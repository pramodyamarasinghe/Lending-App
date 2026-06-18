import { BottomTabBar } from "@/components/bottom-tab-bar";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
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
import { Ionicons } from "@expo/vector-icons";
import { getLoans } from "@/lib/appwrite";

interface Loan {
  $id?: string;
  id: string;
  customerName: string;
  branch: string;
  loanType: "Daily" | "Weekly" | "Monthly";
  collector: string;
  amount: number;
  interestRate: number;
  duration: number;
  disbursementDate: string;
  outstanding: number;
  paidAmount: number;
  status: string;
}

export default function ProfitScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const safeBottom = insets?.bottom ?? 0;
  const safeTop = insets?.top ?? 0;
  const contentPaddingBottom = safeBottom + 110;

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const isCompact = width < 768;
  const isDesktop = width >= 1024;

  // States
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "branch" | "collector" | "type">("overview");

  const colors = {
    bg: isDark ? "#0f172a" : "#f8fafc",
    cardBg: isDark ? "#1e293b" : "#ffffff",
    titleText: isDark ? "#ffffff" : "#0f172a",
    bodyText: isDark ? "#94a3b8" : "#475569",
    subtleText: isDark ? "#64748b" : "#94a3b8",
    borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
    dividerColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#f1f5f9",
    
    // Profit & Loss specific colors
    profitGradStart: "#10b981",
    profitGradEnd: "#059669",
    lossGradStart: "#ef4444",
    lossGradEnd: "#dc2626",
    neutralGradStart: "#6366f1",
    neutralGradEnd: "#4f46e5",

    profitBg: isDark ? "rgba(16, 185, 129, 0.12)" : "#ecfdf5",
    profitText: "#10b981",
    lossBg: isDark ? "rgba(239, 68, 68, 0.12)" : "#fef2f2",
    lossText: "#ef4444",
    infoBg: isDark ? "rgba(99, 102, 241, 0.12)" : "#e0e7ff",
    infoText: "#6366f1",
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const loanDocs = await getLoans();
      const mapped: Loan[] = loanDocs.map((doc: any) => ({
        $id: doc.$id,
        id: doc.$id || doc.loanId,
        customerName: doc.customerName,
        branch: doc.branch || "Unknown",
        loanType: doc.loanType as "Daily" | "Weekly" | "Monthly",
        collector: doc.collector || "Unknown",
        amount: doc.amount,
        interestRate: doc.interestRate,
        duration: doc.duration,
        disbursementDate: doc.disbursementDate,
        outstanding: doc.outstanding,
        paidAmount: doc.paidAmount,
        status: doc.status || "active",
      }));
      setLoans(mapped);
    } catch (err) {
      console.log("Profit screen loadData error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Profit and Loss Calculations
  const calculatedMetrics = useMemo(() => {
    let totalDisbursed = 0;
    let totalInterestCollected = 0;
    let totalOverdueLosses = 0;
    let totalUnrealizedInterest = 0;
    let totalPrincipalRecovered = 0;

    loans.forEach((loan) => {
      const isOverdue = loan.status?.toLowerCase() === "overdue" || loan.status?.toLowerCase()?.includes("behind");
      
      // Expected flat interest for the loan
      const expectedInterest = loan.amount * (loan.interestRate / 100);
      const totalRepayable = loan.amount + expectedInterest;
      
      // Pro-rata factor representing interest proportion
      const interestFactor = totalRepayable > 0 ? (expectedInterest / totalRepayable) : 0;
      
      // Realized Interest (Profit)
      const realizedInterest = loan.paidAmount * interestFactor;
      // Realized Principal Recovered
      const realizedPrincipal = loan.paidAmount - realizedInterest;

      totalDisbursed += loan.amount;
      totalInterestCollected += realizedInterest;
      totalPrincipalRecovered += realizedPrincipal;

      if (isOverdue) {
        // Overdue outstanding balance is counted as loss / risk
        totalOverdueLosses += loan.outstanding;
      } else {
        // Healthy outstanding interest is unrealized profit
        totalUnrealizedInterest += loan.outstanding * interestFactor;
      }
    });

    const netRealized = totalInterestCollected - totalOverdueLosses;

    return {
      totalDisbursed,
      totalInterestCollected,
      totalOverdueLosses,
      totalUnrealizedInterest,
      totalPrincipalRecovered,
      netRealized,
    };
  }, [loans]);

  // Grouped Breakdowns calculations
  const groupedData = useMemo(() => {
    const branchMap: { [key: string]: { name: string; profit: number; loss: number; count: number } } = {};
    const collectorMap: { [key: string]: { name: string; profit: number; loss: number; count: number } } = {};
    const typeMap: { [key: string]: { name: string; profit: number; loss: number; count: number } } = {
      Daily: { name: "Daily", profit: 0, loss: 0, count: 0 },
      Weekly: { name: "Weekly", profit: 0, loss: 0, count: 0 },
      Monthly: { name: "Monthly", profit: 0, loss: 0, count: 0 },
    };

    loans.forEach((loan) => {
      const isOverdue = loan.status?.toLowerCase() === "overdue" || loan.status?.toLowerCase()?.includes("behind");
      const expectedInterest = loan.amount * (loan.interestRate / 100);
      const totalRepayable = loan.amount + expectedInterest;
      const interestFactor = totalRepayable > 0 ? (expectedInterest / totalRepayable) : 0;
      const realizedInterest = loan.paidAmount * interestFactor;
      const overdueLoss = isOverdue ? loan.outstanding : 0;

      // Group by Branch
      const bKey = loan.branch || "Unknown";
      if (!branchMap[bKey]) {
        branchMap[bKey] = { name: bKey, profit: 0, loss: 0, count: 0 };
      }
      branchMap[bKey].profit += realizedInterest;
      branchMap[bKey].loss += overdueLoss;
      branchMap[bKey].count += 1;

      // Group by Collector
      const cKey = loan.collector || "Unknown";
      if (!collectorMap[cKey]) {
        collectorMap[cKey] = { name: cKey, profit: 0, loss: 0, count: 0 };
      }
      collectorMap[cKey].profit += realizedInterest;
      collectorMap[cKey].loss += overdueLoss;
      collectorMap[cKey].count += 1;

      // Group by Loan Type
      const tKey = loan.loanType;
      if (typeMap[tKey]) {
        typeMap[tKey].profit += realizedInterest;
        typeMap[tKey].loss += overdueLoss;
        typeMap[tKey].count += 1;
      }
    });

    return {
      branches: Object.values(branchMap),
      collectors: Object.values(collectorMap),
      types: Object.values(typeMap).filter(t => t.count > 0),
    };
  }, [loans]);

  if (loading) {
    return (
      <View style={[styles.page, { justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={{ marginTop: 12, color: colors.bodyText, fontWeight: "600" }}>Analyzing portfolio...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: safeTop, backgroundColor: colors.bg }]}>
      
      <ScrollView
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: contentPaddingBottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={["#6366f1"]} />
        }
      >
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.titleText }]}>Profit & Loss</Text>
          <Text style={[styles.subtitle, { color: colors.bodyText }]}>
            Realized collections, default write-offs, and risk indicators
          </Text>
        </View>

        {/* Net Bottom Line Summary Card */}
        <View
          style={[
            styles.netCard,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.borderColor,
            },
          ]}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <View>
              <Text style={[styles.netLabel, { color: colors.subtleText }]}>NET REALIZED MARGIN</Text>
              <Text
                style={[
                  styles.netValue,
                  {
                    color: calculatedMetrics.netRealized >= 0 ? colors.profitText : colors.lossText,
                  },
                ]}
              >
                {calculatedMetrics.netRealized >= 0 ? "+" : ""}
                Rs. {Math.round(calculatedMetrics.netRealized).toLocaleString()}
              </Text>
            </View>
            
            <View
              style={[
                styles.netBadge,
                {
                  backgroundColor: calculatedMetrics.netRealized >= 0 ? colors.profitBg : colors.lossBg,
                },
              ]}
            >
              <Ionicons
                name={calculatedMetrics.netRealized >= 0 ? "trending-up" : "trending-down"}
                size={18}
                color={calculatedMetrics.netRealized >= 0 ? colors.profitText : colors.lossText}
              />
              <Text
                style={[
                  styles.netBadgeText,
                  { color: calculatedMetrics.netRealized >= 0 ? colors.profitText : colors.lossText },
                ]}
              >
                {calculatedMetrics.netRealized >= 0 ? "Net Profit" : "Net Deficit"}
              </Text>
            </View>
          </View>
          
          <View style={[styles.cardDivider, { backgroundColor: colors.dividerColor }]} />
          
          <Text style={[styles.netSummaryDesc, { color: colors.bodyText }]}>
            This position sums all **Realized Interest Collected** (Rs. {Math.round(calculatedMetrics.totalInterestCollected).toLocaleString()}) and subtracts **Active Overdue Default Balances** (Rs. {Math.round(calculatedMetrics.totalOverdueLosses).toLocaleString()}).
          </Text>
        </View>

        {/* Metrics Grid Row */}
        <View style={[styles.metricsRow, isCompact && styles.metricsRowColumn]}>
          <View style={[styles.metricBox, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
            <View style={[styles.iconFrame, { backgroundColor: colors.profitBg }]}>
              <Ionicons name="gift-outline" size={18} color={colors.profitText} />
            </View>
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.metricBoxLabel, { color: colors.subtleText }]}>INTEREST REVENUE (PROFIT)</Text>
              <Text style={[styles.metricBoxValue, { color: colors.titleText }]}>
                Rs. {Math.round(calculatedMetrics.totalInterestCollected).toLocaleString()}
              </Text>
              <Text style={[styles.metricBoxDesc, { color: colors.subtleText }]}>Pro-rata collected interest</Text>
            </View>
          </View>

          <View style={[styles.metricBox, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
            <View style={[styles.iconFrame, { backgroundColor: colors.lossBg }]}>
              <Ionicons name="skull-outline" size={18} color={colors.lossText} />
            </View>
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.metricBoxLabel, { color: colors.subtleText }]}>OVERDUE DEFAULTS (LOSS)</Text>
              <Text style={[styles.metricBoxValue, { color: colors.titleText }]}>
                Rs. {Math.round(calculatedMetrics.totalOverdueLosses).toLocaleString()}
              </Text>
              <Text style={[styles.metricBoxDesc, { color: colors.subtleText }]}>Outstanding balance on overdue loans</Text>
            </View>
          </View>

          <View style={[styles.metricBox, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
            <View style={[styles.iconFrame, { backgroundColor: colors.infoBg }]}>
              <Ionicons name="sparkles-outline" size={18} color={colors.infoText} />
            </View>
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.metricBoxLabel, { color: colors.subtleText }]}>EXPECTED (UNREALIZED)</Text>
              <Text style={[styles.metricBoxValue, { color: colors.titleText }]}>
                Rs. {Math.round(calculatedMetrics.totalUnrealizedInterest).toLocaleString()}
              </Text>
              <Text style={[styles.metricBoxDesc, { color: colors.subtleText }]}>Receivable interest from active loans</Text>
            </View>
          </View>
        </View>

        {/* Segmented Toggles */}
        <View style={styles.segmentWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {(["overview", "branch", "collector", "type"] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tabButton,
                  { backgroundColor: colors.cardBg, borderColor: colors.borderColor },
                  activeTab === tab && { backgroundColor: "#6366f1", borderColor: "#6366f1" },
                ]}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    { color: colors.titleText },
                    activeTab === tab && { color: "#ffffff", fontWeight: "700" },
                  ]}
                >
                  {tab === "overview"
                    ? "Loan Overview"
                    : tab === "branch"
                    ? "By Branch"
                    : tab === "collector"
                    ? "By Collector"
                    : "By Loan Type"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Data Table / Content Display */}
        <View style={[styles.tableContainer, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
          {activeTab === "overview" && (
            <View>
              <Text style={[styles.tableSectionTitle, { color: colors.titleText }]}>Individual Loan P&L Analysis</Text>
              <Text style={[styles.tableSectionDesc, { color: colors.bodyText }]}>
                List of all contracts in database with their specific interest profits and outstanding risk.
              </Text>

              {isCompact ? (
                /* Compact List View */
                <View style={{ marginTop: 16 }}>
                  {loans.map((loan) => {
                    const expectedInterest = loan.amount * (loan.interestRate / 100);
                    const totalRepayable = loan.amount + expectedInterest;
                    const interestFactor = totalRepayable > 0 ? (expectedInterest / totalRepayable) : 0;
                    const realizedInterest = loan.paidAmount * interestFactor;
                    const isOverdue = loan.status?.toLowerCase() === "overdue" || loan.status?.toLowerCase()?.includes("behind");

                    return (
                      <View key={loan.id} style={[styles.cardItemRow, { borderBottomColor: colors.dividerColor }]}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                          <View>
                            <Text style={[styles.itemTextBold, { color: colors.titleText }]}>{loan.customerName}</Text>
                            <Text style={[styles.itemTextSub, { color: colors.subtleText }]}>{loan.id} · {loan.loanType}</Text>
                          </View>
                          <View style={[styles.badgeContainer, { backgroundColor: isOverdue ? colors.lossBg : colors.profitBg }]}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: isOverdue ? colors.lossText : colors.profitText }}>
                              {loan.status}
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                          <Text style={{ fontSize: 13, color: colors.bodyText }}>
                            Profit: <Text style={{ fontWeight: "700", color: colors.profitText }}>Rs. {Math.round(realizedInterest).toLocaleString()}</Text>
                          </Text>
                          <Text style={{ fontSize: 13, color: colors.bodyText }}>
                            Loss Risk: <Text style={{ fontWeight: "700", color: isOverdue ? colors.lossText : colors.bodyText }}>Rs. {Math.round(loan.outstanding).toLocaleString()}</Text>
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                /* Wide Grid View */
                <View style={styles.gridTable}>
                  <View style={[styles.gridHeader, { backgroundColor: colors.bg, borderColor: colors.borderColor }]}>
                    <Text style={[styles.gridTh, { flex: 1.2, color: colors.subtleText }]}>Loan ID</Text>
                    <Text style={[styles.gridTh, { flex: 2, color: colors.subtleText }]}>Customer</Text>
                    <Text style={[styles.gridTh, { flex: 1.5, color: colors.subtleText }]}>Disbursed</Text>
                    <Text style={[styles.gridTh, { flex: 1.8, color: colors.subtleText }]}>Realized Profit (Int)</Text>
                    <Text style={[styles.gridTh, { flex: 1.8, color: colors.subtleText }]}>Outstanding (Risk)</Text>
                    <Text style={[styles.gridTh, { flex: 1.2, textAlign: "center", color: colors.subtleText }]}>Status</Text>
                  </View>

                  {loans.map((loan) => {
                    const expectedInterest = loan.amount * (loan.interestRate / 100);
                    const totalRepayable = loan.amount + expectedInterest;
                    const interestFactor = totalRepayable > 0 ? (expectedInterest / totalRepayable) : 0;
                    const realizedInterest = loan.paidAmount * interestFactor;
                    const isOverdue = loan.status?.toLowerCase() === "overdue" || loan.status?.toLowerCase()?.includes("behind");

                    return (
                      <View key={loan.id} style={[styles.gridRow, { borderBottomColor: colors.dividerColor }]}>
                        <Text style={[styles.gridTd, { flex: 1.2, color: colors.titleText, fontWeight: "600" }]}>{loan.id}</Text>
                        <Text style={[styles.gridTd, { flex: 2, color: colors.titleText, fontWeight: "700" }]}>{loan.customerName}</Text>
                        <Text style={[styles.gridTd, { flex: 1.5, color: colors.bodyText }]}>Rs. {loan.amount.toLocaleString()}</Text>
                        <Text style={[styles.gridTd, { flex: 1.8, color: colors.profitText, fontWeight: "700" }]}>
                          Rs. {Math.round(realizedInterest).toLocaleString()}
                        </Text>
                        <Text style={[styles.gridTd, { flex: 1.8, color: isOverdue ? colors.lossText : colors.bodyText, fontWeight: "700" }]}>
                          Rs. {Math.round(loan.outstanding).toLocaleString()}
                        </Text>
                        <View style={{ flex: 1.2, alignItems: "center", justifyContent: "center" }}>
                          <View style={[styles.badgeContainer, { backgroundColor: isOverdue ? colors.lossBg : colors.profitBg }]}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: isOverdue ? colors.lossText : colors.profitText }}>
                              {loan.status}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {activeTab === "branch" && (
            <View>
              <Text style={[styles.tableSectionTitle, { color: colors.titleText }]}>P&L Breakdown By Branch</Text>
              <Text style={[styles.tableSectionDesc, { color: colors.bodyText }]}>
                Summarized earnings performance across all operational branches.
              </Text>
              
              <View style={styles.groupGrid}>
                <View style={[styles.gridHeader, { backgroundColor: colors.bg, borderColor: colors.borderColor }]}>
                  <Text style={[styles.gridTh, { flex: 2, color: colors.subtleText }]}>Branch Name</Text>
                  <Text style={[styles.gridTh, { flex: 1.2, color: colors.subtleText }]}>Loans</Text>
                  <Text style={[styles.gridTh, { flex: 2, color: colors.subtleText }]}>Collected Interest</Text>
                  <Text style={[styles.gridTh, { flex: 2, color: colors.subtleText }]}>Overdue Default</Text>
                  <Text style={[styles.gridTh, { flex: 2, textAlign: "right", color: colors.subtleText }]}>Net Income</Text>
                </View>

                {groupedData.branches.map((b) => {
                  const branchNet = b.profit - b.loss;
                  return (
                    <View key={b.name} style={[styles.gridRow, { borderBottomColor: colors.dividerColor }]}>
                      <Text style={[styles.gridTd, { flex: 2, color: colors.titleText, fontWeight: "700" }]}>{b.name}</Text>
                      <Text style={[styles.gridTd, { flex: 1.2, color: colors.bodyText }]}>{b.count} active</Text>
                      <Text style={[styles.gridTd, { flex: 2, color: colors.profitText, fontWeight: "600" }]}>
                        Rs. {Math.round(b.profit).toLocaleString()}
                      </Text>
                      <Text style={[styles.gridTd, { flex: 2, color: colors.lossText, fontWeight: "600" }]}>
                        Rs. {Math.round(b.loss).toLocaleString()}
                      </Text>
                      <Text style={[styles.gridTd, { flex: 2, textAlign: "right", color: branchNet >= 0 ? colors.profitText : colors.lossText, fontWeight: "700" }]}>
                        Rs. {Math.round(branchNet).toLocaleString()}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {activeTab === "collector" && (
            <View>
              <Text style={[styles.tableSectionTitle, { color: colors.titleText }]}>P&L Breakdown By Collector</Text>
              <Text style={[styles.tableSectionDesc, { color: colors.bodyText }]}>
                Summarized collection metrics and outstanding debt defaults grouped by assigned field collectors.
              </Text>
              
              <View style={styles.groupGrid}>
                <View style={[styles.gridHeader, { backgroundColor: colors.bg, borderColor: colors.borderColor }]}>
                  <Text style={[styles.gridTh, { flex: 2, color: colors.subtleText }]}>Collector Name</Text>
                  <Text style={[styles.gridTh, { flex: 1.2, color: colors.subtleText }]}>Portfolios</Text>
                  <Text style={[styles.gridTh, { flex: 2, color: colors.subtleText }]}>Collected Interest</Text>
                  <Text style={[styles.gridTh, { flex: 2, color: colors.subtleText }]}>Overdue Default</Text>
                  <Text style={[styles.gridTh, { flex: 2, textAlign: "right", color: colors.subtleText }]}>Net Income</Text>
                </View>

                {groupedData.collectors.map((c) => {
                  const collectorNet = c.profit - c.loss;
                  return (
                    <View key={c.name} style={[styles.gridRow, { borderBottomColor: colors.dividerColor }]}>
                      <Text style={[styles.gridTd, { flex: 2, color: colors.titleText, fontWeight: "700" }]}>{c.name}</Text>
                      <Text style={[styles.gridTd, { flex: 1.2, color: colors.bodyText }]}>{c.count} portfolios</Text>
                      <Text style={[styles.gridTd, { flex: 2, color: colors.profitText, fontWeight: "600" }]}>
                        Rs. {Math.round(c.profit).toLocaleString()}
                      </Text>
                      <Text style={[styles.gridTd, { flex: 2, color: colors.lossText, fontWeight: "600" }]}>
                        Rs. {Math.round(c.loss).toLocaleString()}
                      </Text>
                      <Text style={[styles.gridTd, { flex: 2, textAlign: "right", color: collectorNet >= 0 ? colors.profitText : colors.lossText, fontWeight: "700" }]}>
                        Rs. {Math.round(collectorNet).toLocaleString()}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {activeTab === "type" && (
            <View>
              <Text style={[styles.tableSectionTitle, { color: colors.titleText }]}>P&L Breakdown By Loan Type</Text>
              <Text style={[styles.tableSectionDesc, { color: colors.bodyText }]}>
                Analysis of profitability and write-off metrics grouped by Daily, Weekly, or Monthly installment plans.
              </Text>
              
              <View style={styles.groupGrid}>
                <View style={[styles.gridHeader, { backgroundColor: colors.bg, borderColor: colors.borderColor }]}>
                  <Text style={[styles.gridTh, { flex: 2, color: colors.subtleText }]}>Loan Type</Text>
                  <Text style={[styles.gridTh, { flex: 1.2, color: colors.subtleText }]}>Installments</Text>
                  <Text style={[styles.gridTh, { flex: 2, color: colors.subtleText }]}>Collected Interest</Text>
                  <Text style={[styles.gridTh, { flex: 2, color: colors.subtleText }]}>Overdue Default</Text>
                  <Text style={[styles.gridTh, { flex: 2, textAlign: "right", color: colors.subtleText }]}>Net Income</Text>
                </View>

                {groupedData.types.map((t) => {
                  const typeNet = t.profit - t.loss;
                  return (
                    <View key={t.name} style={[styles.gridRow, { borderBottomColor: colors.dividerColor }]}>
                      <Text style={[styles.gridTd, { flex: 2, color: colors.titleText, fontWeight: "700" }]}>{t.name}</Text>
                      <Text style={[styles.gridTd, { flex: 1.2, color: colors.bodyText }]}>{t.count} active</Text>
                      <Text style={[styles.gridTd, { flex: 2, color: colors.profitText, fontWeight: "600" }]}>
                        Rs. {Math.round(t.profit).toLocaleString()}
                      </Text>
                      <Text style={[styles.gridTd, { flex: 2, color: colors.lossText, fontWeight: "600" }]}>
                        Rs. {Math.round(t.loss).toLocaleString()}
                      </Text>
                      <Text style={[styles.gridTd, { flex: 2, textAlign: "right", color: typeNet >= 0 ? colors.profitText : colors.lossText, fontWeight: "700" }]}>
                        Rs. {Math.round(typeNet).toLocaleString()}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

      </ScrollView>
      <BottomTabBar activeTab="profit" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContainer: {
    padding: 24,
    maxWidth: 1400,
    alignSelf: "center",
    width: "100%",
  },
  titleContainer: {
    marginBottom: 24,
    marginTop: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 6,
    fontWeight: "500",
  },
  
  // Summary Net Card
  netCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    marginBottom: 24,
  },
  netLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  netValue: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
  },
  netBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  netBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  cardDivider: {
    height: 1,
    marginVertical: 18,
  },
  netSummaryDesc: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  // Metric grid columns
  metricsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 28,
  },
  metricsRowColumn: {
    flexDirection: "column",
  },
  metricBox: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  iconFrame: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  metricBoxLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  metricBoxValue: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  metricBoxDesc: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
  },

  // Segment toggles
  segmentWrapper: {
    marginBottom: 20,
  },
  tabsRow: {
    gap: 10,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Data table container
  tableContainer: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  tableSectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  tableSectionDesc: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 6,
    lineHeight: 18,
  },

  // Grid/List Styles
  cardItemRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  itemTextBold: {
    fontSize: 15,
    fontWeight: "700",
  },
  itemTextSub: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  // Desktop Table Styles
  gridTable: {
    marginTop: 20,
    width: "100%",
  },
  groupGrid: {
    marginTop: 20,
    width: "100%",
  },
  gridHeader: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderRadius: 12,
  },
  gridTh: {
    fontSize: 12,
    fontWeight: "700",
  },
  gridRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  gridTd: {
    fontSize: 14,
    fontWeight: "500",
  },
});
