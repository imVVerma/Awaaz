import React from "react";
import { View, StyleSheet, Alert, Modal, Pressable, Platform } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { FormInput } from "@/components/FormInput";
import { FormSelect } from "@/components/FormSelect";
import { FormDatePicker } from "@/components/FormDatePicker";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Card } from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, queryClient } from "@/lib/query-client";
import type {
  Supplier,
  ProductWithCompany,
  CreatePurchaseInput,
} from "@shared/types";

interface PurchaseDraftItem {
  product_id: number;
  product_name: string;
  company_name: string;
  batch_number: string;
  expiry_date: string;
  quantity: string;
  purchase_price: string;
  mrp: string;
  selling_price: string;
  tax_rate: number;
}

export default function CreatePurchaseScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const tabBarHeight = useBottomTabBarHeight();

  // Header Details
  const [supplierId, setSupplierId] = React.useState<number | null>(null);
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [invoiceDate, setInvoiceDate] = React.useState(
    new Date().toISOString().split("T")[0],
  );
  const [notes, setNotes] = React.useState("");

  // Line Items
  const [items, setItems] = React.useState<PurchaseDraftItem[]>([]);

  // Item Modal Form State
  const [showItemModal, setShowItemModal] = React.useState(false);
  const [selectedProductId, setSelectedProductId] = React.useState<
    number | null
  >(null);
  const [batchNum, setBatchNum] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [purchasePrice, setPurchasePrice] = React.useState("");
  const [mrp, setMrp] = React.useState("");
  const [sellingPrice, setSellingPrice] = React.useState("");
  const [taxRate, setTaxRate] = React.useState(12);

  // Quick Add Supplier Modal State
  const [showSupplierModal, setShowSupplierModal] = React.useState(false);
  const [newSupplierName, setNewSupplierName] = React.useState("");
  const [newSupplierContact, setNewSupplierContact] = React.useState("");
  const [newSupplierPhone, setNewSupplierPhone] = React.useState("");
  const [newSupplierGstin, setNewSupplierGstin] = React.useState("");

  // Error States
  const [formError, setFormError] = React.useState<string | null>(null);
  const [itemError, setItemError] = React.useState<string | null>(null);

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: products } = useQuery<ProductWithCompany[]>({
    queryKey: ["/api/products"],
  });

  const supplierOptions = React.useMemo(() => {
    if (!suppliers) return [];
    return suppliers.map((s) => ({ label: s.name, value: s.id }));
  }, [suppliers]);

  const productOptions = React.useMemo(() => {
    if (!products) return [];
    return products.map((p) => ({
      label: `${p.product_name} (${p.company_name})`,
      value: p.id,
    }));
  }, [products]);

  // When a product is selected in item modal, prefill default prices and tax
  const handleSelectProduct = (pId: number) => {
    setSelectedProductId(pId);
    setItemError(null);
    const prod = products?.find((p) => p.id === pId);
    if (prod) {
      setPurchasePrice(String(prod.purchase_price));
      setMrp(String(prod.mrp));
      setSellingPrice(String(prod.selling_price || prod.mrp * 0.85));
      setTaxRate(prod.gst_rate ?? 12);
    }
  };

  const handleAddItem = () => {
    setItemError(null);
    if (!selectedProductId) {
      setItemError("Please select a medicine product.");
      return;
    }
    if (!batchNum.trim()) {
      setItemError("Batch lot number is required (e.g. LOT-101).");
      return;
    }
    if (!expiryDate || expiryDate.trim().length < 7) {
      setItemError("A valid expiry date is required (YYYY-MM-DD).");
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setItemError("Received quantity must be greater than zero.");
      return;
    }
    const cost = parseFloat(purchasePrice);
    if (isNaN(cost) || cost <= 0) {
      setItemError("Purchase rate must be a valid positive amount.");
      return;
    }

    const prod = products?.find((p) => p.id === selectedProductId);

    const newItem: PurchaseDraftItem = {
      product_id: selectedProductId,
      product_name: prod?.product_name || "Unknown Product",
      company_name: prod?.company_name || "Unknown",
      batch_number: batchNum.trim().toUpperCase(),
      expiry_date: expiryDate,
      quantity: String(qty),
      purchase_price: String(cost),
      mrp: mrp ? String(parseFloat(mrp)) : String(cost * 1.25),
      selling_price: sellingPrice
        ? String(parseFloat(sellingPrice))
        : String(parseFloat(mrp || String(cost * 1.25)) * 0.85),
      tax_rate: taxRate,
    };

    setItems([...items, newItem]);
    setFormError(null);
    // Reset item form
    setSelectedProductId(null);
    setBatchNum("");
    setExpiryDate("");
    setQuantity("");
    setPurchasePrice("");
    setMrp("");
    setSellingPrice("");
    setItemError(null);
    setShowItemModal(false);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Totals calculations
  const totals = React.useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    items.forEach((it) => {
      const qty = parseInt(it.quantity, 10) || 0;
      const price = parseFloat(it.purchase_price) || 0;
      const taxable = qty * price;
      const tax = taxable * (it.tax_rate / 100);
      subtotal += taxable;
      totalTax += tax;
    });
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      grandTotal: Math.round((subtotal + totalTax) * 100) / 100,
    };
  }, [items]);

  const purchaseMutation = useMutation({
    mutationFn: async (payload: CreatePurchaseInput) => {
      const res = await apiRequest("POST", "/api/purchases", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      if (Platform.OS === "web") {
        alert(
          "Inbound purchase recorded successfully! Inventory stock and batch lots updated.",
        );
      }
      navigation.goBack();
    },
    onError: (err: Error) => {
      const msg = err.message || "Failed to record purchase invoice";
      setFormError(msg);
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      contact_person?: string;
      phone?: string;
      gstin?: string;
    }) => {
      const res = await apiRequest("POST", "/api/suppliers", payload);
      return res.json();
    },
    onSuccess: (newSupp: Supplier) => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setSupplierId(newSupp.id);
      setShowSupplierModal(false);
      setNewSupplierName("");
      setNewSupplierContact("");
      setNewSupplierPhone("");
      setNewSupplierGstin("");
      setFormError(null);
    },
    onError: (err: Error) => {
      const msg = err.message || "Failed to register supplier";
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    },
  });

  const handleSubmit = () => {
    setFormError(null);
    if (!supplierId) {
      const msg = "Please select a procuring supplier or vendor.";
      setFormError(msg);
      if (Platform.OS === "web") alert(msg);
      return;
    }
    if (!invoiceNumber.trim()) {
      const msg = "Please enter the supplier's invoice number.";
      setFormError(msg);
      if (Platform.OS === "web") alert(msg);
      return;
    }
    if (items.length === 0) {
      const msg = "Please add at least one medicine lot item before confirming.";
      setFormError(msg);
      if (Platform.OS === "web") alert(msg);
      return;
    }

    purchaseMutation.mutate({
      supplier_id: supplierId,
      purchase_invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate,
      notes: notes.trim() || undefined,
      items: items.map((it) => ({
        product_id: it.product_id,
        batch_number: it.batch_number,
        expiry_date: it.expiry_date,
        quantity: parseInt(it.quantity, 10),
        purchase_price: parseFloat(it.purchase_price),
        mrp: parseFloat(it.mrp),
        selling_price: parseFloat(it.selling_price),
        tax_rate: it.tax_rate,
      })),
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + Spacing["2xl"] },
        ]}
      >
        {formError ? (
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
            <ThemedText
              style={[styles.errorBannerText, { color: theme.danger }]}
            >
              {formError}
            </ThemedText>
          </View>
        ) : null}
        {/* Section 1: Supplier & Inbound Invoice Header */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: theme.primaryLight },
              ]}
            >
              <Feather name="truck" size={18} color={theme.primary} />
            </View>
            <View>
              <ThemedText style={styles.sectionTitle}>
                Inbound Supplier Invoice
              </ThemedText>
              <ThemedText
                style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
              >
                Stock procurement from wholesaler or distributor
              </ThemedText>
            </View>
          </View>

          <View style={styles.supplierRow}>
            <View style={styles.supplierSelectWrapper}>
              <FormSelect
                label="Procuring Supplier / Vendor"
                placeholder="Select a supplier"
                value={supplierId}
                options={supplierOptions}
                onChange={(val) => setSupplierId(val as number)}
                required
              />
            </View>
            <Pressable
              onPress={() => setShowSupplierModal(true)}
              style={[
                styles.inlineBtn,
                {
                  backgroundColor: theme.primaryLight,
                  borderColor: theme.border,
                },
              ]}
              hitSlop={8}
            >
              <Feather name="plus" size={16} color={theme.primary} />
              <ThemedText
                style={[styles.inlineBtnText, { color: theme.primary }]}
              >
                New
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <FormInput
                label="Supplier Invoice #"
                value={invoiceNumber}
                onChangeText={setInvoiceNumber}
                placeholder="e.g. SUPP-2024-984"
                required
              />
            </View>
            <View style={styles.halfInput}>
              <FormDatePicker
                label="Invoice Date"
                value={invoiceDate}
                onChange={setInvoiceDate}
                required
              />
            </View>
          </View>

          <FormInput
            label="Procurement Notes (Optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Received via Delhi Road Logistics, L/R #5541"
          />
        </Card>

        {/* Section 2: Received Batch Lots */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: theme.warningLight },
              ]}
            >
              <Feather name="layers" size={18} color={theme.warning} />
            </View>
            <View style={styles.flex1}>
              <ThemedText style={styles.sectionTitle}>
                Procured Medicines & Batches
              </ThemedText>
              <ThemedText
                style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
              >
                Physical lots received into distributor warehouse
              </ThemedText>
            </View>
            <Pressable
              onPress={() => setShowItemModal(true)}
              style={[styles.addLotBtn, { backgroundColor: theme.primary }]}
              hitSlop={8}
            >
              <Feather name="plus" size={16} color="#FFFFFF" />
              <ThemedText style={styles.addLotText}>Add Lot</ThemedText>
            </Pressable>
          </View>

          {items.map((item, index) => {
            const lineCost =
              (parseInt(item.quantity, 10) || 0) *
              (parseFloat(item.purchase_price) || 0);
            return (
              <View
                key={`${item.product_id}-${index}`}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemHeaderLeft}>
                    <ThemedText style={styles.itemTitle} numberOfLines={1}>
                      {item.product_name}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.itemSubtitle,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Mfg: {item.company_name} • Lot: {item.batch_number} • Exp:{" "}
                      {item.expiry_date}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => handleRemoveItem(index)}
                    hitSlop={8}
                    style={styles.trashBtn}
                  >
                    <Feather name="trash-2" size={16} color={theme.danger} />
                  </Pressable>
                </View>

                <View style={styles.itemNumbers}>
                  <ThemedText style={styles.itemQty}>
                    {item.quantity} units @ ₹{item.purchase_price}
                  </ThemedText>
                  <ThemedText style={styles.itemLineTotal}>
                    ₹{lineCost.toFixed(2)} (+{item.tax_rate}% GST)
                  </ThemedText>
                </View>
              </View>
            );
          })}

          {items.length === 0 && (
            <View
              style={[
                styles.emptyItemsBox,
                {
                  backgroundColor: theme.backgroundRoot,
                  borderColor: theme.border,
                },
              ]}
            >
              <Feather name="package" size={24} color={theme.textSecondary} />
              <ThemedText
                style={[styles.emptyItemsText, { color: theme.textSecondary }]}
              >
                No medicine lots added yet. Click &ldquo;Add Lot&rdquo; above.
              </ThemedText>
            </View>
          )}
        </Card>

        {/* Section 3: Inbound Financial Summary */}
        <Card style={styles.summaryCard}>
          <ThemedText style={styles.summaryTitle}>
            Purchase Invoice Total
          </ThemedText>
          <View style={styles.summaryRow}>
            <ThemedText style={{ color: theme.textSecondary }}>
              Taxable Value ({items.length} items):
            </ThemedText>
            <ThemedText style={styles.summaryValue}>
              ₹{totals.subtotal.toFixed(2)}
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={{ color: theme.textSecondary }}>
              Applicable Tax (GST):
            </ThemedText>
            <ThemedText style={styles.summaryValue}>
              ₹{totals.totalTax.toFixed(2)}
            </ThemedText>
          </View>
          <View
            style={[
              styles.summaryRow,
              styles.grandTotalRow,
              { borderTopColor: theme.border },
            ]}
          >
            <ThemedText style={styles.grandTotalLabel}>
              Total Inbound Cost:
            </ThemedText>
            <ThemedText
              style={[styles.grandTotalValue, { color: theme.primary }]}
            >
              ₹{totals.grandTotal.toFixed(2)}
            </ThemedText>
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actionButtons}>
          <PrimaryButton
            title="Cancel"
            variant="secondary"
            onPress={() => navigation.goBack()}
            style={styles.btn}
            disabled={purchaseMutation.isPending}
          />
          <PrimaryButton
            title="Confirm Inbound Stock"
            onPress={handleSubmit}
            style={styles.btn}
            loading={purchaseMutation.isPending}
            icon="check"
          />
        </View>
      </KeyboardAwareScrollViewCompat>

      {/* Modal: Add Lot */}
      <Modal
        visible={showItemModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setItemError(null);
          setShowItemModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>Add Medicine Lot</ThemedText>
            <ThemedText
              style={[styles.modalSubtitle, { color: theme.textSecondary }]}
            >
              Specify incoming batch lot number, quantities, and prices
            </ThemedText>

            {itemError ? (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: theme.dangerLight,
                    borderColor: theme.danger,
                    marginBottom: Spacing.md,
                  },
                ]}
              >
                <Feather name="alert-circle" size={16} color={theme.danger} />
                <ThemedText
                  style={[styles.errorBannerText, { color: theme.danger }]}
                >
                  {itemError}
                </ThemedText>
              </View>
            ) : null}

            <FormSelect
              label="Select Catalog Medicine"
              placeholder="Choose a product"
              value={selectedProductId}
              options={productOptions}
              onChange={(val) => handleSelectProduct(val as number)}
              required
            />

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <FormInput
                  label="Batch Number"
                  value={batchNum}
                  onChangeText={setBatchNum}
                  placeholder="e.g. B-2024-X"
                  required
                />
              </View>
              <View style={styles.halfInput}>
                <FormDatePicker
                  label="Expiry Date"
                  value={expiryDate}
                  onChange={setExpiryDate}
                  required
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <FormInput
                  label="Received Units"
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="e.g. 100"
                  keyboardType="number-pad"
                  required
                />
              </View>
              <View style={styles.halfInput}>
                <FormInput
                  label="Purchase Cost (₹)"
                  value={purchasePrice}
                  onChangeText={setPurchasePrice}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  required
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <FormInput
                  label="MRP (₹)"
                  value={mrp}
                  onChangeText={setMrp}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.halfInput}>
                <FormInput
                  label="Selling Price (₹)"
                  value={sellingPrice}
                  onChangeText={setSellingPrice}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <PrimaryButton
                title="Cancel"
                variant="secondary"
                onPress={() => setShowItemModal(false)}
                style={styles.modalBtn}
              />
              <PrimaryButton
                title="Add to Invoice"
                onPress={handleAddItem}
                style={styles.modalBtn}
                icon="plus"
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* Modal: Quick Add Supplier */}
      <Modal
        visible={showSupplierModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSupplierModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>
              Register New Supplier
            </ThemedText>
            <ThemedText
              style={[styles.modalSubtitle, { color: theme.textSecondary }]}
            >
              Wholesaler, Stockist, or C&amp;F Agent
            </ThemedText>

            <FormInput
              label="Supplier / Firm Name"
              value={newSupplierName}
              onChangeText={setNewSupplierName}
              placeholder="e.g. Apex Pharma Stockists"
              required
            />

            <FormInput
              label="Contact Person"
              value={newSupplierContact}
              onChangeText={setNewSupplierContact}
              placeholder="e.g. Anil Mehta"
            />

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <FormInput
                  label="Phone Number"
                  value={newSupplierPhone}
                  onChangeText={setNewSupplierPhone}
                  placeholder="10 digits"
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.halfInput}>
                <FormInput
                  label="GSTIN"
                  value={newSupplierGstin}
                  onChangeText={setNewSupplierGstin}
                  placeholder="15-character GSTIN"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <PrimaryButton
                title="Cancel"
                variant="secondary"
                onPress={() => setShowSupplierModal(false)}
                style={styles.modalBtn}
                disabled={createSupplierMutation.isPending}
              />
              <PrimaryButton
                title="Save Supplier"
                onPress={() => {
                  if (!newSupplierName.trim()) {
                    Alert.alert("Validation", "Supplier name is required");
                    return;
                  }
                  createSupplierMutation.mutate({
                    name: newSupplierName.trim(),
                    contact_person: newSupplierContact.trim() || undefined,
                    phone: newSupplierPhone.trim() || undefined,
                    gstin: newSupplierGstin.trim() || undefined,
                  });
                }}
                style={styles.modalBtn}
                loading={createSupplierMutation.isPending}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  sectionCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  flex1: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  supplierRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  supplierSelectWrapper: {
    flex: 1,
  },
  inlineBtn: {
    marginTop: 26,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inlineBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  addLotBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  addLotText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  itemCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemHeaderLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  trashBtn: {
    padding: 4,
  },
  itemNumbers: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  itemQty: {
    fontSize: 13,
    fontWeight: "600",
  },
  itemLineTotal: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyItemsBox: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  emptyItemsText: {
    fontSize: 13,
    textAlign: "center",
  },
  summaryCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  grandTotalRow: {
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  btn: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: Spacing.lg,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalBtn: {
    flex: 1,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
});
