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
import type { Order, OrderItem, Payment } from "@shared/types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { OrdersStackParamList } from "@/navigation/OrdersStackNavigator";

type Props = {
  navigation: NativeStackNavigationProp<OrdersStackParamList, "OrderDetail">;
  route: RouteProp<OrdersStackParamList, "OrderDetail">;
};

export default function OrderDetailScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<
    "upi" | "cash" | "bank_transfer" | "cheque"
  >("upi");
  const [payRef, setPayRef] = useState("");

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const { data: order, isLoading } = useQuery<
    Order & {
      customer_name: string;
      customer_contact: string;
      customer_phone: string;
      customer_gstin: string;
      customer_address: string;
      items: (OrderItem & {
        product_name: string;
        company_name: string;
        batch_number: string;
        expiry_date: string;
        uom: string;
      })[];
      payments: Payment[];
    }
  >({
    queryKey: [`/api/orders/${orderId}`],
  });

  const remaining = order ? order.total_amount - order.paid_amount : 0;
  const isPaid = order?.status === "Paid";
  const isOverdue = order?.status === "Overdue";

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(payAmount);
      if (!amt || amt <= 0) {
        throw new Error("Enter a valid payment amount");
      }

      return await apiRequest("POST", "/api/payments", {
        customer_id: order?.customer_id,
        order_id: order?.id,
        amount: amt,
        payment_method: payMethod,
        reference_number: payRef.trim() || undefined,
        notes: `Payment for ${order?.invoice_number}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setPaymentModalVisible(false);
      setPayAmount("");
      setPayRef("");
    },
    onError: (err: any) => {
      const msg = err.message || "Failed to record payment";
      if (Platform.OS === "web") {
        alert(msg);
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/orders/${orderId}/cancel`, {
        reason: cancelReason.trim() || "Order cancelled by distributor",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/reports/receivables-aging"],
      });
      setCancelModalVisible(false);
      setCancelReason("");
    },
    onError: (err: any) => {
      const msg = err.message || "Failed to cancel order";
      if (Platform.OS === "web") {
        alert(msg);
      }
    },
  });

  if (isLoading || !order) {
    return (
      <View
        style={[styles.centered, { backgroundColor: theme.backgroundRoot }]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={styles.content}
    >
      {/* 1. Formal Letterhead Card */}
      <Card style={styles.card}>
        <View style={styles.letterhead}>
          <View>
            <Text style={[styles.distributorName, { color: theme.primary }]}>
              MediDist Pharma Distributors
            </Text>
            <Text
              style={[
                styles.distributorAddress,
                { color: theme.textSecondary },
              ]}
            >
              Shop 14, Wholesale Medicine Market, Delhi
            </Text>
            <Text
              style={[styles.distributorTax, { color: theme.textTertiary }]}
            >
              GSTIN: 07AAAAA0000A1Z5 | DL: DL-20B/21B-987654
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.invoiceTitle, { color: theme.text }]}>
              TAX INVOICE
            </Text>
            <Text style={[styles.invoiceNumber, { color: theme.primary }]}>
              {order.invoice_number}
            </Text>
          </View>
        </View>

        {/* Invoice Meta Grid */}
        <View
          style={[
            styles.metaGrid,
            { borderTopColor: theme.border, borderBottomColor: theme.border },
          ]}
        >
          <View style={styles.metaCell}>
            <Text style={[styles.metaLabel, { color: theme.textTertiary }]}>
              Invoice Date
            </Text>
            <Text style={[styles.metaVal, { color: theme.text }]}>
              {order.order_date}
            </Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={[styles.metaLabel, { color: theme.textTertiary }]}>
              Due Date
            </Text>
            <Text
              style={[
                styles.metaVal,
                { color: isOverdue ? theme.error : theme.text },
              ]}
            >
              {order.due_date}
            </Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={[styles.metaLabel, { color: theme.textTertiary }]}>
              Payment Status
            </Text>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isPaid
                    ? theme.badgeSuccessBg
                    : isOverdue
                      ? theme.badgeDangerBg
                      : theme.badgeWarningBg,
                  borderColor: isPaid
                    ? theme.badgeSuccessBorder
                    : isOverdue
                      ? theme.badgeDangerBorder
                      : theme.badgeWarningBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: isPaid
                      ? theme.badgeSuccessText
                      : isOverdue
                        ? theme.badgeDangerText
                        : theme.badgeWarningText,
                  },
                ]}
              >
                {order.status}
              </Text>
            </View>
          </View>
        </View>

        {/* Billed To Customer */}
        <View style={styles.customerBox}>
          <Text
            style={[styles.customerBoxTitle, { color: theme.textTertiary }]}
          >
            BILLED TO (BUYER):
          </Text>
          <Text style={[styles.customerStoreName, { color: theme.text }]}>
            {order.customer_name}
          </Text>
          {order.customer_contact ? (
            <Text
              style={[
                styles.customerDetailText,
                { color: theme.textSecondary },
              ]}
            >
              Attn: {order.customer_contact} ({order.customer_phone})
            </Text>
          ) : (
            <Text
              style={[
                styles.customerDetailText,
                { color: theme.textSecondary },
              ]}
            >
              Phone: {order.customer_phone}
            </Text>
          )}
          {order.customer_address && (
            <Text
              style={[
                styles.customerDetailText,
                { color: theme.textSecondary },
              ]}
            >
              Address: {order.customer_address}
            </Text>
          )}
          {order.customer_gstin && (
            <Text
              style={[
                styles.customerDetailText,
                { color: theme.textSecondary },
              ]}
            >
              GSTIN: {order.customer_gstin}
            </Text>
          )}
        </View>
      </Card>

      {/* 2. Line Items Table */}
      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Itemized Medicines
        </Text>

        {order.items?.map((it, idx) => (
          <View
            key={idx}
            style={[styles.lineItemRow, { borderBottomColor: theme.border }]}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.lineItemName, { color: theme.text }]}>
                {it.product_name}
              </Text>
              <Text
                style={[styles.lineItemMeta, { color: theme.textTertiary }]}
              >
                {it.company_name} | Lot: {it.batch_number} (Exp:{" "}
                {it.expiry_date})
              </Text>
              <Text
                style={[styles.lineItemMath, { color: theme.textSecondary }]}
              >
                {it.quantity} {it.uom || "Units"} × ₹{it.unit_price} (GST{" "}
                {it.tax_rate}%)
              </Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.lineItemTotal, { color: theme.text }]}>
                ₹{it.line_total.toFixed(2)}
              </Text>
              <Text style={[styles.lineItemTax, { color: theme.textTertiary }]}>
                Tax: ₹{it.tax_amount.toFixed(2)}
              </Text>
            </View>
          </View>
        ))}

        {/* GST Tax Summary Box */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Taxable Value
            </Text>
            <Text style={[styles.summaryVal, { color: theme.text }]}>
              ₹{order.subtotal.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              CGST (
              {((order.tax_amount / (order.subtotal || 1)) * 50).toFixed(0)}%)
            </Text>
            <Text style={[styles.summaryVal, { color: theme.text }]}>
              ₹{(order.tax_amount / 2).toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              SGST (
              {((order.tax_amount / (order.subtotal || 1)) * 50).toFixed(0)}%)
            </Text>
            <Text style={[styles.summaryVal, { color: theme.text }]}>
              ₹{(order.tax_amount / 2).toFixed(2)}
            </Text>
          </View>
          <View
            style={[
              styles.summaryRow,
              styles.grandTotalRow,
              { borderTopColor: theme.border },
            ]}
          >
            <Text style={[styles.grandTotalLabel, { color: theme.text }]}>
              Invoice Total
            </Text>
            <Text style={[styles.grandTotalVal, { color: theme.primary }]}>
              ₹{order.total_amount.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Amount Paid
            </Text>
            <Text style={[styles.summaryVal, { color: theme.success }]}>
              ₹{order.paid_amount.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Balance Outstanding
            </Text>
            <Text
              style={[
                styles.summaryVal,
                {
                  color:
                    remaining > 0
                      ? isOverdue
                        ? theme.error
                        : theme.warning
                      : theme.success,
                },
              ]}
            >
              ₹{remaining.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Record Payment Button if balance remaining */}
        {remaining > 0 && order.status.toLowerCase() !== "cancelled" && (
          <Pressable
            onPress={() => {
              setPayAmount(String(remaining));
              setPaymentModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.recordPayBtn,
              { backgroundColor: theme.primary, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Feather
              name="dollar-sign"
              size={16}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.recordPayBtnText}>
              Record Payment (₹{remaining.toFixed(2)})
            </Text>
          </Pressable>
        )}

        {/* Cancel Invoice & Reverse Stock Button */}
        {order.status.toLowerCase() !== "cancelled" && (
          <Pressable
            onPress={() => setCancelModalVisible(true)}
            style={({ pressed }) => [
              styles.cancelOrderBtn,
              { borderColor: theme.error, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather
              name="x-circle"
              size={16}
              color={theme.error}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.cancelOrderBtnText, { color: theme.error }]}>
              Cancel Invoice & Reverse Stock
            </Text>
          </Pressable>
        )}
      </Card>

      {/* 3. Payment Receipts */}
      {order.payments && order.payments.length > 0 && (
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Payments Received
          </Text>
          {order.payments.map((p) => (
            <View
              key={p.id}
              style={[
                styles.paymentReceiptRow,
                { borderBottomColor: theme.border },
              ]}
            >
              <View>
                <Text style={[styles.receiptMode, { color: theme.text }]}>
                  {p.payment_method.toUpperCase()}{" "}
                  {p.reference_number ? `(${p.reference_number})` : ""}
                </Text>
                <Text
                  style={[styles.receiptDate, { color: theme.textTertiary }]}
                >
                  {p.payment_date}
                </Text>
              </View>
              <Text style={[styles.receiptAmount, { color: theme.success }]}>
                ₹{p.amount.toFixed(2)}
              </Text>
            </View>
          ))}
        </Card>
      )}

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
                Record Payment for {order.invoice_number}
              </Text>
              <Pressable onPress={() => setPaymentModalVisible(false)}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

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
                value={payAmount}
                onChangeText={setPayAmount}
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
                      onPress={() => setPayMethod(mode)}
                      style={[
                        styles.methodChip,
                        payMethod === mode
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
                              payMethod === mode
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
                value={payRef}
                onChangeText={setPayRef}
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
                <Text style={styles.modalSubmitBtnText}>Submit Settlement</Text>
              )}
            </Pressable>
          </Card>
        </View>
      </Modal>

      {/* Cancel Invoice Modal */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.error }]}>
                Cancel Invoice {order.invoice_number}
              </Text>
              <Pressable
                onPress={() => setCancelModalVisible(false)}
                hitSlop={8}
              >
                <Feather name="x" size={20} color={theme.textTertiary} />
              </Pressable>
            </View>

            <Text
              style={{
                fontSize: 13,
                color: theme.textSecondary,
                marginBottom: 16,
                lineHeight: 18,
              }}
            >
              Cancelling this invoice will immediately return all billed items
              back into their physical inventory lots, log audit movements, and
              credit the customer&apos;s ledger.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Cancellation Reason (Optional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder="e.g. Pharmacy requested cancellation / Wrong order"
                placeholderTextColor={theme.textTertiary}
                value={cancelReason}
                onChangeText={setCancelReason}
              />
            </View>

            <Pressable
              onPress={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              style={({ pressed }) => [
                styles.modalSubmitBtn,
                {
                  backgroundColor: theme.error,
                  opacity: pressed || cancelMutation.isPending ? 0.8 : 1,
                },
              ]}
            >
              {cancelMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>
                  Confirm Cancellation & Reverse Stock
                </Text>
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
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    padding: 16,
    borderRadius: 12,
  },
  letterhead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  distributorName: {
    fontSize: 16,
    fontWeight: "800",
  },
  distributorAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  distributorTax: {
    fontSize: 11,
    marginTop: 2,
  },
  invoiceTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: "row",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  metaCell: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  metaVal: {
    fontSize: 14,
    fontWeight: "700",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  customerBox: {
    gap: 2,
  },
  customerBoxTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  customerStoreName: {
    fontSize: 16,
    fontWeight: "700",
  },
  customerDetailText: {
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  lineItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  lineItemName: {
    fontSize: 14,
    fontWeight: "700",
  },
  lineItemMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  lineItemMath: {
    fontSize: 12,
    marginTop: 2,
  },
  lineItemTotal: {
    fontSize: 14,
    fontWeight: "700",
  },
  lineItemTax: {
    fontSize: 11,
    marginTop: 2,
  },
  summaryBox: {
    paddingTop: 12,
    gap: 6,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryLabel: {
    fontSize: 13,
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: "600",
  },
  grandTotalRow: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: "800",
  },
  grandTotalVal: {
    fontSize: 18,
    fontWeight: "800",
  },
  recordPayBtn: {
    height: 44,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  recordPayBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  cancelOrderBtn: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  cancelOrderBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  paymentReceiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  receiptMode: {
    fontSize: 13,
    fontWeight: "700",
  },
  receiptDate: {
    fontSize: 11,
    marginTop: 2,
  },
  receiptAmount: {
    fontSize: 15,
    fontWeight: "700",
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
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
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
});
