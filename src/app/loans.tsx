import { BottomTabBar } from "@/components/bottom-tab-bar";
import { getCustomers, getLoans, addLoan, updateLoan, getSettings, getCollectors, getBranches } from "@/lib/appwrite";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
}

interface Loan {
  id: string; // e.g., L-44012
  documentId?: string; // Appwrite Document ID
  customerId: string;
  customerName: string;
  branch: string;
  loanType: "Daily" | "Weekly" | "Monthly";
  collector: string;
  amount: number;
  interestRate: number;
  duration: number;
  disbursementDate: string;
  loanPurpose: string;
  outstanding: number;
  paidAmount: number;
  status: "active" | "overdue" | "closed" | "renewed";
  risk?: "Low" | "Medium" | "High";
}





let inMemoryUnsyncedLoans: Loan[] = [];

const COLLECTOR_OPTIONS = ["Mahesh Kularatne", "Suresh Perera", "Anura Silva", "Nimal Jayasinghe"];

export default function LoansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const safeBottom = insets?.bottom ?? 0;
  const safeTop = insets?.top ?? 0;
  const contentPaddingBottom = safeBottom + 110;
  const isCompact = width < 760;

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const colors = {
    bg: isDark ? "#0f172a" : "#ecf2ff",
    cardBg: isDark ? "#1e293b" : "#ffffff",
    titleText: isDark ? "#ffffff" : "#192a4a",
    bodyText: isDark ? "#94a3b8" : "#6b7a99",
    subtleText: isDark ? "#64748b" : "#8a92a6",
    inputText: isDark ? "#ffffff" : "#192a4a",
    inputBg: isDark ? "#0f172a" : "#f4f7ff",
    inputPlaceholder: isDark ? "#475569" : "#a0aec0",
    borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#e2e8f0",
    borderColorLight: isDark ? "rgba(255, 255, 255, 0.08)" : "#f1f3f7",
    tableHeaderBg: isDark ? "#0f172a" : "#fcfdff",
    searchBoxBg: isDark ? "#1e293b" : "#ffffff",
    compactCardBg: isDark ? "#0f172a" : "#f8faff",
    stepCircleActiveBg: "#3366ff",
    stepCircleInactiveBg: isDark ? "#1e293b" : "#ffffff",
    stepCircleActiveBorder: "#3366ff",
    stepCircleInactiveBorder: isDark ? "#475569" : "#cbd5e1",
    stepTextActive: "#3366ff",
    stepTextInactive: isDark ? "#64748b" : "#cbd5e1",
    dividerColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#e2e8f0",
    toggleBtnActiveBg: "#3366ff",
    toggleBtnInactiveBg: isDark ? "#0f172a" : "#ffffff",
    repaymentOverlayBg: isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.4)",
  };

  // State
  const [loans, setLoans] = useState<Loan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingLoan, setIsAddingLoan] = useState(false);

  // Wizard State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [collectorOptions, setCollectorOptions] = useState<string[]>(COLLECTOR_OPTIONS);
  
  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [loanType, setLoanType] = useState<"Daily" | "Weekly" | "Monthly">("Daily");
  const [selectedCollector, setSelectedCollector] = useState(COLLECTOR_OPTIONS[0]);
  const [amountStr, setAmountStr] = useState("100000");
  const [interestStr, setInterestStr] = useState("20");
  const [durationStr, setDurationStr] = useState("60");
  const [disbursementDateStr, setDisbursementDateStr] = useState("06/17/2026");
  const [loanPurposeStr, setLoanPurposeStr] = useState("Working capital, equipment, etc.");

  // Selector Modal UI states & search queries
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [collectorModalVisible, setCollectorModalVisible] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [collectorSearch, setCollectorSearch] = useState("");
  const [planModalVisible, setPlanModalVisible] = useState(false);

  // Calendar Modal UI states & helpers
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [viewDate, setViewDate] = useState(new Date(2026, 5, 17));

  const getParsedDate = (dateStr: string) => {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const m = parseInt(parts[0], 10) - 1;
      const d = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      const parsed = new Date(y, m, d);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  };

  const handleSelectCalendarDate = (date: Date) => {
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const yyyy = date.getFullYear();
    setDisbursementDateStr(`${mm}/${dd}/${yyyy}`);
    setCalendarModalVisible(false);
  };

  const syncUnsyncedLoans = async () => {
    try {
      let storageUnsynced: Loan[] = [];
      try {
        const storedUnsynced = await AsyncStorage.getItem('LENDING_APP_UNSYNCED_LOANS');
        if (storedUnsynced) {
          const parsed = JSON.parse(storedUnsynced);
          if (Array.isArray(parsed)) {
            storageUnsynced = parsed;
          }
        }
      } catch (storageErr) {
        console.log("AsyncStorage read error in syncUnsyncedLoans:", storageErr);
      }

      // Merge both in-memory and AsyncStorage lists (avoiding duplicates)
      const mergedUnsynced = [...inMemoryUnsyncedLoans];
      for (const loan of storageUnsynced) {
        if (!mergedUnsynced.some(l => l.id === loan.id)) {
          mergedUnsynced.push(loan);
        }
      }

      if (mergedUnsynced.length === 0) return;

      console.log(`Attempting to sync ${mergedUnsynced.length} unsynced loans...`);
      const remaining: Loan[] = [];

      for (const loan of mergedUnsynced) {
        try {
          await addLoan({
            loanId: loan.id,
            customerId: loan.customerId,
            customerName: loan.customerName,
            branch: loan.branch,
            loanType: loan.loanType,
            collector: loan.collector,
            amount: loan.amount,
            interestRate: loan.interestRate,
            duration: loan.duration,
            disbursementDate: loan.disbursementDate,
            loanPurpose: loan.loanPurpose,
            outstanding: loan.outstanding,
            paidAmount: loan.paidAmount,
            status: loan.status,
            risk: "Low"
          });
          console.log(`Synced loan ${loan.id} successfully!`);
        } catch (syncErr) {
          console.log(`Failed to sync loan ${loan.id}:`, syncErr);
          remaining.push(loan);
        }
      }

      inMemoryUnsyncedLoans = [...remaining];

      try {
        await AsyncStorage.setItem('LENDING_APP_UNSYNCED_LOANS', JSON.stringify(remaining));
      } catch (cacheErr) {
        console.log("Error writing remaining unsynced loans to storage:", cacheErr);
      }
    } catch (err) {
      console.log("Error in syncUnsyncedLoans:", err);
    }
  };

  const generateCalendarGrid = (viewDate: Date) => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    const cells: { dayNum: number; isCurrentMonth: boolean; dateObj: Date }[] = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      cells.push({
        dayNum,
        isCurrentMonth: false,
        dateObj: new Date(prevYear, prevMonth, dayNum)
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      cells.push({
        dayNum: i,
        isCurrentMonth: true,
        dateObj: new Date(year, month, i)
      });
    }

    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      cells.push({
        dayNum: i,
        isCurrentMonth: false,
        dateObj: new Date(nextYear, nextMonth, i)
      });
    }

    return cells;
  };

  // Details Modal state
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [collectedAmountStr, setCollectedAmountStr] = useState("");
  const [recordingCollection, setRecordingCollection] = useState(false);

  // Fetch Data on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      // Try to sync any local unsynced loans first
      try {
        await syncUnsyncedLoans();
      } catch (syncErr) {
        console.log("Auto-sync error:", syncErr);
      }

      // 1. Try to load dynamic branches and collectors from Appwrite databases
      let activeBranches: string[] = [];
      let activeCollectors: string[] = [];

      try {
        const remoteBranches = await getBranches();
        if (remoteBranches && remoteBranches.length > 0) {
          activeBranches = remoteBranches.map((b: any) => b.name);
        }
      } catch (remoteErr) {
        console.log("Failed to load branches from Appwrite, using storage cache fallback:", remoteErr);
      }

      try {
        const remoteCols = await getCollectors();
        if (remoteCols && remoteCols.length > 0) {
          activeCollectors = remoteCols.map((c: any) => c.name);
        }
      } catch (remoteErr) {
        console.log("Failed to load collectors from Appwrite, using storage cache fallback:", remoteErr);
      }

      // 2. Local AsyncStorage fallback / cache check if remote failed or was empty
      if (activeBranches.length === 0) {
        try {
          const storedBranches = await AsyncStorage.getItem('LENDING_APP_BRANCHES');
          if (storedBranches) {
            const parsed = JSON.parse(storedBranches);
            if (Array.isArray(parsed) && parsed.length > 0) {
              activeBranches = parsed.map((b: any) => typeof b === 'object' ? b.name : b);
            }
          }
        } catch (err) {
          console.log("Error reading branches from storage cache:", err);
        }
      }

      if (activeCollectors.length === 0) {
        try {
          const storedCollectors = await AsyncStorage.getItem('LENDING_APP_COLLECTORS');
          if (storedCollectors) {
            const parsed = JSON.parse(storedCollectors);
            if (Array.isArray(parsed) && parsed.length > 0) {
              activeCollectors = parsed.map((c: any) => typeof c === 'object' ? c.name : c);
            }
          }
        } catch (err) {
          console.log("Error reading collectors from storage cache:", err);
        }
      }

      // If still empty after all attempts, leave empty (no hardcoded defaults)
      if (activeCollectors.length === 0) {
        activeCollectors = COLLECTOR_OPTIONS;
      }

      setBranchOptions(activeBranches);
      setSelectedBranch((prev) => activeBranches.includes(prev) ? prev : activeBranches[0]);

      setCollectorOptions(activeCollectors);
      setSelectedCollector((prev) => activeCollectors.includes(prev) ? prev : activeCollectors[0]);

      // Cache the loaded parameters locally
      try {
        await AsyncStorage.setItem('LENDING_APP_BRANCHES', JSON.stringify(activeBranches));
        await AsyncStorage.setItem('LENDING_APP_COLLECTORS', JSON.stringify(activeCollectors));
      } catch (cacheErr) {
        console.log("Error caching branches/collectors:", cacheErr);
      }

      // Load Customers
      try {
        const custDocs = await getCustomers();
        if (custDocs && custDocs.length > 0) {
          const mappedCusts: Customer[] = custDocs.map((doc: any) => ({
            id: doc.customerId || doc.$id,
            name: doc.name,
            nic: doc.nic,
            phone: doc.phone
          }));
          setCustomers(mappedCusts);
          setSelectedCustomerId(mappedCusts[0].id);
        }
      } catch (custErr) {
        console.log("Failed to load customers from Appwrite:", custErr);
      }

      // Load Loans
      let remoteLoans: Loan[] = [];
      try {
        const loanDocs = await getLoans();
        if (loanDocs && loanDocs.length > 0) {
          remoteLoans = loanDocs.map((doc: any) => ({
            id: doc.$id || doc.loanId,
            documentId: doc.$id,
            customerId: doc.customerId,
            customerName: doc.customerName,
            branch: doc.branch,
            loanType: doc.loanType as "Daily" | "Weekly" | "Monthly",
            collector: doc.collector,
            amount: doc.amount,
            interestRate: doc.interestRate,
            duration: doc.duration,
            disbursementDate: doc.disbursementDate,
            loanPurpose: doc.loanPurpose,
            outstanding: doc.outstanding,
            paidAmount: doc.paidAmount,
            status: doc.status as "active" | "overdue" | "closed" | "renewed",
            risk: doc.risk
          }));
        }
      } catch (loanErr) {
        console.log("Failed to load loans from Appwrite:", loanErr);
      }

      // Load locally stored unsynced loans, merging in-memory and AsyncStorage
      let unsyncedLoans: Loan[] = [...inMemoryUnsyncedLoans];
      try {
        const storedUnsynced = await AsyncStorage.getItem('LENDING_APP_UNSYNCED_LOANS');
        if (storedUnsynced) {
          const parsed = JSON.parse(storedUnsynced);
          if (Array.isArray(parsed)) {
            for (const loan of parsed) {
              if (!unsyncedLoans.some((l) => l.id === loan.id)) {
                unsyncedLoans.push(loan);
              }
            }
          }
        }
      } catch (cacheErr) {
        console.log("Failed to load unsynced loans from cache:", cacheErr);
      }

      // Update in-memory with the combined unsynced list (in case AsyncStorage has items not in memory)
      inMemoryUnsyncedLoans = [...unsyncedLoans];

      // Combine with remote loans (avoiding duplicates)
      const combinedLoans = [...unsyncedLoans];
      for (const rL of remoteLoans) {
        if (!combinedLoans.some((l) => l.id === rL.id)) {
          combinedLoans.push(rL);
        }
      }
      setLoans(combinedLoans);
    } catch (err) {
      console.log("Using local mock data fallbacks due to offline database/collection:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Calculations for Form
  const amount = Number(amountStr) || 0;
  const interestRate = Number(interestStr) || 0;
  const duration = Number(durationStr) || 1;

  const calculatedSummary = useMemo(() => {
    const totalInterest = amount * (interestRate / 100);
    const totalRepayment = amount + totalInterest;
    const installmentAmount = totalRepayment / duration;

    // End date calculation
    const parts = disbursementDateStr.split("/");
    let endDateFormatted = "";
    if (parts.length === 3) {
      const m = parseInt(parts[0], 10) - 1;
      const d = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      const dateObj = new Date(y, m, d);
      if (loanType === "Daily") {
        dateObj.setDate(dateObj.getDate() + duration);
      } else if (loanType === "Weekly") {
        dateObj.setDate(dateObj.getDate() + duration * 7);
      } else {
        dateObj.setMonth(dateObj.getMonth() + duration);
      }
      endDateFormatted = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
    }

    return {
      principal: amount,
      totalInterest,
      totalRepayment,
      installmentAmount,
      endDateFormatted
    };
  }, [amount, interestRate, duration, loanType, disbursementDateStr]);

  // Generated Installments (First 8)
  const scheduleInstallments = useMemo(() => {
    const schedule = [];
    const parts = disbursementDateStr.split("/");
    if (parts.length === 3) {
      const m = parseInt(parts[0], 10) - 1;
      const d = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      const baseDate = new Date(y, m, d);

      for (let i = 1; i <= Math.min(duration, 8); i++) {
        const dueDateObj = new Date(baseDate);
        if (loanType === "Daily") {
          dueDateObj.setDate(baseDate.getDate() + i);
        } else if (loanType === "Weekly") {
          dueDateObj.setDate(baseDate.getDate() + i * 7);
        } else {
          dueDateObj.setMonth(baseDate.getMonth() + i);
        }
        const formattedDueDate = `${dueDateObj.getMonth() + 1}/${dueDateObj.getDate()}/${dueDateObj.getFullYear()}`;
        const remaining = Math.max(0, calculatedSummary.totalRepayment - (calculatedSummary.installmentAmount * i));
        schedule.push({
          num: i,
          dueDate: formattedDueDate,
          installment: calculatedSummary.installmentAmount,
          remaining
        });
      }
    }
    return schedule;
  }, [disbursementDateStr, duration, loanType, calculatedSummary]);

  // Dynamic Metrics
  const stats = useMemo(() => {
    let active = 0;
    let overdue = 0;
    let closed = 0;
    let renewed = 0;
    loans.forEach((l) => {
      if (l.status === "active") active++;
      else if (l.status === "overdue") overdue++;
      else if (l.status === "closed") closed++;
      else if (l.status === "renewed") renewed++;
    });
    return { active, overdue, closed, renewed };
  }, [loans]);

  // Filtered list
  const filteredLoans = useMemo(() => {
    if (!searchQuery.trim()) return loans;
    const q = searchQuery.toLowerCase();
    return loans.filter(
      (l) =>
        l.id.toLowerCase().includes(q) ||
        l.customerName.toLowerCase().includes(q) ||
        l.branch.toLowerCase().includes(q)
    );
  }, [loans, searchQuery]);

  const selectedCustomerName = useMemo(() => {
    if (customers.length === 0) return "Loading customers...";
    const cust = customers.find((c) => c.id === selectedCustomerId);
    return cust ? `${cust.name} · ${cust.id}` : "Select a customer";
  }, [selectedCustomerId, customers]);

  const filteredCustomersList = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const filteredBranchesList = useMemo(() => {
    if (!branchSearch.trim()) return branchOptions;
    const q = branchSearch.toLowerCase();
    return branchOptions.filter((b) => b.toLowerCase().includes(q));
  }, [branchOptions, branchSearch]);

  const filteredCollectorsList = useMemo(() => {
    if (!collectorSearch.trim()) return collectorOptions;
    const q = collectorSearch.toLowerCase();
    return collectorOptions.filter((col) => col.toLowerCase().includes(q));
  }, [collectorOptions, collectorSearch]);

  // Actions
  const handleDisburseLoan = async () => {
    if (amount <= 0 || duration <= 0) {
      Alert.alert("Validation Error", "Please check loan amount and duration.");
      return;
    }
    const customerObj = customers.find((c) => c.id === selectedCustomerId);
    if (!customerObj) {
      Alert.alert("Validation Error", "Invalid customer selected.");
      return;
    }

    setLoading(true);
    const newIdNum = loans.reduce((max, l) => {
      const num = parseInt(l.id.replace("L-", ""), 10);
      return num > max ? num : max;
    }, 44019);
    const newLoanId = `L-${newIdNum + 1}`;

    const newLoan: Loan = {
      id: newLoanId,
      customerId: selectedCustomerId,
      customerName: customerObj.name,
      branch: selectedBranch,
      loanType: loanType,
      collector: selectedCollector,
      amount: amount,
      interestRate: interestRate,
      duration: duration,
      disbursementDate: disbursementDateStr,
      loanPurpose: loanPurposeStr,
      outstanding: calculatedSummary.totalRepayment,
      paidAmount: 0,
      status: "active"
    };

    try {
      await addLoan({
        loanId: newLoan.id,
        customerId: newLoan.customerId,
        customerName: newLoan.customerName,
        branch: newLoan.branch,
        loanType: newLoan.loanType,
        collector: newLoan.collector,
        amount: newLoan.amount,
        interestRate: newLoan.interestRate,
        duration: newLoan.duration,
        disbursementDate: newLoan.disbursementDate,
        loanPurpose: newLoan.loanPurpose,
        outstanding: newLoan.outstanding,
        paidAmount: newLoan.paidAmount,
        status: newLoan.status,
        risk: "Low"
      });
      Alert.alert("Success", `Loan ${newLoanId} disbursed successfully!`);
    } catch (err) {
      console.log("Could not save loan to Appwrite. Saving locally instead.", err);
      
      // Update in-memory cache immediately
      if (!inMemoryUnsyncedLoans.some(l => l.id === newLoan.id)) {
        inMemoryUnsyncedLoans.push(newLoan);
      }

      try {
        const storedUnsynced = await AsyncStorage.getItem('LENDING_APP_UNSYNCED_LOANS');
        const unsyncedList = storedUnsynced ? JSON.parse(storedUnsynced) : [];
        if (!unsyncedList.some((l: Loan) => l.id === newLoan.id)) {
          unsyncedList.push(newLoan);
        }
        await AsyncStorage.setItem('LENDING_APP_UNSYNCED_LOANS', JSON.stringify(unsyncedList));
      } catch (cacheErr) {
        console.log("Error caching unsynced loan:", cacheErr);
      }
      Alert.alert("Success (Offline)", "Saved loan locally because database is offline or unauthorized.");
    }
    
    // Refresh and close form
    await loadData();
    setIsAddingLoan(false);
    setCurrentStep(1); // Reset step
  };

  const handleRecordCollection = async () => {
    const payAmt = Number(collectedAmountStr);
    if (!selectedLoan || isNaN(payAmt) || payAmt <= 0) {
      Alert.alert("Validation Error", "Please enter a valid amount.");
      return;
    }

    setRecordingCollection(true);
    const newOutstanding = Math.max(0, selectedLoan.outstanding - payAmt);
    const newPaidAmount = selectedLoan.paidAmount + payAmt;
    const newStatus = newOutstanding <= 0 ? "closed" : selectedLoan.status;

    try {
      if (selectedLoan.documentId) {
        await updateLoan(selectedLoan.documentId, {
          outstanding: newOutstanding,
          paidAmount: newPaidAmount,
          status: newStatus
        });
      } else {
        throw new Error("No Appwrite Document ID found. Local fallback update.");
      }
      Alert.alert("Success", "Collection recorded successfully!");
    } catch (err) {
      console.log("Repayment update failed on Appwrite, using local update:", err);
      // Local updates
      setLoans((prevLoans) =>
        prevLoans.map((l) =>
          l.id === selectedLoan.id
            ? { ...l, outstanding: newOutstanding, paidAmount: newPaidAmount, status: newStatus }
            : l
        )
      );
      Alert.alert("Success (Local)", "Collection recorded locally!");
    } finally {
      setRecordingCollection(false);
      setDetailsModalVisible(false);
      setCollectedAmountStr("");
      setSelectedLoan(null);
      await loadData();
    }
  };

  // Helper for Badge styling
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "active":
        return { bg: "#e8efff", text: "#3366ff" };
      case "overdue":
        return { bg: "#ffebeb", text: "#ff4d4f" };
      case "closed":
        return { bg: "#e6f8ef", text: "#2ecc71" };
      case "renewed":
        return { bg: "#f0f4ff", text: "#5f6fc1" };
      default:
        return { bg: "#f4f7ff", text: "#7a859d" };
    }
  };

  const getLoanEndDate = (loan: any) => {
    if (!loan || !loan.disbursementDate) return "—";
    const parts = loan.disbursementDate.split("/");
    if (parts.length !== 3) return "—";
    
    const m = parseInt(parts[0], 10) - 1;
    const d = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    const baseDate = new Date(y, m, d);
    if (isNaN(baseDate.getTime())) return "—";

    const endDateObj = new Date(baseDate);
    if (loan.loanType === "Daily") {
      endDateObj.setDate(baseDate.getDate() + loan.duration);
    } else if (loan.loanType === "Weekly") {
      endDateObj.setDate(baseDate.getDate() + loan.duration * 7);
    } else {
      endDateObj.setMonth(baseDate.getMonth() + loan.duration);
    }
    
    return `${endDateObj.getMonth() + 1}/${endDateObj.getDate()}/${endDateObj.getFullYear()}`;
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />
        }
      >
        {!isAddingLoan ? (
          /* LIST SCREEN VIEW */
          <View>
            <View style={styles.header}>
              <View style={styles.titleArea}>
                <Text style={[styles.title, { color: colors.titleText }]}>Loans</Text>
                <Text style={[styles.subtitle, { color: colors.bodyText }]}>All loans across the portfolio</Text>
              </View>
              <Pressable style={styles.newLoanBtn} onPress={() => { setIsAddingLoan(true); setCurrentStep(1); }}>
                <Ionicons name="add" size={18} color="#fff" style={styles.btnIcon} />
                <Text style={styles.newLoanBtnText}>New Loan</Text>
              </Pressable>
            </View>

            {/* Stats Cards Row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statsRow}
            >
              <View style={[styles.statCard, { backgroundColor: colors.cardBg }]}>
                <Text style={[styles.statLabelText, { color: colors.subtleText }]}>Active</Text>
                <Text style={[styles.statValueText, { color: colors.titleText }]}>{stats.active}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.cardBg }]}>
                <Text style={[styles.statLabelText, { color: colors.subtleText }]}>Overdue</Text>
                <Text style={[styles.statValueText, { color: colors.titleText }]}>{stats.overdue}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.cardBg }]}>
                <Text style={[styles.statLabelText, { color: colors.subtleText }]}>Closed</Text>
                <Text style={[styles.statValueText, { color: colors.titleText }]}>{stats.closed}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.cardBg }]}>
                <Text style={[styles.statLabelText, { color: colors.subtleText }]}>Renewed</Text>
                <Text style={[styles.statValueText, { color: colors.titleText }]}>{stats.renewed}</Text>
              </View>
            </ScrollView>

            {/* Search Bar */}
            <View style={[styles.searchBar, { backgroundColor: colors.searchBoxBg }]}>
              <Ionicons name="search" size={20} color={isDark ? "#64748b" : "#7a859d"} style={styles.searchIcon} />
              <TextInput
                placeholder="Search loans by customer name, ID, branch..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.searchInput, { color: colors.inputText }]}
                placeholderTextColor={colors.inputPlaceholder}
              />
            </View>

            {/* Loans Table (Web/Desktop Layout) or Cards (Mobile Layout) */}
            <View style={[styles.cardContainer, { backgroundColor: colors.cardBg }]}>
              {isCompact ? (
                /* Mobile Layout - Cards */
                <View style={styles.compactList}>
                  {filteredLoans.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.subtleText }]}>No loans found</Text>
                  ) : (
                    filteredLoans.map((loan) => {
                      const totalRepayable = loan.amount + (loan.amount * (loan.interestRate / 100));
                      const progress = totalRepayable > 0 ? (loan.paidAmount / totalRepayable) * 100 : 0;
                      const badge = getStatusStyle(loan.status);

                      return (
                        <Pressable
                          key={loan.id}
                          style={[styles.compactCard, { backgroundColor: colors.compactCardBg, borderColor: colors.borderColor }]}
                          onPress={() => {
                            setSelectedLoan(loan);
                            setDetailsModalVisible(true);
                          }}
                        >
                          <View style={styles.compactCardHeader}>
                            <View>
                              <Text style={[styles.customerNameText, { color: colors.titleText }]}>{loan.customerName}</Text>
                              <Text style={[styles.loanIdText, { color: colors.subtleText }]}>{loan.id}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                              <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                                {loan.status}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.compactCardBody}>
                            <View style={styles.compactCardInfoRow}>
                              <Text style={[styles.compactLabel, { color: colors.bodyText }]}>Principal:</Text>
                              <Text style={[styles.compactValue, { color: colors.titleText }]}>Rs. {loan.amount.toLocaleString()}</Text>
                            </View>
                            <View style={styles.compactCardInfoRow}>
                              <Text style={[styles.compactLabel, { color: colors.bodyText }]}>Installment:</Text>
                              <Text style={[styles.compactValue, { color: colors.titleText }]}>
                                Rs. {Math.round((loan.amount + loan.amount * (loan.interestRate / 100)) / loan.duration).toLocaleString()}
                              </Text>
                            </View>
                            <View style={styles.compactCardInfoRow}>
                              <Text style={[styles.compactLabel, { color: colors.bodyText }]}>Outstanding:</Text>
                              <Text style={[styles.compactValue, { color: colors.titleText }]}>Rs. {loan.outstanding.toLocaleString()}</Text>
                            </View>
                            <View style={styles.compactCardInfoRow}>
                              <Text style={[styles.compactLabel, { color: colors.bodyText }]}>Collector:</Text>
                              <Text style={[styles.compactValue, { color: colors.titleText, fontWeight: "600" }]}>{loan.collector}</Text>
                            </View>
                            <View style={styles.compactCardInfoRow}>
                              <Text style={[styles.compactLabel, { color: colors.bodyText }]}>Type:</Text>
                              <View style={[styles.typeBadge, { backgroundColor: loan.loanType === "Daily" ? "#e8efff" : loan.loanType === "Weekly" ? "#e6f9ff" : "#f5e8ff" }]}>
                                <Text style={[styles.typeBadgeText, { color: loan.loanType === "Daily" ? "#3366ff" : loan.loanType === "Weekly" ? "#00bcd4" : "#9c27b0" }]}>
                                  {loan.loanType}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Progress bar */}
                          <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBarBg, { backgroundColor: colors.dividerColor }]}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  {
                                    width: `${Math.min(100, progress)}%`,
                                    backgroundColor: loan.status === "overdue" ? "#ff4d4f" : "#3366ff"
                                  }
                                ]}
                              />
                            </View>
                            <Text style={[styles.progressText, { color: colors.subtleText }]}>{Math.round(progress)}% paid</Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              ) : (
                /* Desktop/Web Layout - Table */
                <View style={styles.tableWrapper}>
                  <View style={[styles.tableHeaderRow, { borderColor: colors.dividerColor }]}>
                    <Text style={[styles.th, { flex: 1.2, color: colors.subtleText }]}>Loan #</Text>
                    <Text style={[styles.th, { flex: 2, color: colors.subtleText }]}>Customer</Text>
                    <Text style={[styles.th, { flex: 1.5, color: colors.subtleText }]}>Branch</Text>
                    <Text style={[styles.th, { flex: 1.5, color: colors.subtleText }]}>Collector</Text>
                    <Text style={[styles.th, { flex: 1, color: colors.subtleText }]}>Type</Text>
                    <Text style={[styles.th, { flex: 1.5, color: colors.subtleText }]}>Principal</Text>
                    <Text style={[styles.th, { flex: 1.5, color: colors.subtleText }]}>Installment</Text>
                    <Text style={[styles.th, { flex: 1.5, color: colors.subtleText }]}>Outstanding</Text>
                    <Text style={[styles.th, { flex: 2.2, color: colors.subtleText }]}>Progress</Text>
                    <Text style={[styles.th, { flex: 1.2, textAlign: "center", color: colors.subtleText }]}>Status</Text>
                  </View>

                  {filteredLoans.length === 0 ? (
                    <Text style={[styles.emptyText, { marginVertical: 32, color: colors.subtleText }]}>No loans found</Text>
                  ) : (
                    filteredLoans.map((loan) => {
                      const totalRepayable = loan.amount + (loan.amount * (loan.interestRate / 100));
                      const progress = totalRepayable > 0 ? (loan.paidAmount / totalRepayable) * 100 : 0;
                      const badge = getStatusStyle(loan.status);
                      const dailyInstallment = totalRepayable / loan.duration;

                      return (
                        <Pressable
                          key={loan.id}
                          style={({ pressed }) => [
                            styles.tableRow,
                            { borderColor: colors.borderColorLight },
                            pressed && { backgroundColor: isDark ? "rgba(51, 102, 255, 0.15)" : "#f0f4ff" }
                          ]}
                          onPress={() => {
                            setSelectedLoan(loan);
                            setDetailsModalVisible(true);
                          }}
                        >
                          <Text style={[styles.td, styles.loanIdTd, { flex: 1.2, color: colors.inputText }]}>{loan.id}</Text>
                          <Text style={[styles.td, styles.customerTd, { flex: 2, color: colors.inputText }]}>{loan.customerName}</Text>
                          <Text style={[styles.td, { flex: 1.5, color: colors.bodyText }]}>{loan.branch}</Text>
                          <Text style={[styles.td, { flex: 1.5, color: colors.bodyText, fontWeight: "600" }]}>{loan.collector}</Text>
                          
                          <View style={[styles.tableCell, { flex: 1 }]}>
                            <View style={[styles.typeBadge, { backgroundColor: loan.loanType === "Daily" ? "#e8efff" : loan.loanType === "Weekly" ? "#e6f9ff" : "#f5e8ff" }]}>
                              <Text style={[styles.typeBadgeText, { color: loan.loanType === "Daily" ? "#3366ff" : loan.loanType === "Weekly" ? "#00bcd4" : "#9c27b0" }]}>
                                {loan.loanType}
                              </Text>
                            </View>
                          </View>

                          <Text style={[styles.td, styles.amountTd, { flex: 1.5, color: colors.bodyText }]}>
                            Rs. {loan.amount.toLocaleString()}
                          </Text>
                          <Text style={[styles.td, { flex: 1.5, color: colors.inputText, fontWeight: "600" }]}>
                            Rs. {Math.round(dailyInstallment).toLocaleString()}
                          </Text>
                          <Text style={[styles.td, styles.outstandingTd, { flex: 1.5, color: colors.inputText }]}>
                            Rs. {loan.outstanding.toLocaleString()}
                          </Text>

                          {/* Progress */}
                          <View style={[styles.tableCell, { flex: 2.2, flexDirection: "column", justifyContent: "center" }]}>
                            <View style={styles.tableProgressContainer}>
                              <View style={[styles.tableProgressBarBg, { backgroundColor: colors.dividerColor }]}>
                                <View
                                  style={[
                                    styles.tableProgressBarFill,
                                    {
                                      width: `${Math.min(100, progress)}%`,
                                      backgroundColor: loan.status === "overdue" ? "#ff4d4f" : "#3366ff"
                                    }
                                  ]}
                                />
                              </View>
                              <Text style={[styles.tableProgressText, { color: colors.subtleText }]}>{Math.round(progress)}% paid</Text>
                            </View>
                          </View>

                          {/* Status badge */}
                          <View style={[styles.tableCell, { flex: 1.2, alignItems: "center", justifyContent: "center" }]}>
                            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                              <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                                {loan.status}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          </View>
        ) : (
          /* NEW LOAN FORM SCREEN VIEW (Image 2/3/4 layout - wizard step by step) */
          <View>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={[styles.newLoanTitle, { color: colors.titleText }]}>New Loan Process</Text>
                <Text style={[styles.newLoanSubtitle, { color: colors.bodyText }]}>
                  Originate a new daily or monthly loan and auto-generate the repayment schedule step-by-step.
                </Text>
              </View>
            </View>

            {/* Step progress indicator */}
            <View style={[styles.wizardProgressContainer, { backgroundColor: colors.cardBg }]}>
              <View style={[styles.wizardStep, currentStep === 1 && styles.wizardStepActive]}>
                <View style={[styles.stepNumberContainer, currentStep === 1 ? styles.stepNumberActive : [styles.stepNumberInactive, { backgroundColor: colors.stepCircleInactiveBg, borderColor: colors.stepCircleInactiveBorder }]]}>
                  <Text style={[styles.stepNumberText, { color: colors.stepTextInactive }, currentStep === 1 && styles.stepNumberTextActive]}>1</Text>
                </View>
                {!isCompact && <Text style={[styles.stepLabel, { color: colors.stepTextInactive }, currentStep === 1 && styles.stepLabelActive]}>Customer & Agent</Text>}
              </View>
              <View style={[styles.stepConnector, { backgroundColor: colors.stepCircleInactiveBorder }]} />
              <View style={[styles.wizardStep, currentStep === 2 && styles.wizardStepActive]}>
                <View style={[styles.stepNumberContainer, currentStep === 2 ? styles.stepNumberActive : [styles.stepNumberInactive, { backgroundColor: colors.stepCircleInactiveBg, borderColor: colors.stepCircleInactiveBorder }]]}>
                  <Text style={[styles.stepNumberText, { color: colors.stepTextInactive }, currentStep === 2 && styles.stepNumberTextActive]}>2</Text>
                </View>
                {!isCompact && <Text style={[styles.stepLabel, { color: colors.stepTextInactive }, currentStep === 2 && styles.stepLabelActive]}>Loan Terms</Text>}
              </View>
              <View style={[styles.stepConnector, { backgroundColor: colors.stepCircleInactiveBorder }]} />
              <View style={[styles.wizardStep, currentStep === 3 && styles.wizardStepActive]}>
                <View style={[styles.stepNumberContainer, currentStep === 3 ? styles.stepNumberActive : [styles.stepNumberInactive, { backgroundColor: colors.stepCircleInactiveBg, borderColor: colors.stepCircleInactiveBorder }]]}>
                  <Text style={[styles.stepNumberText, { color: colors.stepTextInactive }, currentStep === 3 && styles.stepNumberTextActive]}>3</Text>
                </View>
                {!isCompact && <Text style={[styles.stepLabel, { color: colors.stepTextInactive }, currentStep === 3 && styles.stepLabelActive]}>Review & Disburse</Text>}
              </View>
            </View>

            {/* Wizard Content rendering based on currentStep */}
            {currentStep === 1 && (
              /* STEP 1: CUSTOMER & BRANCH SELECTION */
              <View style={[styles.formContainerCard, { backgroundColor: colors.cardBg }]}>
                <Text style={[styles.sectionHeaderTitle, { color: colors.subtleText }]}>STEP 1: CUSTOMER & AGENT DETAILS</Text>

                <View style={styles.formRowVertical}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.titleText }]}>Customer</Text>
                    <Pressable
                      style={[styles.dropdownSelector, { backgroundColor: colors.inputBg, borderColor: colors.borderColor }]}
                      onPress={() => {
                        setCustomerSearch("");
                        setCustomerModalVisible(true);
                      }}
                    >
                      <Text style={[styles.dropdownSelectorText, { color: colors.inputText }]}>{selectedCustomerName}</Text>
                      <Ionicons name="chevron-down" size={16} color="#7a859d" />
                    </Pressable>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.titleText }]}>Branch</Text>
                    <Pressable
                      style={[styles.dropdownSelector, { backgroundColor: colors.inputBg, borderColor: colors.borderColor }]}
                      onPress={() => {
                        setBranchSearch("");
                        setBranchModalVisible(true);
                      }}
                    >
                      <Text style={[styles.dropdownSelectorText, { color: selectedBranch ? colors.inputText : colors.inputPlaceholder }]}>{selectedBranch || (branchOptions.length === 0 ? "No branches registered" : "Select a branch")}</Text>
                      <Ionicons name="chevron-down" size={16} color="#7a859d" />
                    </Pressable>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.titleText }]}>Collector</Text>
                    <Pressable
                      style={[styles.dropdownSelector, { backgroundColor: colors.inputBg, borderColor: colors.borderColor }]}
                      onPress={() => {
                        setCollectorSearch("");
                        setCollectorModalVisible(true);
                      }}
                    >
                      <Text style={[styles.dropdownSelectorText, { color: colors.inputText }]}>{selectedCollector}</Text>
                      <Ionicons name="chevron-down" size={16} color="#7a859d" />
                    </Pressable>
                  </View>
                </View>

                {/* Footer Buttons for Step 1 */}
                <View style={[styles.wizardFooterRow, { borderColor: colors.borderColorLight }]}>
                  <Pressable style={styles.wizardCancelBtn} onPress={() => setIsAddingLoan(false)}>
                    <Text style={[styles.wizardCancelBtnText, { color: colors.bodyText }]}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.wizardNextBtn} onPress={() => setCurrentStep(2)}>
                    <Text style={styles.wizardNextBtnText}>Next Step</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
                  </Pressable>
                </View>
              </View>
            )}

            {currentStep === 2 && (
              /* STEP 2: LOAN TERMS */
              <View style={[styles.formContainerCard, { backgroundColor: colors.cardBg }]}>
                <Text style={[styles.sectionHeaderTitle, { color: colors.subtleText }]}>STEP 2: LOAN TERMS & CONDITIONS</Text>

                <View style={styles.formRowVertical}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.titleText }]}>Loan type</Text>
                    <View style={[styles.toggleContainer, { borderColor: colors.borderColor }]}>
                      <Pressable
                        style={[
                          styles.toggleBtn,
                          { backgroundColor: colors.toggleBtnInactiveBg },
                          loanType === "Daily" && styles.toggleBtnActive
                        ]}
                        onPress={() => {
                          setLoanType("Daily");
                          setDurationStr("60");
                        }}
                      >
                        <Text style={[styles.toggleBtnText, { color: colors.bodyText }, loanType === "Daily" && styles.toggleBtnTextActive]}>
                          Daily loan
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.toggleBtn,
                          { backgroundColor: colors.toggleBtnInactiveBg },
                          loanType === "Weekly" && styles.toggleBtnActive
                        ]}
                        onPress={() => {
                          setLoanType("Weekly");
                          setDurationStr("24");
                        }}
                      >
                        <Text style={[styles.toggleBtnText, { color: colors.bodyText }, loanType === "Weekly" && styles.toggleBtnTextActive]}>
                          Weekly loan
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.toggleBtn,
                          { backgroundColor: colors.toggleBtnInactiveBg },
                          loanType === "Monthly" && styles.toggleBtnActive
                        ]}
                        onPress={() => {
                          setLoanType("Monthly");
                          setDurationStr("10");
                        }}
                      >
                        <Text style={[styles.toggleBtnText, { color: colors.bodyText }, loanType === "Monthly" && styles.toggleBtnTextActive]}>
                          Monthly loan
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.titleText }]}>Loan amount (Rs.)</Text>
                    <TextInput
                      style={[styles.formTextInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }]}
                      value={amountStr}
                      onChangeText={setAmountStr}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.titleText }]}>Interest rate (flat %)</Text>
                    <TextInput
                      style={[styles.formTextInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }]}
                      value={interestStr}
                      onChangeText={setInterestStr}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.titleText }]}>
                      Duration ({loanType === "Daily" ? "days" : loanType === "Weekly" ? "weeks" : "months"})
                    </Text>
                    <TextInput
                      style={[styles.formTextInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }]}
                      value={durationStr}
                      onChangeText={setDurationStr}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.titleText }]}>Disbursement date</Text>
                    <Pressable
                      style={[styles.dropdownSelector, { backgroundColor: colors.inputBg, borderColor: colors.borderColor }]}
                      onPress={() => {
                        const parsed = getParsedDate(disbursementDateStr);
                        setViewDate(parsed);
                        setCalendarModalVisible(true);
                      }}
                    >
                      <Text style={[styles.dropdownSelectorText, { color: colors.inputText }]}>{disbursementDateStr}</Text>
                      <Ionicons name="calendar-outline" size={18} color="#7a859d" />
                    </Pressable>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.titleText }]}>Loan purpose</Text>
                    <TextInput
                      style={[styles.formTextInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }]}
                      value={loanPurposeStr}
                      onChangeText={setLoanPurposeStr}
                    />
                  </View>
                </View>

                {/* Footer Buttons for Step 2 */}
                <View style={[styles.wizardFooterRow, { borderColor: colors.borderColorLight }]}>
                  <Pressable style={[styles.wizardBackBtn, { borderColor: colors.stepCircleInactiveBorder }]} onPress={() => setCurrentStep(1)}>
                    <Ionicons name="arrow-back" size={16} color={isDark ? "#94a3b8" : "#6b7a99"} style={{ marginRight: 6 }} />
                    <Text style={[styles.wizardBackBtnText, { color: colors.bodyText }]}>Back</Text>
                  </Pressable>
                  <Pressable style={styles.wizardNextBtn} onPress={() => setCurrentStep(3)}>
                    <Text style={styles.wizardNextBtnText}>Next Step</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
                  </Pressable>
                </View>
              </View>
            )}

            {currentStep === 3 && (
              /* STEP 3: REVIEW SUMMARY & DISBURSE */
              <View style={[styles.step3Layout, { flexDirection: width > 900 ? "row" : "column" }]}>
                {/* Summary side details */}
                <View style={[styles.summaryCard, { backgroundColor: colors.cardBg }, { flex: width > 900 ? 1 : undefined }]}>
                  <Text style={[styles.sectionHeaderTitle, { color: colors.subtleText }]}>STEP 3: REPAYMENT SUMMARY</Text>
                  <Text style={[styles.summaryTitle, { color: colors.titleText }]}>Summary</Text>

                  <View style={styles.summaryItemRow}>
                    <Text style={[styles.summaryItemLabel, { color: colors.bodyText }]}>Principal</Text>
                    <Text style={[styles.summaryItemVal, { color: colors.titleText }]}>Rs. {calculatedSummary.principal.toLocaleString()}</Text>
                  </View>

                  <View style={styles.summaryItemRow}>
                    <Text style={[styles.summaryItemLabel, { color: colors.bodyText }]}>Total interest</Text>
                    <Text style={[styles.summaryItemVal, { color: colors.titleText }]}>Rs. {calculatedSummary.totalInterest.toLocaleString()}</Text>
                  </View>

                  <View style={[styles.summaryDivider, { backgroundColor: colors.dividerColor }]} />

                  <View style={styles.summaryItemRow}>
                    <Text style={[styles.summaryItemTotalLabel, { color: colors.titleText }]}>Total repayment</Text>
                    <Text style={[styles.summaryItemTotalVal, { color: colors.titleText }]}>Rs. {calculatedSummary.totalRepayment.toLocaleString()}</Text>
                  </View>

                  <View style={styles.summaryItemRow}>
                    <Text style={[styles.summaryItemLabel, { color: colors.bodyText }]}>
                      {loanType === "Daily" ? "Daily" : loanType === "Weekly" ? "Weekly" : "Monthly"} installment
                    </Text>
                    <Text style={[styles.summaryItemVal, { color: colors.titleText }]}>
                      Rs. {Math.round(calculatedSummary.installmentAmount).toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.summaryItemRow}>
                    <Text style={[styles.summaryItemLabel, { color: colors.bodyText }]}>Duration</Text>
                    <Text style={[styles.summaryItemVal, { color: colors.titleText }]}>
                      {duration} {loanType === "Daily" ? "days" : loanType === "Weekly" ? "weeks" : "months"}
                    </Text>
                  </View>

                  <View style={styles.summaryItemRow}>
                    <Text style={[styles.summaryItemLabel, { color: colors.bodyText }]}>End date</Text>
                    <Text style={[styles.summaryItemVal, { color: colors.titleText }]}>{calculatedSummary.endDateFormatted}</Text>
                  </View>

                  {/* Actions */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.disburseBtn,
                      pressed && styles.buttonPressed
                    ]}
                    onPress={handleDisburseLoan}
                  >
                    <Text style={styles.disburseBtnText}>Disburse loan</Text>
                  </Pressable>

                  <Pressable
                    style={styles.wizardBackBtnCenter}
                    onPress={() => setCurrentStep(2)}
                  >
                    <Ionicons name="arrow-back" size={16} color={isDark ? "#94a3b8" : "#6b7a99"} style={{ marginRight: 6 }} />
                    <Text style={[styles.wizardBackBtnText, { color: colors.bodyText }]}>Back to Terms</Text>
                  </Pressable>
                </View>

                {/* Generated schedule */}
                <View style={[styles.scheduleContainer, { backgroundColor: colors.cardBg }, { flex: width > 900 ? 1.5 : undefined }]}>
                  <Text style={[styles.scheduleHeading, { color: colors.subtleText }]}>
                    GENERATED SCHEDULE (FIRST 8 INSTALLMENTS)
                  </Text>
                  
                  <View style={styles.scheduleTable}>
                    <View style={[styles.scheduleHeaderRow, { borderColor: colors.dividerColor }]}>
                      <Text style={[styles.schTh, { flex: 0.5, color: colors.subtleText }]}>#</Text>
                      <Text style={[styles.schTh, { flex: 2.5, color: colors.subtleText }]}>Due date</Text>
                      <Text style={[styles.schTh, { flex: 2.5, color: colors.subtleText }]}>Installment</Text>
                      <Text style={[styles.schTh, { flex: 2.5, textAlign: "right", color: colors.subtleText }]}>Remaining balance</Text>
                    </View>

                    {scheduleInstallments.map((item) => (
                      <View key={item.num} style={[styles.scheduleRow, { borderColor: colors.borderColorLight }]}>
                        <Text style={[styles.schTd, { flex: 0.5, fontWeight: "600", color: colors.inputText }]}>{item.num}</Text>
                        <Text style={[styles.schTd, { flex: 2.5, color: colors.inputText }]}>{item.dueDate}</Text>
                        <Text style={[styles.schTd, { flex: 2.5, fontWeight: "600", color: colors.inputText }]}>
                          Rs. {Math.round(item.installment).toLocaleString()}
                        </Text>
                        <Text style={[styles.schTd, { flex: 2.5, textAlign: "right", color: colors.bodyText }]}>
                          Rs. {Math.round(item.remaining).toLocaleString()}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* DETAIL VIEW & RECORD COLLECTION MODAL */}
      {selectedLoan && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={detailsModalVisible}
          onRequestClose={() => setDetailsModalVisible(false)}
        >
          <View style={[styles.modalOverlay, { backgroundColor: colors.repaymentOverlayBg }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBg, maxHeight: "85%" }]}>
              <View style={[styles.modalHeader, { borderColor: colors.dividerColor }]}>
                <Text style={[styles.modalTitle, { color: colors.titleText }]}>Loan Details ({selectedLoan.id})</Text>
                <Pressable onPress={() => setDetailsModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.subtleText} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={true}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.bodyText }]}>Customer:</Text>
                  <Text style={[styles.detailValue, { color: colors.titleText }]}>{selectedLoan.customerName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.bodyText }]}>Branch:</Text>
                  <Text style={[styles.detailValue, { color: colors.titleText }]}>{selectedLoan.branch}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.bodyText }]}>Collector:</Text>
                  <Text style={[styles.detailValue, { color: colors.titleText, fontWeight: "700" }]}>{selectedLoan.collector}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.bodyText }]}>Type:</Text>
                  <Text style={[styles.detailValue, { color: colors.titleText }]}>{selectedLoan.loanType} loan</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.bodyText }]}>Principal:</Text>
                  <Text style={[styles.detailValue, { color: colors.titleText }]}>Rs. {selectedLoan.amount.toLocaleString()}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.bodyText }]}>Interest rate:</Text>
                  <Text style={[styles.detailValue, { color: colors.titleText }]}>{selectedLoan.interestRate}% flat</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.bodyText }]}>Paid Amount:</Text>
                  <Text style={[styles.detailValue, { color: "#2ecc71", fontWeight: "700" }]}>
                    Rs. {selectedLoan.paidAmount.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.bodyText }]}>Outstanding balance:</Text>
                  <Text style={[styles.detailValue, { color: "#ff4d4f", fontWeight: "700" }]}>
                    Rs. {selectedLoan.outstanding.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.bodyText }]}>Disbursement date:</Text>
                  <Text style={[styles.detailValue, { color: colors.titleText }]}>{selectedLoan.disbursementDate}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.bodyText }]}>Loan ended date:</Text>
                  <Text style={[styles.detailValue, { color: colors.titleText, fontWeight: "600" }]}>
                    {getLoanEndDate(selectedLoan)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.bodyText }]}>Status:</Text>
                  <Text style={[styles.detailValue, { color: colors.titleText }]}>{selectedLoan.status}</Text>
                </View>

                <Pressable
                  style={[styles.viewPlanBtn, { backgroundColor: colors.inputBg, borderColor: colors.borderColor }]}
                  onPress={() => {
                    setPlanModalVisible(true);
                  }}
                >
                  <Ionicons name="calendar-outline" size={16} color="#3366ff" style={{ marginRight: 8 }} />
                  <Text style={[styles.viewPlanBtnText, { color: colors.inputText }]}>View Installment Plan</Text>
                </Pressable>

                {selectedLoan.status !== "closed" && (
                  <View style={[styles.repaymentInputContainer, { borderColor: colors.dividerColor }]}>
                    <Text style={[styles.repaymentSectionHeader, { color: colors.subtleText }]}>RECORD COLLECTION</Text>
                    <TextInput
                      style={[styles.modalTextInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.borderColor }]}
                      placeholder="Enter collected amount (Rs.)"
                      value={collectedAmountStr}
                      onChangeText={setCollectedAmountStr}
                      keyboardType="numeric"
                      placeholderTextColor={colors.inputPlaceholder}
                    />
                    <Pressable
                      style={({ pressed }) => [
                        styles.recordPaymentBtn,
                        pressed && styles.buttonPressed,
                        recordingCollection && { opacity: 0.6 }
                      ]}
                      onPress={handleRecordCollection}
                      disabled={recordingCollection}
                    >
                      <Text style={styles.recordPaymentBtnText}>
                        {recordingCollection ? "Recording..." : "Collected Payment"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* FULL INSTALLMENT PLAN MODAL */}
      {selectedLoan && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={planModalVisible}
          onRequestClose={() => setPlanModalVisible(false)}
        >
          <View style={[styles.modalOverlay, { backgroundColor: colors.repaymentOverlayBg }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBg, maxHeight: "85%", maxWidth: 540 }]}>
              {(() => {
                const today = new Date();
                const totalRepayment = selectedLoan.amount + (selectedLoan.amount * (selectedLoan.interestRate / 100));
                const originalInstallment = totalRepayment / selectedLoan.duration;
                const parts = selectedLoan.disbursementDate.split("/");
                if (parts.length !== 3) return null;
                
                const m = parseInt(parts[0], 10) - 1;
                const d = parseInt(parts[1], 10);
                const y = parseInt(parts[2], 10);
                const baseDate = new Date(y, m, d);

                let expectedPaidAsOfToday = 0;
                let remainingInstallmentsCount = 0;
                let nextCollectionDateStr = "N/A";
                let nextCollectionAmount = 0;
                
                const rows: React.JSX.Element[] = [];

                for (let i = 1; i <= selectedLoan.duration; i++) {
                  const dueDateObj = new Date(baseDate);
                  if (selectedLoan.loanType === "Daily") {
                    dueDateObj.setDate(baseDate.getDate() + i);
                  } else if (selectedLoan.loanType === "Weekly") {
                    dueDateObj.setDate(baseDate.getDate() + i * 7);
                  } else {
                    dueDateObj.setMonth(baseDate.getMonth() + i);
                  }
                  
                  const isPastOrToday = dueDateObj <= today;
                  if (isPastOrToday) {
                    expectedPaidAsOfToday += originalInstallment;
                  }
                  
                  const formattedDueDate = `${dueDateObj.getMonth() + 1}/${dueDateObj.getDate()}/${dueDateObj.getFullYear()}`;
                  const remaining = Math.max(0, totalRepayment - (originalInstallment * i));
                  
                  const cumulativeDue = originalInstallment * i;
                  let status: "Paid" | "Partial" | "Pending" = "Pending";
                  
                  if (selectedLoan.paidAmount >= cumulativeDue) {
                    status = "Paid";
                  } else if (selectedLoan.paidAmount > cumulativeDue - originalInstallment) {
                    status = "Partial";
                  }
                  
                  if (selectedLoan.paidAmount < cumulativeDue) {
                    remainingInstallmentsCount++;
                    if (nextCollectionDateStr === "N/A") {
                      nextCollectionDateStr = formattedDueDate;
                      nextCollectionAmount = cumulativeDue - selectedLoan.paidAmount;
                    }
                  }

                  const statusColor = status === "Paid" 
                    ? { bg: "#e6f8ef", text: "#2ecc71" } 
                    : status === "Partial" 
                      ? { bg: "#ffebeb", text: "#ff9c00" } 
                      : { bg: "#f4f7ff", text: "#7a859d" };

                  rows.push(
                    <View key={i} style={[styles.scheduleRow, { borderColor: colors.borderColorLight, paddingHorizontal: 4, paddingVertical: 10 }]}>
                      <Text style={[styles.schTd, { flex: 0.6, fontWeight: "600", color: colors.inputText }]}>{i}</Text>
                      <Text style={[styles.schTd, { flex: 2.2, color: colors.inputText }]}>{formattedDueDate}</Text>
                      <Text style={[styles.schTd, { flex: 2.2, fontWeight: "600", color: colors.inputText }]}>
                        Rs. {Math.round(originalInstallment).toLocaleString()}
                      </Text>
                      <Text style={[styles.schTd, { flex: 2.2, color: colors.bodyText, textAlign: "right" }]}>
                        Rs. {Math.round(remaining).toLocaleString()}
                      </Text>
                      <View style={{ flex: 1.8, alignItems: "center", justifyContent: "center" }}>
                        <View style={{ backgroundColor: statusColor.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, minWidth: 50, alignItems: "center" }}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: statusColor.text }}>{status}</Text>
                        </View>
                      </View>
                    </View>
                  );
                }

                const overdueAmount = Math.max(0, expectedPaidAsOfToday - selectedLoan.paidAmount);
                const adjustedInstallment = remainingInstallmentsCount > 0 
                  ? selectedLoan.outstanding / remainingInstallmentsCount 
                  : 0;

                let statusText = "On Track";
                let statusColor = "#3366ff";
                if (selectedLoan.outstanding <= 0) {
                  statusText = "Fully Paid";
                  statusColor = "#2ecc71";
                  nextCollectionDateStr = "N/A";
                  nextCollectionAmount = 0;
                } else if (overdueAmount > 0) {
                  statusText = `Behind (Overdue Rs. ${Math.round(overdueAmount).toLocaleString()})`;
                  statusColor = "#ff4d4f";
                } else if (selectedLoan.paidAmount > expectedPaidAsOfToday) {
                  statusText = "Ahead of Schedule";
                  statusColor = "#2ecc71";
                }

                const termUnit = selectedLoan.loanType === "Daily" ? "days" : selectedLoan.loanType === "Weekly" ? "weeks" : "months";
                const labelUnit = selectedLoan.loanType === "Daily" ? "Day" : selectedLoan.loanType === "Weekly" ? "Wk" : "Mth";

                return (
                  <>
                    <View style={[styles.modalHeader, { borderColor: colors.dividerColor }]}>
                      <View>
                        <Text style={[styles.modalTitle, { color: colors.titleText }]}>Installment Plan</Text>
                        <Text style={{ color: colors.subtleText, fontSize: 12, marginTop: 4 }}>
                          Loan ID: {selectedLoan.id} · Type: {selectedLoan.loanType} · Duration: {selectedLoan.duration}
                        </Text>
                      </View>
                      <Pressable onPress={() => setPlanModalVisible(false)}>
                        <Ionicons name="close" size={24} color={colors.subtleText} />
                      </Pressable>
                    </View>

                    {/* Next Collection Summary Card */}
                    <View style={[styles.planCard, { backgroundColor: colors.inputBg, borderColor: colors.borderColor }]}>
                      <Text style={[styles.planCardTitle, { color: colors.titleText }]}>Next Collection Plan</Text>
                      
                      <View style={styles.planCardRow}>
                        <View style={styles.planCardCol}>
                          <Text style={[styles.planCardLabel, { color: colors.subtleText }]}>Next Date</Text>
                          <Text style={[styles.planCardValue, { color: colors.titleText }]}>{nextCollectionDateStr}</Text>
                        </View>
                        <View style={styles.planCardCol}>
                          <Text style={[styles.planCardLabel, { color: colors.subtleText }]}>Next Amount</Text>
                          <Text style={[styles.planCardValue, { color: "#3366ff", fontWeight: "700" }]}>
                            Rs. {Math.round(nextCollectionAmount).toLocaleString()}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.planCardDivider, { backgroundColor: colors.borderColor }]} />

                      <View style={styles.planCardRow}>
                        <View style={styles.planCardCol}>
                          <Text style={[styles.planCardLabel, { color: colors.subtleText }]}>Remaining Term</Text>
                          <Text style={[styles.planCardValue, { color: colors.titleText }]}>
                            {remainingInstallmentsCount} of {selectedLoan.duration} {termUnit}
                          </Text>
                        </View>
                        <View style={styles.planCardCol}>
                          <Text style={[styles.planCardLabel, { color: colors.subtleText }]}>Adjusted {labelUnit} Amt</Text>
                          <Text style={[styles.planCardValue, { color: colors.titleText }]}>
                            Rs. {Math.round(adjustedInstallment).toLocaleString()}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.planCardDivider, { backgroundColor: colors.borderColor }]} />

                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={[styles.planCardLabel, { color: colors.subtleText }]}>Schedule Status</Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: statusColor }}>{statusText}</Text>
                      </View>
                    </View>

                    <View style={{ flex: 1 }}>
                      {/* Summary Table Header */}
                      <View style={[styles.scheduleHeaderRow, { borderColor: colors.dividerColor, paddingHorizontal: 4, paddingBottom: 8 }]}>
                        <Text style={[styles.schTh, { flex: 0.6, color: colors.subtleText }]}>#</Text>
                        <Text style={[styles.schTh, { flex: 2.2, color: colors.subtleText }]}>Due date</Text>
                        <Text style={[styles.schTh, { flex: 2.2, color: colors.subtleText }]}>Amount</Text>
                        <Text style={[styles.schTh, { flex: 2.2, color: colors.subtleText, textAlign: "right" }]}>Remaining</Text>
                        <Text style={[styles.schTh, { flex: 1.8, color: colors.subtleText, textAlign: "center" }]}>Status</Text>
                      </View>

                      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                        {rows}
                      </ScrollView>
                    </View>
                  </>
                );
              })()}
            </View>
          </View>
        </Modal>
      )}

      {/* CUSTOMER SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={customerModalVisible}
        onRequestClose={() => setCustomerModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.repaymentOverlayBg }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
            <View style={[styles.modalHeader, { borderColor: colors.dividerColor, marginBottom: 16 }]}>
              <Text style={[styles.modalTitle, { color: colors.titleText }]}>Select Customer</Text>
              <Pressable onPress={() => setCustomerModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.subtleText} />
              </Pressable>
            </View>
            <View style={{ paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.borderColorLight, marginBottom: 12 }}>
              <View style={[styles.searchBar, { backgroundColor: colors.inputBg, marginBottom: 0, height: 44, paddingHorizontal: 12, borderRadius: 12, shadowOpacity: 0, elevation: 0 }]}>
                <Ionicons name="search" size={18} color={isDark ? "#64748b" : "#7a859d"} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Search customer..."
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                  style={{ flex: 1, color: colors.inputText, fontSize: 14 }}
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>
            </View>
            <ScrollView style={{ maxHeight: 350 }} nestedScrollEnabled={true}>
              {filteredCustomersList.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text style={{ color: colors.inputPlaceholder, fontStyle: "italic", fontSize: 14 }}>
                    {customers.length === 0 ? "No customers registered." : "No matching customers."}
                  </Text>
                </View>
              ) : (
                filteredCustomersList.map((c) => (
                  <Pressable
                    key={c.id}
                    style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.borderColorLight }}
                    onPress={() => {
                      setSelectedCustomerId(c.id);
                      setCustomerModalVisible(false);
                      setCustomerSearch("");
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.inputText }}>{c.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.subtleText, marginTop: 2 }}>ID: {c.id} · NIC: {c.nic}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* BRANCH SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={branchModalVisible}
        onRequestClose={() => setBranchModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.repaymentOverlayBg }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
            <View style={[styles.modalHeader, { borderColor: colors.dividerColor, marginBottom: 16 }]}>
              <Text style={[styles.modalTitle, { color: colors.titleText }]}>Select Branch</Text>
              <Pressable onPress={() => setBranchModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.subtleText} />
              </Pressable>
            </View>
            <View style={{ paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.borderColorLight, marginBottom: 12 }}>
              <View style={[styles.searchBar, { backgroundColor: colors.inputBg, marginBottom: 0, height: 44, paddingHorizontal: 12, borderRadius: 12, shadowOpacity: 0, elevation: 0 }]}>
                <Ionicons name="search" size={18} color={isDark ? "#64748b" : "#7a859d"} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Search branch..."
                  value={branchSearch}
                  onChangeText={setBranchSearch}
                  style={{ flex: 1, color: colors.inputText, fontSize: 14 }}
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>
            </View>
            <ScrollView style={{ maxHeight: 350 }} nestedScrollEnabled={true}>
              {filteredBranchesList.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text style={{ color: colors.inputPlaceholder, fontStyle: "italic", fontSize: 14 }}>
                    {branchOptions.length === 0 ? "No branches registered." : "No matching branches."}
                  </Text>
                </View>
              ) : (
                filteredBranchesList.map((b) => (
                  <Pressable
                    key={b}
                    style={{ paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.borderColorLight }}
                    onPress={() => {
                      setSelectedBranch(b);
                      setBranchModalVisible(false);
                      setBranchSearch("");
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.inputText }}>{b}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* COLLECTOR SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={collectorModalVisible}
        onRequestClose={() => setCollectorModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.repaymentOverlayBg }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
            <View style={[styles.modalHeader, { borderColor: colors.dividerColor, marginBottom: 16 }]}>
              <Text style={[styles.modalTitle, { color: colors.titleText }]}>Select Collector</Text>
              <Pressable onPress={() => setCollectorModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.subtleText} />
              </Pressable>
            </View>
            <View style={{ paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.borderColorLight, marginBottom: 12 }}>
              <View style={[styles.searchBar, { backgroundColor: colors.inputBg, marginBottom: 0, height: 44, paddingHorizontal: 12, borderRadius: 12, shadowOpacity: 0, elevation: 0 }]}>
                <Ionicons name="search" size={18} color={isDark ? "#64748b" : "#7a859d"} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Search collector..."
                  value={collectorSearch}
                  onChangeText={setCollectorSearch}
                  style={{ flex: 1, color: colors.inputText, fontSize: 14 }}
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>
            </View>
            <ScrollView style={{ maxHeight: 350 }} nestedScrollEnabled={true}>
              {filteredCollectorsList.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text style={{ color: colors.inputPlaceholder, fontStyle: "italic", fontSize: 14 }}>
                    No matching collectors.
                  </Text>
                </View>
              ) : (
                filteredCollectorsList.map((col) => (
                  <Pressable
                    key={col}
                    style={{ paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.borderColorLight }}
                    onPress={() => {
                      setSelectedCollector(col);
                      setCollectorModalVisible(false);
                      setCollectorSearch("");
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.inputText }}>{col}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* CALENDAR SELECTION MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={calendarModalVisible}
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.repaymentOverlayBg }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg, maxWidth: 360 }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderColor: colors.dividerColor, marginBottom: 12, borderBottomWidth: 1, paddingBottom: 12 }]}>
              <Text style={[styles.modalTitle, { color: colors.titleText }]}>Select Date</Text>
              <Pressable onPress={() => setCalendarModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.subtleText} />
              </Pressable>
            </View>

            {/* Calendar Controls */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingHorizontal: 4 }}>
              <Pressable
                style={{ padding: 6, borderRadius: 8, backgroundColor: colors.inputBg }}
                onPress={() => {
                  setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
                }}
              >
                <Ionicons name="chevron-back" size={20} color={colors.titleText} />
              </Pressable>
              
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.titleText }}>
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][viewDate.getMonth()]} {viewDate.getFullYear()}
              </Text>

              <Pressable
                style={{ padding: 6, borderRadius: 8, backgroundColor: colors.inputBg }}
                onPress={() => {
                  setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
                }}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.titleText} />
              </Pressable>
            </View>

            {/* Week Days Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, idx) => (
                <Text
                  key={idx}
                  style={{
                    width: "14.2%",
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: "600",
                    color: colors.subtleText
                  }}
                >
                  {day}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start" }}>
              {generateCalendarGrid(viewDate).map((cell, idx) => {
                const isSelected = cell.dateObj.toDateString() === getParsedDate(disbursementDateStr).toDateString();
                return (
                  <Pressable
                    key={idx}
                    style={[{
                      width: "14.2%",
                      height: 36,
                      justifyContent: "center",
                      alignItems: "center",
                      marginVertical: 2,
                      borderRadius: 18
                    }, isSelected && { backgroundColor: "#3366ff" }]}
                    onPress={() => handleSelectCalendarDate(cell.dateObj)}
                  >
                    <Text
                      style={[{
                        fontSize: 13,
                        fontWeight: "500",
                        color: cell.isCurrentMonth ? colors.inputText : colors.subtleText
                      }, !cell.isCurrentMonth && { opacity: 0.3 }, isSelected && { color: "#fff", fontWeight: "700" }]}
                    >
                      {cell.dayNum}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Footer */}
            <View style={{ flexDirection: "row", justifyContent: "center", borderTopWidth: 1, borderColor: colors.borderColorLight, paddingTop: 12, marginTop: 12 }}>
              <Pressable
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.borderColor
                }}
                onPress={() => {
                  const today = new Date();
                  setViewDate(today);
                  handleSelectCalendarDate(today);
                }}
              >
                <Text style={{ color: colors.titleText, fontWeight: "700", fontSize: 13 }}>Select Today</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <BottomTabBar activeTab="loans" />
    </View>
  );
}
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#ecf2ff"
  },
  container: {
    padding: 24,
    paddingBottom: 120
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 12
  },
  titleArea: {
    flexDirection: "column"
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#192a4a",
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7a99"
  },
  newLoanBtn: {
    backgroundColor: "#3366ff",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#3366ff",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  newLoanBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14
  },
  btnIcon: {
    marginRight: 6
  },
  buttonPressed: {
    opacity: 0.85
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24,
    paddingBottom: 4
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    minWidth: 140,
    flex: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  statLabelText: {
    fontSize: 13,
    color: "#8a92a6",
    fontWeight: "600",
    marginBottom: 8
  },
  statValueText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#192a4a"
  },
  searchBar: {
    backgroundColor: "#fff",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  searchIcon: {
    marginRight: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#192a4a"
  },
  cardContainer: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  emptyText: {
    textAlign: "center",
    color: "#8a92a6",
    fontSize: 15,
    marginVertical: 20
  },
  compactList: {
    gap: 16
  },
  compactCard: {
    backgroundColor: "#f8faff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(51, 102, 255, 0.06)"
  },
  compactCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12
  },
  customerNameText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#192a4a"
  },
  loanIdText: {
    fontSize: 12,
    color: "#6b7a99",
    marginTop: 2
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "lowercase"
  },
  compactCardBody: {
    gap: 8,
    marginBottom: 12
  },
  compactCardInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  compactLabel: {
    fontSize: 13,
    color: "#6b7a99"
  },
  compactValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#192a4a"
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600"
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3
  },
  progressText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7a99"
  },
  tableWrapper: {
    overflow: "hidden"
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    paddingBottom: 12,
    marginBottom: 4
  },
  th: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8a92a6",
    textTransform: "uppercase"
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#f1f3f7"
  },
  td: {
    fontSize: 14,
    color: "#192a4a"
  },
  loanIdTd: {
    fontWeight: "700",
    color: "#192a4a"
  },
  customerTd: {
    fontWeight: "600",
    color: "#192a4a"
  },
  amountTd: {
    fontWeight: "600",
    color: "#6b7a99"
  },
  outstandingTd: {
    fontWeight: "700",
    color: "#192a4a"
  },
  tableProgressContainer: {
    flexDirection: "column",
    gap: 4
  },
  tableProgressBarBg: {
    width: "80%",
    height: 5,
    backgroundColor: "#e2e8f0",
    borderRadius: 2.5,
    overflow: "hidden"
  },
  tableProgressBarFill: {
    height: "100%",
    borderRadius: 2.5
  },
  tableProgressText: {
    fontSize: 11,
    color: "#6b7a99",
    fontWeight: "500"
  },
  newLoanTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#192a4a"
  },
  newLoanSubtitle: {
    fontSize: 14,
    color: "#6b7a99",
    marginTop: 6
  },
  wizardProgressContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  wizardStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    opacity: 0.5
  },
  wizardStepActive: {
    opacity: 1
  },
  stepNumberContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5
  },
  stepNumberActive: {
    backgroundColor: "#3366ff",
    borderColor: "#3366ff"
  },
  stepNumberInactive: {
    backgroundColor: "#fff",
    borderColor: "#cbd5e1"
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b"
  },
  stepNumberTextActive: {
    color: "#fff"
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b"
  },
  stepLabelActive: {
    color: "#3366ff"
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: "#cbd5e1",
    marginHorizontal: 12
  },
  formContainerCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8a92a6",
    letterSpacing: 0.5,
    marginBottom: 20,
    textTransform: "uppercase"
  },
  formRowVertical: {
    gap: 20,
    zIndex: 2,
    marginBottom: 24
  },
  inputGroup: {
    position: "relative"
  },
  inputGroupZ10: {
    position: "relative",
    zIndex: 10
  },
  inputGroupZ5: {
    position: "relative",
    zIndex: 5
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#192a4a",
    marginBottom: 8
  },
  formTextInput: {
    backgroundColor: "#f4f7ff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: "#192a4a"
  },
  dropdownSelector: {
    backgroundColor: "#f4f7ff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 48
  },
  dropdownSelectorText: {
    fontSize: 14,
    color: "#192a4a"
  },
  dropdownListContainer: {
    position: "absolute",
    top: 76,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
    zIndex: 100
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#f1f3f7"
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#192a4a"
  },
  toggleContainer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
    height: 48
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  toggleBtnActive: {
    backgroundColor: "#3366ff"
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7a99"
  },
  toggleBtnTextActive: {
    color: "#fff"
  },
  wizardFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#f1f3f7",
    paddingTop: 20
  },
  wizardCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  wizardCancelBtnText: {
    color: "#6b7a99",
    fontWeight: "600",
    fontSize: 14
  },
  wizardBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderRadius: 12
  },
  wizardBackBtnText: {
    color: "#6b7a99",
    fontWeight: "600",
    fontSize: 14
  },
  wizardNextBtn: {
    backgroundColor: "#3366ff",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  wizardNextBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14
  },
  step3Layout: {
    gap: 20
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#192a4a",
    marginBottom: 20
  },
  summaryItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14
  },
  summaryItemLabel: {
    fontSize: 14,
    color: "#8a92a6",
    fontWeight: "500"
  },
  summaryItemVal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#192a4a"
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 14
  },
  summaryItemTotalLabel: {
    fontSize: 15,
    color: "#192a4a",
    fontWeight: "700"
  },
  summaryItemTotalVal: {
    fontSize: 18,
    fontWeight: "800",
    color: "#192a4a"
  },
  disburseBtn: {
    backgroundColor: "#3366ff",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 20
  },
  disburseBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15
  },
  wizardBackBtnCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 10
  },
  scheduleContainer: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  scheduleHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8a92a6",
    letterSpacing: 0.5,
    marginBottom: 16
  },
  scheduleTable: {
    overflow: "hidden"
  },
  scheduleHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    paddingBottom: 10,
    marginBottom: 6
  },
  schTh: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8a92a6"
  },
  scheduleRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#f1f3f7"
  },
  schTd: {
    fontSize: 14,
    color: "#192a4a"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 24,
    width: "100%",
    maxWidth: 480,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    paddingBottom: 12
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#192a4a"
  },
  modalBody: {
    gap: 12
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  modalTextInput: {
    backgroundColor: "#f4f7ff",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 15,
    color: "#192a4a",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  repaymentInputContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
    paddingTop: 16
  },
  repaymentSectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8a92a6",
    letterSpacing: 0.5
  },
  recordPaymentBtn: {
    backgroundColor: "#3366ff",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 12
  },
  recordPaymentBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14
  },
  detailLabel: {
    fontSize: 14,
    color: "#8a92a6",
    fontWeight: "500"
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#192a4a"
  },
  tableCell: {
    justifyContent: "center"
  },
  viewPlanBtn: {
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 16
  },
  viewPlanBtnText: {
    fontWeight: "700",
    fontSize: 14
  },
  planCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20
  },
  planCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12
  },
  planCardRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  planCardCol: {
    flex: 1
  },
  planCardLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4
  },
  planCardValue: {
    fontSize: 13,
    fontWeight: "600"
  },
  planCardDivider: {
    height: 1,
    marginVertical: 10
  }
});
