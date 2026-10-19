import React from "react";
import { View, StyleSheet, Alert } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { FormInput } from "@/components/FormInput";
import { FormSelect } from "@/components/FormSelect";
import { FormDatePicker } from "@/components/FormDatePicker";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { apiRequest, queryClient } from "@/lib/query-client";
import type { Company, UpdateProductInput } from "@shared/types";
import type { ProductsStackParamList } from "@/navigation/ProductsStackNavigator";

type EditProductRouteProp = RouteProp<ProductsStackParamList, "EditProduct">;

interface FormErrors {
  company_id?: string;
  product_name?: string;
  batch_number?: string;
  expiry_date?: string;
  mrp?: string;
  purchase_price?: string;
  stock_quantity?: string;
  minimum_stock_level?: string;
}

export default function EditProductScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<EditProductRouteProp>();
  const tabBarHeight = useBottomTabBarHeight();
  const { product } = route.params;

  const [companyId, setCompanyId] = React.useState<number>(product.company_id);
  const [productName, setProductName] = React.useState(product.product_name);
  const [composition, setComposition] = React.useState(
    product.composition || "",
  );
  const [batchNumber, setBatchNumber] = React.useState(product.batch_number);
  const [expiryDate, setExpiryDate] = React.useState(
    product.expiry_date.split("T")[0],
  );
  const [mrp, setMrp] = React.useState(String(product.mrp));
  const [purchasePrice, setPurchasePrice] = React.useState(
    String(product.purchase_price),
  );
  const [stockQuantity, setStockQuantity] = React.useState(
    String(product.stock_quantity),
  );
  const [minimumStockLevel, setMinimumStockLevel] = React.useState(
    String(product.minimum_stock_level),
  );
  const [errors, setErrors] = React.useState<FormErrors>({});

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const companyOptions = React.useMemo(() => {
    if (!companies) return [];
    return companies.map((c) => ({ label: c.name, value: c.id }));
  }, [companies]);

  const mutation = useMutation({
    mutationFn: async (data: UpdateProductInput) => {
      const res = await apiRequest("PUT", `/api/products/${product.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      navigation.goBack();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to update product");
    },
  });

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!companyId) {
      newErrors.company_id = "Please select a company";
    }
    if (!productName.trim()) {
      newErrors.product_name = "Product name is required";
    }
    if (!batchNumber.trim()) {
      newErrors.batch_number = "Batch number is required";
    }
    if (!expiryDate) {
      newErrors.expiry_date = "Expiry date is required";
    }
    if (!mrp || parseFloat(mrp) <= 0) {
      newErrors.mrp = "MRP must be a positive number";
    }
    if (!purchasePrice || parseFloat(purchasePrice) <= 0) {
      newErrors.purchase_price = "Purchase price must be a positive number";
    }
    if (!stockQuantity || parseInt(stockQuantity) < 0) {
      newErrors.stock_quantity = "Stock quantity must be a non-negative number";
    }
    if (!minimumStockLevel || parseInt(minimumStockLevel) < 0) {
      newErrors.minimum_stock_level =
        "Minimum stock level must be a non-negative number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    mutation.mutate({
      company_id: companyId,
      product_name: productName.trim(),
      composition: composition.trim() || undefined,
      batch_number: batchNumber.trim(),
      expiry_date: expiryDate,
      mrp: parseFloat(mrp),
      purchase_price: parseFloat(purchasePrice),
      stock_quantity: parseInt(stockQuantity),
      minimum_stock_level: parseInt(minimumStockLevel),
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
        <FormSelect
          label="Company"
          placeholder="Select a company"
          value={companyId}
          options={companyOptions}
          onChange={(val) => setCompanyId(val as number)}
          required
          error={errors.company_id}
        />

        <FormInput
          label="Product Name"
          value={productName}
          onChangeText={setProductName}
          placeholder="Enter product name"
          required
          error={errors.product_name}
        />

        <FormInput
          label="Composition"
          value={composition}
          onChangeText={setComposition}
          placeholder="Enter composition (optional)"
        />

        <FormInput
          label="Batch Number"
          value={batchNumber}
          onChangeText={setBatchNumber}
          placeholder="Enter batch number"
          required
          error={errors.batch_number}
        />

        <FormDatePicker
          label="Expiry Date"
          value={expiryDate}
          onChange={setExpiryDate}
          required
          error={errors.expiry_date}
        />

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <FormInput
              label="MRP"
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
              label="Purchase Price"
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
              label="Stock Quantity"
              value={stockQuantity}
              onChangeText={setStockQuantity}
              placeholder="0"
              keyboardType="number-pad"
              required
              error={errors.stock_quantity}
            />
          </View>
          <View style={styles.halfInput}>
            <FormInput
              label="Min. Stock Level"
              value={minimumStockLevel}
              onChangeText={setMinimumStockLevel}
              placeholder="10"
              keyboardType="number-pad"
              required
              error={errors.minimum_stock_level}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            title="Cancel"
            variant="secondary"
            onPress={() => navigation.goBack()}
            style={styles.button}
            disabled={mutation.isPending}
          />
          <PrimaryButton
            title="Save Changes"
            onPress={handleSubmit}
            style={styles.button}
            loading={mutation.isPending}
            icon="check"
          />
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  button: {
    flex: 1,
  },
});
