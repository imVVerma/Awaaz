import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { ProductListItem } from "@/components/ProductListItem";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ConfirmModal";
import { StockUpdateModal } from "@/components/StockUpdateModal";
import { SearchBar } from "@/components/SearchBar";
import { FilterSelect } from "@/components/FilterSelect";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { apiRequest, queryClient } from "@/lib/query-client";
import type { Company, ProductWithCompany } from "@shared/types";
import type { ProductsStackParamList } from "@/navigation/ProductsStackNavigator";

type ProductsNavProp = NativeStackNavigationProp<
  ProductsStackParamList,
  "Products"
>;

export default function ProductsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<ProductsNavProp>();
  const tabBarHeight = useBottomTabBarHeight();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [companyFilter, setCompanyFilter] = React.useState<string | number>(
    "all",
  );
  const [deleteModal, setDeleteModal] = React.useState<{
    visible: boolean;
    product: ProductWithCompany | null;
  }>({
    visible: false,
    product: null,
  });
  const [stockModal, setStockModal] = React.useState<{
    visible: boolean;
    product: ProductWithCompany | null;
  }>({
    visible: false,
    product: null,
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const {
    data: products,
    isLoading,
    refetch,
  } = useQuery<ProductWithCompany[]>({
    queryKey: ["/api/products"],
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDeleteModal({ visible: false, product: null });
    },
  });

  const stockUpdateMutation = useMutation({
    mutationFn: async ({
      id,
      quantity,
      type,
    }: {
      id: number;
      quantity: number;
      type: "add" | "remove";
    }) => {
      await apiRequest("PATCH", `/api/products/${id}/stock`, {
        quantity,
        type,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setStockModal({ visible: false, product: null });
    },
  });

  const filterOptions = React.useMemo(() => {
    const options: { label: string; value: string | number }[] = [
      { label: "All Companies", value: "all" },
    ];
    if (companies) {
      companies.forEach((c) => {
        options.push({ label: c.name, value: c.id });
      });
    }
    return options;
  }, [companies]);

  const filteredProducts = React.useMemo(() => {
    if (!products) return [];

    let filtered = products;

    if (companyFilter !== "all") {
      filtered = filtered.filter((p) => p.company_id === companyFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.product_name.toLowerCase().includes(query) ||
          (p.composition && p.composition.toLowerCase().includes(query)) ||
          p.batch_number.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [products, searchQuery, companyFilter]);

  const handleEdit = (product: ProductWithCompany) => {
    navigation.navigate("EditProduct", { product });
  };

  const handleDelete = (product: ProductWithCompany) => {
    setDeleteModal({ visible: true, product });
  };

  const handleUpdateStock = (product: ProductWithCompany) => {
    setStockModal({ visible: true, product });
  };

  const confirmDelete = () => {
    if (deleteModal.product) {
      deleteMutation.mutate(deleteModal.product.id);
    }
  };

  const confirmStockUpdate = (
    productId: number,
    quantity: number,
    type: "add" | "remove",
  ) => {
    stockUpdateMutation.mutate({ id: productId, quantity, type });
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", gap: Spacing.sm }}>
          <Pressable
            onPress={() => navigation.navigate("ImportCatalogue")}
            style={({ pressed }) => [
              { opacity: pressed ? 0.5 : 1, padding: Spacing.sm },
            ]}
            hitSlop={8}
          >
            <Feather name="upload" size={22} color={theme.primary} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("AddProduct")}
            style={({ pressed }) => [
              { opacity: pressed ? 0.5 : 1, padding: Spacing.sm },
            ]}
            hitSlop={8}
          >
            <Feather name="plus" size={24} color={theme.primary} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, theme]);

  if (!isLoading && (!products || products.length === 0)) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <EmptyState
          icon="package"
          title="No Products Yet"
          message="Add your first product to start managing your pharmacy inventory."
          actionLabel="Add Product"
          onAction={() => navigation.navigate("AddProduct")}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={styles.filterContainer}>
        <View style={styles.searchWrapper}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
          />
        </View>
        <FilterSelect
          value={companyFilter}
          options={filterOptions}
          onChange={setCompanyFilter}
          placeholder="All"
        />
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ProductListItem
            product={item}
            onEdit={() => handleEdit(item)}
            onDelete={() => handleDelete(item)}
            onUpdateStock={() => handleUpdateStock(item)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="search"
            title="No Results"
            message="No products match your search criteria."
          />
        }
      />

      <ConfirmModal
        visible={deleteModal.visible}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteModal.product?.product_name}"? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ visible: false, product: null })}
        loading={deleteMutation.isPending}
      />

      <StockUpdateModal
        visible={stockModal.visible}
        product={stockModal.product}
        onClose={() => setStockModal({ visible: false, product: null })}
        onUpdate={confirmStockUpdate}
        loading={stockUpdateMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  searchWrapper: {
    flex: 1,
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
});
