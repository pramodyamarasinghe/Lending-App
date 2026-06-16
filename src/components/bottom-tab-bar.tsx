import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type BottomTabKey =
  | "overview"
  | "customers"
  | "loans"
  | "collections"
  | "profit";

interface TabConfig {
  key: BottomTabKey;
  label: string;
  route: string;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
}

const tabs: TabConfig[] = [
  {
    key: "overview",
    label: "Dashboard",
    route: "/",
    iconActive: "home",
    iconInactive: "home-outline",
  },
  {
    key: "customers",
    label: "Customers",
    route: "/customers",
    iconActive: "people",
    iconInactive: "people-outline",
  },
  {
    key: "loans",
    label: "Loans",
    route: "/loans",
    iconActive: "card",
    iconInactive: "card-outline",
  },
  {
    key: "collections",
    label: "Collections",
    route: "/collections",
    iconActive: "cash",
    iconInactive: "cash-outline",
  },
  {
    key: "profit",
    label: "Profit",
    route: "/profit",
    iconActive: "analytics",
    iconInactive: "analytics-outline",
  },
];

export function BottomTabBar({ activeTab }: { activeTab: BottomTabKey }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  
  const isDark = colorScheme === "dark";
  const bottomInset = insets?.bottom ?? 0;

  return (
    <View
      style={[
        styles.tabBar,
        {
          bottom: 16 + bottomInset,
          backgroundColor: isDark ? "#192a4a" : "#ffffff",
          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.06)",
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [
              styles.tabButton,
              isActive && (isDark ? styles.tabButtonActiveDark : styles.tabButtonActiveLight),
              pressed && styles.tabButtonPressed,
            ]}
            onPress={() => router.push(tab.route as any)}
          >
            <Ionicons
              name={isActive ? tab.iconActive : tab.iconInactive}
              size={20}
              color={isActive ? "#3366ff" : (isDark ? "#a0aec0" : "#6e7d9e")}
              style={styles.tabIcon}
            />
            <Text style={[
              styles.tabLabel,
              { color: isDark ? "#a0aec0" : "#6e7d9e" },
              isActive && styles.tabLabelActive
            ]}>
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
    height: 72,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 16,
    marginHorizontal: 2,
  },
  tabButtonActiveLight: {
    backgroundColor: "#f0f4ff",
  },
  tabButtonActiveDark: {
    backgroundColor: "rgba(51, 102, 255, 0.15)",
  },
  tabButtonPressed: {
    opacity: 0.7,
  },
  tabIcon: {
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: "#3366ff",
    fontWeight: "700",
  },
});

