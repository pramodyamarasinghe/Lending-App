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
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const metrics = [
  {
    title: "Portfolio Value",
    value: "$54,420,000",
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
    value: "$186,500",
    subtitle: "vs $160k target",
    accent: "#2ecc71",
  },
  {
    title: "Cash Position",
    value: "$2,840,000",
    subtitle: "Across 5 branches",
    accent: "#208ae5",
  },
  {
    title: "Outstanding",
    value: "$8,120,000",
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

const chartData = [
  { label: "Collected", color: "#3d5afe" },
  { label: "Target", color: "#d9e4ff" },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<BottomTabKey>("overview");
  const isCompact = width < 520;
  const cardWidth = isCompact ? "100%" : "48%";
  const contentPaddingBottom = insets.bottom + 110;

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

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: insets.top + 16,
            paddingBottom: contentPaddingBottom,
            paddingHorizontal: isCompact ? 16 : 24,
          },
        ]}
      >
        <View style={styles.header}>
          <View
            style={[styles.headerTop, isCompact && styles.headerTopCompact]}
          >
            <Text style={styles.pageTitle}>Dashboard</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {metrics.map((item) => (
            <View
              key={item.title}
              style={[styles.metricCard, { width: cardWidth }]}
            >
              <View
                style={[styles.metricAccent, { backgroundColor: item.accent }]}
              />
              <Text style={styles.metricTitle}>{item.title}</Text>
              <Text style={styles.metricValue}>{item.value}</Text>
              <Text style={styles.metricSubtitle}>{item.subtitle}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Collections Trend</Text>
            <Text style={styles.sectionCaption}>
              Last 7 days · all branches
            </Text>
          </View>

          <View style={styles.chartPlaceholder}>
            <View style={[styles.chartLine, { width: "24%", left: "4%" }]} />
            <View style={[styles.chartLine, { width: "30%", left: "18%" }]} />
            <View style={[styles.chartLine, { width: "22%", left: "42%" }]} />
            <View style={[styles.chartLine, { width: "18%", left: "62%" }]} />
            <View style={[styles.chartLine, { width: "28%", left: "78%" }]} />
          </View>

          <View style={styles.chartLegendRow}>
            {chartData.map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: item.color }]}
                />
                <Text style={styles.legendLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Branch Performance</Text>
            <Text style={styles.sectionCaption}>
              Portfolio value & recovery rate
            </Text>
          </View>

          <View style={styles.barChartRow}>
            {[
              { label: "Colombo Central", value: 18 },
              { label: "Kandy Branch", value: 12 },
              { label: "Galle Branch", value: 10 },
              { label: "Jaffna Branch", value: 6 },
              { label: "Negombo Branch", value: 8 },
            ].map((branch) => (
              <View key={branch.label} style={styles.barItem}>
                <View
                  style={[styles.bar, { height: `${branch.value * 4}%` }]}
                />
                <Text style={styles.barLabel} numberOfLines={2}>
                  {branch.label}
                </Text>
              </View>
            ))}
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

      <View style={[styles.tabBarContainer, styles.glassContainer]}>
        <View style={styles.glassBackground} />
        <BottomTabBar activeTab={activeTab} />
      </View>
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
  chartPlaceholder: {
    height: 170,
    borderRadius: 20,
    backgroundColor: "#f4f7ff",
    overflow: "hidden",
    justifyContent: "flex-end",
    paddingVertical: 16,
  },
  chartLine: {
    position: "absolute",
    bottom: 0,
    height: 80,
    borderRadius: 14,
    backgroundColor: "#3366ff",
  },
  chartLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 18,
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
    color: "#5f6fc1",
  },
  navGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 16,
  },
  navCard: {
    backgroundColor: "#f4f7ff",
    borderRadius: 20,
    padding: 18,
    flexBasis: "48%",
    minWidth: "48%",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  navCardPressed: {
    opacity: 0.8,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#192a4a",
    marginBottom: 6,
  },
  navSubtitle: {
    fontSize: 13,
    color: "#5f6fc1",
    lineHeight: 18,
  },
  barChartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    marginTop: 16,
  },
  barItem: {
    alignItems: "center",
    flex: 1,
  },
  bar: {
    width: "100%",
    maxWidth: 38,
    backgroundColor: "#3d5afe",
    borderRadius: 16,
    marginBottom: 12,
  },
  barLabel: {
    textAlign: "center",
    fontSize: 12,
    color: "#6b7a99",
    lineHeight: 16,
  },
});
