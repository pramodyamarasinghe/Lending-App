import { BottomTabBar } from "@/components/bottom-tab-bar";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text as SvgText } from "react-native-svg";
import { 
  account,
  getCollectionRecords, 
  getLoans, 
  getCustomers, 
  addCollectionRecord, 
  updateLoan,
  type CollectionRecord 
} from "@/lib/appwrite";

interface LocalCollectionRecord {
  receipt: string;
  time: string;
  customer: string;
  loan: string;
  collector: string;
  amount: number | null;
  status: "Collected" | "Promise to Pay";
  date: string;
}

export default function CollectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const safeBottom = insets?.bottom ?? 0;
  const safeTop = insets?.top ?? 0;
  const contentPaddingBottom = safeBottom + 110;

  // Layout states
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isCompact = width < 768;

  // Selected Date state (Default to today's date, e.g. "Jun 18")
  const todayLabel = useMemo(() => {
    const now = new Date();
    const standardMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${standardMonths[now.getMonth()]} ${now.getDate()}`;
  }, []);

  // Page States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDateLabel, setSelectedDateLabel] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(600);

  // Database States
  const [collections, setCollections] = useState<LocalCollectionRecord[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string; email: string } | null>(null);
  const [viewDate, setViewDate] = useState(new Date());

  // Add Collection Modal Form States
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [formCustomer, setFormCustomer] = useState<any>(null);
  const [formLoan, setFormLoan] = useState<any>(null);
  const [formAmount, setFormAmount] = useState("");
  const [formCollector, setFormCollector] = useState("");
  const [formStatus, setFormStatus] = useState<"Collected" | "Promise to Pay">("Collected");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Search filter lists for customer selection inside modal
  const [modalSearch, setModalSearch] = useState("");

  // Styling palette
  const colors = {
    bg: isDark ? "#0f172a" : "#f8fafc",
    cardBg: isDark ? "#1e293b" : "#ffffff",
    titleText: isDark ? "#ffffff" : "#0f172a",
    bodyText: isDark ? "#94a3b8" : "#475569",
    subtleText: isDark ? "#64748b" : "#94a3b8",
    inputText: isDark ? "#ffffff" : "#0f172a",
    inputBg: isDark ? "#0f172a" : "#f1f5f9",
    inputPlaceholder: isDark ? "#475569" : "#94a3b8",
    borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
    tableHeaderBg: isDark ? "#0f172a" : "#f8fafc",
    dividerColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#f1f5f9",
    
    // Status colors
    collectedBg: isDark ? "rgba(34, 197, 94, 0.15)" : "#e8fdf0",
    collectedText: isDark ? "#4ade80" : "#15803d",
    promiseBg: isDark ? "rgba(249, 115, 22, 0.15)" : "#fff4e5",
    promiseText: isDark ? "#fb923c" : "#b45309",
    
    // Grid highlights
    blueActiveBg: "#2563eb",
    blueScheduledBg: isDark ? "rgba(37, 99, 235, 0.2)" : "#dbeafe",
    blueScheduledText: isDark ? "#93c5fd" : "#1e40af",
  };

  // Fetch all collection data, loans, and customers on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Fetch session details once on mount
  useEffect(() => {
    account.get()
      .then((profile) => {
        setUserProfile({
          name: profile.name || profile.email.split('@')[0],
          email: profile.email
        });
      })
      .catch(err => {
        console.log("Failed to fetch user session details:", err);
      });
  }, []);

  const loadData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [collDocs, loanDocs, customerDocs] = await Promise.all([
        getCollectionRecords(),
        getLoans(),
        getCustomers(),
      ]);

      setLoans(loanDocs);
      setCustomers(customerDocs);

      // Map Appwrite collection documents to local state format
      const mapped: LocalCollectionRecord[] = collDocs.map((doc: any) => ({
        receipt: doc.receiptId,
        time: doc.time,
        customer: doc.customerName,
        loan: doc.loanId,
        collector: doc.collectorName,
        amount: doc.amount,
        status: doc.status,
        date: doc.date,
      }));
      setCollections(mapped);
    } catch (err: any) {
      console.log("loadData error:", err);
      Alert.alert("Connection Status", "Loaded offline mock mode. Set up Appwrite collection permissions to connect.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePrevMonth = () => {
    setViewDate(prev => {
      const d = new Date(prev);
      d.setMonth(prev.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setViewDate(prev => {
      const d = new Date(prev);
      d.setMonth(prev.getMonth() + 1);
      return d;
    });
  };

  // Compute expected installment dates from active loans in database
  const activeLoansInstallmentDates = useMemo(() => {
    const datesMap: { [dateStr: string]: { amount: number; customerName: string; loanId: string; collector: string }[] } = {};
    const standardMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    loans.forEach((loan) => {
      // Consider only active or overdue loans with outstanding balance
      const loanStatus = loan.status?.toLowerCase();
      if (loanStatus === "closed" || loanStatus === "fully paid" || !(loan.outstanding > 0)) {
        return;
      }
      
      const parts = loan.disbursementDate?.split("/");
      if (!parts || parts.length !== 3) return;
      
      const m = parseInt(parts[0], 10) - 1;
      const d = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      const baseDate = new Date(y, m, d);
      
      const totalRepayable = loan.amount + (loan.amount * (loan.interestRate / 100));
      const originalInstallment = totalRepayable / loan.duration;
      
      for (let i = 1; i <= loan.duration; i++) {
        const dueDateObj = new Date(baseDate);
        if (loan.loanType === "Daily") {
          dueDateObj.setDate(baseDate.getDate() + i);
        } else if (loan.loanType === "Weekly") {
          dueDateObj.setDate(baseDate.getDate() + i * 7);
        } else {
          dueDateObj.setMonth(baseDate.getMonth() + i);
        }
        
        // Format as standard calendar date: "Jun 14"
        const formattedDate = `${standardMonths[dueDateObj.getMonth()]} ${dueDateObj.getDate()}`;
        
        // Also check if this specific installment is already paid or not
        const cumulativeDue = originalInstallment * i;
        const isPaid = loan.paidAmount >= cumulativeDue;
        
        if (!isPaid) {
          if (!datesMap[formattedDate]) {
            datesMap[formattedDate] = [];
          }
          datesMap[formattedDate].push({
            amount: originalInstallment,
            customerName: loan.customerName,
            loanId: loan.$id,
            collector: loan.collector || "Mahesh K.",
          });
        }
      }
    });
    
    return datesMap;
  }, [loans]);

  // Generate dynamic calendar for the current view date
  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const standardMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthName = standardMonths[month];
    
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon...
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const cells = [];
    // Previous month padding
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ dayNum: "", type: "empty", dateStr: "" });
    }
    
    // Month days
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${monthName} ${day}`;
      const dayCollections = collections.filter(c => c.date === dateStr);
      const hasCollected = dayCollections.some(c => c.status === "Collected");
      const hasPromise = dayCollections.some(c => c.status === "Promise to Pay");
      
      const dayInstallments = activeLoansInstallmentDates[dateStr] || [];
      const hasDueInstallment = dayInstallments.length > 0;
      
      let type: "normal" | "active" | "scheduled" = "normal";
      if (hasCollected) {
        type = "active";
      } else if (hasPromise || hasDueInstallment) {
        type = "scheduled";
      }
      
      cells.push({
        dayNum: day,
        type,
        dateStr,
      });
    }
    
    // Next month padding
    const totalCells = cells.length <= 35 ? 35 : 42;
    while (cells.length < totalCells) {
      cells.push({ dayNum: "", type: "empty", dateStr: "" });
    }
    
    return { cells, monthName, year };
  }, [collections, viewDate, activeLoansInstallmentDates]);

  // Compute dynamic past 7 days of labels starting from today
  const past7Days = useMemo(() => {
    const days = [];
    const now = new Date();
    const standardMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push({
        dayName: dayNames[d.getDay()],
        dateLabel: `${standardMonths[d.getMonth()]} ${d.getDate()}`,
      });
    }
    return days;
  }, []);

  // Compute dynamic chart data from database
  const chartData = useMemo(() => {
    return past7Days.map((day) => {
      const dailySum = collections
        .filter((r) => r.date === day.dateLabel && r.status === "Collected")
        .reduce((sum, r) => sum + (r.amount || 0), 0);
      return {
        dayName: day.dayName,
        collected: dailySum,
      };
    });
  }, [collections, past7Days]);

  const maxCollectedScale = useMemo(() => {
    const maxVal = Math.max(...chartData.map((d) => d.collected));
    return maxVal > 0 ? maxVal : 50000; // default 50k scale line
  }, [chartData]);

  // Compute SVG Path points for dynamic line chart
  const linePathD = useMemo(() => {
    const paddingLeft = 45;
    const paddingRight = 20;
    const chartNetWidth = chartWidth - paddingLeft - paddingRight;

    const points = chartData.map((data, idx) => {
      const x = paddingLeft + (idx / 6) * chartNetWidth;
      const y = 160 - (data.collected / maxCollectedScale) * 140; 
      return { x, y };
    });

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [chartWidth, chartData, maxCollectedScale]);

  // Closed area under the curve path
  const areaPathD = useMemo(() => {
    const paddingLeft = 45;
    const paddingRight = 20;
    const chartNetWidth = chartWidth - paddingLeft - paddingRight;
    const lastX = paddingLeft + chartNetWidth;
    return `${linePathD} L ${lastX} 160 L ${paddingLeft} 160 Z`;
  }, [linePathD, chartWidth]);

  // Dynamic calculated Metrics based on Appwrite DB
  const collectedTodayVal = useMemo(() => {
    const sum = collections
      .filter((r) => r.date === todayLabel && r.status === "Collected")
      .reduce((s, r) => s + (r.amount || 0), 0);
    return `Rs. ${sum.toLocaleString()}`;
  }, [collections, todayLabel]);

  const pendingTodayVal = useMemo(() => {
    const sum = collections
      .filter((r) => r.date === todayLabel && r.status === "Promise to Pay")
      .reduce((s, r) => s + (r.amount || 0), 0);
    // If no collections have amounts, count active loans due values as pending representation
    if (sum === 0) {
      const activePending = loans
        .filter(l => l.status === "Overdue" || l.status === "Behind")
        .reduce((s, l) => s + (l.outstanding / 12), 0); // installment estimation
      return `Rs. ${Math.round(activePending).toLocaleString()}`;
    }
    return `Rs. ${sum.toLocaleString()}`;
  }, [collections, loans, todayLabel]);

  const missedYesterdayVal = useMemo(() => {
    // Count overdue loans directly from Appwrite loans table
    const overdueCount = loans.filter((l) => l.status === "Overdue" || l.status.toLowerCase().includes("behind")).length;
    return overdueCount > 0 ? `${overdueCount} overdue` : "0 overdue";
  }, [loans]);

  const scheduledTomorrowVal = useMemo(() => {
    // Count active loans in system
    const activeLoans = loans.filter((l) => l.status === "Active" || l.status === "On Track").length;
    return activeLoans > 0 ? `${activeLoans} visits` : "0 visits";
  }, [loans]);

  const metrics = [
    {
      title: "COLLECTED TODAY",
      value: collectedTodayVal,
      icon: "cash-outline",
      iconBg: isDark ? "rgba(34, 197, 94, 0.18)" : "#e8fdf0",
      iconColor: "#22c55e",
    },
    {
      title: "PENDING TODAY",
      value: pendingTodayVal,
      icon: "time-outline",
      iconBg: isDark ? "rgba(249, 115, 22, 0.18)" : "#fff4e5",
      iconColor: "#f97316",
    },
    {
      title: "MISSED YESTERDAY",
      value: missedYesterdayVal,
      icon: "alert-circle-outline",
      iconBg: isDark ? "rgba(239, 68, 68, 0.18)" : "#fef2f2",
      iconColor: "#ef4444",
    },
    {
      title: "SCHEDULED TOMORROW",
      value: scheduledTomorrowVal,
      icon: "calendar-outline",
      iconBg: isDark ? "rgba(37, 99, 235, 0.18)" : "#eff6ff",
      iconColor: "#2563eb",
    },
  ];

  // Filtered collections records list
  const records = useMemo(() => {
    if (!selectedDateLabel) return [];
    const dailyCollected = collections.filter((r) => r.date === selectedDateLabel);
    
    // Get due installments for this date that are not collected yet
    const dailyInstallments = activeLoansInstallmentDates[selectedDateLabel] || [];
    
    const dueRecords: LocalCollectionRecord[] = [];
    dailyInstallments.forEach(inst => {
      // If the customer has already paid or has a collection entry on this date, do not duplicate it
      const alreadyLogged = dailyCollected.some(c => c.loan === inst.loanId);
      if (!alreadyLogged) {
        dueRecords.push({
          receipt: "DUE",
          time: "—",
          customer: inst.customerName,
          loan: inst.loanId,
          collector: inst.collector || "Mahesh K.",
          amount: inst.amount,
          status: "Promise to Pay", // orange pending badge
          date: selectedDateLabel,
        });
      }
    });
    
    const combined = [...dailyCollected, ...dueRecords];
    
    if (!searchQuery.trim()) return combined;
    return combined.filter(
      (r) =>
        r.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.receipt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.loan.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.collector.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [collections, activeLoansInstallmentDates, selectedDateLabel, searchQuery]);

  // Modal selector filters
  const filteredCustomersForModal = useMemo(() => {
    if (!modalSearch.trim()) return customers;
    return customers.filter(c => c.name.toLowerCase().includes(modalSearch.toLowerCase()) || c.nic.toLowerCase().includes(modalSearch.toLowerCase()));
  }, [customers, modalSearch]);

  const filteredLoansForSelectedCustomer = useMemo(() => {
    if (!formCustomer) return [];
    return loans.filter(l => l.customerId === (formCustomer.customerId || formCustomer.$id) && l.outstanding > 0);
  }, [loans, formCustomer]);

  // Select customer callback inside modal
  const handleSelectCustomer = (cust: any) => {
    setFormCustomer(cust);
    setFormLoan(null);
    setFormAmount("");
    // Find first active loan if any
    const firstLoan = loans.find(l => l.customerId === (cust.customerId || cust.$id) && l.outstanding > 0);
    if (firstLoan) {
      setFormLoan(firstLoan);
      // Pre-fill default installment estimation (e.g. amount / duration)
      const installmentEst = Math.round(firstLoan.amount / (firstLoan.duration || 12));
      setFormAmount(String(installmentEst));
      setFormCollector(firstLoan.collector || "Mahesh K.");
    }
  };

  const handleOpenBooking = (r: LocalCollectionRecord) => {
    const foundCustomer = customers.find(c => c.name === r.customer);
    const foundLoan = loans.find(l => l.$id === r.loan);
    
    if (foundCustomer && foundLoan) {
      setFormCustomer(foundCustomer);
      setFormLoan(foundLoan);
      setFormAmount(r.amount !== null ? String(Math.round(r.amount)) : "");
      setFormStatus("Collected");
      setFormCollector(foundLoan.collector || userProfile?.name || "Mahesh K.");
      setRecordModalVisible(true);
    } else {
      const fallbackCust = customers.find(c => c.name.toLowerCase() === r.customer.toLowerCase());
      if (fallbackCust) {
        setFormCustomer(fallbackCust);
        const fallbackLoan = loans.find(l => l.customerId === (fallbackCust.customerId || fallbackCust.$id) && l.outstanding > 0);
        if (fallbackLoan) {
          setFormLoan(fallbackLoan);
          setFormAmount(r.amount !== null ? String(Math.round(r.amount)) : "");
          setFormCollector(fallbackLoan.collector || userProfile?.name || "Mahesh K.");
        }
      }
      setRecordModalVisible(true);
    }
  };

  // Record Collection Form submission
  const handleRecordCollection = async () => {
    if (!formCustomer) {
      Alert.alert("Validation Error", "Please select a customer.");
      return;
    }
    if (!formLoan) {
      Alert.alert("Validation Error", "Selected customer has no active outstanding loans.");
      return;
    }
    if (!formAmount.trim() && formStatus === "Collected") {
      Alert.alert("Validation Error", "Please enter collection amount.");
      return;
    }

    setFormSubmitting(true);
    try {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const amtVal = formStatus === "Collected" ? parseFloat(formAmount) : null;
      
      const newRecord = {
        receiptId: `R-${Math.floor(90000 + Math.random() * 9999)}`,
        time: timeStr,
        customerName: formCustomer.name,
        loanId: formLoan.$id,
        collectorName: formCollector || "Mahesh K.",
        amount: amtVal,
        status: formStatus,
        date: selectedDateLabel || todayLabel,
      };

      // 1. Upload new collection document to Appwrite
      await addCollectionRecord(newRecord);

      // 2. If repayment is collected, update the loan totals in Appwrite
      if (formStatus === "Collected" && amtVal !== null) {
        const currentPaid = formLoan.paidAmount || 0;
        const currentOutstanding = formLoan.outstanding || 0;
        
        const newPaid = currentPaid + amtVal;
        const newOutstanding = Math.max(0, currentOutstanding - amtVal);
        const newStatus = newOutstanding === 0 ? "Fully Paid" : formLoan.status;

        // Pass direct loanId (Appwrite document ID) to update document fields
        await updateLoan(formLoan.$id, {
          paidAmount: newPaid,
          outstanding: newOutstanding,
          status: newStatus
        });
      }

      Alert.alert("Success", "Collection record has been successfully added to Appwrite.");
      setRecordModalVisible(false);
      
      // Reset Form states
      setFormCustomer(null);
      setFormLoan(null);
      setFormAmount("");
      setFormStatus("Collected");
      setModalSearch("");

      // Refresh dashboard datasets
      await loadData(true);
    } catch (err: any) {
      console.log("handleRecordCollection error:", err);
      Alert.alert("Submit Error", err.message || "Failed to create database document in Appwrite.");
    } finally {
      setFormSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.page, { justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 12, color: colors.bodyText, fontWeight: "600" }}>Loading Appwrite database...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: safeTop, backgroundColor: colors.bg }]}>
      
      {/* 1. Global Header Bar (Desktop & Web only) */}
      {!isCompact && (
        <View style={[styles.globalHeader, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
          {/* Search bar inside header */}
          <View style={[styles.headerSearchBox, { backgroundColor: colors.inputBg }]}>
            <Ionicons name="search" size={18} color={colors.subtleText} />
            <TextInput
              placeholder="Search customers, loans, receipts..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.headerSearchInput, { color: colors.inputText }]}
              placeholderTextColor={colors.inputPlaceholder}
            />
            <View style={[styles.shortcutBadge, { borderColor: colors.borderColor }]}>
              <Text style={[styles.shortcutText, { color: colors.subtleText }]}>⌘K</Text>
            </View>
          </View>

          {/* Right Controls */}
          <View style={styles.headerRightActions}>
            <Pressable style={({ pressed }) => [styles.mobileLink, pressed && styles.pressed]}>
              <Text style={styles.mobileLinkText}>Open mobile app →</Text>
            </Pressable>
            <View style={styles.bellWrapper}>
              <Ionicons name="notifications-outline" size={22} color={colors.titleText} />
              <View style={styles.notificationDot} />
            </View>
            <View style={[styles.verticalDivider, { backgroundColor: colors.borderColor }]} />
            <View style={styles.profileWrapper}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>
                  {userProfile?.name ? userProfile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : "AP"}
                </Text>
              </View>
              <View style={styles.profileMeta}>
                <Text style={[styles.profileName, { color: colors.titleText }]}>
                  {userProfile?.name || "Anuradha P."}
                </Text>
                <Text style={[styles.profileRole, { color: colors.subtleText }]}>
                  {userProfile?.email || "Tenant Owner"}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={colors.subtleText} />
            </View>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: contentPaddingBottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={["#2563eb"]} />
        }
      >
        
        {/* 2. Main Title Section */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.titleText }]}>Collections</Text>
          <Text style={[styles.pageSubtitle, { color: colors.bodyText }]}>
            Field collections, dues and follow-ups
          </Text>
        </View>

        {/* 3. Search Bar for Mobile View */}
        {isCompact && (
          <View style={[styles.mobileSearchBox, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
            <Ionicons name="search" size={20} color={colors.subtleText} />
            <TextInput
              placeholder="Search customers, loans, receipts..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.mobileSearchInput, { color: colors.inputText }]}
              placeholderTextColor={colors.inputPlaceholder}
            />
          </View>
        )}

        {/* 4. Metrics Grid Row */}
        <View style={[styles.metricsGrid, isCompact && styles.metricsGridMobile]}>
          {metrics.map((m) => (
            <View
              key={m.title}
              style={[
                styles.metricCard,
                { 
                  backgroundColor: colors.cardBg, 
                  padding: isCompact ? 14 : 20,
                  position: "relative",
                  minHeight: isCompact ? 82 : 104
                },
                isCompact && styles.metricCardMobile,
              ]}
            >
              <View style={{ paddingRight: isCompact ? 30 : 38 }}>
                <Text
                  style={[
                    styles.metricTitle,
                    {
                      color: colors.subtleText,
                      fontSize: isCompact ? 9.5 : 11,
                      lineHeight: isCompact ? 13 : 15,
                      marginBottom: isCompact ? 6 : 12,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {m.title}
                </Text>
                <Text
                  style={[
                    styles.metricValue,
                    { color: colors.titleText, fontSize: isCompact ? 18 : 26 },
                  ]}
                >
                  {m.value}
                </Text>
              </View>

              <View
                style={[
                  styles.metricIconBox,
                  {
                    backgroundColor: m.iconBg,
                    width: isCompact ? 26 : 32,
                    height: isCompact ? 26 : 32,
                    borderRadius: isCompact ? 8 : 10,
                    position: "absolute",
                    top: isCompact ? 14 : 20,
                    right: isCompact ? 14 : 20,
                  },
                ]}
              >
                <Ionicons name={m.icon as any} size={isCompact ? 14 : 18} color={m.iconColor} />
              </View>
            </View>
          ))}
        </View>

        {/* 5. Chart and Calendar Side-by-Side Row */}
        <View style={[styles.dashboardMidRow, (isCompact || isTablet) && styles.dashboardMidRowColumn]}>
          
          {/* Left Block: Chart Card */}
          <View style={[styles.midPanelCard, { flex: 1.6, backgroundColor: colors.cardBg }]} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
            <Text style={[styles.midCardTitle, { color: colors.titleText }]}>Collections vs target — 7 days</Text>
            
            <View style={styles.chartContainer}>
              <Svg height="190" width="100%">
                <Defs>
                  <LinearGradient id="chartGreenGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                    <Stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
                  </LinearGradient>
                </Defs>

                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const val = Math.round(maxCollectedScale * ratio);
                  const y = 160 - ratio * 140;
                  return (
                    <React.Fragment key={ratio}>
                      <Line
                        x1="45"
                        y1={y}
                        x2={chartWidth - 20}
                        y2={y}
                        stroke={colors.borderColor}
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <SvgText
                        x="36"
                        y={y + 4}
                        fill={colors.subtleText}
                        fontSize="10"
                        fontWeight="600"
                        textAnchor="end"
                      >
                        {val === 0 ? "Rs.0" : `Rs.${Math.round(val / 1000)}k`}
                      </SvgText>
                    </React.Fragment>
                  );
                })}

                <Path d={areaPathD} fill="url(#chartGreenGrad)" />
                <Path d={linePathD} fill="none" stroke="#22c55e" strokeWidth="2.5" />

                {/* X-Axis labels */}
                {past7Days.map((day, idx) => {
                  const paddingLeft = 45;
                  const paddingRight = 20;
                  const chartNetWidth = chartWidth - paddingLeft - paddingRight;
                  const x = paddingLeft + (idx / 6) * chartNetWidth;
                  return (
                    <SvgText
                      key={idx}
                      x={x}
                      y="182"
                      fill={colors.subtleText}
                      fontSize="11"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {day.dayName}
                    </SvgText>
                  );
                })}
              </Svg>
            </View>
          </View>

          {/* Right Block: Calendar Card */}
          <View style={[styles.midPanelCard, { flex: 1, backgroundColor: colors.cardBg }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 8, flexWrap: "wrap" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Pressable onPress={handlePrevMonth} style={({ pressed }) => [pressed && styles.pressed, { padding: 4 }]}>
                  <Ionicons name="chevron-back" size={20} color={colors.titleText} />
                </Pressable>
                <Text style={[styles.midCardTitle, { color: colors.titleText, marginBottom: 0 }]}>
                  {calendarData.monthName} {calendarData.year}
                </Text>
                <Pressable onPress={handleNextMonth} style={({ pressed }) => [pressed && styles.pressed, { padding: 4 }]}>
                  <Ionicons name="chevron-forward" size={20} color={colors.titleText} />
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", gap: 4 }}>
                <View style={[styles.legendIndicator, { backgroundColor: colors.blueActiveBg }]} />
                <Text style={[styles.legendIndicatorLabel, { color: colors.bodyText }]}>Paid</Text>
                <View style={[styles.legendIndicator, { backgroundColor: colors.blueScheduledBg, marginLeft: 6 }]} />
                <Text style={[styles.legendIndicatorLabel, { color: colors.bodyText }]}>Due</Text>
              </View>
            </View>
            
            <View style={styles.calendarWeekRow}>
              {["S", "M", "T", "W", "T", "F", "S"].map((w, idx) => (
                <Text key={idx} style={[styles.calendarWeekText, { color: colors.subtleText }]}>{w}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarData.cells.map((c, idx) => {
                const isActiveDate = c.dateStr === selectedDateLabel;
                
                return (
                  <View key={idx} style={styles.calendarCellContainer}>
                    <Pressable
                      disabled={c.type === "empty"}
                      onPress={() => {
                        if (c.dateStr) setSelectedDateLabel(c.dateStr);
                      }}
                      style={({ pressed }) => [
                        styles.calendarCell,
                        c.type === "active" && { backgroundColor: colors.blueActiveBg },
                        c.type === "scheduled" && { backgroundColor: colors.blueScheduledBg },
                        isActiveDate && { borderWidth: 2, borderColor: colors.titleText },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarCellText,
                          { color: colors.titleText },
                          c.type === "active" && { color: "#ffffff", fontWeight: "700" },
                          c.type === "scheduled" && { color: colors.blueScheduledText, fontWeight: "600" },
                          c.type === "empty" && { color: "transparent" },
                        ]}
                      >
                        {c.dayNum}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* 6. Today's Collections Section */}
        {selectedDateLabel && (
          <View style={[styles.recordsCard, { backgroundColor: colors.cardBg }]}>
            
            <View style={styles.recordsHeader}>
              <View>
                <Text style={[styles.recordsTitle, { color: colors.titleText }]}>
                  Collections on {selectedDateLabel}
                </Text>
                <Text style={[styles.recordsCount, { color: colors.bodyText, marginTop: 4 }]}>
                  {records.length} record{records.length !== 1 ? "s" : ""} in database
                </Text>
              </View>
            </View>

            {records.length === 0 ? (
              /* Empty State Layout */
              <View style={styles.emptyView}>
                <Ionicons name="receipt-outline" size={48} color={colors.subtleText} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyTitle, { color: colors.titleText }]}>No records found</Text>
                <Text style={[styles.emptySubtitle, { color: colors.bodyText }]}>
                  There are no collection entries saved in Appwrite for {selectedDateLabel}.
                </Text>
              </View>
            ) : isCompact ? (
              /* Compact Mobile Records List Layout */
              <View style={styles.mobileRecordsList}>
                {records.map((r, idx) => (
                  <View key={idx} style={[styles.mobileRecordRow, idx !== records.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.dividerColor }]}>
                    <View style={styles.mobileRowTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.recordCustomerName, { color: colors.titleText }]}>{r.customer}</Text>
                        <View style={styles.metaRow}>
                          <Text style={[styles.metaText, { color: colors.subtleText }]}>{r.receipt}</Text>
                          <Text style={[styles.bullet, { color: colors.subtleText }]}>•</Text>
                          <Text style={[styles.metaText, { color: colors.subtleText }]}>{r.time}</Text>
                          <Text style={[styles.bullet, { color: colors.subtleText }]}>•</Text>
                          <Text style={[styles.metaText, { color: colors.subtleText }]}>{r.loan}</Text>
                        </View>
                      </View>
                      <View style={styles.rightAmtBlock}>
                        <Text style={[styles.recordAmount, { color: colors.titleText }]}>
                          {r.amount !== null ? `Rs. ${r.amount.toLocaleString()}` : "—"}
                        </Text>
                        <View style={[
                          styles.recordBadge,
                          { backgroundColor: r.status === "Collected" ? colors.collectedBg : colors.promiseBg }
                        ]}>
                          <Text style={[
                            styles.recordBadgeText,
                            { color: r.status === "Collected" ? colors.collectedText : colors.promiseText }
                          ]}>
                            {r.status}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <Text style={[styles.recordCollectorText, { color: colors.bodyText }]}>
                        Collector: <Text style={{ fontWeight: "600" }}>{r.collector}</Text>
                      </Text>
                      {r.receipt === "DUE" && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.actionBtnMini,
                            { backgroundColor: colors.blueActiveBg },
                            pressed && styles.pressed
                          ]}
                          onPress={() => handleOpenBooking(r)}
                        >
                          <Text style={styles.actionBtnMiniText}>Record Payment</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              /* Wide Screen Desktop Records Table Layout */
              <View style={styles.table}>
                <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg, borderColor: colors.borderColor }]}>
                  <Text style={[styles.thText, { flex: 1, color: colors.subtleText }]}>Receipt</Text>
                  <Text style={[styles.thText, { flex: 1, color: colors.subtleText }]}>Time</Text>
                  <Text style={[styles.thText, { flex: 2.2, color: colors.subtleText }]}>Customer</Text>
                  <Text style={[styles.thText, { flex: 1.2, color: colors.subtleText }]}>Loan</Text>
                  <Text style={[styles.thText, { flex: 1.8, color: colors.subtleText }]}>Collector</Text>
                  <Text style={[styles.thText, { flex: 1.5, color: colors.subtleText }]}>Amount</Text>
                  <Text style={[styles.thText, { flex: 1.5, color: colors.subtleText }]}>Status</Text>
                  <Text style={[styles.thText, { flex: 1.5, color: colors.subtleText }]}>Action</Text>
                </View>

                {records.map((r, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.tableRow,
                      idx !== records.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.dividerColor }
                    ]}
                  >
                    <Text style={[styles.tdText, { flex: 1, color: colors.inputText, fontWeight: "600" }]}>{r.receipt}</Text>
                    <Text style={[styles.tdText, { flex: 1, color: colors.bodyText }]}>{r.time}</Text>
                    <Text style={[styles.tdText, { flex: 2.2, color: colors.inputText, fontWeight: "700" }]}>{r.customer}</Text>
                    <Text style={[styles.tdText, { flex: 1.2, color: colors.bodyText }]}>{r.loan}</Text>
                    <Text style={[styles.tdText, { flex: 1.8, color: colors.bodyText }]}>{r.collector}</Text>
                    <Text style={[styles.tdText, { flex: 1.5, color: colors.inputText, fontWeight: "700" }]}>
                      {r.amount !== null ? `Rs. ${r.amount.toLocaleString()}` : "—"}
                    </Text>
                    <View style={[styles.tdCell, { flex: 1.5, alignItems: "flex-start" }]}>
                      <View style={[
                        styles.recordBadge,
                        { backgroundColor: r.status === "Collected" ? colors.collectedBg : colors.promiseBg }
                      ]}>
                        <Text style={[
                          styles.recordBadgeText,
                          { color: r.status === "Collected" ? colors.collectedText : colors.promiseText }
                        ]}>
                          {r.status}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.tdCell, { flex: 1.5, alignItems: "flex-start" }]}>
                      {r.receipt === "DUE" ? (
                        <Pressable
                          style={({ pressed }) => [
                            styles.actionBtnMini,
                            { backgroundColor: colors.blueActiveBg },
                            pressed && styles.pressed
                          ]}
                          onPress={() => handleOpenBooking(r)}
                        >
                          <Text style={styles.actionBtnMiniText}>Record Payment</Text>
                        </Pressable>
                      ) : (
                        <Text style={[styles.tdText, { color: colors.subtleText }]}>—</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* 7. Record Collection / Receipt Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={recordModalVisible}
        onRequestClose={() => setRecordModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: isDark ? "rgba(0, 0, 0, 0.65)" : "rgba(15, 23, 42, 0.45)" }]}>
          <View style={[styles.modalContentCard, { backgroundColor: colors.cardBg, borderColor: colors.borderColor }]}>
            
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderColor }]}>
              <Text style={[styles.modalTitle, { color: colors.titleText }]}>Record Collection</Text>
              <Pressable onPress={() => setRecordModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.titleText} />
              </Pressable>
            </View>

            {/* Modal Scroll Content */}
            <ScrollView style={styles.modalFormBody}>
              
              {/* Customer Selector Block */}
              <View style={styles.formInputGroup}>
                <Text style={[styles.formLabel, { color: colors.subtleText }]}>Select Customer</Text>
                
                {/* Search customers inside selector */}
                <View style={[styles.modalSearchBox, { backgroundColor: colors.inputBg }]}>
                  <Ionicons name="search" size={16} color={colors.subtleText} />
                  <TextInput
                    placeholder="Search customer by name..."
                    value={modalSearch}
                    onChangeText={setModalSearch}
                    style={[styles.modalSearchInputText, { color: colors.inputText }]}
                    placeholderTextColor={colors.inputPlaceholder}
                  />
                </View>

                {/* Selected Tag Indicator */}
                {formCustomer ? (
                  <View style={[styles.selectedEntityTag, { backgroundColor: colors.inputBg, borderColor: colors.borderColor }]}>
                    <Ionicons name="person" size={16} color="#2563eb" />
                    <Text style={[styles.selectedEntityText, { color: colors.inputText }]}>
                      {formCustomer.name} ({formCustomer.nic})
                    </Text>
                    <Pressable onPress={() => { setFormCustomer(null); setFormLoan(null); }}>
                      <Ionicons name="close-circle" size={16} color="#ef4444" />
                    </Pressable>
                  </View>
                ) : (
                  /* Mini customer grid list to tap */
                  <ScrollView style={[styles.modalListContainer, { borderColor: colors.borderColor, maxHeight: 180 }]} nestedScrollEnabled={true}>
                    {filteredCustomersForModal.map((cust) => (
                      <Pressable
                        key={cust.id || cust.$id}
                        onPress={() => handleSelectCustomer(cust)}
                        style={({ pressed }) => [
                          styles.modalListItem,
                          { borderBottomColor: colors.dividerColor },
                          pressed && { backgroundColor: colors.inputBg }
                        ]}
                      >
                        <Text style={[styles.modalListItemText, { color: colors.inputText }]}>{cust.name}</Text>
                        <Text style={[styles.modalListItemSubtext, { color: colors.subtleText }]}>{cust.nic}</Text>
                      </Pressable>
                    ))}
                    {filteredCustomersForModal.length === 0 && (
                      <Text style={{ textAlign: "center", padding: 12, color: colors.subtleText, fontSize: 13 }}>
                        No customers found matching search.
                      </Text>
                    )}
                  </ScrollView>
                )}
              </View>

              {/* Active Loan Selector */}
              {formCustomer && (
                <View style={styles.formInputGroup}>
                  <Text style={[styles.formLabel, { color: colors.subtleText }]}>Select Loan Agreement</Text>
                  <ScrollView style={[styles.modalListContainer, { borderColor: colors.borderColor, maxHeight: 180 }]} nestedScrollEnabled={true}>
                    {filteredLoansForSelectedCustomer.map((l) => {
                      const isSelected = formLoan?.$id === l.$id;
                      return (
                        <Pressable
                          key={l.$id}
                          onPress={() => {
                            setFormLoan(l);
                            const installmentEst = Math.round(l.amount / (l.duration || 12));
                            setFormAmount(String(installmentEst));
                          }}
                          style={[
                            styles.modalListItem,
                            { borderBottomColor: colors.dividerColor },
                            isSelected && { backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "#eff6ff" }
                          ]}
                        >
                          <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
                            <Text style={[styles.modalListItemText, { color: colors.inputText, fontWeight: "700" }]}>
                              {l.$id} ({l.loanType})
                            </Text>
                            <Text style={{ color: "#2563eb", fontWeight: "800", fontSize: 13 }}>
                              Outstanding: Rs. {l.outstanding.toLocaleString()}
                            </Text>
                          </View>
                          <Text style={[styles.modalListItemSubtext, { color: colors.subtleText, marginTop: 4 }]}>
                            Principal: Rs. {l.amount.toLocaleString()} · Collector: {l.collector}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {filteredLoansForSelectedCustomer.length === 0 && (
                      <Text style={{ textAlign: "center", padding: 12, color: "#ef4444", fontSize: 13, fontWeight: "600" }}>
                        This customer has no active loans with outstanding balances.
                      </Text>
                    )}
                  </ScrollView>
                </View>
              )}

              {/* Status Selector */}
              <View style={styles.formInputGroup}>
                <Text style={[styles.formLabel, { color: colors.subtleText }]}>Collection Status</Text>
                <View style={styles.statusSelectRow}>
                  {(["Collected", "Promise to Pay"] as const).map((s) => {
                    const isSelected = formStatus === s;
                    return (
                      <Pressable
                        key={s}
                        onPress={() => setFormStatus(s)}
                        style={[
                          styles.statusSelectCell,
                          { backgroundColor: colors.inputBg, borderColor: colors.borderColor },
                          isSelected && {
                            backgroundColor: s === "Collected" ? colors.collectedBg : colors.promiseBg,
                            borderColor: s === "Collected" ? colors.collectedText : colors.promiseText,
                            borderWidth: 2
                          }
                        ]}
                      >
                        <Text style={[
                          styles.statusSelectCellText,
                          { color: colors.bodyText },
                          isSelected && { color: s === "Collected" ? colors.collectedText : colors.promiseText, fontWeight: "800" }
                        ]}>
                          {s}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Amount Input */}
              {formStatus === "Collected" && (
                <View style={styles.formInputGroup}>
                  <Text style={[styles.formLabel, { color: colors.subtleText }]}>Collected Amount (Rs.)</Text>
                  <TextInput
                    placeholder="e.g. 5000"
                    value={formAmount}
                    onChangeText={setFormAmount}
                    keyboardType="numeric"
                    style={[styles.formTextInputElement, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }]}
                    placeholderTextColor={colors.inputPlaceholder}
                  />
                </View>
              )}

              {/* Collector Name Input */}
              <View style={styles.formInputGroup}>
                <Text style={[styles.formLabel, { color: colors.subtleText }]}>Collector Name</Text>
                <TextInput
                  placeholder="e.g. Mahesh K."
                  value={formCollector}
                  onChangeText={setFormCollector}
                  style={[styles.formTextInputElement, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }]}
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>

              {/* Selected Date Indicator */}
              <View style={[styles.formInputGroup, { marginBottom: 32 }]}>
                <Text style={[styles.formLabel, { color: colors.subtleText }]}>Receipt Booking Date</Text>
                <View style={[styles.dateReadbox, { backgroundColor: colors.inputBg, borderColor: colors.borderColor }]}>
                  <Ionicons name="calendar" size={16} color={colors.subtleText} />
                  <Text style={{ color: colors.inputText, fontWeight: "600", marginLeft: 8 }}>{selectedDateLabel}</Text>
                  <Text style={{ color: colors.subtleText, fontSize: 11, marginLeft: "auto" }}>(Pre-selected from calendar)</Text>
                </View>
              </View>

              {/* Submit Action Button */}
              <Pressable
                disabled={formSubmitting}
                style={({ pressed }) => [
                  styles.formSubmitBtn,
                  pressed && styles.pressed,
                  formSubmitting && { opacity: 0.6 }
                ]}
                onPress={handleRecordCollection}
              >
                {formSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.formSubmitBtnText}>Book Collection Receipt</Text>
                )}
              </Pressable>

            </ScrollView>
          </View>
        </View>
      </Modal>

      <BottomTabBar activeTab="collections" />
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
  pressed: {
    opacity: 0.75,
  },
  
  // 1. Desktop Global Header styling
  globalHeader: {
    height: 70,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    zIndex: 10,
  },
  headerSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    width: 380,
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  headerSearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    padding: 0,
  },
  shortcutBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  shortcutText: {
    fontSize: 10,
    fontWeight: "700",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  mobileLink: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  mobileLinkText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "600",
  },
  bellWrapper: {
    position: "relative",
    padding: 6,
    cursor: "pointer",
  },
  notificationDot: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  verticalDivider: {
    width: 1,
    height: 32,
  },
  profileWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  profileMeta: {
    justifyContent: "center",
  },
  profileName: {
    fontSize: 14,
    fontWeight: "700",
  },
  profileRole: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },

  // 2. Page Title styling
  pageTitleContainer: {
    marginBottom: 24,
    marginTop: 8,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 15,
    marginTop: 6,
    fontWeight: "500",
  },

  // 3. Mobile Search Styling
  mobileSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 10,
  },
  mobileSearchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },

  // 4. Metrics Grid styling
  metricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
  },
  metricsGridMobile: {
    flexWrap: "wrap",
  },
  metricCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  metricCardMobile: {
    width: "47.5%",
    minWidth: "47.5%",
    flex: 0,
  },
  metricTitle: {
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  metricIconBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  // 5. Middle dashboard blocks
  dashboardMidRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 24,
  },
  dashboardMidRowColumn: {
    flexDirection: "column",
  },
  midPanelCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  midCardTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  chartContainer: {
    minHeight: 190,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },

  // Calendar styling
  calendarWeekRow: {
    flexDirection: "row",
    marginBottom: 14,
    width: "100%",
  },
  calendarWeekText: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    rowGap: 10,
  },
  calendarCellContainer: {
    width: `${100 / 7}%`,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarCell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarCellText: {
    fontSize: 13,
    fontWeight: "500",
  },
  legendIndicator: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendIndicatorLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },

  // 6. Data table styling
  recordsCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    marginBottom: 20,
  },
  recordsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  recordsTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  recordsCount: {
    fontSize: 13,
    fontWeight: "600",
  },
  recordBtn: {
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  recordBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderRadius: 12,
  },
  thText: {
    fontSize: 12,
    fontWeight: "700",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  tdText: {
    fontSize: 14,
    fontWeight: "500",
  },
  tdCell: {
    justifyContent: "center",
  },

  // Empty State illustration
  emptyView: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 18,
  },

  // Record Badge Badges
  recordBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  recordBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },

  // Mobile records list styling
  mobileRecordsList: {
    flexDirection: "column",
  },
  mobileRecordRow: {
    paddingVertical: 16,
  },
  mobileRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  recordCustomerName: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  bullet: {
    fontSize: 10,
  },
  rightAmtBlock: {
    alignItems: "flex-end",
    gap: 6,
  },
  recordAmount: {
    fontSize: 16,
    fontWeight: "800",
  },
  recordCollectorText: {
    fontSize: 13,
  },

  // Modal styling
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContentCard: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "85%",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalFormBody: {
    padding: 24,
  },
  formInputGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  modalSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 10,
  },
  modalSearchInputText: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  selectedEntityTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  selectedEntityText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  modalListContainer: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
    maxHeight: 180,
  },
  modalListItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalListItemText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalListItemSubtext: {
    fontSize: 11,
    fontWeight: "500",
  },
  statusSelectRow: {
    flexDirection: "row",
    gap: 12,
  },
  statusSelectCell: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusSelectCellText: {
    fontSize: 13,
    fontWeight: "600",
  },
  formTextInputElement: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: "600",
  },
  dateReadbox: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  formSubmitBtn: {
    backgroundColor: "#2563eb",
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  formSubmitBtnText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
  },
  actionBtnMini: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnMiniText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
});
