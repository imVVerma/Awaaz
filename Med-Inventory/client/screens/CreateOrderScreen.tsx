import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Card } from "@/components/Card";
import { apiRequest } from "@/lib/query-client";
import type { Customer, ProductWithCompany, ProductBatch } from "@shared/types";

interface OrderLineItem {
  product_id: number;
  product_name: string;
  company_name: string;
  batch_id: number;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  taxable_value: number;
  tax_amount: number;
  line_total: number;
}

export default function CreateOrderScreen({ navigation, route }: any) {
  const initialCustomerId = route?.params?.customerId;
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  // Selected Customer
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(
    initialCustomerId || 1,
  );
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerModalVisible, setCustomerModalVisible] = useState(false);

  // Line Items
  const [items, setItems] = useState<OrderLineItem[]>([]);

  // Item Form State
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null,
  );
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [orderNotes, setOrderNotes] = useState("");

  // Upfront Payment
  const [collectPaymentNow, setCollectPaymentNow] = useState(false);
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<
    "upi" | "cash" | "bank_transfer"
  >("cash");

  // Queries
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products } = useQuery<ProductWithCompany[]>({
    queryKey: ["/api/products"],
  });

  const { data: allBatches } = useQuery<
    (ProductBatch & { product_name: string; company_name: string })[]
  >({
    queryKey: ["/api/batches"],
  });

  // Selected Customer Entity
  const selectedCustomer = useMemo(() => {
    return customers?.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Batches for Selected Product (FEFO sorted)
  const productBatches = useMemo(() => {
    if (!selectedProductId || !allBatches) return [];
    return allBatches
      .filter(
        (b) => b.product_id === selectedProductId && b.current_quantity > 0,
      )
      .sort((a, b) => (a.expiry_date > b.expiry_date ? 1 : -1));
  }, [allBatches, selectedProductId]);

  // Selected Batch Entity
  const selectedBatch = useMemo(() => {
    return productBatches.find((b) => b.id === selectedBatchId) || null;
  }, [productBatches, selectedBatchId]);

  // When a product is selected, pre-select the FEFO batch (first expiring batch)
  const handleSelectProduct = (prodId: number) => {
    setSelectedProductId(prodId);
    const available =
      allBatches?.filter(
        (b) => b.product_id === prodId && b.current_quantity > 0,
      ) || [];
    if (available.length > 0) {
      const fefoBatch = available.sort((a, b) =>
        a.expiry_date > b.expiry_date ? 1 : -1,
      )[0];
      setSelectedBatchId(fefoBatch.id);
      setUnitPrice(String(fefoBatch.selling_price || fefoBatch.mrp * 0.85));
    } else {
      setSelectedBatchId(null);
      setUnitPrice("");
    }
  };

  // Add Item to Order
  const handleAddItem = () => {
    if (!selectedProductId || !selectedBatchId) {
      Alert.alert(
        "Select Item",
        "Please select a product and an available batch lot",
      );
      return;
    }

    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      Alert.alert("Invalid Quantity", "Quantity must be greater than zero");
      return;
    }

    if (selectedBatch && qty > selectedBatch.current_quantity) {
      Alert.alert(
        "Stock Limit Exceeded",
        `Batch ${selectedBatch.batch_number} has only ${selectedBatch.current_quantity} units available.`,
      );
      return;
    }

    const price = parseFloat(unitPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert("Invalid Price", "Enter a valid unit price");
      return;
    }

    const disc = parseFloat(discountPercent) || 0;
    const prod = products?.find((p) => p.id === selectedProductId);
    const taxRate = prod?.gst_rate || 12;

    const gross = qty * price;
    const discAmount = gross * (disc / 100);
    const taxable = Math.round((gross - discAmount) * 100) / 100;
    const tax = Math.round(taxable * (taxRate / 100) * 100) / 100;
    const total = Math.round((taxable + tax) * 100) / 100;

    const newItem: OrderLineItem = {
      product_id: selectedProductId,
      product_name: prod?.product_name || "Medicine",
      company_name: prod?.company_name || "",
      batch_id: selectedBatchId,
      batch_number: selectedBatch?.batch_number || "Lot",
      expiry_date: selectedBatch?.expiry_date || "",
      quantity: qty,
      unit_price: price,
      discount_percent: disc,
      tax_rate: taxRate,
      taxable_value: taxable,
      tax_amount: tax,
      line_total: total,
    };

    setItems([...items, newItem]);
    // Reset item form
    setSelectedProductId(null);
    setSelectedBatchId(null);
    setQuantity("1");
    setUnitPrice("");
    setDiscountPercent("0");
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Totals Calculation
  const orderSummary = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    let grandTotal = 0;

    for (const it of items) {
      subtotal += it.taxable_value;
      taxTotal += it.tax_amount;
      grandTotal += it.line_total;
    }

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }, [items]);

  // Error State
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Submit Order Mutation
  const orderMutation = useMutation({
    mutationFn: async () => {
      setSubmissionError(null);
      if (!selectedCustomerId) {
        throw new Error("Please select a buyer or customer pharmacy.");
      }
      if (items.length === 0) {
        throw new Error("Add at least one medicine item to generate invoice.");
      }

      const payload: any = {
        customer_id: selectedCustomerId,
        notes: orderNotes.trim() || undefined,
        items: items.map((it) => ({
          product_id: it.product_id,
          batch_id: it.batch_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount_percent: it.discount_percent,
          tax_rate: it.tax_rate,
        })),
      };

      if (collectPaymentNow && orderSummary.grandTotal > 0) {
        payload.initial_payment = {
          amount: orderSummary.grandTotal,
          payment_method: initialPaymentMethod,
          reference_number: "Counter settlement",
        };
      }

      const res = await apiRequest("POST", "/api/orders", payload);
      const data = await res.json();
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/summary"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/reports/receivables-aging"],
      });

      if (Platform.OS === "web") {
        navigation.navigate("OrderDetail", { orderId: data.id });
      } else {
        Alert.alert(
          "Invoice Generated",
          `Invoice ${data.invoice_number} created successfully!`,
          [
            {
              text: "View Invoice",
              onPress: () =>
                navigation.navigate("OrderDetail", { orderId: data.id }),
            },
          ],
        );
      }
    },
    onError: (err: any) => {
      const msg = err.message || "Failed to generate invoice";
      setSubmissionError(msg);
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Order Error", msg);
      }
    },
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={styles.content}
    >
      {/* 1. Customer Selection Card */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Feather
            name="user"
            size={18}
            color={theme.primary}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Bill To / Buyer Selection
          </Text>
        </View>

        <Pressable
          onPress={() => setCustomerModalVisible(true)}
          style={[
            styles.customerPicker,
            {
              borderColor: selectedCustomer?.id === 1 ? theme.border : theme.primary,
              backgroundColor: theme.backgroundTertiary,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Text style={[styles.customerPickerTitle, { color: theme.text }]}>
                {selectedCustomer?.store_name || "Select Customer Pharmacy"}
              </Text>
              <View
                style={[
                  styles.customerTypeBadge,
                  {
                    backgroundColor:
                      selectedCustomer?.id === 1
                        ? theme.backgroundDefault
                        : theme.primaryLight,
                    borderColor:
                      selectedCustomer?.id === 1
                        ? theme.border
                        : theme.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.customerTypeBadgeText,
                    {
                      color:
                        selectedCustomer?.id === 1
                          ? theme.textSecondary
                          : theme.primary,
                    },
                  ]}
                >
                  {selectedCustomer?.id === 1 ? "CASH COUNTER" : "REGISTERED ACCOUNT"}
                </Text>
              </View>
            </View>

            {selectedCustomer && selectedCustomer.id === 1 ? (
              <Text
                style={[
                  styles.customerPickerSub,
                  { color: theme.textSecondary },
                ]}
              >
                Over-the-Counter Retail Sales • Immediate Cash/UPI Settlement Only (No Credit)
              </Text>
            ) : selectedCustomer ? (
              <Text
                style={[
                  styles.customerPickerSub,
                  { color: theme.textSecondary },
                ]}
              >
                Ph: {selectedCustomer.phone} | Terms: {selectedCustomer.payment_terms_days}d | Limit: ₹{(selectedCustomer.credit_limit || 50000).toLocaleString("en-IN")} | Balance: ₹{(selectedCustomer.outstanding_balance || 0).toLocaleString("en-IN")}
              </Text>
            ) : null}
          </View>
          <View style={[styles.changeCustBtn, { backgroundColor: theme.primaryLight }]}>
            <Text style={[styles.changeCustBtnText, { color: theme.primary }]}>Change</Text>
            <Feather name="chevron-down" size={16} color={theme.primary} />
          </View>
        </Pressable>
      </Card>

      {/* 2. Item Builder Card */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Feather
            name="shopping-cart"
            size={18}
            color={theme.primary}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Add Product to Invoice
          </Text>
        </View>

        {/* Product Picker */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Select Medicine
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.productPillsScroll}
          >
            {products?.map((p) => {
              const isSelected = selectedProductId === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => handleSelectProduct(p.id)}
                  style={[
                    styles.productPill,
                    isSelected
                      ? {
                          backgroundColor: theme.primary,
                          borderColor: theme.primary,
                        }
                      : {
                          backgroundColor: theme.backgroundDefault,
                          borderColor: theme.border,
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.productPillTitle,
                      { color: isSelected ? "#FFFFFF" : theme.text },
                    ]}
                  >
                    {p.product_name}
                  </Text>
                  <Text
                    style={[
                      styles.productPillSub,
                      { color: isSelected ? "#F1F5F9" : theme.textTertiary },
                    ]}
                  >
                    {p.company_name} | Stock: {p.stock_quantity}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Batch Selection with FEFO Recommendation */}
        {selectedProductId && (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Batch Lot (FEFO: First Expiry First Out)
            </Text>
            {productBatches.length === 0 ? (
              <Text
                style={{ color: theme.error, fontSize: 13, marginVertical: 4 }}
              >
                No active lots with available stock for this medicine.
              </Text>
            ) : (
              <View style={styles.batchesRow}>
                {productBatches.map((b, idx) => {
                  const isSelected = selectedBatchId === b.id;
                  const isFefo = idx === 0;
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => {
                        setSelectedBatchId(b.id);
                        setUnitPrice(String(b.selling_price || b.mrp * 0.85));
                      }}
                      style={[
                        styles.batchChip,
                        isSelected
                          ? {
                              backgroundColor: theme.primary,
                              borderColor: theme.primary,
                            }
                          : {
                              backgroundColor: theme.backgroundDefault,
                              borderColor: theme.border,
                            },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text
                          style={[
                            styles.batchChipText,
                            { color: isSelected ? "#FFFFFF" : theme.text },
                          ]}
                        >
                          Lot {b.batch_number}
                        </Text>
                        {isFefo && (
                          <View style={styles.fefoBadge}>
                            <Text style={styles.fefoBadgeText}>FEFO</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.batchChipSub,
                          {
                            color: isSelected ? "#F1F5F9" : theme.textTertiary,
                          },
                        ]}
                      >
                        Exp: {b.expiry_date} | Avail: {b.current_quantity} |
                        MRP: ₹{b.mrp}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Pricing & Quantity Inputs */}
        {selectedBatchId && (
          <View>
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 6 }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Quantity
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.border },
                  ]}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                />
              </View>

              <View
                style={[styles.fieldGroup, { flex: 1, marginHorizontal: 6 }]}
              >
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Rate (₹)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.border },
                  ]}
                  keyboardType="numeric"
                  value={unitPrice}
                  onChangeText={setUnitPrice}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1, marginLeft: 6 }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Disc %
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.border },
                  ]}
                  keyboardType="numeric"
                  value={discountPercent}
                  onChangeText={setDiscountPercent}
                />
              </View>
            </View>

            <Pressable
              onPress={handleAddItem}
              style={({ pressed }) => [
                styles.addItemBtn,
                { backgroundColor: theme.success, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Feather
                name="plus"
                size={16}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.addItemBtnText}>Add Item to Invoice</Text>
            </Pressable>
          </View>
        )}
      </Card>

      {/* 3. Added Items Summary Table */}
      {items.length > 0 && (
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather
              name="file-text"
              size={18}
              color={theme.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Invoice Items ({items.length})
            </Text>
          </View>

          {items.map((it, idx) => (
            <View
              key={idx}
              style={[styles.itemRow, { borderBottomColor: theme.border }]}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.itemName, { color: theme.text }]}>
                  {it.product_name}
                </Text>
                <Text style={[styles.itemMeta, { color: theme.textTertiary }]}>
                  {it.company_name} | Lot {it.batch_number} (Exp:{" "}
                  {it.expiry_date})
                </Text>
                <Text
                  style={[
                    styles.itemCalculation,
                    { color: theme.textSecondary },
                  ]}
                >
                  {it.quantity} units @ ₹{it.unit_price} (GST {it.tax_rate}%)
                </Text>
              </View>

              <View style={{ alignItems: "flex-end", marginRight: 12 }}>
                <Text style={[styles.itemTotal, { color: theme.text }]}>
                  ₹{it.line_total.toFixed(2)}
                </Text>
                <Text
                  style={[styles.itemTaxable, { color: theme.textTertiary }]}
                >
                  Tax: ₹{it.tax_amount.toFixed(2)}
                </Text>
              </View>

              <Pressable
                onPress={() => handleRemoveItem(idx)}
                style={styles.removeBtn}
              >
                <Feather name="trash-2" size={16} color={theme.error} />
              </Pressable>
            </View>
          ))}

          {/* Totals Breakdown */}
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
                Taxable Subtotal:
              </Text>
              <Text style={[styles.totalVal, { color: theme.text }]}>
                ₹{orderSummary.subtotal.toFixed(2)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
                Total GST Amount:
              </Text>
              <Text style={[styles.totalVal, { color: theme.text }]}>
                ₹{orderSummary.taxTotal.toFixed(2)}
              </Text>
            </View>
            <View
              style={[
                styles.totalRow,
                styles.grandTotalRow,
                { borderTopColor: theme.border },
              ]}
            >
              <Text style={[styles.grandTotalLabel, { color: theme.text }]}>
                Grand Total:
              </Text>
              <Text style={[styles.grandTotalVal, { color: theme.primary }]}>
                ₹{orderSummary.grandTotal.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Upfront Payment Toggle */}
          <View style={styles.paymentToggleRow}>
            <Pressable
              onPress={() => setCollectPaymentNow(!collectPaymentNow)}
              style={styles.checkboxRow}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: theme.primary,
                    backgroundColor: collectPaymentNow
                      ? theme.primary
                      : "transparent",
                  },
                ]}
              >
                {collectPaymentNow && (
                  <Feather name="check" size={14} color="#FFFFFF" />
                )}
              </View>
              <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                Immediate Cash / UPI Settlement
              </Text>
            </Pressable>

            {collectPaymentNow && (
              <View style={styles.paymentMethodChips}>
                {(["cash", "upi", "bank_transfer"] as const).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setInitialPaymentMethod(m)}
                    style={[
                      styles.methodPill,
                      initialPaymentMethod === m
                        ? {
                            backgroundColor: theme.primary,
                            borderColor: theme.primary,
                          }
                        : { borderColor: theme.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodPillText,
                        {
                          color:
                            initialPaymentMethod === m
                              ? "#FFFFFF"
                              : theme.textSecondary,
                        },
                      ]}
                    >
                      {m.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Pre-Submission Review Summary */}
          <View
            style={[
              styles.preCommitSummary,
              {
                backgroundColor: theme.backgroundTertiary,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.preCommitHeader}>
              <Feather name="shield" size={16} color={theme.primary} />
              <Text style={[styles.preCommitTitle, { color: theme.text }]}>
                Pre-Invoice Review Summary
              </Text>
            </View>
            <View style={styles.preCommitRow}>
              <Text
                style={[
                  styles.preCommitLabel,
                  { color: theme.textSecondary },
                ]}
              >
                Billed Buyer:
              </Text>
              <Text
                style={[styles.preCommitValue, { color: theme.text }]}
                numberOfLines={1}
              >
                {selectedCustomer?.store_name}{" "}
                {selectedCustomer?.id === 1 ? "(Cash Counter)" : ""}
              </Text>
            </View>
            <View style={styles.preCommitRow}>
              <Text
                style={[
                  styles.preCommitLabel,
                  { color: theme.textSecondary },
                ]}
              >
                Line Items:
              </Text>
              <Text style={[styles.preCommitValue, { color: theme.text }]}>
                {items.length} medicine lot{items.length > 1 ? "s" : ""}
              </Text>
            </View>
            <View style={styles.preCommitRow}>
              <Text
                style={[
                  styles.preCommitLabel,
                  { color: theme.textSecondary },
                ]}
              >
                Settlement Terms:
              </Text>
              <Text
                style={[
                  styles.preCommitValue,
                  {
                    color: collectPaymentNow
                      ? theme.success
                      : theme.warning,
                  },
                ]}
              >
                {collectPaymentNow
                  ? `Immediate ${initialPaymentMethod.toUpperCase()} (Marks Invoice as PAID)`
                  : `Customer Ledger (Net ${selectedCustomer?.payment_terms_days || 30} Days)`}
              </Text>
            </View>
            <View style={styles.preCommitRow}>
              <Text
                style={[
                  styles.preCommitLabel,
                  { color: theme.text, fontWeight: "700" },
                ]}
              >
                Invoice Total:
              </Text>
              <Text
                style={[
                  styles.preCommitValue,
                  { color: theme.primary, fontWeight: "800", fontSize: 16 },
                ]}
              >
                ₹{orderSummary.grandTotal.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Submission Error Banner */}
          {submissionError ? (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: theme.dangerLight,
                  borderColor: theme.danger,
                },
              ]}
            >
              <Feather name="alert-circle" size={18} color={theme.danger} />
              <Text
                style={[styles.errorBannerText, { color: theme.danger }]}
              >
                {submissionError}
              </Text>
            </View>
          ) : null}

          {/* Confirm Button */}
          <Pressable
            onPress={() => orderMutation.mutate()}
            disabled={orderMutation.isPending}
            style={({ pressed }) => [
              styles.submitInvoiceBtn,
              {
                backgroundColor: theme.primary,
                opacity: pressed || orderMutation.isPending ? 0.85 : 1,
              },
            ]}
          >
            {orderMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather
                  name="check-square"
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.submitInvoiceBtnText}>
                  Confirm & Generate Invoice (₹
                  {orderSummary.grandTotal.toFixed(2)})
                </Text>
              </>
            )}
          </Pressable>
        </Card>
      )}

      {/* Customer Picker Modal */}
      {customerModalVisible && (
        <View style={styles.modalOverlay}>
          <Card
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  Select Pharmacy / Buyer
                </Text>
                <Text
                  style={[styles.modalSubtitle, { color: theme.textSecondary }]}
                >
                  Type name or phone and press Enter to select
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setCustomerSearchQuery("");
                  setCustomerModalVisible(false);
                }}
              >
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <TextInput
              style={[
                styles.modalSearch,
                { color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Search pharmacy by name, contact, or phone..."
              placeholderTextColor={theme.textTertiary}
              value={customerSearchQuery}
              onChangeText={setCustomerSearchQuery}
              returnKeyType="search"
              onSubmitEditing={() => {
                const matches = (customers || []).filter((c) =>
                  customerSearchQuery.trim()
                    ? c.store_name
                        .toLowerCase()
                        .includes(customerSearchQuery.toLowerCase()) ||
                      c.phone.includes(customerSearchQuery)
                    : true,
                );
                if (matches.length > 0) {
                  setSelectedCustomerId(matches[0].id);
                  setCustomerModalVisible(false);
                  setCustomerSearchQuery("");
                }
              }}
              autoFocus
            />

            <ScrollView style={{ maxHeight: 340 }}>
              {(() => {
                const matches = (customers || []).filter((c) =>
                  customerSearchQuery.trim()
                    ? c.store_name
                        .toLowerCase()
                        .includes(customerSearchQuery.toLowerCase()) ||
                      (c.contact_person &&
                        c.contact_person
                          .toLowerCase()
                          .includes(customerSearchQuery.toLowerCase())) ||
                      c.phone.includes(customerSearchQuery)
                    : true,
                );

                if (matches.length === 0) {
                  return (
                    <View style={styles.noCustomerFoundBox}>
                      <Feather
                        name="user-x"
                        size={28}
                        color={theme.textTertiary}
                      />
                      <Text
                        style={[
                          styles.noCustomerFoundText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        No pharmacy found matching &ldquo;{customerSearchQuery}&rdquo;
                      </Text>
                      <Pressable
                        onPress={() => {
                          setCustomerModalVisible(false);
                          navigation.navigate("CustomersTab", {
                            screen: "AddCustomer",
                          });
                        }}
                        style={[
                          styles.addCustomerShortcutBtn,
                          { backgroundColor: theme.primary },
                        ]}
                      >
                        <Feather
                          name="user-plus"
                          size={16}
                          color="#FFFFFF"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.addCustomerShortcutText}>
                          + Register New Pharmacy
                        </Text>
                      </Pressable>
                    </View>
                  );
                }

                return matches.map((c) => {
                  const isWalkIn = c.id === 1 || c.store_name.includes("Walk-in");
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => {
                        setSelectedCustomerId(c.id);
                        setCustomerModalVisible(false);
                        setCustomerSearchQuery("");
                      }}
                      style={[
                        styles.customerOption,
                        selectedCustomerId === c.id && {
                          backgroundColor: theme.backgroundTertiary,
                          borderLeftWidth: 4,
                          borderLeftColor: theme.primary,
                        },
                        isWalkIn && {
                          backgroundColor: theme.backgroundRoot,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Text
                            style={[
                              styles.custOptionName,
                              { color: theme.text },
                            ]}
                          >
                            {c.store_name}
                          </Text>
                          {isWalkIn && (
                            <View
                              style={[
                                styles.walkInTag,
                                {
                                  backgroundColor: theme.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.walkInTagText,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                Cash Only
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.custOptionPhone,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {isWalkIn
                            ? "Over-the-counter sales (No credit account)"
                            : `Ph: ${c.phone} | Credit Terms: ${c.payment_terms_days}d | Balance: ₹${(c.outstanding_balance || 0).toFixed(0)}`}
                        </Text>
                      </View>
                      {selectedCustomerId === c.id && (
                        <Feather name="check" size={18} color={theme.primary} />
                      )}
                    </Pressable>
                  );
                });
              })()}
            </ScrollView>
          </Card>
        </View>
      )}
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
  card: {
    padding: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  customerPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  customerPickerTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  customerPickerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  productPillsScroll: {
    flexDirection: "row",
  },
  productPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  productPillTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  productPillSub: {
    fontSize: 11,
    marginTop: 2,
  },
  batchesRow: {
    gap: 8,
  },
  batchChip: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  batchChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  batchChipSub: {
    fontSize: 11,
    marginTop: 2,
  },
  fefoBadge: {
    backgroundColor: "#16A34A",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fefoBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    marginBottom: 12,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  addItemBtn: {
    height: 42,
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  addItemBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "700",
  },
  itemMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  itemCalculation: {
    fontSize: 12,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: "700",
  },
  itemTaxable: {
    fontSize: 11,
    marginTop: 2,
  },
  removeBtn: {
    padding: 6,
  },
  totalsBox: {
    paddingTop: 12,
    gap: 6,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: {
    fontSize: 13,
  },
  totalVal: {
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
    fontWeight: "700",
  },
  grandTotalVal: {
    fontSize: 18,
    fontWeight: "800",
  },
  paymentToggleRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  paymentMethodChips: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginLeft: 28,
  },
  methodPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  methodPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  submitInvoiceBtn: {
    height: 48,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  submitInvoiceBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    padding: 16,
    borderRadius: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  modalSearch: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    marginBottom: 12,
  },
  customerOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  custOptionName: {
    fontSize: 14,
    fontWeight: "600",
  },
  custOptionPhone: {
    fontSize: 12,
    marginTop: 2,
  },
  customerTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  customerTypeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  changeCustBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  changeCustBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  preCommitSummary: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    gap: 6,
  },
  preCommitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  preCommitTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  preCommitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  preCommitLabel: {
    fontSize: 12,
  },
  preCommitValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  noCustomerFoundBox: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  noCustomerFoundText: {
    fontSize: 13,
    textAlign: "center",
  },
  addCustomerShortcutBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  addCustomerShortcutText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  walkInTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  walkInTagText: {
    fontSize: 10,
    fontWeight: "600",
  },
});
