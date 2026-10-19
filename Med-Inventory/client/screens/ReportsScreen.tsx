import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Card } from "@/components/Card";

type ReportTab = "aging" | "sales" | "movement" | "valuation";
type AgingBucketKey = "all" | "current" | "days_1_15" | "days_16_30" | "days_31_60" | "days_60_plus";

export default function ReportsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();
  const [activeTab, setActiveTab] = useState<ReportTab>("aging");
  const [selectedBucket, setSelectedBucket] = useState<AgingBucketKey>("all");

  // Aging Query
  const {
    data: agingData,
    isLoading: isAgingLoading,
    refetch: refetchAging,
    isRefetching: isAgingRefetching,
  } = useQuery<any>({
    queryKey: ["/api/reports/receivables-aging"],
  });

  // Sales Query
  const {
    data: salesData,
    isLoading: isSalesLoading,
    refetch: refetchSales,
    isRefetching: isSalesRefetching,
  } = useQuery<any[]>({
    queryKey: ["/api/reports/sales-by-company"],
  });

  // Movement Query
  const {
    data: movementData,
    isLoading: isMovementLoading,
    refetch: refetchMovement,
    isRefetching: isMovementRefetching,
  } = useQuery<any[]>({
    queryKey: ["/api/reports/stock-movement"],
  });

  // Valuation Query
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
    isRefetching: isSummaryRefetching,
  } = useQuery<any>({
    queryKey: ["/api/reports/summary"],
  });

  const isRefreshing =
    isAgingRefetching ||
    isSalesRefetching ||
    isMovementRefetching ||
    isSummaryRefetching;

  const onRefresh = async () => {
    await Promise.all([
      refetchAging(),
      refetchSales(),
      refetchMovement(),
      refetchSummary(),
    ]);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const navigateToCustomer = (customerId: number) => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate("CustomersTab", {
        screen: "CustomerDetail",
        params: { customerId },
      });
    }
  };

  const navigateToOrder = (orderId: number) => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate("SalesTab", {
        screen: "OrderDetail",
        params: { orderId },
      });
    }
  };

  // Filter invoices based on selected aging bucket
  const allInvoices: any[] = agingData?.invoices || [];
  const filteredInvoices = allInvoices.filter((inv) => {
    if (selectedBucket === "all") return true;
    if (selectedBucket === "current") return inv.days_overdue <= 0;
    if (selectedBucket === "days_1_15") return inv.days_overdue >= 1 && inv.days_overdue <= 15;
    if (selectedBucket === "days_16_30") return inv.days_overdue >= 16 && inv.days_overdue <= 30;
    if (selectedBucket === "days_31_60") return inv.days_overdue >= 31 && inv.days_overdue <= 60;
    if (selectedBucket === "days_60_plus") return inv.days_overdue > 60;
    return true;
  });

  // Filter customers based on selected aging bucket
  const allCustomers: any[] = agingData?.customers || [];
  const filteredCustomers = allCustomers.filter((cust) => {
    if (selectedBucket === "all") return true;
    if (selectedBucket === "current") return (cust.current || 0) > 0;
    if (selectedBucket === "days_1_15") return (cust.days_1_15 || 0) > 0;
    if (selectedBucket === "days_16_30") return (cust.days_16_30 || 0) > 0;
    if (selectedBucket === "days_31_60") return (cust.days_31_60 || 0) > 0;
    if (selectedBucket === "days_60_plus") return (cust.days_60_plus || 0) > 0;
    return true;
  });

  // Group stock movement hierarchically by company
  const groupedMovements = React.useMemo(() => {
    if (!movementData || movementData.length === 0) return {};
    const groups: Record<string, any[]> = {};
    for (const mov of movementData) {
      const company = mov.company_name || "General / Other";
      if (!groups[company]) {
        groups[company] = [];
      }
      groups[company].push(mov);
    }
    return groups;
  }, [movementData]);

  const bucketCards: {
    key: AgingBucketKey;
    label: string;
    amount: number;
    sub: string;
    color: string;
  }[] = [
    {
      key: "all",
      label: "All Overdue",
      amount: agingData?.summary?.total_receivables || 0,
      sub: "Total market due",
      color: theme.primary,
    },
    {
      key: "current",
      label: "Current (0d)",
      amount: agingData?.summary?.current || 0,
      sub: "Within credit terms",
      color: theme.success,
    },
    {
      key: "days_1_15",
      label: "1 - 15 Days",
      amount: agingData?.summary?.days_1_15 || 0,
      sub: "Grace window",
      color: theme.warning,
    },
    {
      key: "days_16_30",
      label: "16 - 30 Days",
      amount: agingData?.summary?.days_16_30 || 0,
      sub: "Overdue alert",
      color: theme.warning,
    },
    {
      key: "days_31_60",
      label: "31 - 60 Days",
      amount: agingData?.summary?.days_31_60 || 0,
      sub: "Follow-up required",
      color: theme.error,
    },
    {
      key: "days_60_plus",
      label: "60+ Days",
      amount: agingData?.summary?.days_60_plus || 0,
      sub: "Critical hold",
      color: theme.error,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* 1. Report Selector Tabs */}
      <View
        style={[
          styles.tabsHeader,
          {
            backgroundColor: theme.backgroundDefault,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
        >
          {[
            { id: "aging", label: "Receivables Aging", icon: "clock" },
            { id: "sales", label: "Sales by Manufacturer", icon: "briefcase" },
            { id: "movement", label: "Stock Movement", icon: "activity" },
            {
              id: "valuation",
              label: "Inventory Valuation",
              icon: "pie-chart",
            },
          ].map((t) => {
            const isSelected = activeTab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setActiveTab(t.id as ReportTab)}
                style={[
                  styles.tabChip,
                  isSelected
                    ? {
                        backgroundColor: theme.primary,
                        borderColor: theme.primary,
                      }
                    : {
                        backgroundColor: theme.backgroundTertiary,
                        borderColor: theme.border,
                      },
                ]}
              >
                <Feather
                  name={t.icon as any}
                  size={14}
                  color={isSelected ? "#FFFFFF" : theme.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.tabChipText,
                    { color: isSelected ? "#FFFFFF" : theme.textSecondary },
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. Content */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + 32 },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* TAB 1: RECEIVABLES AGING WITH INTERACTIVE BUCKET DRILL-DOWN */}
        {activeTab === "aging" && (
          <View style={styles.tabSection}>
            {isAgingLoading ? (
              <ActivityIndicator
                size="large"
                color={theme.primary}
                style={{ marginTop: 32 }}
              />
            ) : (
              <>
                {/* Total Receivables Hero */}
                <Card style={styles.heroCard}>
                  <Text
                    style={[styles.heroLabel, { color: theme.textTertiary }]}
                  >
                    Total Market Receivables
                  </Text>
                  <Text style={[styles.heroValue, { color: theme.error }]}>
                    {formatCurrency(agingData?.summary?.total_receivables || 0)}
                  </Text>
                  <Text
                    style={[styles.heroSub, { color: theme.textSecondary }]}
                  >
                    Across {agingData?.customers?.length || 0} active pharmacy
                    accounts • Tap an aging bucket to filter invoices
                  </Text>
                </Card>

                {/* Aging Buckets Row (Interactive Filter) */}
                <View style={styles.agingBucketsGrid}>
                  {bucketCards.map((b) => {
                    const isActive = selectedBucket === b.key;
                    return (
                      <Pressable
                        key={b.key}
                        onPress={() => setSelectedBucket(b.key)}
                        style={[
                          styles.bucketCard,
                          {
                            backgroundColor: isActive
                              ? theme.backgroundSecondary
                              : theme.backgroundDefault,
                            borderColor: isActive ? theme.primary : theme.border,
                            borderWidth: isActive ? 2 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.bucketTitle,
                            {
                              color: isActive
                                ? theme.primary
                                : theme.textTertiary,
                              fontWeight: isActive ? "700" : "600",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {b.label}
                        </Text>
                        <Text style={[styles.bucketVal, { color: b.color }]}>
                          ₹{b.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </Text>
                        <Text
                          style={[
                            styles.bucketDesc,
                            { color: theme.textTertiary },
                          ]}
                          numberOfLines={1}
                        >
                          {b.sub}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Drill-Down Invoices List */}
                <View style={styles.drillDownSection}>
                  <View style={styles.drillDownHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      {selectedBucket === "all"
                        ? "All Unpaid Invoices"
                        : `Invoices in "${bucketCards.find((b) => b.key === selectedBucket)?.label}"`}
                    </Text>
                    <View
                      style={[
                        styles.countBadge,
                        { backgroundColor: theme.backgroundTertiary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.countBadgeText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {filteredInvoices.length} {filteredInvoices.length === 1 ? "Invoice" : "Invoices"}
                      </Text>
                    </View>
                  </View>

                  {filteredInvoices.length === 0 ? (
                    <Card style={styles.emptyCard}>
                      <Feather
                        name="check-circle"
                        size={32}
                        color={theme.success}
                      />
                      <Text style={[styles.emptyCardText, { color: theme.text }]}>
                        No Invoices in this Bucket
                      </Text>
                      <Text
                        style={[
                          styles.emptyCardSub,
                          { color: theme.textSecondary },
                        ]}
                      >
                        There are no outstanding invoices in this specific aging period.
                      </Text>
                    </Card>
                  ) : (
                    filteredInvoices.map((inv: any) => {
                      const isOver = inv.days_overdue > 0;
                      return (
                        <Pressable
                          key={inv.id}
                          onPress={() => navigateToOrder(inv.id)}
                          style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
                        >
                          <Card style={styles.invoiceCard}>
                            <View style={styles.invoiceCardHeader}>
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <View style={styles.invNumberRow}>
                                  <Text
                                    style={[
                                      styles.invoiceNumber,
                                      { color: theme.primary },
                                    ]}
                                  >
                                    {inv.invoice_number}
                                  </Text>
                                  <View
                                    style={[
                                      styles.overdueBadge,
                                      {
                                        backgroundColor: isOver
                                          ? theme.badgeDangerBg
                                          : theme.badgeSuccessBg,
                                        borderColor: isOver
                                          ? theme.badgeDangerBorder
                                          : theme.badgeSuccessBorder,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.overdueBadgeText,
                                        {
                                          color: isOver
                                            ? theme.badgeDangerText
                                            : theme.badgeSuccessText,
                                        },
                                      ]}
                                    >
                                      {isOver
                                        ? `${inv.days_overdue}d Overdue`
                                        : "Current / In Terms"}
                                    </Text>
                                  </View>
                                </View>

                                <Pressable
                                  onPress={() => navigateToCustomer(inv.customer_id)}
                                >
                                  <Text
                                    style={[
                                      styles.invCustomerName,
                                      { color: theme.text },
                                    ]}
                                  >
                                    {inv.customer_name}
                                  </Text>
                                </Pressable>
                                <Text
                                  style={[
                                    styles.invDates,
                                    { color: theme.textTertiary },
                                  ]}
                                >
                                  Billed: {inv.order_date ? inv.order_date.split("T")[0] : ""} • Due: {inv.due_date}
                                </Text>
                              </View>

                              <View style={styles.invAmountsContainer}>
                                <Text
                                  style={[
                                    styles.invOutstanding,
                                    { color: theme.error },
                                  ]}
                                >
                                  ₹{Number(inv.outstanding_amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                                </Text>
                                <Text
                                  style={[
                                    styles.invTotalSub,
                                    { color: theme.textTertiary },
                                  ]}
                                >
                                  of ₹{Number(inv.total_amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                                </Text>
                                <View style={styles.invActionPrompt}>
                                  <Text
                                    style={[
                                      styles.invActionPromptText,
                                      { color: theme.primary },
                                    ]}
                                  >
                                    View Invoice &gt;
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </Card>
                        </Pressable>
                      );
                    })
                  )}
                </View>

                {/* Customer Breakdown Section */}
                <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 16 }]}>
                  Debtor Pharmacy Accounts
                </Text>
                {filteredCustomers.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <Feather
                      name="check-circle"
                      size={32}
                      color={theme.success}
                    />
                    <Text style={[styles.emptyCardText, { color: theme.text }]}>
                      No Customer Accounts in this Category
                    </Text>
                  </Card>
                ) : (
                  filteredCustomers.map((cust: any) => (
                    <Pressable
                      key={cust.customer_id}
                      onPress={() => navigateToCustomer(cust.customer_id)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                    >
                      <Card style={styles.agingCustCard}>
                        <View style={styles.agingCustHeader}>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.agingCustName,
                                { color: theme.text },
                              ]}
                            >
                              {cust.customer_name}
                            </Text>
                            <Text
                              style={[
                                styles.agingCustPhone,
                                { color: theme.textTertiary },
                              ]}
                            >
                              {cust.customer_phone ? `${cust.customer_phone} • ` : ""}{cust.invoices_count} Unpaid Invoices
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.agingCustTotal,
                              { color: theme.error },
                            ]}
                          >
                            ₹{Number(cust.total_outstanding).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.agingCustBuckets,
                            { borderTopColor: theme.border },
                          ]}
                        >
                          <Text
                            style={[
                              styles.custBucketItem,
                              { color: theme.textSecondary },
                            ]}
                          >
                            Current: ₹{Number(cust.current || 0).toFixed(0)}
                          </Text>
                          <Text
                            style={[
                              styles.custBucketItem,
                              { color: theme.warning },
                            ]}
                          >
                            1-30d: ₹
                            {Number((cust.days_1_15 || 0) + (cust.days_16_30 || 0)).toFixed(0)}
                          </Text>
                          <Text
                            style={[
                              styles.custBucketItem,
                              { color: theme.error },
                            ]}
                          >
                            30d+: ₹
                            {Number((cust.days_31_60 || 0) + (cust.days_60_plus || 0)).toFixed(0)}
                          </Text>
                        </View>
                      </Card>
                    </Pressable>
                  ))
                )}
              </>
            )}
          </View>
        )}

        {/* TAB 2: SALES BY MANUFACTURER */}
        {activeTab === "sales" && (
          <View style={styles.tabSection}>
            {isSalesLoading ? (
              <ActivityIndicator
                size="large"
                color={theme.primary}
                style={{ marginTop: 32 }}
              />
            ) : salesData?.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Feather
                  name="briefcase"
                  size={36}
                  color={theme.textTertiary}
                />
                <Text style={[styles.emptyCardText, { color: theme.text }]}>
                  No Sales Recorded Yet
                </Text>
                <Text
                  style={[styles.emptyCardSub, { color: theme.textSecondary }]}
                >
                  Generate sales invoices to see manufacturer performance.
                </Text>
              </Card>
            ) : (
              salesData?.map((comp: any) => (
                <Card key={comp.company_id} style={styles.salesCard}>
                  <View style={styles.salesHeader}>
                    <Text
                      style={[styles.salesCompanyName, { color: theme.text }]}
                    >
                      {comp.company_name}
                    </Text>
                    <Text
                      style={[styles.salesRevenue, { color: theme.primary }]}
                    >
                      ₹{Number(comp.total_revenue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.salesMetricsGrid,
                      { borderTopColor: theme.border },
                    ]}
                  >
                    <View style={styles.salesMetricItem}>
                      <Text
                        style={[
                          styles.salesMetricLabel,
                          { color: theme.textTertiary },
                        ]}
                      >
                        Invoices
                      </Text>
                      <Text
                        style={[styles.salesMetricVal, { color: theme.text }]}
                      >
                        {comp.orders_count}
                      </Text>
                    </View>
                    <View style={styles.salesMetricItem}>
                      <Text
                        style={[
                          styles.salesMetricLabel,
                          { color: theme.textTertiary },
                        ]}
                      >
                        Units Sold
                      </Text>
                      <Text
                        style={[styles.salesMetricVal, { color: theme.text }]}
                      >
                        {comp.units_sold}
                      </Text>
                    </View>
                    <View style={styles.salesMetricItem}>
                      <Text
                        style={[
                          styles.salesMetricLabel,
                          { color: theme.textTertiary },
                        ]}
                      >
                        Taxable Value
                      </Text>
                      <Text
                        style={[styles.salesMetricVal, { color: theme.text }]}
                      >
                        ₹{Number(comp.total_taxable || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </Text>
                    </View>
                    <View style={styles.salesMetricItem}>
                      <Text
                        style={[
                          styles.salesMetricLabel,
                          { color: theme.textTertiary },
                        ]}
                      >
                        GST Collected
                      </Text>
                      <Text
                        style={[
                          styles.salesMetricVal,
                          { color: theme.success },
                        ]}
                      >
                        ₹{Number(comp.total_tax || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {/* TAB 3: STOCK MOVEMENT HIERARCHICAL VIEW */}
        {activeTab === "movement" && (
          <View style={styles.tabSection}>
            {isMovementLoading ? (
              <ActivityIndicator
                size="large"
                color={theme.primary}
                style={{ marginTop: 32 }}
              />
            ) : Object.keys(groupedMovements).length === 0 ? (
              <Card style={styles.emptyCard}>
                <Feather name="activity" size={36} color={theme.textTertiary} />
                <Text style={[styles.emptyCardText, { color: theme.text }]}>
                  No Stock Movements
                </Text>
                <Text style={[styles.emptyCardSub, { color: theme.textSecondary }]}>
                  Stock receipts and sales dispatches will create audit movements here.
                </Text>
              </Card>
            ) : (
              Object.entries(groupedMovements).map(([companyName, movements]) => (
                <View key={companyName} style={styles.movementGroup}>
                  {/* Company Header */}
                  <View
                    style={[
                      styles.movementGroupHeader,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Feather
                      name="briefcase"
                      size={14}
                      color={theme.primary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.movementGroupName,
                        { color: theme.text },
                      ]}
                    >
                      {companyName}
                    </Text>
                    <Text
                      style={[
                        styles.movementGroupCount,
                        { color: theme.textTertiary },
                      ]}
                    >
                      ({movements.length} {movements.length === 1 ? "entry" : "entries"})
                    </Text>
                  </View>

                  {/* Movements under Company */}
                  <View style={styles.movementGroupItems}>
                    {movements.map((mov) => {
                      const isIn = mov.transaction_type === "in";
                      return (
                        <Card key={mov.id} style={styles.movementCard}>
                          <View style={styles.movementHeader}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text
                                style={[
                                  styles.movementName,
                                  { color: theme.text },
                                ]}
                              >
                                {mov.product_name}
                              </Text>
                              <Text
                                style={[
                                  styles.movementMeta,
                                  { color: theme.textTertiary },
                                ]}
                              >
                                {mov.batch_number ? `Lot: ${mov.batch_number} • ` : ""}Date: {mov.date ? mov.date.split("T")[0] : ""}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.movementBadge,
                                {
                                  backgroundColor: isIn
                                    ? theme.badgeSuccessBg
                                    : theme.badgeWarningBg,
                                  borderColor: isIn
                                    ? theme.badgeSuccessBorder
                                    : theme.badgeWarningBorder,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.movementBadgeText,
                                  {
                                    color: isIn
                                      ? theme.badgeSuccessText
                                      : theme.badgeWarningText,
                                  },
                                ]}
                              >
                                {isIn ? `+${mov.quantity}` : `-${mov.quantity}`}{" "}
                                {mov.uom || "Units"}
                              </Text>
                            </View>
                          </View>
                          {mov.notes && (
                            <Text
                              style={[
                                styles.movementNotes,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {mov.notes}
                            </Text>
                          )}
                        </Card>
                      );
                    })}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 4: VALUATION & HOLDINGS */}
        {activeTab === "valuation" && (
          <View style={styles.tabSection}>
            {isSummaryLoading ? (
              <ActivityIndicator
                size="large"
                color={theme.primary}
                style={{ marginTop: 32 }}
              />
            ) : (
              <>
                <Card style={styles.heroCard}>
                  <Text
                    style={[styles.heroLabel, { color: theme.textTertiary }]}
                  >
                    Total Inventory Value (Cost basis)
                  </Text>
                  <Text style={[styles.heroValue, { color: theme.primary }]}>
                    {formatCurrency(
                      summaryData?.inventory?.total_investment || 0,
                    )}
                  </Text>
                  <Text
                    style={[styles.heroSub, { color: theme.textSecondary }]}
                  >
                    Potential Realizable Value:{" "}
                    {formatCurrency(
                      summaryData?.inventory?.potential_revenue || 0,
                    )}
                  </Text>
                </Card>

                <View style={styles.valuationGrid}>
                  <View
                    style={[
                      styles.valuationTile,
                      {
                        backgroundColor: theme.backgroundDefault,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.valTileLabel,
                        { color: theme.textTertiary },
                      ]}
                    >
                      Active Catalog Products
                    </Text>
                    <Text style={[styles.valTileVal, { color: theme.text }]}>
                      {summaryData?.inventory?.total_products || 0}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.valuationTile,
                      {
                        backgroundColor: theme.backgroundDefault,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.valTileLabel,
                        { color: theme.textTertiary },
                      ]}
                    >
                      Physical Units in Stock
                    </Text>
                    <Text style={[styles.valTileVal, { color: theme.text }]}>
                      {summaryData?.inventory?.total_stock_quantity || 0}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.valuationTile,
                      {
                        backgroundColor: theme.backgroundDefault,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.valTileLabel,
                        { color: theme.textTertiary },
                      ]}
                    >
                      Projected Gross Margin
                    </Text>
                    <Text style={[styles.valTileVal, { color: theme.success }]}>
                      {formatCurrency(
                        (summaryData?.inventory?.potential_revenue || 0) -
                          (summaryData?.inventory?.total_investment || 0),
                      )}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsHeader: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  tabSection: {
    gap: 12,
  },
  heroCard: {
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 4,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  heroValue: {
    fontSize: 28,
    fontWeight: "800",
    marginVertical: 4,
  },
  heroSub: {
    fontSize: 12,
    textAlign: "center",
  },
  agingBucketsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bucketCard: {
    flex: 1,
    minWidth: 100,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  bucketTitle: {
    fontSize: 11,
    marginBottom: 2,
  },
  bucketVal: {
    fontSize: 15,
    fontWeight: "700",
    marginVertical: 2,
  },
  bucketDesc: {
    fontSize: 10,
  },
  drillDownSection: {
    marginTop: 8,
    gap: 10,
  },
  drillDownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  invoiceCard: {
    padding: 12,
    borderRadius: 8,
  },
  invoiceCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  invNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  invoiceNumber: {
    fontSize: 13,
    fontWeight: "700",
  },
  overdueBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  overdueBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  invCustomerName: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  invDates: {
    fontSize: 11,
    marginTop: 2,
  },
  invAmountsContainer: {
    alignItems: "flex-end",
  },
  invOutstanding: {
    fontSize: 15,
    fontWeight: "800",
  },
  invTotalSub: {
    fontSize: 11,
    marginTop: 1,
  },
  invActionPrompt: {
    marginTop: 4,
  },
  invActionPromptText: {
    fontSize: 11,
    fontWeight: "600",
  },
  agingCustCard: {
    padding: 14,
    borderRadius: 10,
  },
  agingCustHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  agingCustName: {
    fontSize: 15,
    fontWeight: "700",
  },
  agingCustPhone: {
    fontSize: 12,
    marginTop: 2,
  },
  agingCustTotal: {
    fontSize: 16,
    fontWeight: "800",
  },
  agingCustBuckets: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: 8,
  },
  custBucketItem: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    gap: 6,
  },
  emptyCardText: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 6,
  },
  emptyCardSub: {
    fontSize: 12,
    textAlign: "center",
  },
  salesCard: {
    padding: 16,
    borderRadius: 10,
  },
  salesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  salesCompanyName: {
    fontSize: 16,
    fontWeight: "700",
  },
  salesRevenue: {
    fontSize: 17,
    fontWeight: "800",
  },
  salesMetricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  salesMetricItem: {
    alignItems: "center",
  },
  salesMetricLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  salesMetricVal: {
    fontSize: 13,
    fontWeight: "700",
  },
  movementGroup: {
    gap: 8,
    marginBottom: 8,
  },
  movementGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  movementGroupName: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  movementGroupCount: {
    fontSize: 11,
  },
  movementGroupItems: {
    gap: 6,
  },
  movementCard: {
    padding: 12,
    borderRadius: 8,
  },
  movementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  movementName: {
    fontSize: 14,
    fontWeight: "700",
  },
  movementMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  movementBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  movementBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  movementNotes: {
    fontSize: 12,
    marginTop: 6,
  },
  valuationGrid: {
    gap: 8,
  },
  valuationTile: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  valTileLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  valTileVal: {
    fontSize: 16,
    fontWeight: "800",
  },
});
