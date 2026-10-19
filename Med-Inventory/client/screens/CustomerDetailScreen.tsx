import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Card } from "@/components/Card";
import { apiRequest } from "@/lib/query-client";
import type { Customer, Order, CustomerLedgerEntry } from "@shared/types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { CustomersStackParamList } from "@/navigation/CustomersStackNavigator";

type Props = {
  navigation: NativeStackNavigationProp<
    CustomersStackParamList,
    "CustomerDetail"
  >;
  route: RouteProp<CustomersStackParamList, "CustomerDetail">;
};

type ActiveTab = "invoices" | "ledger" | "details";

export default function CustomerDetailScreen({ navigation, route }: Props) {
  const { customerId } = route.params;
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>("invoices");
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "upi" | "cash" | "bank_transfer" | "cheque"
  >("upi");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const { data: customer, isLoading } = useQuery<
    Customer & {
      total_invoices: number;
      overdue_invoices: number;
      recent_invoices: Order[];
      recent_ledger: CustomerLedgerEntry[];
    }
  >({
    queryKey: [`/api/customers/${customerId}`],
  });

  const { data: fullLedger } = useQuery<CustomerLedgerEntry[]>({
    queryKey: [`/api/customers/${customerId}/ledger`],
    enabled: activeTab === "ledger",
  });

  const { data: fullInvoices } = useQuery<Order[]>({
    queryKey: [`/api/customers/${customerId}/invoices`],
    enabled: activeTab === "invoices",
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(paymentAmount);
      if (!amt || amt <= 0) {
        throw new Error("Enter a valid payment amount");
      }

      return await apiRequest("POST", "/api/payments", {
        customer_id: customerId,
        amount: amt,
        payment_method: paymentMethod,
        reference_number: paymentRef.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/customers/${customerId}`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/customers/${customerId}/ledger`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/customers/${customerId}/invoices`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setPaymentModalVisible(false);
      setPaymentAmount("");
      setPaymentRef("");
      setPaymentNotes("");
    },
    onError: (err: any) => {
      const msg = err.message || "Failed to record payment";
      if (Platform.OS === "web") {
        alert(msg);
      }
    },
  });

  if (isLoading || !customer) {
    return (
      <View
        style={[styles.centered, { backgroundColor: theme.backgroundRoot }]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const isWalkIn = customer.id === 1 || customer.store_name.includes("Walk-in");
  const balance = customer.outstanding_balance || 0;
  const creditLimit = isWalkIn ? 0 : customer.credit_limit || 50000;
  const isOverdue = !isWalkIn && customer.overdue_invoices > 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
    >
      {/* 1. Header Card */}
      <Card style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.storeName, { color: theme.text }]}>
              {customer.store_name}
            </Text>
            {customer.contact_person ? (
              <Text
                style={[styles.contactPerson, { color: theme.textSecondary }]}
              >
                {customer.contact_person}
              </Text>
            ) : null}
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isWalkIn
                  ? theme.backgroundTertiary
                  : isOverdue
                    ? theme.badgeDangerBg
                    : balance > 0
                      ? theme.badgeWarningBg
                      : theme.badgeSuccessBg,
                borderColor: isWalkIn
                  ? theme.border
                  : isOverdue
                    ? theme.badgeDangerBorder
                    : balance > 0
                      ? theme.badgeWarningBorder
                      : theme.badgeSuccessBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                {
                  color: isWalkIn
                    ? theme.textSecondary
                    : isOverdue
                      ? theme.badgeDangerText
                      : balance > 0
                        ? theme.badgeWarningText
                        : theme.badgeSuccessText,
                },
              ]}
            >
              {isWalkIn
                ? "Cash Counter"
                : isOverdue
                  ? "Overdue"
                  : balance > 0
                    ? "Active Balance"
                    : "Clear"}
            </Text>
          </View>
        </View>

        {/* Financial Stat Tiles */}
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statTile,
              { backgroundColor: theme.backgroundTertiary },
            ]}
          >
            <Text style={[styles.statLabel, { color: theme.textTertiary }]}>
              {isWalkIn ? "Settlement" : "Outstanding Due"}
            </Text>
            <Text
              style={[
                styles.statValue,
                {
                  color: isWalkIn
                    ? theme.text
                    : isOverdue
                      ? theme.error
                      : balance > 0
                        ? theme.warning
                        : theme.success,
                },
              ]}
            >
              {isWalkIn
                ? "Immediate"
                : `₹${balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            </Text>
          </View>

          <View
            style={[
              styles.statTile,
              { backgroundColor: theme.backgroundTertiary },
            ]}
          >
            <Text style={[styles.statLabel, { color: theme.textTertiary }]}>
              {isWalkIn ? "Credit Line" : "Credit Limit"}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {isWalkIn ? "None (Cash)" : `₹${creditLimit.toLocaleString("en-IN")}`}
            </Text>
          </View>

          <View
            style={[
              styles.statTile,
              { backgroundColor: theme.backgroundTertiary },
            ]}
          >
            <Text style={[styles.statLabel, { color: theme.textTertiary }]}>
              Terms
            </Text>
            <Text style={[styles.statValue, { color: theme.primary }]}>
              {isWalkIn ? "0 Days (Cash)" : `${customer.payment_terms_days} Days`}
            </Text>
          </View>
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.actionButtonsRow}>
          <Pressable
            onPress={() =>
              navigation.navigate("CreateOrder", { customerId: customer.id })
            }
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: theme.primary, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Feather
              name="plus-circle"
              size={16}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.actionBtnText}>New Order</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setPaymentAmount(balance > 0 ? String(balance) : "");
              setPaymentModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.primary,
                borderWidth: 1,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Feather
              name="dollar-sign"
              size={16}
              color={theme.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.actionBtnText, { color: theme.primary }]}>
              Record Payment
            </Text>
          </Pressable>
        </View>
      </Card>

      {/* 2. Navigation Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        <Pressable
          onPress={() => setActiveTab("invoices")}
          style={[
            styles.tabItem,
            activeTab === "invoices" && [
              styles.activeTabItem,
              { borderBottomColor: theme.primary },
            ],
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "invoices"
                    ? theme.primary
                    : theme.textSecondary,
              },
            ]}
          >
            Invoices ({customer.total_invoices || 0})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("ledger")}
          style={[
            styles.tabItem,
            activeTab === "ledger" && [
              styles.activeTabItem,
              { borderBottomColor: theme.primary },
            ],
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "ledger" ? theme.primary : theme.textSecondary,
              },
            ]}
          >
            Ledger History
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("details")}
          style={[
            styles.tabItem,
            activeTab === "details" && [
              styles.activeTabItem,
              { borderBottomColor: theme.primary },
            ],
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "details" ? theme.primary : theme.textSecondary,
              },
            ]}
          >
            Info & Tax
          </Text>
        </Pressable>
      </View>

      {/* 3. Tab Contents */}
      <View style={styles.tabContentContainer}>
        {activeTab === "invoices" && (
          <View style={styles.invoicesList}>
            {(fullInvoices || customer.recent_invoices)?.length === 0 ? (
              <View style={styles.emptyTabState}>
                <Feather
                  name="file-text"
                  size={36}
                  color={theme.textTertiary}
                />
                <Text
                  style={[styles.emptyTabText, { color: theme.textSecondary }]}
                >
                  No invoices generated yet for this pharmacy.
                </Text>
              </View>
            ) : (
              (fullInvoices || customer.recent_invoices)?.map((inv) => (
                <Pressable
                  key={inv.id}
                  onPress={() =>
                    navigation.navigate("OrderDetail", { orderId: inv.id })
                  }
                  style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
                >
                  <Card style={styles.invoiceItemCard}>
                    <View style={styles.invoiceHeader}>
                      <View>
                        <Text
                          style={[styles.invoiceNumber, { color: theme.text }]}
                        >
                          {inv.invoice_number}
                        </Text>
                        <Text
                          style={[
                            styles.invoiceDate,
                            { color: theme.textTertiary },
                          ]}
                        >
                          Date: {inv.order_date} | Due: {inv.due_date}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor:
                              inv.status === "Paid"
                                ? theme.badgeSuccessBg
                                : inv.status === "Overdue"
                                  ? theme.badgeDangerBg
                                  : theme.badgeWarningBg,
                            borderColor:
                              inv.status === "Paid"
                                ? theme.badgeSuccessBorder
                                : inv.status === "Overdue"
                                  ? theme.badgeDangerBorder
                                  : theme.badgeWarningBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            {
                              color:
                                inv.status === "Paid"
                                  ? theme.badgeSuccessText
                                  : inv.status === "Overdue"
                                    ? theme.badgeDangerText
                                    : theme.badgeWarningText,
                            },
                          ]}
                        >
                          {inv.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.invoiceFinancials}>
                      <View>
                        <Text
                          style={[styles.finLabel, { color: theme.textTertiary }]}
                        >
                          Total
                        </Text>
                        <Text style={[styles.finValue, { color: theme.text }]}>
                          ₹{inv.total_amount.toFixed(2)}
                        </Text>
                      </View>
                      <View>
                        <Text
                          style={[styles.finLabel, { color: theme.textTertiary }]}
                        >
                          Paid
                        </Text>
                        <Text style={[styles.finValue, { color: theme.success }]}>
                          ₹{inv.paid_amount.toFixed(2)}
                        </Text>
                      </View>
                      <View>
                        <Text
                          style={[styles.finLabel, { color: theme.textTertiary }]}
                        >
                          Balance
                        </Text>
                        <Text style={[styles.finValue, { color: theme.warning }]}>
                          ₹{(inv.total_amount - inv.paid_amount).toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.invoiceFooterRow,
                        { borderTopColor: theme.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.viewInvoiceLink,
                          { color: theme.primary },
                        ]}
                      >
                        View Tax Invoice Details
                      </Text>
                      <Feather
                        name="chevron-right"
                        size={16}
                        color={theme.primary}
                      />
                    </View>
                  </Card>
                </Pressable>
              ))
            )}
          </View>
        )}

        {activeTab === "ledger" && (
          <View style={styles.ledgerList}>
            {(fullLedger || customer.recent_ledger)?.length === 0 ? (
              <View style={styles.emptyTabState}>
                <Feather
                  name="book-open"
                  size={36}
                  color={theme.textTertiary}
                />
                <Text
                  style={[styles.emptyTabText, { color: theme.textSecondary }]}
                >
                  No ledger entries recorded yet.
                </Text>
              </View>
            ) : (
              (fullLedger || customer.recent_ledger)?.map((entry) => (
                <Card key={entry.id} style={styles.ledgerCard}>
                  <View style={styles.ledgerHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ledgerType, { color: theme.text }]}>
                        {entry.entry_type.toUpperCase()}
                      </Text>
                      <Text
                        style={[
                          styles.ledgerDate,
                          { color: theme.textTertiary },
                        ]}
                      >
                        {entry.entry_date}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.ledgerAmount,
                        {
                          color: entry.debit > 0 ? theme.error : theme.success,
                        },
                      ]}
                    >
                      {entry.debit > 0
                        ? `+ ₹${entry.debit.toFixed(2)}`
                        : `- ₹${entry.credit.toFixed(2)}`}
                    </Text>
                  </View>
                  {entry.notes ? (
                    <Text
                      style={[
                        styles.ledgerNotes,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {entry.notes}
                    </Text>
                  ) : null}
                </Card>
              ))
            )}
          </View>
        )}

        {activeTab === "details" && (
          <Card style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailKey, { color: theme.textSecondary }]}>
                Phone Number:
              </Text>
              <Text style={[styles.detailVal, { color: theme.text }]}>
                {customer.phone}
              </Text>
            </View>
            {customer.email ? (
              <View style={styles.detailRow}>
                <Text
                  style={[styles.detailKey, { color: theme.textSecondary }]}
                >
                  Email:
                </Text>
                <Text style={[styles.detailVal, { color: theme.text }]}>
                  {customer.email}
                </Text>
              </View>
            ) : null}
            {customer.gstin ? (
              <View style={styles.detailRow}>
                <Text
                  style={[styles.detailKey, { color: theme.textSecondary }]}
                >
                  GSTIN:
                </Text>
                <Text style={[styles.detailVal, { color: theme.text }]}>
                  {customer.gstin}
                </Text>
              </View>
            ) : null}
            {customer.dl_number ? (
              <View style={styles.detailRow}>
                <Text
                  style={[styles.detailKey, { color: theme.textSecondary }]}
                >
                  Drug License (DL):
                </Text>
                <Text style={[styles.detailVal, { color: theme.text }]}>
                  {customer.dl_number}
                </Text>
              </View>
            ) : null}
            {customer.billing_address ? (
              <View style={styles.detailRow}>
                <Text
                  style={[styles.detailKey, { color: theme.textSecondary }]}
                >
                  Billing Address:
                </Text>
                <Text style={[styles.detailVal, { color: theme.text }]}>
                  {customer.billing_address}
                </Text>
              </View>
            ) : null}
            {customer.delivery_address ? (
              <View style={styles.detailRow}>
                <Text
                  style={[styles.detailKey, { color: theme.textSecondary }]}
                >
                  Delivery Address:
                </Text>
                <Text style={[styles.detailVal, { color: theme.text }]}>
                  {customer.delivery_address}
                </Text>
              </View>
            ) : null}
          </Card>
        )}
      </View>

      {/* Record Payment Modal */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Record Customer Payment
              </Text>
              <Pressable onPress={() => setPaymentModalVisible(false)}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <Text
              style={[styles.modalCustomerName, { color: theme.textSecondary }]}
            >
              {customer.store_name} | Current Balance: ₹{balance.toFixed(2)}
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Payment Amount (₹) *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder="0.00"
                placeholderTextColor={theme.textTertiary}
                keyboardType="numeric"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Payment Mode
              </Text>
              <View style={styles.paymentMethodRow}>
                {(["upi", "cash", "bank_transfer", "cheque"] as const).map(
                  (mode) => (
                    <Pressable
                      key={mode}
                      onPress={() => setPaymentMethod(mode)}
                      style={[
                        styles.methodChip,
                        paymentMethod === mode
                          ? {
                              backgroundColor: theme.primary,
                              borderColor: theme.primary,
                            }
                          : { borderColor: theme.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.methodChipText,
                          {
                            color:
                              paymentMethod === mode
                                ? "#FFFFFF"
                                : theme.textSecondary,
                          },
                        ]}
                      >
                        {mode.toUpperCase()}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Reference / Transaction # (Optional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder="UPI ID, UTR, or Cheque number"
                placeholderTextColor={theme.textTertiary}
                value={paymentRef}
                onChangeText={setPaymentRef}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Notes (Optional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder="Remarks"
                placeholderTextColor={theme.textTertiary}
                value={paymentNotes}
                onChangeText={setPaymentNotes}
              />
            </View>

            <Pressable
              onPress={() => paymentMutation.mutate()}
              disabled={paymentMutation.isPending}
              style={({ pressed }) => [
                styles.modalSubmitBtn,
                {
                  backgroundColor: theme.primary,
                  opacity: pressed || paymentMutation.isPending ? 0.8 : 1,
                },
              ]}
            >
              {paymentMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Save Payment</Text>
              )}
            </Pressable>
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  profileCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  storeName: {
    fontSize: 18,
    fontWeight: "700",
  },
  contactPerson: {
    fontSize: 14,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  statTile: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tabItem: {
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTabItem: {},
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabContentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  invoicesList: {
    gap: 12,
  },
  invoiceItemCard: {
    padding: 14,
    borderRadius: 10,
  },
  invoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  invoiceNumber: {
    fontSize: 15,
    fontWeight: "700",
  },
  invoiceDate: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  invoiceFinancials: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 8,
  },
  finLabel: {
    fontSize: 11,
  },
  finValue: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  ledgerList: {
    gap: 10,
  },
  ledgerCard: {
    padding: 12,
    borderRadius: 8,
  },
  ledgerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ledgerType: {
    fontSize: 13,
    fontWeight: "700",
  },
  ledgerDate: {
    fontSize: 11,
    marginTop: 2,
  },
  ledgerAmount: {
    fontSize: 15,
    fontWeight: "700",
  },
  ledgerNotes: {
    fontSize: 12,
    marginTop: 6,
  },
  detailsCard: {
    padding: 16,
    borderRadius: 10,
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailKey: {
    fontSize: 13,
    fontWeight: "500",
    width: "40%",
  },
  detailVal: {
    fontSize: 13,
    fontWeight: "600",
    width: "60%",
    textAlign: "right",
  },
  emptyTabState: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTabText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxWidth: 480,
    padding: 20,
    borderRadius: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  modalCustomerName: {
    fontSize: 13,
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  paymentMethodRow: {
    flexDirection: "row",
    gap: 8,
  },
  methodChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
  },
  methodChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  modalSubmitBtn: {
    height: 46,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  modalSubmitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  invoiceFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
  },
  viewInvoiceLink: {
    fontSize: 12,
    fontWeight: "600",
  },
});
