import React from "react";
import { View, StyleSheet, Alert, Modal, Pressable } from "react-native";
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
import type { Company, CreateProductInput } from "@shared/types";

interface FormErrors {
  company_id?: string;
  product_name?: string;
  batch_number?: string;
  expiry_date?: string;
  mrp?: string;
  purchase_price?: string;
  selling_price?: string;
  stock_quantity?: string;
  minimum_stock_level?: string;
}

const CATEGORY_OPTIONS = [
  { label: "Tablets", value: "Tablets" },
  { label: "Capsules", value: "Capsules" },
  { label: "Syrup / Liquid", value: "Syrup" },
  { label: "Injection", value: "Injection" },
  { label: "Ointment / Gel", value: "Ointment" },
  { label: "Drops", value: "Drops" },
  { label: "Other", value: "Other" },
];

const GST_OPTIONS = [
  { label: "0% (Exempt)", value: 0 },
  { label: "5% (Essential)", value: 5 },
  { label: "12% (Standard Pharma)", value: 12 },
  { label: "18% (Medical Supplies)", value: 18 },
  { label: "28% (Special)", value: 28 },
];

export default function AddProductScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const tabBarHeight = useBottomTabBarHeight();

  // Section 1: Product Master
  const [companyId, setCompanyId] = React.useState<number | null>(null);
  const [productName, setProductName] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [composition, setComposition] = React.useState("");
  const [category, setCategory] = React.useState("Tablets");
  const [uom, setUom] = React.useState("10x10 Strip");
  const [gstRate, setGstRate] = React.useState(12);
  const [minimumStockLevel, setMinimumStockLevel] = React.useState("10");

  // Section 2: Opening Inventory Batch
  const [batchNumber, setBatchNumber] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [mrp, setMrp] = React.useState("");
  const [purchasePrice, setPurchasePrice] = React.useState("");
  const [sellingPrice, setSellingPrice] = React.useState("");
  const [stockQuantity, setStockQuantity] = React.useState("");

  const [errors, setErrors] = React.useState<FormErrors>({});

  // Inline Quick Add Company Modal
  const [showAddCompanyModal, setShowAddCompanyModal] = React.useState(false);
  const [newCompanyName, setNewCompanyName] = React.useState("");
  const [newCompanyContact, setNewCompanyContact] = React.useState("");

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const companyOptions = React.useMemo(() => {
    if (!companies) return [];
    return companies.map((c) => ({ label: c.name, value: c.id }));
  }, [companies]);

  // Margin preview calculation
  const marginPreview = React.useMemo(() => {
    const buy = parseFloat(purchasePrice);
    const sell = parseFloat(sellingPrice || mrp);
    if (!isNaN(buy) && !isNaN(sell) && buy > 0 && sell > 0) {
      const margin = sell - buy;
      const marginPercent = ((margin / sell) * 100).toFixed(1);
      return {
        margin: margin.toFixed(2),
        percent: marginPercent,
        isValid: true,
      };
    }
    return { margin: "0.00", percent: "0.0", isValid: false };
  }, [purchasePrice, sellingPrice, mrp]);

  const mutation = useMutation({
    mutationFn: async (data: CreateProductInput) => {
      const res = await apiRequest("POST", "/api/products", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      navigation.goBack();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to create product");
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async ({
      name,
      contact_info,
    }: {
      name: string;
      contact_info?: string;
    }) => {
      const res = await apiRequest("POST", "/api/companies", {
        name,
        contact_info,
      });
      return res.json();
    },
    onSuccess: (newCompany: Company) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setCompanyId(newCompany.id);
      setShowAddCompanyModal(false);
      setNewCompanyName("");
      setNewCompanyContact("");
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to create company");
    },
  });

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!companyId) {
      newErrors.company_id = "Please select or add a manufacturer/company";
    }
    if (!productName.trim()) {
      newErrors.product_name = "Product name is required";
    }
    if (!batchNumber.trim()) {
      newErrors.batch_number = "Batch number is required";
    }
    if (!expiryDate) {
      newErrors.expiry_date = "Expiry date is required";
    } else {
      const today = new Date().toISOString().split("T")[0];
      if (expiryDate < today) {
        newErrors.expiry_date = "Expiry date must be in the future";
      }
    }
    if (!mrp || parseFloat(mrp) <= 0) {
      newErrors.mrp = "MRP must be a positive number";
    }
    if (!purchasePrice || parseFloat(purchasePrice) <= 0) {
      newErrors.purchase_price = "Purchase price must be a positive number";
    }
    if (sellingPrice && parseFloat(sellingPrice) <= 0) {
      newErrors.selling_price = "Selling price must be a positive number";
    }
    if (!stockQuantity || parseInt(stockQuantity, 10) < 0) {
      newErrors.stock_quantity = "Stock quantity must be a non-negative number";
    }
    if (!minimumStockLevel || parseInt(minimumStockLevel, 10) < 0) {
      newErrors.minimum_stock_level =
        "Minimum stock level must be a non-negative number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    mutation.mutate({
      company_id: companyId!,
      product_name: productName.trim(),
      sku: sku.trim() || undefined,
      composition: composition.trim() || undefined,
      category,
      uom: uom.trim() || undefined,
      gst_rate: gstRate,
      batch_number: batchNumber.trim(),
      expiry_date: expiryDate,
      mrp: parseFloat(mrp),
      purchase_price: parseFloat(purchasePrice),
      selling_price: sellingPrice ? parseFloat(sellingPrice) : parseFloat(mrp),
      stock_quantity: parseInt(stockQuantity, 10),
      minimum_stock_level: parseInt(minimumStockLevel, 10),
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
        {/* Section 1: Product Master Information */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIcon,
                { backgroundColor: theme.primaryLight },
              ]}
            >
              <Feather name="package" size={18} color={theme.primary} />
            </View>
            <View>
              <ThemedText style={styles.sectionTitle}>
                1. Product Catalog Master
              </ThemedText>
              <ThemedText
                style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
              >
                Permanent medicine identity and pharmaceutical classification
              </ThemedText>
            </View>
          </View>

          <View style={styles.companySelectRow}>
            <View style={styles.companySelectWrapper}>
              <FormSelect
                label="Manufacturer / Company"
                placeholder="Select a company"
                value={companyId}
                options={companyOptions}
                onChange={(val) => setCompanyId(val as number)}
                required
                error={errors.company_id}
              />
            </View>
            <Pressable
              onPress={() => setShowAddCompanyModal(true)}
              style={[
                styles.inlineAddButton,
                {
                  backgroundColor: theme.primaryLight,
                  borderColor: theme.border,
                },
              ]}
              hitSlop={8}
            >
              <Feather name="plus" size={16} color={theme.primary} />
              <ThemedText
                style={[styles.inlineAddText, { color: theme.primary }]}
              >
                New
              </ThemedText>
            </Pressable>
          </View>

          <FormInput
            label="Product Name"
            value={productName}
            onChangeText={setProductName}
            placeholder="e.g. Paracetamol 650mg, Deliv Tablets"
            required
            error={errors.product_name}
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <FormInput
                label="SKU / Code"
                value={sku}
                onChangeText={setSku}
                placeholder="e.g. PARA-650"
              />
            </View>
            <View style={styles.halfInput}>
              <FormSelect
                label="Dosage Form"
                value={category}
                options={CATEGORY_OPTIONS}
                onChange={(val) => setCategory(val as string)}
              />
            </View>
          </View>

          <FormInput
            label="Composition / Active Salt"
            value={composition}
            onChangeText={setComposition}
            placeholder="e.g. Paracetamol IP 650mg, Aceclofenac + Paracetamol"
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <FormInput
                label="Packaging / Unit"
                value={uom}
                onChangeText={setUom}
                placeholder="e.g. 10x10 Strip, 100ml"
              />
            </View>
            <View style={styles.halfInput}>
              <FormSelect
                label="GST Rate"
                value={gstRate}
                options={GST_OPTIONS}
                onChange={(val) => setGstRate(val as number)}
              />
            </View>
          </View>

          <FormInput
            label="Low-Stock Alert Threshold"
            value={minimumStockLevel}
            onChangeText={setMinimumStockLevel}
            placeholder="10"
            keyboardType="number-pad"
            required
            error={errors.minimum_stock_level}
          />
        </Card>

        {/* Section 2: Opening Inventory Batch */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIcon,
                { backgroundColor: theme.warningLight },
              ]}
            >
              <Feather name="layers" size={18} color={theme.warning} />
            </View>
            <View>
              <ThemedText style={styles.sectionTitle}>
                2. Opening Inventory Batch
              </ThemedText>
              <ThemedText
                style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
              >
                Specific manufacturing lot, expiry date, prices, and stock units
              </ThemedText>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <FormInput
                label="Batch Number"
                value={batchNumber}
                onChangeText={setBatchNumber}
                placeholder="e.g. B-2024-09"
                required
                error={errors.batch_number}
              />
            </View>
            <View style={styles.halfInput}>
              <FormDatePicker
                label="Expiry Date"
                value={expiryDate}
                onChange={setExpiryDate}
                required
                error={errors.expiry_date}
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
                required
                error={errors.mrp}
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
                error={errors.purchase_price}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <FormInput
                label="Selling Price to Retailer (₹)"
                value={sellingPrice}
                onChangeText={setSellingPrice}
                placeholder={mrp ? `Default: ₹${mrp}` : "0.00"}
                keyboardType="decimal-pad"
                error={errors.selling_price}
              />
            </View>
            <View style={styles.halfInput}>
              <FormInput
                label="Opening Stock Units"
                value={stockQuantity}
                onChangeText={setStockQuantity}
                placeholder="0"
                keyboardType="number-pad"
                required
                error={errors.stock_quantity}
              />
            </View>
          </View>

          {/* Live Margin Indicator */}
          {marginPreview.isValid && (
            <View
              style={[
                styles.marginCard,
                {
                  backgroundColor:
                    parseFloat(marginPreview.margin) >= 0
                      ? theme.successLight
                      : theme.dangerLight,
                },
              ]}
            >
              <Feather
                name={
                  parseFloat(marginPreview.margin) >= 0
                    ? "trending-up"
                    : "alert-circle"
                }
                size={16}
                color={
                  parseFloat(marginPreview.margin) >= 0
                    ? theme.success
                    : theme.danger
                }
              />
              <ThemedText
                style={[
                  styles.marginText,
                  {
                    color:
                      parseFloat(marginPreview.margin) >= 0
                        ? theme.success
                        : theme.danger,
                  },
                ]}
              >
                Estimated Gross Margin: ₹{marginPreview.margin} / unit (
                {marginPreview.percent}%)
              </ThemedText>
            </View>
          )}
        </Card>

        <View style={styles.actions}>
          <PrimaryButton
            title="Cancel"
            variant="secondary"
            onPress={() => navigation.goBack()}
            style={styles.button}
            disabled={mutation.isPending}
          />
          <PrimaryButton
            title="Save Product & Batch"
            onPress={handleSubmit}
            style={styles.button}
            loading={mutation.isPending}
            icon="plus"
          />
        </View>
      </KeyboardAwareScrollViewCompat>

      {/* Quick Add Company Modal */}
      <Modal
        visible={showAddCompanyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddCompanyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>Quick Add Company</ThemedText>
            <ThemedText
              style={[styles.modalSubtitle, { color: theme.textSecondary }]}
            >
              Register a new pharmaceutical manufacturer
            </ThemedText>

            <FormInput
              label="Company Name"
              value={newCompanyName}
              onChangeText={setNewCompanyName}
              placeholder="e.g. Cipla, Sun Pharma, Zydus"
              required
            />

            <FormInput
              label="Contact Info / Phone (Optional)"
              value={newCompanyContact}
              onChangeText={setNewCompanyContact}
              placeholder="Phone or email"
            />

            <View style={styles.modalActions}>
              <PrimaryButton
                title="Cancel"
                variant="secondary"
                onPress={() => setShowAddCompanyModal(false)}
                style={styles.modalButton}
                disabled={createCompanyMutation.isPending}
              />
              <PrimaryButton
                title="Save Company"
                onPress={() => {
                  if (!newCompanyName.trim()) {
                    Alert.alert("Validation", "Company name is required");
                    return;
                  }
                  createCompanyMutation.mutate({
                    name: newCompanyName.trim(),
                    contact_info: newCompanyContact.trim() || undefined,
                  });
                }}
                style={styles.modalButton}
                loading={createCompanyMutation.isPending}
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
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  companySelectRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  companySelectWrapper: {
    flex: 1,
  },
  inlineAddButton: {
    marginTop: 26,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inlineAddText: {
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
  marginCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
  },
  marginText: {
    fontSize: 13,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  button: {
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
    maxWidth: 480,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: Spacing.lg,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});
