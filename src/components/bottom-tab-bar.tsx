import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type BottomTabKey =
  | "overview"
  | "customers"
  | "loans"
  | "collections"
  | "profit";

const tabs: Array<{
  key: BottomTabKey;
  label: string;
  route: string;
  icon: { ios: string; android: string; web: string };
}> = [
  {
    key: "overview",
    label: "Dashboard",
    route: "/",
    icon: { ios: "house", android: "home", web: "home" },
  },
  {
    key: "customers",
    label: "Customers",
    route: "/customers",
    icon: { ios: "person.2.fill", android: "people", web: "people" },
  },
  {
    key: "loans",
    label: "Loans",
    route: "/loans",
    icon: { ios: "creditcard", android: "payments", web: "payments" },
  },
  {
    key: "collections",
    label: "Collections",
    route: "/collections",
    icon: {
      ios: "tray.and.arrow.down.fill",
      android: "download",
      web: "download",
    },
  },
  {
    key: "profit",
    label: "Profit",
    route: "/profit",
    icon: { ios: "chart.bar.fill", android: "analytics", web: "analytics" },
  },
];

export function BottomTabBar({ activeTab }: { activeTab: BottomTabKey }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBar,
        {
          bottom: 16 + insets.bottom,
          left: 12,
          right: 12,
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            style={[styles.tabButton, isActive && styles.tabButtonActive]}
            onPress={() => router.push(tab.route)}
          >
            <SymbolView
              name={tab.icon}
              size={18}
              tintColor={isActive ? "#3366ff" : "#6e7d9e"}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
    height: 72,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  tabButtonActive: {
    backgroundColor: "#e9f0ff",
  },
  tabIcon: {
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6e7d9e",
  },
  tabLabelActive: {
    color: "#3366ff",
  },
});
