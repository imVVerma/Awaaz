import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ScrollView,
  ActivityIndicator,
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
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, queryClient } from "@/lib/query-client";
import type { Company, ProductWithCompany } from "@shared/types";
import type { ProductsStackParamList } from "@/navigation/ProductsStackNavigator";

type ProductsNavProp = NativeStackNavigationProp<
  ProductsStackParamList,
  "Products"
>;

type StockFilterType = "all" | "in_stock" | "low_stock" | "out_of_stock";
type ExpiryFilterType = "all" | "near_expiry" | "expired";

export default function ProductsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<ProductsNavProp>();
  const tabBarHeight = useBottomTabBarHeight();

  const [viewMode, setViewMode] = React.useState<"all" | "company">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [companyFilter, setCompanyFilter] = React.useState<string | number>(
    "all",
  );
  const [stockFilter, setStockFilter] = React.useState<StockFilterType>("all");
  const [expiryFilter, setExpiryFilter] =
    React.useState<ExpiryFilterType>("all");

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

  const companyFilterOptions = React.useMemo(() => {
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

  const companyStats = React.useMemo(() => {
    if (!companies || !products) return [];

    return companies.map((comp) => {
      const compProducts = products.filter((p) => p.company_id === comp.id);
      const totalUnits = compProducts.reduce(
        (sum, p) => sum + p.stock_quantity,
        0,
      );
      const lowStockCount = compProducts.filter(
        (p) => p.stock_quantity <= p.minimum_stock_level,
      ).length;

      return {
        ...comp,
        productCount: compProducts.length,
        totalUnits,
        lowStockCount,
      };
    });
  }, [companies, products]);

  const filteredProducts = React.useMemo(() => {
    if (!products) return [];

    const todayStr = new Date().toISOString().split("T")[0];
    const threeMonthsStr = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const getSellableStock = (p: ProductWithCompany) => {
      if (p.batches && p.batches.length > 0) {
        return p.batches
          .filter((b) => b.expiry_date > todayStr)
          .reduce((sum, b) => sum + b.current_quantity, 0);
      }
      return p.expiry_date > todayStr ? p.stock_quantity : 0;
    };

    const hasExpiredBatches = (p: ProductWithCompany) => {
      if (p.batches && p.batches.length > 0) {
        return p.batches.some(
          (b) => b.expiry_date <= todayStr && b.current_quantity > 0,
        );
      }
      return p.expiry_date <= todayStr && p.stock_quantity > 0;
    };

    const hasNearExpiryBatches = (p: ProductWithCompany) => {
      if (p.batches && p.batches.length > 0) {
        return p.batches.some(
          (b) =>
            b.expiry_date > todayStr &&
            b.expiry_date <= threeMonthsStr &&
            b.current_quantity > 0,
        );
      }
      return (
        p.expiry_date > todayStr &&
        p.expiry_date <= threeMonthsStr &&
        p.stock_quantity > 0
      );
    };

    let filtered = products;

    if (companyFilter !== "all") {
      filtered = filtered.filter((p) => p.company_id === companyFilter);
    }

    if (stockFilter === "in_stock") {
      filtered = filtered.filter(
        (p) => getSellableStock(p) > p.minimum_stock_level,
      );
    } else if (stockFilter === "low_stock") {
      filtered = filtered.filter(
        (p) =>
          getSellableStock(p) <= p.minimum_stock_level &&
          getSellableStock(p) > 0,
      );
    } else if (stockFilter === "out_of_stock") {
      filtered = filtered.filter((p) => getSellableStock(p) === 0);
    }

    if (expiryFilter !== "all") {
      if (expiryFilter === "near_expiry") {
        filtered = filtered.filter((p) => hasNearExpiryBatches(p));
      } else if (expiryFilter === "expired") {
        filtered = filtered.filter((p) => hasExpiredBatches(p));
      }
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => {
        const batchNums = (p.batches || [])
          .map((b) => b.batch_number.toLowerCase())
          .join(" ");
        return (
          p.product_name.toLowerCase().includes(query) ||
          (p.composition && p.composition.toLowerCase().includes(query)) ||
          p.batch_number.toLowerCase().includes(query) ||
          batchNums.includes(query) ||
          (p.sku && p.sku.toLowerCase().includes(query)) ||
          (p.category && p.category.toLowerCase().includes(query)) ||
          (p.company_name && p.company_name.toLowerCase().includes(query))
        );
      });
    }

    return filtered;
  }, [products, searchQuery, companyFilter, stockFilter, expiryFilter]);

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
        <View style={styles.headerRightActions}>
          <Pressable
            onPress={() => navigation.navigate("ImportCatalogue")}
            style={({ pressed }) => [
              styles.headerIconButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            hitSlop={8}
            accessibilityLabel="Import Catalogue"
          >
            <Feather name="upload" size={20} color={theme.primary} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("AddProduct")}
            style={({ pressed }) => [
              styles.headerIconButton,
              {
                opacity: pressed ? 0.6 : 1,
                backgroundColor: theme.primaryLight,
              },
            ]}
            hitSlop={8}
            accessibilityLabel="Add Product"
          >
            <Feather name="plus" size={20} color={theme.primary} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, theme]);

  const selectedCompanyName = React.useMemo(() => {
    if (companyFilter === "all") return null;
    return companies?.find((c) => c.id === companyFilter)?.name || null;
  }, [companies, companyFilter]);

  const hasNoProducts =
    !products || (products as ProductWithCompany[]).length === 0;
  if (isLoading && hasNoProducts) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Browsing Mode Toggle */}
      <View
        style={[
          styles.viewModeContainer,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: theme.border,
          },
        ]}
      >
        <Pressable
          onPress={() => setViewMode("all")}
          style={[
            styles.viewModeButton,
            viewMode === "all" && {
              backgroundColor: theme.primary,
            },
          ]}
        >
          <Feather
            name="grid"
            size={16}
            color={viewMode === "all" ? "#FFFFFF" : theme.textSecondary}
            style={styles.viewModeIcon}
          />
          <ThemedText
            style={[
              styles.viewModeText,
              { color: viewMode === "all" ? "#FFFFFF" : theme.textSecondary },
            ]}
          >
            All Products ({products?.length ?? 0})
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => setViewMode("company")}
          style={[
            styles.viewModeButton,
            viewMode === "company" && {
              backgroundColor: theme.primary,
            },
          ]}
        >
          <Feather
            name="briefcase"
            size={16}
            color={viewMode === "company" ? "#FFFFFF" : theme.textSecondary}
            style={styles.viewModeIcon}
          />
          <ThemedText
            style={[
              styles.viewModeText,
              {
                color: viewMode === "company" ? "#FFFFFF" : theme.textSecondary,
              },
            ]}
          >
            Company-First ({companies?.length ?? 0})
          </ThemedText>
        </Pressable>
      </View>

      {/* Company Filter Active Banner */}
      {selectedCompanyName && (
        <View
          style={[
            styles.activeFilterBanner,
            { backgroundColor: theme.primaryLight, borderColor: theme.border },
          ]}
        >
          <View style={styles.activeFilterContent}>
            <Feather name="filter" size={14} color={theme.primary} />
            <ThemedText
              style={[styles.activeFilterText, { color: theme.primary }]}
            >
              Filtered by: {selectedCompanyName}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => setCompanyFilter("all")}
            hitSlop={8}
            style={styles.clearFilterButton}
          >
            <ThemedText
              style={[styles.clearFilterText, { color: theme.primary }]}
            >
              Clear
            </ThemedText>
            <Feather name="x" size={14} color={theme.primary} />
          </Pressable>
        </View>
      )}

      {viewMode === "company" ? (
        /* Company-First Browsing Mode */
        <ScrollView
          contentContainerStyle={[
            styles.companyGrid,
            { paddingBottom: tabBarHeight + Spacing.xl },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {companyStats.map((comp) => (
            <Card
              key={comp.id}
              style={styles.companyCard}
              onPress={() => {
                setCompanyFilter(comp.id);
                setViewMode("all");
              }}
            >
              <View style={styles.companyCardHeader}>
                <View
                  style={[
                    styles.companyIconWrapper,
                    { backgroundColor: theme.primaryLight },
                  ]}
                >
                  <Feather name="briefcase" size={20} color={theme.primary} />
                </View>
                <View style={styles.companyMeta}>
                  <ThemedText style={styles.companyTitle} numberOfLines={1}>
                    {comp.name}
                  </ThemedText>
                  {comp.contact_info && (
                    <ThemedText
                      style={[
                        styles.companyContact,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {comp.contact_info}
                    </ThemedText>
                  )}
                </View>
                <Feather
                  name="chevron-right"
                  size={20}
                  color={theme.textSecondary}
                />
              </View>

              <View
                style={[
                  styles.companyStatsBar,
                  { borderTopColor: theme.border },
                ]}
              >
                <View style={styles.companyStatCol}>
                  <ThemedText style={[styles.statNum, { color: theme.text }]}>
                    {comp.productCount}
                  </ThemedText>
                  <ThemedText
                    style={[styles.statLabel, { color: theme.textSecondary }]}
                  >
                    Products
                  </ThemedText>
                </View>

                <View style={styles.companyStatCol}>
                  <ThemedText style={[styles.statNum, { color: theme.text }]}>
                    {comp.totalUnits}
                  </ThemedText>
                  <ThemedText
                    style={[styles.statLabel, { color: theme.textSecondary }]}
                  >
                    Total Units
                  </ThemedText>
                </View>

                <View style={styles.companyStatCol}>
                  <ThemedText
                    style={[
                      styles.statNum,
                      {
                        color:
                          comp.lowStockCount > 0
                            ? theme.warning
                            : theme.success,
                      },
                    ]}
                  >
                    {comp.lowStockCount}
                  </ThemedText>
                  <ThemedText
                    style={[styles.statLabel, { color: theme.textSecondary }]}
                  >
                    Low Stock
                  </ThemedText>
                </View>
              </View>
            </Card>
          ))}

          {companyStats.length === 0 && (
            <EmptyState
              icon="briefcase"
              title="No Companies Found"
              message="Add pharmaceutical distributors to browse products company-first."
            />
          )}
        </ScrollView>
      ) : (
        /* All Products Search & Filter View */
        <View style={styles.productListWrapper}>
          <View style={styles.filterContainer}>
            <View style={styles.searchWrapper}>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by medicine, composition, batch..."
              />
            </View>
            <FilterSelect
              value={companyFilter}
              options={companyFilterOptions}
              onChange={setCompanyFilter}
              placeholder="All Companies"
            />
          </View>

          {/* Quick Status Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillsScrollView}
            contentContainerStyle={styles.pillsContainer}
          >
            <Pressable
              onPress={() => setStockFilter("all")}
              style={[
                styles.filterPill,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
                stockFilter === "all" && {
                  backgroundColor: theme.primary,
                  borderColor: theme.primary,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.filterPillText,
                  {
                    color:
                      stockFilter === "all" ? "#FFFFFF" : theme.textSecondary,
                  },
                ]}
              >
                All Stock
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setStockFilter("in_stock")}
              style={[
                styles.filterPill,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
                stockFilter === "in_stock" && {
                  backgroundColor: theme.success,
                  borderColor: theme.success,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.filterPillText,
                  {
                    color:
                      stockFilter === "in_stock"
                        ? "#FFFFFF"
                        : theme.textSecondary,
                  },
                ]}
              >
                In Stock
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setStockFilter("low_stock")}
              style={[
                styles.filterPill,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
                stockFilter === "low_stock" && {
                  backgroundColor: theme.warning,
                  borderColor: theme.warning,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.filterPillText,
                  {
                    color:
                      stockFilter === "low_stock"
                        ? "#FFFFFF"
                        : theme.textSecondary,
                  },
                ]}
              >
                Low Stock
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setStockFilter("out_of_stock")}
              style={[
                styles.filterPill,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
                stockFilter === "out_of_stock" && {
                  backgroundColor: theme.danger,
                  borderColor: theme.danger,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.filterPillText,
                  {
                    color:
                      stockFilter === "out_of_stock"
                        ? "#FFFFFF"
                        : theme.textSecondary,
                  },
                ]}
              >
                Out of Stock
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() =>
                setExpiryFilter(
                  expiryFilter === "near_expiry" ? "all" : "near_expiry",
                )
              }
              style={[
                styles.filterPill,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
                expiryFilter === "near_expiry" && {
                  backgroundColor: theme.warning,
                  borderColor: theme.warning,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.filterPillText,
                  {
                    color:
                      expiryFilter === "near_expiry"
                        ? "#FFFFFF"
                        : theme.textSecondary,
                  },
                ]}
              >
                Near Expiry (&lt;90d)
              </ThemedText>
            </Pressable>
          </ScrollView>

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
                title="No Products Match"
                message="Try adjusting your search terms or filter criteria."
                actionLabel="Reset Filters"
                onAction={() => {
                  setSearchQuery("");
                  setCompanyFilter("all");
                  setStockFilter("all");
                  setExpiryFilter("all");
                }}
              />
            }
          />
        </View>
      )}

      <ConfirmModal
        visible={deleteModal.visible}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteModal.product?.product_name}"? All associated inventory records will be removed.`}
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
  headerRightActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  viewModeContainer: {
    flexDirection: "row",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    padding: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  viewModeIcon: {
    marginRight: Spacing.xs,
  },
  viewModeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  activeFilterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  activeFilterContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: "600",
  },
  clearFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    padding: Spacing.xs,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: "500",
  },
  productListWrapper: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  searchWrapper: {
    flex: 1,
  },
  pillsScrollView: {
    maxHeight: 48,
    marginVertical: Spacing.xs,
  },
  pillsContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    alignItems: "center",
  },
  filterPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "500",
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  companyGrid: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  companyCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  companyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  companyIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  companyMeta: {
    flex: 1,
  },
  companyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  companyContact: {
    fontSize: 12,
  },
  companyStatsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  companyStatCol: {
    alignItems: "center",
    flex: 1,
  },
  statNum: {
    fontSize: 15,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 1,
  },
});
