import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  FlatList,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ThemedText } from "@/components/ThemedText";
import { StatCard } from "@/components/StatCard";
import { ProductListItem } from "@/components/ProductListItem";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import type { DashboardStats, ProductWithCompany } from "@shared/types";
import type { DashboardStackParamList } from "@/navigation/DashboardStackNavigator";

type DashboardNavProp = NativeStackNavigationProp<
  DashboardStackParamList,
  "Dashboard"
>;

export default function DashboardScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<DashboardNavProp>();
  const tabBarHeight = useBottomTabBarHeight();

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const {
    data: lowStockProducts,
    isLoading: lowStockLoading,
    refetch: refetchLowStock,
  } = useQuery<ProductWithCompany[]>({
    queryKey: ["/api/products/low-stock"],
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchLowStock()]);
    setRefreshing(false);
  };

  const themeColors = isDark ? Colors.dark : Colors.light;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabBarHeight + Spacing.xl },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <StatCard
              title="Total Products"
              value={stats?.totalProducts ?? 0}
              icon="package"
              color={themeColors.primary}
            />
          </View>
          <View style={styles.statItem}>
            <StatCard
              title="Companies"
              value={stats?.totalCompanies ?? 0}
              icon="briefcase"
              color={themeColors.info}
            />
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <StatCard
              title="Low Stock"
              value={stats?.lowStockCount ?? 0}
              icon="alert-triangle"
              color={themeColors.warning}
              onPress={() => navigation.navigate("LowStock")}
            />
          </View>
          <View style={styles.statItem}>
            <StatCard
              title="Expiring Soon"
              value={stats?.expiringCount ?? 0}
              icon="clock"
              color={themeColors.danger}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            Low Stock Alerts
          </ThemedText>
          {lowStockProducts && lowStockProducts.length > 3 && (
            <ThemedText
              style={[styles.seeAll, { color: theme.primary }]}
              onPress={() => navigation.navigate("LowStock")}
            >
              See All
            </ThemedText>
          )}
        </View>

        {lowStockLoading ? (
          <ThemedText
            style={[styles.loadingText, { color: theme.textSecondary }]}
          >
            Loading...
          </ThemedText>
        ) : lowStockProducts && lowStockProducts.length > 0 ? (
          lowStockProducts
            .slice(0, 5)
            .map((product) => (
              <ProductListItem
                key={product.id}
                product={product}
                showActions={false}
              />
            ))
        ) : (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <ThemedText
              style={[styles.emptyText, { color: theme.textSecondary }]}
            >
              All products are well stocked
            </ThemedText>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  statsGrid: {
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statItem: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  seeAll: {
    fontSize: 14,
    fontWeight: "500",
  },
  loadingText: {
    textAlign: "center",
    padding: Spacing.xl,
  },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: 8,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
  },
});
