import { BottomTabBar } from "@/components/bottom-tab-bar";
import { addCustomer, getCustomers } from "@/lib/appwrite";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Customer {
  id: string;
  name: string;
  nic: string;
  phone: string;
  address: string;
  risk: "Low" | "Medium" | "High";
  status: "Active" | "Overdue";
}


export default function CustomersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const safeBottom = insets?.bottom ?? 0;
  const safeTop = insets?.top ?? 0;
  const contentPaddingBottom = safeBottom + 110;

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const colors = {
    bg: isDark ? "#0f172a" : "#ecf2ff",
    cardBg: isDark ? "#1e293b" : "#ffffff",
    titleText: isDark ? "#ffffff" : "#192a4a",
    bodyText: isDark ? "#94a3b8" : "#5f6fc1",
    subtleText: isDark ? "#64748b" : "#8a92a6",
    inputText: isDark ? "#ffffff" : "#192a4a",
    inputBg: isDark ? "#0f172a" : "#f4f7ff",
    inputPlaceholder: isDark ? "#475569" : "#7a859d",
    borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.04)",
    borderColorLight: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.03)",
    tableHeaderBg: isDark ? "#0f172a" : "#fcfdff",
    searchBoxBg: isDark ? "#1e293b" : "#ffffff",
    filterBtnBg: isDark ? "#1e293b" : "#ffffff",
    filterBtnActiveBg: isDark ? "rgba(51, 102, 255, 0.15)" : "#f0f4ff",
    filterBtnBorderActive: isDark ? "rgba(51, 102, 255, 0.4)" : "rgba(51, 102, 255, 0.2)",
    filterOptionBg: isDark ? "#0f172a" : "#f4f7ff",
    filterOptionActiveBg: isDark ? "rgba(51, 102, 255, 0.15)" : "#e8efff",
    filterOptionActiveBorder: isDark ? "rgba(51, 102, 255, 0.4)" : "rgba(51, 102, 255, 0.25)",
    filterOptionText: isDark ? "#94a3b8" : "#6b7a99",
    closeBtnBorder: isDark ? "#475569" : "#3366ff",
    closeBtnText: isDark ? "#94a3b8" : "#3366ff",
  };

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | "Active" | "Overdue">("All");
  const [filterRisk, setFilterRisk] = useState<"All" | "Low" | "Medium" | "High">("All");
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // Modals state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form state for new customer
  const [formName, setFormName] = useState("");
  const [formNic, setFormNic] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formRisk, setFormRisk] = useState<"Low" | "Medium" | "High">("Low");
  const [formStatus, setFormStatus] = useState<"Active" | "Overdue">("Active");

  const isCompact = width < 760;

  // Fetch data on mount
  useEffect(() => {
    loadCustomerData();
  }, []);

  const loadCustomerData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const docs = await getCustomers();
      const mapped: Customer[] = docs.map((doc: any) => ({
        id: doc.customerId,
        name: doc.name,
        nic: doc.nic,
        phone: doc.phone,
        address: doc.address,
        risk: doc.risk,
        status: doc.status,
      }));
      // Sort: newly created/higher IDs first
      mapped.sort((a, b) => b.id.localeCompare(a.id));
      setCustomers(mapped);
    } catch (err: any) {
      console.log("loadCustomerData error:", err);
      Alert.alert(
        "Database Status",
        "Could not load data from Appwrite. Make sure your database and columns are set up and permissions are configured."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch =
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.nic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = filterStatus === "All" || customer.status === filterStatus;
      const matchesRisk = filterRisk === "All" || customer.risk === filterRisk;

      return matchesSearch && matchesStatus && matchesRisk;
    });
  }, [customers, searchQuery, filterStatus, filterRisk]);

  const getRowBackgroundColor = (customer: Customer) => {
    if (customer.status === "Overdue" || customer.risk === "High") {
      return "rgba(255, 77, 79, 0.09)"; // faded red (9% opacity)
    }
    if (customer.status === "Active" && customer.risk === "Low") {
      return "rgba(46, 204, 113, 0.09)"; // faded green (9% opacity)
    }
    return colors.cardBg; // neutral themed card
  };

  const renderEmptyView = () => {
    const isEmptyDb = customers.length === 0;
    return (
      <View style={styles.emptyView}>
        <Ionicons name="people-outline" size={48} color="#a0aec0" />
        <Text style={styles.emptyText}>
          {isEmptyDb
            ? "No customers registered in the database."
            : "No customers found matching active search filters."}
        </Text>
      </View>
    );
  };

  const handleAddCustomerSubmit = async () => {
    if (!formName.trim() || !formNic.trim() || !formPhone.trim() || !formAddress.trim()) {
      Alert.alert("Validation Error", "All fields are required.");
      return;
    }

    // Basic NIC Validation (Sri Lankan formats: 9 digits + V/X or 12 digits)
    const nicRegex = /^([0-9]{9}[vVxX]|[0-9]{12})$/;
    if (!nicRegex.test(formNic.trim())) {
      Alert.alert("Validation Error", "Please enter a valid Sri Lankan NIC number (e.g. 892341234V or 12-digit number).");
      return;
    }

    setLoading(true);
    try {
      // Generate new ID (incrementing from the highest existing ID in state or database fallback)
      const maxIdNum = customers.reduce((max, c) => {
        const parts = c.id.split("-");
        const num = parts.length > 1 ? parseInt(parts[1]) : 10233;
        return num > max ? num : max;
      }, 10233);
      const newId = `C-${maxIdNum + 1}`;

      const newCustomer = {
        customerId: newId,
        name: formName.trim(),
        nic: formNic.trim(),
        phone: formPhone.trim(),
        address: formAddress.trim(),
        risk: formRisk,
        status: formStatus,
      };

      await addCustomer(newCustomer);
      setAddModalVisible(false);

      // Reset Form
      setFormName("");
      setFormNic("");
      setFormPhone("");
      setFormAddress("");
      setFormRisk("Low");
      setFormStatus("Active");

      Alert.alert("Success", `Customer ${newCustomer.name} has been added to the database!`);
      await loadCustomerData();
    } catch (err: any) {
      console.log("Add customer error:", err);
      Alert.alert("Database Error", err.message || "Failed to create customer record in Appwrite.");
    } finally {
      setLoading(false);
    }
  };




  const openDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailModalVisible(true);
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: safeTop + 24,
            paddingBottom: contentPaddingBottom,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadCustomerData(true)} />
        }
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.title, { color: colors.titleText }]}>Customers</Text>
            <Text style={[styles.subtitle, { color: colors.bodyText }]}>
              {customers.length} registered customers
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.addCustomerBtn,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setAddModalVisible(true)}
          >
            <Ionicons name="add" size={20} color="#fff" style={styles.btnIcon} />
            <Text style={styles.addCustomerBtnText}>Add Customer</Text>
          </Pressable>
        </View>

        {/* Search & Filter Bar */}
        <View style={styles.searchBarContainer}>
          <View style={[styles.searchBox, { backgroundColor: colors.searchBoxBg }]}>
            <Ionicons name="search" size={20} color={isDark ? "#64748b" : "#7a859d"} style={styles.searchIcon} />
            <TextInput
              placeholder="Search by name, NIC, phone..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.inputText }]}
              placeholderTextColor={colors.inputPlaceholder}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.filterBtn,
              { backgroundColor: colors.filterBtnBg },
              showFiltersPanel && [styles.filterBtnActive, { backgroundColor: colors.filterBtnActiveBg, borderColor: colors.filterBtnBorderActive }],
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setShowFiltersPanel(!showFiltersPanel)}
          >
            <Ionicons
              name={showFiltersPanel ? "funnel" : "funnel-outline"}
              size={18}
              color={showFiltersPanel ? "#3366ff" : (isDark ? "#94a3b8" : "#5f6fc1")}
            />
            <Text
              style={[
                styles.filterBtnText,
                { color: isDark ? "#94a3b8" : "#5f6fc1" },
                showFiltersPanel && styles.filterBtnTextActive,
              ]}
            >
              Filters
            </Text>
          </Pressable>

          <Text style={[styles.resultsText, { color: colors.subtleText }]}>
            {filteredCustomers.length} result{filteredCustomers.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {/* Filter Selection Panel */}
        {showFiltersPanel && (
          <View style={[styles.filtersPanel, { backgroundColor: colors.cardBg }]}>
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: colors.subtleText }]}>Status</Text>
              <View style={styles.filterOptions}>
                {(["All", "Active", "Overdue"] as const).map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setFilterStatus(opt)}
                    style={[
                      styles.filterOptionItem,
                      { backgroundColor: colors.filterOptionBg },
                      filterStatus === opt && [styles.filterOptionItemActive, { backgroundColor: colors.filterOptionActiveBg, borderColor: colors.filterOptionActiveBorder }],
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        { color: colors.filterOptionText },
                        filterStatus === opt && styles.filterOptionTextActive,
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: colors.subtleText }]}>Risk Assessment</Text>
              <View style={styles.filterOptions}>
                {(["All", "Low", "Medium", "High"] as const).map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setFilterRisk(opt)}
                    style={[
                      styles.filterOptionItem,
                      { backgroundColor: colors.filterOptionBg },
                      filterRisk === opt && [styles.filterOptionItemActive, { backgroundColor: colors.filterOptionActiveBg, borderColor: colors.filterOptionActiveBorder }],
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        { color: colors.filterOptionText },
                        filterRisk === opt && styles.filterOptionTextActive,
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Customers Grid/List */}
        <View style={[styles.customersCard, { backgroundColor: colors.cardBg }]}>
          {isCompact ? (
            /* Compact Mobile Layout */
            <View style={styles.compactList}>
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer, idx) => (
                  <Pressable
                    key={customer.id}
                    onPress={() => openDetails(customer)}
                    style={({ pressed }) => [
                      styles.compactRow,
                      idx !== filteredCustomers.length - 1 && [styles.borderBottom, { borderColor: colors.borderColor }],
                      { backgroundColor: pressed ? (isDark ? "rgba(51, 102, 255, 0.15)" : "#f0f4ff") : getRowBackgroundColor(customer) },
                    ]}
                  >
                    <View style={styles.compactBody}>
                      <View style={styles.compactNameRow}>
                        <Text style={[styles.customerName, { color: colors.titleText }]}>{customer.name}</Text>
                        <View style={styles.badgeRow}>
                          <View
                            style={[
                              styles.badgeRisk,
                              customer.risk === "Low"
                                ? styles.riskLow
                                : customer.risk === "Medium"
                                  ? styles.riskMedium
                                  : styles.riskHigh,
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeRiskText,
                                customer.risk === "Low"
                                  ? styles.riskLowText
                                  : customer.risk === "Medium"
                                    ? styles.riskMediumText
                                    : styles.riskHighText,
                              ]}
                            >
                              {customer.risk}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.badgeStatus,
                              customer.status === "Active"
                                ? styles.statusActive
                                : styles.statusOverdue,
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeStatusText,
                                customer.status === "Active"
                                  ? styles.statusActiveText
                                  : styles.statusOverdueText,
                              ]}
                            >
                              {customer.status}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text style={[styles.customerId, { color: colors.subtleText }]}>{customer.id}</Text>
                      <View style={styles.compactDetailsGrid}>
                        <Text style={[styles.compactDetailText, { color: colors.bodyText }]}>NIC: {customer.nic}</Text>
                        <Text style={[styles.compactDetailText, { color: colors.bodyText }]}>Phone: {customer.phone}</Text>
                        <Text style={[styles.compactDetailText, { color: colors.bodyText }]}>Address: {customer.address}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={isDark ? "#64748b" : "#a0aec0"} style={styles.chevronIcon} />
                  </Pressable>
                ))
              ) : (
                <View style={styles.emptyView}>
                  <Ionicons name="people-outline" size={48} color={isDark ? "#64748b" : "#a0aec0"} />
                  <Text style={[styles.emptyText, { color: colors.subtleText }]}>No customers found matching filters.</Text>
                </View>
              )}
            </View>
          ) : (
            /* Wide Screen Table Layout */
            <View style={styles.table}>
              <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg, borderColor: colors.borderColorLight }]}>
                <Text style={[styles.th, { flex: 2.5, color: colors.subtleText }]}>Customer</Text>
                <Text style={[styles.th, { flex: 1.5, color: colors.subtleText }]}>NIC</Text>
                <Text style={[styles.th, { flex: 2, color: colors.subtleText }]}>Phone</Text>
                <Text style={[styles.th, { flex: 1.5, color: colors.subtleText }]}>Address</Text>
                <Text style={[styles.th, { flex: 1, color: colors.subtleText }]}>Risk</Text>
                <Text style={[styles.th, { flex: 1.2, color: colors.subtleText }]}>Status</Text>
                <Text style={[styles.th, { flex: 0.8, textAlign: "right" }]}></Text>
              </View>

              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer, idx) => (
                  <View
                    key={customer.id}
                    style={[
                      styles.tableRow,
                      idx !== filteredCustomers.length - 1 && [styles.borderBottom, { borderColor: colors.borderColorLight }],
                      { backgroundColor: getRowBackgroundColor(customer) },
                    ]}
                  >
                    <View style={[styles.tdCustomer, { flex: 2.5 }]}>
                      <View style={styles.customerMeta}>
                        <Text style={[styles.customerName, { color: colors.titleText }]}>{customer.name}</Text>
                        <Text style={[styles.customerId, { color: colors.subtleText }]}>{customer.id}</Text>
                      </View>
                    </View>
                    <Text style={[styles.td, { flex: 1.5, color: colors.inputText }]}>{customer.nic}</Text>
                    <Text style={[styles.td, { flex: 2, color: colors.inputText }]}>{customer.phone}</Text>
                    <Text style={[styles.td, { flex: 1.5, color: colors.inputText }]}>{customer.address}</Text>
                    <View style={[styles.tdBadgeCol, { flex: 1 }]}>
                      <View
                        style={[
                          styles.badgeRisk,
                          customer.risk === "Low"
                            ? styles.riskLow
                            : customer.risk === "Medium"
                              ? styles.riskMedium
                              : styles.riskHigh,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeRiskText,
                            customer.risk === "Low"
                              ? styles.riskLowText
                              : customer.risk === "Medium"
                                ? styles.riskMediumText
                                : styles.riskHighText,
                          ]}
                        >
                          {customer.risk}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.tdBadgeCol, { flex: 1.2 }]}>
                      <View
                        style={[
                          styles.badgeStatus,
                          customer.status === "Active"
                            ? styles.statusActive
                            : styles.statusOverdue,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeStatusText,
                            customer.status === "Active"
                              ? styles.statusActiveText
                              : styles.statusOverdueText,
                          ]}
                        >
                          {customer.status}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={[styles.viewLinkCol, { flex: 0.8 }]}
                      onPress={() => openDetails(customer)}
                    >
                      <Text style={styles.viewLink}>View</Text>
                    </Pressable>
                  </View>
                ))
              ) : (
                renderEmptyView()
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* -------------------- ADD CUSTOMER FORM MODAL -------------------- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addModalVisible}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(25, 42, 74, 0.45)" }]}>
          <View style={[styles.modalContentCard, { backgroundColor: colors.cardBg }]}>
            <View style={[styles.modalHeader, { borderColor: colors.borderColor }]}>
              <Text style={[styles.modalTitle, { color: colors.titleText }]}>Add Customer</Text>
              <Pressable onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.titleText} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalFormBody}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.subtleText }]}>Full Name</Text>
                <TextInput
                  placeholder="e.g. Asanka Bandara"
                  value={formName}
                  onChangeText={setFormName}
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }]}
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.subtleText }]}>NIC Number</Text>
                <TextInput
                  placeholder="e.g. 892341234V or 12 digits"
                  value={formNic}
                  onChangeText={setFormNic}
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }]}
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.subtleText }]}>Phone Number</Text>
                <TextInput
                  placeholder="e.g. +94 71 234 5678"
                  value={formPhone}
                  onChangeText={setFormPhone}
                  keyboardType="phone-pad"
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }]}
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.subtleText }]}>Address</Text>
                <TextInput
                  placeholder="e.g. Colombo 5"
                  value={formAddress}
                  onChangeText={setFormAddress}
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }]}
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.subtleText }]}>Risk Level</Text>
                <View style={styles.selectionRow}>
                  {(["Low", "Medium", "High"] as const).map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setFormRisk(r)}
                      style={[
                        styles.selectionCell,
                        { backgroundColor: colors.inputBg },
                        formRisk === r && [styles.selectionCellActive, { backgroundColor: colors.filterOptionActiveBg, borderColor: colors.filterOptionActiveBorder }],
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectionCellText,
                          { color: colors.bodyText },
                          formRisk === r && styles.selectionCellTextActive,
                        ]}
                      >
                        {r}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.subtleText }]}>Account Status</Text>
                <View style={styles.selectionRow}>
                  {(["Active", "Overdue"] as const).map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setFormStatus(s)}
                      style={[
                        styles.selectionCell,
                        { backgroundColor: colors.inputBg },
                        formStatus === s && [styles.selectionCellActive, { backgroundColor: colors.filterOptionActiveBg, borderColor: colors.filterOptionActiveBorder }],
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectionCellText,
                          { color: colors.bodyText },
                          formStatus === s && styles.selectionCellTextActive,
                        ]}
                      >
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Submit Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.formSubmitBtn,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleAddCustomerSubmit}
              >
                <Text style={styles.formSubmitBtnText}>Create Customer Account</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* -------------------- CUSTOMER DETAILS MODAL -------------------- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(25, 42, 74, 0.45)" }]}>
          <View style={[styles.modalContentCard, styles.detailsModalCard, { backgroundColor: colors.cardBg }]}>
            {selectedCustomer && (
              <>
                <View style={[styles.modalHeader, { borderColor: colors.borderColor }]}>
                  <Text style={[styles.modalTitle, { color: colors.titleText }]}>Customer Profile</Text>
                  <Pressable onPress={() => setDetailModalVisible(false)}>
                    <Ionicons name="close" size={24} color={colors.titleText} />
                  </Pressable>
                </View>

                <ScrollView style={styles.modalFormBody}>
                  {/* Key Profile Details */}
                  <View style={[styles.detailProfileHeader, { borderColor: colors.borderColor }]}>
                    <Text style={[styles.detailName, { color: colors.titleText }]}>{selectedCustomer.name}</Text>
                    <Text style={[styles.detailId, { color: colors.subtleText }]}>{selectedCustomer.id}</Text>

                    <View style={[styles.badgeRow, { marginTop: 12 }]}>
                      <View
                        style={[
                          styles.badgeRisk,
                          selectedCustomer.risk === "Low"
                            ? styles.riskLow
                            : selectedCustomer.risk === "Medium"
                              ? styles.riskMedium
                              : styles.riskHigh,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeRiskText,
                            selectedCustomer.risk === "Low"
                              ? styles.riskLowText
                              : selectedCustomer.risk === "Medium"
                                ? styles.riskMediumText
                                : styles.riskHighText,
                          ]}
                        >
                          {selectedCustomer.risk} Risk
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.badgeStatus,
                          selectedCustomer.status === "Active"
                            ? styles.statusActive
                            : styles.statusOverdue,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeStatusText,
                            selectedCustomer.status === "Active"
                              ? styles.statusActiveText
                              : styles.statusOverdueText,
                          ]}
                        >
                          {selectedCustomer.status}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* General Contact Info Card */}
                  <View style={[styles.detailsInfoSection, { backgroundColor: colors.inputBg, borderColor: colors.borderColor }]}>
                    <Text style={styles.sectionHeaderTitle}>Identity & Details</Text>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.subtleText }]}>National Identity Card (NIC)</Text>
                      <Text style={[styles.detailValue, { color: colors.titleText }]}>{selectedCustomer.nic}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.subtleText }]}>Mobile Phone</Text>
                      <Text style={[styles.detailValue, { color: colors.titleText }]}>{selectedCustomer.phone}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.subtleText }]}>Resident Address</Text>
                      <Text style={[styles.detailValue, { color: colors.titleText }]}>{selectedCustomer.address}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.subtleText }]}>Assigned Branch</Text>
                      <Text style={[styles.detailValue, { color: colors.titleText }]}>
                        {selectedCustomer.address.toLowerCase().includes("kandy") ? "Kandy Branch" : "Colombo Central"}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.closeDetailsBtn,
                      { borderColor: colors.closeBtnBorder },
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => setDetailModalVisible(false)}
                  >
                    <Text style={[styles.closeDetailsBtnText, { color: colors.closeBtnText }]}>Close Profile</Text>
                  </Pressable>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Tabs navigation */}
      <BottomTabBar activeTab="customers" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#ecf2ff",
  },
  container: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  headerTitleContainer: {
    flex: 1,
    minWidth: 200,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#192a4a",
  },
  subtitle: {
    fontSize: 14,
    color: "#5f6fc1",
    marginTop: 4,
    fontWeight: "500",
  },
  addCustomerBtn: {
    backgroundColor: "#3366ff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: "#3366ff",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  addCustomerBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  btnIcon: {
    marginRight: 6,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
    flexWrap: "wrap",
  },
  searchBox: {
    flex: 1,
    minWidth: 220,
    backgroundColor: "#fff",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 48,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#192a4a",
    fontWeight: "500",
  },
  filterBtn: {
    backgroundColor: "#fff",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 48,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterBtnActive: {
    borderColor: "rgba(51, 102, 255, 0.2)",
    backgroundColor: "#f0f4ff",
  },
  filterBtnText: {
    color: "#5f6fc1",
    fontWeight: "600",
    fontSize: 14,
  },
  filterBtnTextActive: {
    color: "#3366ff",
  },
  resultsText: {
    fontSize: 13,
    color: "#8a92a6",
    fontWeight: "600",
    marginLeft: "auto",
    paddingRight: 4,
  },
  filtersPanel: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8a92a6",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  filterOptions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  filterOptionItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#f4f7ff",
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterOptionItemActive: {
    backgroundColor: "#e8efff",
    borderColor: "rgba(51, 102, 255, 0.25)",
  },
  filterOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7a99",
  },
  filterOptionTextActive: {
    color: "#3366ff",
    fontWeight: "700",
  },
  customersCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    overflow: "hidden",
  },
  /* Wide Screen Table Style */
  table: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#fcfdff",
    borderBottomWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.03)",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  th: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8a92a6",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  tdCustomer: {
    flexDirection: "row",
    alignItems: "center",
  },
  customerMeta: {
    marginLeft: 12,
  },
  td: {
    fontSize: 13,
    color: "#192a4a",
    fontWeight: "600",
  },
  tdBadgeCol: {
    justifyContent: "center",
  },
  viewLinkCol: {
    alignItems: "flex-end",
  },
  viewLink: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3366ff",
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  customerName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#192a4a",
  },
  customerId: {
    fontSize: 11,
    color: "#8a92a6",
    fontWeight: "500",
    marginTop: 2,
  },
  /* Badges Styles */
  badgeRisk: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  riskLow: {
    backgroundColor: "rgba(46, 204, 113, 0.12)",
  },
  riskMedium: {
    backgroundColor: "rgba(243, 156, 18, 0.12)",
  },
  riskHigh: {
    backgroundColor: "rgba(231, 76, 60, 0.12)",
  },
  badgeRiskText: {
    fontSize: 11,
    fontWeight: "700",
  },
  riskLowText: {
    color: "#27ae60",
  },
  riskMediumText: {
    color: "#d35400",
  },
  riskHighText: {
    color: "#c0392b",
  },
  badgeStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusActive: {
    backgroundColor: "rgba(51, 102, 255, 0.1)",
  },
  statusOverdue: {
    backgroundColor: "rgba(255, 77, 79, 0.1)",
  },
  badgeStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusActiveText: {
    color: "#3366ff",
  },
  statusOverdueText: {
    color: "#ff4d4f",
  },
  /* Compact Layout Style */
  compactList: {
    width: "100%",
  },
  compactRow: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
  },
  rowPressed: {
    backgroundColor: "#f8faff",
  },
  compactBody: {
    flex: 1,
  },
  compactNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
  },
  compactDetailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  compactDetailText: {
    fontSize: 12,
    color: "#6b7a99",
    fontWeight: "500",
  },
  chevronIcon: {
    marginLeft: 8,
  },
  emptyView: {
    alignItems: "center",
    padding: 40,
    gap: 12,
  },
  emptyText: {
    color: "#8a92a6",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  /* Modal Overlay Styling */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(25, 42, 74, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContentCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    paddingBottom: 14,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#192a4a",
  },
  modalFormBody: {
    flexGrow: 0,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8a92a6",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  formInput: {
    backgroundColor: "#f4f7ff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#192a4a",
    fontWeight: "500",
    borderWidth: 1,
    borderColor: "rgba(51, 102, 255, 0.04)",
  },
  selectionRow: {
    flexDirection: "row",
    gap: 8,
  },
  selectionCell: {
    flex: 1,
    backgroundColor: "#f4f7ff",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  selectionCellActive: {
    backgroundColor: "#e8efff",
    borderColor: "rgba(51, 102, 255, 0.2)",
  },
  selectionCellText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7a99",
  },
  selectionCellTextActive: {
    color: "#3366ff",
    fontWeight: "700",
  },
  formSubmitBtn: {
    backgroundColor: "#3366ff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  formSubmitBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  /* Details Modal Styling */
  detailsModalCard: {
    maxWidth: 480,
  },
  detailProfileHeader: {
    alignItems: "center",
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    marginBottom: 16,
  },
  detailName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#192a4a",
  },
  detailId: {
    fontSize: 12,
    color: "#8a92a6",
    fontWeight: "600",
    marginTop: 4,
  },
  detailsInfoSection: {
    backgroundColor: "#fcfdff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.02)",
    padding: 14,
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#3366ff",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: "#8a92a6",
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 12,
    color: "#192a4a",
    fontWeight: "700",
  },
  detailsFinancialGrid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 10,
  },
  financialCell: {
    flex: 1,
    backgroundColor: "#f4f7ff",
    padding: 10,
    borderRadius: 12,
  },
  financialLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#8a92a6",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  financialValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#192a4a",
  },
  closeDetailsBtn: {
    borderWidth: 1.5,
    borderColor: "#3366ff",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  closeDetailsBtnText: {
    color: "#3366ff",
    fontWeight: "700",
    fontSize: 14,
  },
  seedDataBtn: {
    backgroundColor: "#2ecc71",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 10,
    alignSelf: "center",
  },
  seedDataBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
});
