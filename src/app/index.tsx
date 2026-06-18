import { BottomTabBar, type BottomTabKey } from "@/components/bottom-tab-bar";
import { getLoans, getCustomers, getCollectionRecords } from "@/lib/appwrite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  
  // Database State
  const [loans, setLoans] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [activeTab, setActiveTab] = useState<BottomTabKey>("overview");
  const [selectedDayIndex, setSelectedDayIndex] = useState(6);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const colors = {
    bg: isDark ? "#0f172a" : "#ecf2ff",
    cardBg: isDark ? "#1e293b" : "#ffffff",
    titleText: isDark ? "#ffffff" : "#192a4a",
    bodyText: isDark ? "#94a3b8" : "#6b7a99",
    subtleText: isDark ? "#64748b" : "#8a92a6",
    trackBg: isDark ? "#0f172a" : "#f4f7ff",
    trackActiveBg: isDark ? "#1e293b" : "#e8efff",
    detailCardBg: isDark ? "#0f172a" : "#f4f7ff",
    borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(51, 102, 255, 0.08)",
    chartActiveBorder: isDark ? "rgba(51, 102, 255, 0.6)" : "rgba(51, 102, 255, 0.3)",
  };
  const isCompact = width < 520;
  const cardWidth = isCompact ? "100%" : "48%";
  const safeBottom = insets?.bottom ?? 0;
  const safeTop = insets?.top ?? 0;
  const contentPaddingBottom = safeBottom + 110;

  // Fetch all dashboard stats from database on focus
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [loanDocs, customerDocs, collectionDocs] = await Promise.all([
        getLoans().catch(err => {
          console.log("Failed to load loans from Appwrite, using fallback:", err);
          return null;
        }),
        getCustomers().catch(err => {
          console.log("Failed to load customers from Appwrite, using fallback:", err);
          return null;
        }),
        getCollectionRecords().catch(err => {
          console.log("Failed to load collection records from Appwrite, using fallback:", err);
          return null;
        }),
      ]);

      let finalLoans = loanDocs;
      let finalCustomers = customerDocs;
      let finalCollections = collectionDocs;

      // Caching if remote succeeded
      if (loanDocs && loanDocs.length > 0) {
        try {
          await AsyncStorage.setItem("LENDING_APP_LOANS", JSON.stringify(loanDocs));
        } catch (storageErr) {
          console.log("Failed to cache loans:", storageErr);
        }
      } else {
        try {
          const stored = await AsyncStorage.getItem("LENDING_APP_LOANS");
          if (stored) finalLoans = JSON.parse(stored);
        } catch (storageErr) {
          console.log("Failed to load loans from storage:", storageErr);
        }
      }

      if (customerDocs && customerDocs.length > 0) {
        try {
          await AsyncStorage.setItem("LENDING_APP_CUSTOMERS", JSON.stringify(customerDocs));
        } catch (storageErr) {
          console.log("Failed to cache customers:", storageErr);
        }
      } else {
        try {
          const stored = await AsyncStorage.getItem("LENDING_APP_CUSTOMERS");
          if (stored) finalCustomers = JSON.parse(stored);
        } catch (storageErr) {
          console.log("Failed to load customers from storage:", storageErr);
        }
      }

      if (collectionDocs && collectionDocs.length > 0) {
        try {
          await AsyncStorage.setItem("LENDING_APP_COLLECTIONS", JSON.stringify(collectionDocs));
        } catch (storageErr) {
          console.log("Failed to cache collections:", storageErr);
        }
      } else {
        try {
          const stored = await AsyncStorage.getItem("LENDING_APP_COLLECTIONS");
          if (stored) finalCollections = JSON.parse(stored);
        } catch (storageErr) {
          console.log("Failed to load collections from storage:", storageErr);
        }
      }

      setLoans(finalLoans || []);
      setCustomers(finalCustomers || []);
      setCollections(finalCollections || []);
    } catch (err: any) {
      console.log("loadDashboardData error:", err);
      // Fallback load everything from storage
      try {
        const [storedLoans, storedCusts, storedColls] = await Promise.all([
          AsyncStorage.getItem("LENDING_APP_LOANS"),
          AsyncStorage.getItem("LENDING_APP_CUSTOMERS"),
          AsyncStorage.getItem("LENDING_APP_COLLECTIONS")
        ]);
        if (storedLoans) setLoans(JSON.parse(storedLoans));
        if (storedCusts) setCustomers(JSON.parse(storedCusts));
        if (storedColls) setCollections(JSON.parse(storedColls));
      } catch (storageErr) {
        console.log("Storage retrieval fallback failed:", storageErr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };



  // Recent Collections Activity
  const recentCollections = useMemo(() => {
    return [...collections]
      .filter(c => c.status === "Collected")
      .slice(0, 3);
  }, [collections]);

  // Memoized dynamic metric computations
  const activeLoansList = useMemo(() => {
    return loans.filter(l => l.status?.toLowerCase() !== 'closed');
  }, [loans]);

  const portfolioValue = useMemo(() => {
    return activeLoansList.reduce((sum, l) => sum + (l.amount || 0), 0);
  }, [activeLoansList]);

  const activeLoansCount = activeLoansList.length;

  const overdueLoansCount = useMemo(() => {
    return activeLoansList.filter(l => l.status?.toLowerCase() === 'overdue' || l.status?.toLowerCase().includes('behind')).length;
  }, [activeLoansList]);

  const todayLabel = useMemo(() => {
    const now = new Date();
    const standardMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${standardMonths[now.getMonth()]} ${now.getDate()}`;
  }, []);

  const collectionsTodayVal = useMemo(() => {
    return collections
      .filter(c => c.date === todayLabel && c.status === "Collected")
      .reduce((sum, c) => sum + (c.amount || 0), 0);
  }, [collections, todayLabel]);

  const cashPositionVal = useMemo(() => {
    return collections
      .filter(c => c.status === "Collected")
      .reduce((sum, c) => sum + (c.amount || 0), 0);
  }, [collections]);

  const uniqueBranchesCount = useMemo(() => {
    const branches = loans.map(l => l.branch).filter(Boolean);
    return Array.from(new Set(branches)).length;
  }, [loans]);

  const outstandingVal = useMemo(() => {
    return activeLoansList.reduce((sum, l) => sum + (l.outstanding || 0), 0);
  }, [activeLoansList]);

  const outstandingPct = useMemo(() => {
    if (portfolioValue <= 0) return "0.0";
    return ((outstandingVal / portfolioValue) * 100).toFixed(1);
  }, [outstandingVal, portfolioValue]);

  const customersWithActiveLoansCount = useMemo(() => {
    const custIds = activeLoansList.map(l => l.customerId).filter(Boolean);
    return Array.from(new Set(custIds)).length;
  }, [activeLoansList]);

  const computedMetrics = useMemo(() => {
    return [
      {
        title: "Portfolio Value",
        value: `Rs. ${portfolioValue.toLocaleString()}`,
        subtitle: `Across ${activeLoansCount} active agreements`,
        accent: "#3d5afe",
      },
      {
        title: "Active Loans",
        value: activeLoansCount.toLocaleString(),
        subtitle: `${overdueLoansCount} overdue`,
        accent: "#ffb300",
      },
      {
        title: "Collections Today",
        value: `Rs. ${collectionsTodayVal.toLocaleString()}`,
        subtitle: "vs Rs. 30k target",
        accent: "#2ecc71",
      },
      {
        title: "Cash Position",
        value: `Rs. ${cashPositionVal.toLocaleString()}`,
        subtitle: `Across ${uniqueBranchesCount || 1} branch${uniqueBranchesCount !== 1 ? 'es' : ''}`,
        accent: "#208ae5",
      },
      {
        title: "Outstanding",
        value: `Rs. ${outstandingVal.toLocaleString()}`,
        subtitle: `${outstandingPct}% of portfolio`,
        accent: "#8e44ad",
      },
      {
        title: "Active Customers",
        value: customers.length.toLocaleString(),
        subtitle: `${customersWithActiveLoansCount} with active loans`,
        accent: "#2196f3",
      },
    ];
  }, [
    portfolioValue,
    activeLoansCount,
    overdueLoansCount,
    collectionsTodayVal,
    cashPositionVal,
    uniqueBranchesCount,
    outstandingVal,
    outstandingPct,
    customers.length,
    customersWithActiveLoansCount,
  ]);

  // Compute 7-day collections trend dynamically based on database entries
  const collectionsTrendData = useMemo(() => {
    const data = [];
    const standardMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const fullDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    // Find the latest collection date in database or today, whichever is later
    let endDate = new Date();
    
    collections.forEach(c => {
      if (c.date && c.status === "Collected") {
        const parts = c.date.split(" ");
        if (parts.length === 2) {
          const monthIndex = standardMonths.indexOf(parts[0]);
          const dayNum = parseInt(parts[1], 10);
          if (monthIndex !== -1 && !isNaN(dayNum)) {
            const collDate = new Date();
            collDate.setMonth(monthIndex);
            collDate.setDate(dayNum);
            
            // Set times to mid-day to normalize comparison
            collDate.setHours(12, 0, 0, 0);
            
            const compareDate = new Date(endDate);
            compareDate.setHours(12, 0, 0, 0);
            
            if (collDate > compareDate) {
              endDate = collDate;
            }
          }
        }
      }
    });
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(endDate.getDate() - i);
      const dateLabel = `${standardMonths[d.getMonth()]} ${d.getDate()}`;
      const dayNameShort = dayNames[d.getDay()];
      const dayNameFull = fullDayNames[d.getDay()];
      
      const dailyCollected = collections
        .filter(c => c.date === dateLabel && c.status === "Collected")
        .reduce((sum, c) => sum + (c.amount || 0), 0);
        
      const target = (dayNameShort === "Sat" || dayNameShort === "Sun") ? 35000 : 30000;
      
      data.push({
        day: dayNameShort,
        collected: dailyCollected,
        target,
        date: `${dayNameFull}, ${dateLabel}`,
      });
    }
    return data;
  }, [collections]);

  const maxCollectedScale = useMemo(() => {
    const maxCollected = Math.max(...collectionsTrendData.map(d => d.collected), ...collectionsTrendData.map(d => d.target));
    return maxCollected > 0 ? maxCollected * 1.1 : 55000;
  }, [collectionsTrendData]);

  const selectedDay = collectionsTrendData[selectedDayIndex] || { day: "", collected: 0, target: 30000, date: "" };
  const percentDiff = selectedDay.target > 0 ? ((selectedDay.collected - selectedDay.target) / selectedDay.target) * 100 : 0;
  const isSurpassed = selectedDay.collected >= selectedDay.target;
  const diffText = `${isSurpassed ? "+" : ""}${percentDiff.toFixed(1)}%`;

  if (loading) {
    return (
      <View style={[styles.page, { justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color="#3366ff" />
        <Text style={{ marginTop: 12, color: colors.bodyText, fontWeight: "600" }}>Loading dashboard analytics...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: safeTop + 16,
            paddingBottom: contentPaddingBottom,
            paddingHorizontal: isCompact ? 16 : 24,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadDashboardData(true)} colors={["#3366ff"]} />
        }
      >
        <View style={styles.header}>
          <View
            style={[styles.headerTop, isCompact && styles.headerTopCompact]}
          >
            <Text style={[styles.pageTitle, { color: colors.titleText }]}>Dashboard</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {computedMetrics.map((item) => (
            <View
              key={item.title}
              style={[styles.metricCard, { width: cardWidth, backgroundColor: colors.cardBg }]}
            >
              <View
                style={[styles.metricAccent, { backgroundColor: item.accent }]}
              />
              <Text style={[styles.metricTitle, { color: colors.subtleText }]}>{item.title}</Text>
              <Text style={[styles.metricValue, { color: colors.titleText }]}>{item.value}</Text>
              <Text style={[styles.metricSubtitle, { color: colors.bodyText }]}>{item.subtitle}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.cardBg }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.titleText }]}>Collections Trend</Text>
            <Text style={[styles.sectionCaption, { color: colors.bodyText }]}>
              Last 7 days · Tap a day to inspect details
            </Text>
          </View>

          {/* Dynamic Details Panel */}
          <View style={[styles.activeDayDetailCard, { backgroundColor: colors.detailCardBg, borderColor: colors.borderColor }]}>
            <View style={styles.detailHeaderRow}>
              <Text style={[styles.detailDateText, { color: colors.titleText }]}>{selectedDay.date}</Text>
              <View style={[
                styles.statusBadge,
                isSurpassed ? styles.statusBadgeSurpassed : styles.statusBadgeBelow
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  isSurpassed ? styles.statusBadgeTextSurpassed : styles.statusBadgeTextBelow
                ]}>
                  {isSurpassed ? "Surpassed" : "Below Target"} ({diffText})
                </Text>
              </View>
            </View>

            <View style={styles.detailStatsRow}>
              <View style={styles.statColumn}>
                <Text style={[styles.statLabel, { color: colors.subtleText }]}>COLLECTED</Text>
                <Text style={styles.statValue}>
                  Rs. {selectedDay.collected.toLocaleString()}
                </Text>
              </View>
              <View style={styles.statColumn}>
                <Text style={[styles.statLabel, { color: colors.subtleText }]}>TARGET</Text>
                <Text style={[styles.statValue, styles.statValueSecondary, { color: colors.titleText }]}>
                  Rs. {selectedDay.target.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Interactive Custom Bar Chart */}
          <View style={styles.interactiveChartContainer}>
            {collectionsTrendData.map((item, idx) => {
              const isActive = idx === selectedDayIndex;
              const maxVal = maxCollectedScale;
              const collectedHeight = Math.min((item.collected / maxVal) * 100, 100);
              const targetHeight = Math.min((item.target / maxVal) * 100, 100);

              return (
                <Pressable
                  key={item.day}
                  onPress={() => setSelectedDayIndex(idx)}
                  style={styles.chartColButton}
                >
                  <View style={[
                    styles.chartColTrack,
                    { backgroundColor: colors.trackBg },
                    isActive && [styles.chartColTrackActive, { backgroundColor: colors.trackActiveBg, borderColor: colors.chartActiveBorder }]
                  ]}>
                    {/* Target indicator line */}
                    <View style={[
                      styles.chartTargetLine,
                      { bottom: `${targetHeight}%` }
                    ]} />

                    {/* Collected Bar */}
                    <View style={[
                      styles.chartCollectedBar,
                      { height: `${collectedHeight}%` },
                      isActive ? styles.chartCollectedBarActive : styles.chartCollectedBarInactive,
                      item.collected >= item.target ? styles.barSurpassedColor : styles.barBelowColor
                    ]} />
                  </View>
                  <Text style={[
                    styles.chartDayLabel,
                    { color: colors.subtleText },
                    isActive && styles.chartDayLabelActive
                  ]}>
                    {item.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Legends */}
          <View style={styles.chartLegendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#3366ff" }]} />
              <Text style={[styles.legendLabel, { color: colors.bodyText }]}>Surpassed Target</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#ff4d4f" }]} />
              <Text style={[styles.legendLabel, { color: colors.bodyText }]}>Below Target</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendTargetLine} />
              <Text style={[styles.legendLabel, { color: colors.bodyText }]}>Target Line</Text>
            </View>
          </View>
        </View>


        {/* Recent Activities Feed Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.cardBg }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.titleText }]}>Recent Collections</Text>
            <Text style={[styles.sectionCaption, { color: colors.bodyText }]}>Latest 3 payments registered to Appwrite</Text>
          </View>
          {recentCollections.length === 0 ? (
            <Text style={[styles.emptySectionText, { color: colors.bodyText }]}>No collections recorded in the database yet.</Text>
          ) : (
            <View style={{ gap: 12 }}>
              {recentCollections.map((item) => (
                <View key={item.receiptId || item.$id} style={[styles.recentActivityRow, { backgroundColor: colors.detailCardBg, borderColor: colors.borderColor }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recentCustomerName, { color: colors.titleText }]}>{item.customerName}</Text>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 4, alignItems: "center" }}>
                      <Text style={[styles.recentMetaText, { color: colors.subtleText }]}>{item.date} · {item.time}</Text>
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.borderColor }} />
                      <Text style={[styles.recentMetaText, { color: colors.subtleText }]}>{item.collectorName}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[styles.recentAmountText, { color: "#2ecc71" }]}>+ Rs. {item.amount?.toLocaleString()}</Text>
                    <Text style={{ fontSize: 10, color: colors.subtleText, fontWeight: "600" }}>{item.receiptId}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <BottomTabBar activeTab={activeTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#ecf2ff",
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 18,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#192a4a",
    marginBottom: 0,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  headerTopCompact: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  tabBarContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  glassContainer: {
    overflow: "hidden",
  },
  glassBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    backdropFilter: "blur(12px)",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
  },
  metricCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    width: "48%",
    minWidth: "48%",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  metricAccent: {
    width: 48,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  metricTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8a92a6",
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#192a4a",
    marginBottom: 8,
  },
  metricSubtitle: {
    fontSize: 12,
    color: "#6b7a99",
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#192a4a",
  },
  sectionCaption: {
    fontSize: 13,
    color: "#6b7a99",
    marginTop: 6,
  },
  chartLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 18,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: 13,
    color: "#6b7a99",
    fontWeight: "500",
  },
  legendTargetLine: {
    width: 16,
    height: 2,
    backgroundColor: "#ffa940",
    borderRadius: 1,
  },
  activeDayDetailCard: {
    backgroundColor: "#f4f7ff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(51, 102, 255, 0.08)",
  },
  detailHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  detailDateText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#192a4a",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeSurpassed: {
    backgroundColor: "rgba(46, 204, 113, 0.15)",
  },
  statusBadgeBelow: {
    backgroundColor: "rgba(255, 77, 79, 0.15)",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusBadgeTextSurpassed: {
    color: "#27ae60",
  },
  statusBadgeTextBelow: {
    color: "#ff4d4f",
  },
  detailStatsRow: {
    flexDirection: "row",
    gap: 24,
  },
  statColumn: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#8a92a6",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#3366ff",
  },
  statValueSecondary: {
    color: "#192a4a",
  },
  interactiveChartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 180,
    paddingVertical: 10,
  },
  chartColButton: {
    flex: 1,
    alignItems: "center",
  },
  chartColTrack: {
    width: 24,
    height: 140,
    backgroundColor: "#f4f7ff",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    justifyContent: "flex-end",
  },
  chartColTrackActive: {
    backgroundColor: "#e8efff",
    borderWidth: 1,
    borderColor: "rgba(51, 102, 255, 0.3)",
  },
  chartTargetLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#ffa940",
    zIndex: 2,
  },
  chartCollectedBar: {
    width: "100%",
    borderRadius: 8,
  },
  chartCollectedBarActive: {
    opacity: 1,
  },
  chartCollectedBarInactive: {
    opacity: 0.75,
  },
  barSurpassedColor: {
    backgroundColor: "#3366ff",
  },
  barBelowColor: {
    backgroundColor: "#ff4d4f",
  },
  chartDayLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8a92a6",
    marginTop: 8,
  },
  chartDayLabelActive: {
    color: "#3366ff",
    fontWeight: "700",
  },
  emptySectionText: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 20,
    fontStyle: "italic",
  },

  recentActivityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  recentCustomerName: {
    fontSize: 14,
    fontWeight: "700",
  },
  recentMetaText: {
    fontSize: 11,
    fontWeight: "500",
  },
  recentAmountText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
