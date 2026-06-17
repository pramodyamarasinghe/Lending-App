import { BottomTabBar } from "@/components/bottom-tab-bar";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  Alert,
  Appearance,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getSettings,
  updateSettings,
  getCollectors,
  addCollector,
  deleteCollectorById,
  getBranches,
  addBranch,
  deleteBranchById
} from "@/lib/appwrite";



interface Branch {
  id: string;
  name: string;
}

interface Collector {
  id: string;
  name: string;
  phone: string | number;
  NIC?: string;
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const safeBottom = insets?.bottom ?? 0;
  const safeTop = insets?.top ?? 0;
  const contentPaddingBottom = safeBottom + 110;
  const isCompact = width < 760;

  // States
  const [branches, setBranches] = useState<Branch[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [showCollectors, setShowCollectors] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  
  const [branchInput, setBranchInput] = useState("");
  
  // Collector Form Inputs
  const [collectorInput, setCollectorInput] = useState("");
  const [collectorPhoneInput, setCollectorPhoneInput] = useState("");
  const [collectorNicInput, setCollectorNicInput] = useState("");

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      let activeBranches: Branch[] = [];
      let activeCollectors: Collector[] = [];

      // 1. Try loading branches from Appwrite branches collection
      try {
        const remoteBranches = await getBranches();
        if (remoteBranches && remoteBranches.length > 0) {
          activeBranches = remoteBranches.map((b: any) => ({
            id: b.$id,
            name: b.name
          }));
        }
      } catch (remoteErr) {
        console.log("Error loading branches from Appwrite, using local cache fallback:", remoteErr);
        const storedBranches = await AsyncStorage.getItem("LENDING_APP_BRANCHES");
        if (storedBranches) {
          activeBranches = JSON.parse(storedBranches);
        }
      }

      // 2. Try loading collectors from Appwrite collecters collection
      try {
        const remoteCols = await getCollectors();
        if (remoteCols && remoteCols.length > 0) {
          activeCollectors = remoteCols.map((c: any) => ({
            id: c.$id,
            name: c.name,
            phone: c.phone,
            NIC: c.NIC
          }));
        } else {
          // If remote list is empty, initialize defaults on Appwrite
          console.log("Remote collectors list is empty. Initializing defaults on Appwrite...");
          const defaultCols = [
            { name: "Mahesh Kularatne", phone: "0771234567", NIC: "891234567V" },
            { name: "Suresh Perera", phone: "0719876543", NIC: "915678123V" },
            { name: "Anura Silva", phone: "0765544332", NIC: "951122334V" },
            { name: "Nimal Jayasinghe", phone: "0724455667", NIC: "937890123V" }
          ];
          for (const item of defaultCols) {
            await addCollector(item.name, item.phone, item.NIC);
          }
          const freshCols = await getCollectors();
          activeCollectors = freshCols.map((c: any) => ({
            id: c.$id,
            name: c.name,
            phone: c.phone,
            NIC: c.NIC
          }));
        }
      } catch (remoteErr) {
        console.log("Error loading collectors from Appwrite, using local cache fallback:", remoteErr);
        const storedCollectors = await AsyncStorage.getItem("LENDING_APP_COLLECTORS");
        if (storedCollectors) {
          activeCollectors = JSON.parse(storedCollectors);
        } else {
          // Local fallback defaults
          activeCollectors = [
            { id: "c1", name: "Mahesh Kularatne", phone: "0771234567", NIC: "891234567V" },
            { id: "c2", name: "Suresh Perera", phone: "0719876543", NIC: "915678123V" },
            { id: "c3", name: "Anura Silva", phone: "0765544332", NIC: "951122334V" },
            { id: "c4", name: "Nimal Jayasinghe", phone: "0724455667", NIC: "937890123V" }
          ];
        }
      }

      setBranches(activeBranches);
      setCollectors(activeCollectors);

      // Keep AsyncStorage cache updated
      try {
        await AsyncStorage.setItem("LENDING_APP_BRANCHES", JSON.stringify(activeBranches));
        await AsyncStorage.setItem("LENDING_APP_COLLECTORS", JSON.stringify(activeCollectors));
      } catch (cacheErr) {
        console.log("Error caching settings:", cacheErr);
      }

    } catch (err) {
      console.log("Error loading settings:", err);
    }
  };

  // Toggle Theme
  const handleToggleTheme = async () => {
    const newTheme = isDark ? "light" : "dark";
    try {
      Appearance.setColorScheme(newTheme);
      await AsyncStorage.setItem("LENDING_APP_THEME", newTheme);
    } catch (err) {
      console.log("Error saving theme preference:", err);
    }
  };

  // Add Branch
  const handleAddBranch = async () => {
    const trimmed = branchInput.trim();
    if (!trimmed) {
      Alert.alert("Validation Error", "Please enter a branch name.");
      return;
    }
    if (branches.some((b) => b.name.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert("Validation Error", "This branch already exists.");
      return;
    }

    let newId = `b_${Date.now()}`;
    try {
      const response = await addBranch(trimmed);
      newId = response.$id;
      console.log("Successfully added branch to Appwrite:", trimmed);
    } catch (remoteErr) {
      console.log("Failed to add branch to Appwrite (using local fallback):", remoteErr);
      Alert.alert("Warning", "Failed to sync branch with Appwrite cloud. Saved locally.");
    }

    const newBranch: Branch = { id: newId, name: trimmed };
    const updated = [...branches, newBranch];
    setBranches(updated);
    setBranchInput("");
    setShowBranches(true);
    try {
      await AsyncStorage.setItem("LENDING_APP_BRANCHES", JSON.stringify(updated));
    } catch (err) {
      console.log("Error saving branches:", err);
    }
  };

  // Delete Branch
  const handleDeleteBranch = async (id: string, name: string) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete branch "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updated = branches.filter((b) => b.id !== id);
            try {
              if (!id.startsWith("b_")) {
                await deleteBranchById(id);
                console.log("Successfully deleted branch from Appwrite:", name);
              }
            } catch (remoteErr) {
              console.log("Failed to delete branch from Appwrite (using local fallback):", remoteErr);
              Alert.alert("Warning", "Failed to delete branch from Appwrite cloud. Deleted locally.");
            }
            setBranches(updated);
            try {
              await AsyncStorage.setItem("LENDING_APP_BRANCHES", JSON.stringify(updated));
            } catch (err) {
              console.log("Error saving branches:", err);
            }
          }
        }
      ]
    );
  };

  // Add Collector
  const handleAddCollector = async () => {
    const trimmedName = collectorInput.trim();
    const phoneStr = collectorPhoneInput.trim();
    const nicStr = collectorNicInput.trim();

    if (!trimmedName) {
      Alert.alert("Validation Error", "Please enter a collector name.");
      return;
    }
    if (!phoneStr) {
      Alert.alert("Validation Error", "Please enter a phone number.");
      return;
    }

    // Check duplicate
    if (collectors.some((c) => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      Alert.alert("Validation Error", "A collector with this name already exists.");
      return;
    }

    let newId = `c_${Date.now()}`; // default unique ID for local fallback
    try {
      const response = await addCollector(trimmedName, phoneStr, nicStr || undefined);
      newId = response.$id;
      console.log("Successfully added collector to Appwrite:", trimmedName);
    } catch (remoteErr) {
      console.log("Failed to add collector to Appwrite (using local fallback):", remoteErr);
      Alert.alert("Warning", "Failed to sync collector with Appwrite cloud. Saved locally.");
    }

    const newCollector: Collector = {
      id: newId,
      name: trimmedName,
      phone: phoneStr,
      NIC: nicStr || undefined
    };

    const updated = [...collectors, newCollector];
    setCollectors(updated);
    setCollectorInput("");
    setCollectorPhoneInput("");
    setCollectorNicInput("");
    setShowCollectors(true);

    try {
      await AsyncStorage.setItem("LENDING_APP_COLLECTORS", JSON.stringify(updated));
    } catch (err) {
      console.log("Error saving collectors:", err);
    }
  };

  // Delete Collector
  const handleDeleteCollector = async (id: string, name: string) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete collector "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updated = collectors.filter((c) => c.id !== id);
            try {
              if (!id.startsWith("c_")) {
                await deleteCollectorById(id);
                console.log("Successfully deleted collector from Appwrite:", name);
              }
            } catch (remoteErr) {
              console.log("Failed to delete collector from Appwrite (using local fallback):", remoteErr);
              Alert.alert("Warning", "Failed to delete collector from Appwrite cloud. Deleted locally.");
            }
            setCollectors(updated);
            try {
              await AsyncStorage.setItem("LENDING_APP_COLLECTORS", JSON.stringify(updated));
            } catch (err) {
              console.log("Error saving collectors:", err);
            }
          }
        }
      ]
    );
  };

  // Colors based on theme
  const colors = {
    bg: isDark ? "#0f172a" : "#ecf2ff",
    cardBg: isDark ? "#1e293b" : "#ffffff",
    titleText: isDark ? "#ffffff" : "#192a4a",
    bodyText: isDark ? "#94a3b8" : "#6b7a99",
    inputBg: isDark ? "#0f172a" : "#f4f7ff",
    inputText: isDark ? "#ffffff" : "#192a4a",
    borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#e2e8f0",
    itemBg: isDark ? "#334155" : "#f8faff",
    buttonBg: isDark ? "#334155" : "#e0eaff",
    buttonText: isDark ? "#60a5fa" : "#3366ff"
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: safeTop + 24,
            paddingBottom: contentPaddingBottom
          }
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.titleText }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: colors.bodyText }]}>
            Configure the lending environment parameters, themes, and dynamic selectors.
          </Text>
        </View>

        {/* Theme Setting Switch Panel */}
        <View style={[styles.settingsCard, { backgroundColor: colors.cardBg }]}>
          <View style={styles.themeSettingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.panelTitle, { color: colors.titleText }]}>Dark Mode</Text>
              <Text style={[styles.panelSubtitle, { color: colors.bodyText }]}>
                Toggle system color scheme theme preference manually.
              </Text>
            </View>
            <Pressable
              style={[
                styles.themeToggleBg,
                isDark ? styles.toggleActiveBg : styles.toggleInactiveBg
              ]}
              onPress={handleToggleTheme}
            >
              <View
                style={[
                  styles.themeToggleBall,
                  { alignSelf: isDark ? "flex-end" : "flex-start" }
                ]}
              />
            </Pressable>
          </View>
        </View>

        {/* Layout for managers (two column if wide screen) */}
        <View style={[styles.managerGrid, { flexDirection: isCompact ? "column" : "row" }]}>
          
          {/* BRANCHES LIST MANAGER */}
          <View style={[styles.settingsCard, { backgroundColor: colors.cardBg, flex: 1 }]}>
            <Text style={[styles.panelTitle, { color: colors.titleText }]}>Manage Branches</Text>
            <Text style={[styles.panelSubtitle, { color: colors.bodyText }]}>
              Add or remove branches from the loans drop-down list.
            </Text>

            <View style={{ gap: 12, marginTop: 20, marginBottom: 16 }}>
                <TextInput
                  style={[
                    styles.textInput,
                    { flex: 0, width: "100%", backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }
                  ]}
                  placeholder="Enter branch name"
                  placeholderTextColor={isDark ? "#475569" : "#a0aec0"}
                  value={branchInput}
                  onChangeText={setBranchInput}
                />
                <Pressable style={styles.addCollectorFormButton} onPress={handleAddBranch}>
                  <Ionicons name="add" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Add Branch</Text>
                </Pressable>

              <Pressable
                style={[
                  styles.viewCollectorsButton,
                  { backgroundColor: colors.buttonBg, borderColor: colors.borderColor }
                ]}
                onPress={() => setShowBranches(!showBranches)}
              >
                <Ionicons
                  name={showBranches ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.buttonText}
                  style={{ marginRight: 6 }}
                />
                <Text style={{ color: colors.buttonText, fontWeight: "700", fontSize: 14 }}>
                  {showBranches ? "Hide Branches" : `View Branches (${branches.length})`}
                </Text>
              </Pressable>
            </View>

            {showBranches && (
              <View style={styles.listContainer}>
                {branches.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.bodyText }]}>No branches added yet.</Text>
                ) : (
                  branches.map((b) => (
                    <View
                      key={b.id}
                      style={[styles.itemRow, { backgroundColor: colors.itemBg, borderColor: colors.borderColor }]}
                    >
                      <Text style={[styles.itemText, { color: colors.titleText }]}>{b.name}</Text>
                      <Pressable style={styles.deleteButton} onPress={() => handleDeleteBranch(b.id, b.name)}>
                        <Ionicons name="trash-outline" size={18} color="#ff4d4f" />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>

          {/* COLLECTORS LIST MANAGER */}
          <View style={[styles.settingsCard, { backgroundColor: colors.cardBg, flex: 1 }]}>
            <Text style={[styles.panelTitle, { color: colors.titleText }]}>Manage Collectors</Text>
            <Text style={[styles.panelSubtitle, { color: colors.bodyText }]}>
              Add or remove collection agents from the database.
            </Text>

            <View style={{ gap: 12, marginTop: 20, marginBottom: 16 }}>
              <TextInput
                style={[
                  styles.textInput,
                  { flex: 0, width: "100%", backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }
                ]}
                placeholder="Collector Name (required)"
                placeholderTextColor={isDark ? "#475569" : "#a0aec0"}
                value={collectorInput}
                onChangeText={setCollectorInput}
              />
              <TextInput
                style={[
                  styles.textInput,
                  { flex: 0, width: "100%", backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }
                ]}
                placeholder="Phone Number (required)"
                placeholderTextColor={isDark ? "#475569" : "#a0aec0"}
                keyboardType="phone-pad"
                value={collectorPhoneInput}
                onChangeText={setCollectorPhoneInput}
              />
              <TextInput
                style={[
                  styles.textInput,
                  { flex: 0, width: "100%", backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }
                ]}
                placeholder="NIC (optional, default 20)"
                placeholderTextColor={isDark ? "#475569" : "#a0aec0"}
                value={collectorNicInput}
                onChangeText={setCollectorNicInput}
              />
              <Pressable style={styles.addCollectorFormButton} onPress={handleAddCollector}>
                <Ionicons name="add" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Add Collector</Text>
              </Pressable>
              
              <Pressable
                style={[
                  styles.viewCollectorsButton,
                  { backgroundColor: colors.buttonBg, borderColor: colors.borderColor }
                ]}
                onPress={() => setShowCollectors(!showCollectors)}
              >
                <Ionicons
                  name={showCollectors ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.buttonText}
                  style={{ marginRight: 6 }}
                />
                <Text style={{ color: colors.buttonText, fontWeight: "700", fontSize: 14 }}>
                  {showCollectors ? "Hide Collectors" : `View Collectors (${collectors.length})`}
                </Text>
              </Pressable>
            </View>

            {showCollectors && (
              <View style={styles.listContainer}>
                {collectors.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.bodyText }]}>No collectors added yet.</Text>
                ) : (
                  collectors.map((col) => (
                    <View
                      key={col.id}
                      style={[styles.itemRow, { backgroundColor: colors.itemBg, borderColor: colors.borderColor }]}
                    >
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={[styles.itemText, { color: colors.titleText }]}>{col.name}</Text>
                        <Text style={{ fontSize: 12, color: colors.bodyText, marginTop: 2 }}>
                          Phone: {col.phone} {col.NIC ? `· NIC: ${col.NIC}` : ""}
                        </Text>
                      </View>
                      <Pressable style={styles.deleteButton} onPress={() => handleDeleteCollector(col.id, col.name)}>
                        <Ionicons name="trash-outline" size={18} color="#ff4d4f" />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>

        </View>
      </ScrollView>
      <BottomTabBar activeTab="settings" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1
  },
  container: {
    padding: 24,
    paddingBottom: 120
  },
  header: {
    marginBottom: 24
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 6
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20
  },
  settingsCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  themeSettingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6
  },
  panelSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    maxWidth: "80%"
  },
  themeToggleBg: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: "center"
  },
  toggleActiveBg: {
    backgroundColor: "#3366ff"
  },
  toggleInactiveBg: {
    backgroundColor: "#cbd5e1"
  },
  themeToggleBall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }
  },
  managerGrid: {
    gap: 20
  },
  inputActionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    marginBottom: 16
  },
  textInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#3366ff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3366ff",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  addCollectorFormButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#3366ff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#3366ff",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  viewCollectorsButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row"
  },
  listContainer: {
    gap: 10
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1
  },
  itemText: {
    fontSize: 14,
    fontWeight: "600"
  },
  deleteButton: {
    padding: 4
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    marginVertical: 16,
    fontStyle: "italic"
  }
});
