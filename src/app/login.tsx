import { account, saveAuthCredentials } from "@/lib/appwrite";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const cardMaxWidth = width > 420 ? 420 : "100%";

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const colors = {
    bg: isDark ? "#0f172a" : "#ecf2ff",
    cardBg: isDark ? "#1e293b" : "#ffffff",
    titleText: isDark ? "#ffffff" : "#192a4a",
    bodyText: isDark ? "#94a3b8" : "#6b7a99",
    inputText: isDark ? "#ffffff" : "#1b264d",
    inputBg: isDark ? "#0f172a" : "#f4f7ff",
    inputPlaceholder: isDark ? "#475569" : "#7a859d",
    linkText: isDark ? "#94a3b8" : "#5f6fc1",
  };

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Validation", "Email and password are required");
      return;
    }
    setLoading(true);
    try {
      console.log("Logging in with:", { email });
      // Use createEmailPasswordSession which is available in v26
      const session = await (account as any).createEmailPasswordSession(
        email,
        password,
      );
      console.log("Session created:", session);
      await saveAuthCredentials(email, password);
      Alert.alert("Success", "Logged in successfully!");
      router.replace("/");
    } catch (err: any) {
      console.error("Login error full object:", JSON.stringify(err, null, 2));
      const errorMessage =
        err?.message || err?.response?.message || "Login failed";
      Alert.alert("Login Error", errorMessage);
    } finally {
      setLoading(false);
    }
  }

  const safeBottom = insets?.bottom ?? 0;
  const safeTop = insets?.top ?? 0;

  return (
    <View
      style={[
        styles.page,
        { paddingTop: safeTop + 24, paddingBottom: safeBottom + 24, backgroundColor: colors.bg },
      ]}
    >
      <View style={styles.brandContainer}>
        <Image
          source={require("../../assets/images/LendingApplogo.png")}
          style={styles.logo}
        />
      </View>

      <View
        style={[
          styles.card,
          { width: "100%", maxWidth: cardMaxWidth, alignSelf: "center", backgroundColor: colors.cardBg },
        ]}
      >
        <Text style={[styles.heading, { color: colors.titleText }]}>Welcome back</Text>
        <Text style={[styles.subheading, { color: colors.bodyText }]}>
          Enter your credentials to continue.
        </Text>

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
          placeholderTextColor={colors.inputPlaceholder}
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
          placeholderTextColor={colors.inputPlaceholder}
        />

        <Pressable
          onPress={handleLogin}
          disabled={loading}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            loading && styles.primaryButtonDisabled,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "Signing in..." : "Sign In"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/signup")}
          style={styles.linkButton}
        >
          <Text style={[styles.linkButtonText, { color: colors.linkText }]}>Create a new account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#ecf2ff",
    padding: 24,
    justifyContent: "center",
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 28,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f3a93",
    marginTop: 12,
  },
  brandSubtitle: {
    fontSize: 14,
    color: "#5a6b8c",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 300,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#192a4a",
    marginBottom: 6,
  },
  subheading: {
    fontSize: 14,
    color: "#6b7a99",
    marginBottom: 24,
  },
  logo: {
    width: 140,
    height: 140,
    resizeMode: "contain",
  },
  input: {
    backgroundColor: "#f4f7ff",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontSize: 16,
    color: "#1b264d",
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: "#3366ff",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  linkButton: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 12,
  },
  linkButtonText: {
    color: "#5f6fc1",
    fontSize: 14,
    fontWeight: "600",
  },
});
