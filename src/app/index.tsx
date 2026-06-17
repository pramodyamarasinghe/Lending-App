import { BottomTabBar, type BottomTabKey } from "@/components/bottom-tab-bar";
import { account, clearAuthCredentials } from "@/lib/appwrite";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const metrics = [
  {
    title: "Portfolio Value",
    value: "Rs. 54,420,000",
    subtitle: "+12.4% MoM",
    accent: "#3d5afe",
  },
  {
    title: "Active Loans",
    value: "1,414",
    subtitle: "62 overdue",
    accent: "#ffb300",
  },
  {
    title: "Collections Today",
    value: "Rs. 186,500",
    subtitle: "vs Rs. 160k target",
    accent: "#2ecc71",
  },
  {
    title: "Cash Position",
    value: "Rs. 2,840,000",
    subtitle: "Across 5 branches",
    accent: "#208ae5",
  },
  {
    title: "Outstanding",
    value: "Rs. 8,120,000",
    subtitle: "3.2% of portfolio",
    accent: "#8e44ad",
  },
  {
    title: "Active Customers",
    value: "2,184",
    subtitle: "48 onboarded this week",
    accent: "#2196f3",
  },
];

const collectionsTrendData = [
  { day: "Mon", collected: 24500, target: 30000, date: "Monday, Jun 10" },
  { day: "Tue", collected: 32000, target: 30000, date: "Tuesday, Jun 11" },
  { day: "Wed", collected: 29800, target: 30000, date: "Wednesday, Jun 12" },
  { day: "Thu", collected: 38500, target: 30000, date: "Thursday, Jun 13" },
  { day: "Fri", collected: 15400, target: 30000, date: "Friday, Jun 14" },
  { day: "Sat", collected: 42000, target: 35000, date: "Saturday, Jun 15" },
  { day: "Sun", collected: 48600, target: 35000, date: "Sunday, Jun 16" },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
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

  async function handleLogout() {
    setLoading(true);
    try {
      await account.deleteSession("current");
      await clearAuthCredentials();
      Alert.alert("Success", "Logged out");
      setActiveTab("overview");
      router.replace("/login");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Logout failed");
    } finally {
      setLoading(false);
    }
  }

  const selectedDay = collectionsTrendData[selectedDayIndex];
  const percentDiff = ((selectedDay.collected - selectedDay.target) / selectedDay.target) * 100;
  const isSurpassed = selectedDay.collected >= selectedDay.target;
  const diffText = `${isSurpassed ? "+" : ""}${percentDiff.toFixed(1)}%`;

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
      >
        <View style={styles.header}>
          <View
            style={[styles.headerTop, isCompact && styles.headerTopCompact]}
          >
            <Text style={[styles.pageTitle, { color: colors.titleText }]}>Dashboard</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {metrics.map((item) => (
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
              const maxVal = 55000;
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

        <Pressable
          onPress={handleLogout}
          disabled={loading}
          style={({ pressed }) => [
            styles.logoutBottomButton,
            pressed && !loading && styles.buttonPressed,
            loading && styles.logoutBottomButtonDisabled,
          ]}
          accessibilityLabel="Logout"
        >
          <Text style={styles.logoutBottomText}>
            {loading ? "Signing out..." : "Logout"}
          </Text>
        </Pressable>
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
  logoutBottomButton: {
    marginTop: 20,
    backgroundColor: "#3366ff",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 0,
    marginBottom: 16,
  },
  logoutBottomButtonDisabled: {
    opacity: 0.6,
  },
  logoutBottomText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
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
});
