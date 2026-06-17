import { BottomTabBar } from "@/components/bottom-tab-bar";
import { useRouter } from "expo-router";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useColorScheme,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CollectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const safeBottom = insets?.bottom ?? 0;
  const safeTop = insets?.top ?? 0;
  const contentPaddingBottom = safeBottom + 110;
  const pageHorizontalPadding = width > 760 ? 32 : 24;
  const maxContentWidth = width > 840 ? 760 : "100%";

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const colors = {
    bg: isDark ? "#0f172a" : "#ecf2ff",
    cardBg: isDark ? "#1e293b" : "#ffffff",
    titleText: isDark ? "#ffffff" : "#192a4a",
    bodyText: isDark ? "#94a3b8" : "#6b7a99",
  };

  return (
    <View style={[styles.page, { paddingTop: safeTop + 24, backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingBottom: contentPaddingBottom,
            paddingHorizontal: pageHorizontalPadding,
            maxWidth: maxContentWidth,
            alignSelf: "center",
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.titleText }]}>Collections</Text>

        <View style={[styles.card, { width: "100%", backgroundColor: colors.cardBg }]}>
          <Text style={[styles.cardTitle, { color: colors.titleText }]}>Collection dashboard</Text>
          <Text style={[styles.cardText, { color: colors.bodyText }]}>
            Track incoming repayments and keep your cash flow up to date.
          </Text>
          <Pressable style={styles.button} onPress={() => router.push("/")}>
            <Text style={styles.buttonText}>Back to dashboard</Text>
          </Pressable>
        </View>
      </ScrollView>
      <BottomTabBar activeTab="collections" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#ecf2ff",
  },
  container: {
    padding: 24,
    paddingBottom: 120,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#192a4a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#5f6fc1",
    marginBottom: 20,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#192a4a",
    marginBottom: 10,
  },
  cardText: {
    fontSize: 14,
    color: "#6b7a99",
    marginBottom: 18,
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#3366ff",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
