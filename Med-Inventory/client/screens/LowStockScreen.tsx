import React from "react";
import { View, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ProductListItem } from "@/components/ProductListItem";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import type { ProductWithCompany } from "@shared/types";

export default function LowStockScreen() {
  const { theme } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const {
    data: products,
    isLoading,
    refetch,
  } = useQuery<ProductWithCompany[]>({
    queryKey: ["/api/products/low-stock"],
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (!isLoading && (!products || products.length === 0)) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <EmptyState
          icon="check-circle"
          title="All Stocked Up"
          message="Great news! All your products are above their minimum stock levels."
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ProductListItem product={item} showActions={false} />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: Spacing.lg,
  },
});
