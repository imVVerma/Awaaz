import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  FlatList,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";

interface InventoryStats {
  total_products: number;
  total_stock_quantity: number;
  total_investment: number;
  potential_revenue: number;
}

interface CompanyStock {
  company_name: string;
  product_count: number;
  stock_level: number;
}

interface Transaction {
  id: number;
  product_id: number;
  product_name: string;
  transaction_type: "in" | "out";
  quantity: number;
  date: string;
  notes: string;
}

interface ReportsData {
  inventory: InventoryStats;
  distribution: CompanyStock[];
  transactions: Transaction[];
}

export default function ReportsScreen() {
  const { theme, isDark } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const { data, isLoading, refetch } = useQuery<ReportsData>({
    queryKey: ["/api/reports/summary"],
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) {
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
        <ThemedText>Loading Reports...</ThemedText>
      </View>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.content}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          Financial Summary
        </ThemedText>
        <View style={styles.statsGrid}>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <ThemedText
              style={[styles.statLabel, { color: theme.textSecondary }]}
            >
              Total Investment
            </ThemedText>
            <ThemedText style={[styles.statValue, { color: theme.primary }]}>
              {formatCurrency(data?.inventory.total_investment || 0)}
            </ThemedText>
            <ThemedText
              style={[styles.statSub, { color: theme.textSecondary }]}
            >
              Cost of all stock
            </ThemedText>
          </View>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <ThemedText
              style={[styles.statLabel, { color: theme.textSecondary }]}
            >
              Potential Revenue
            </ThemedText>
            <ThemedText style={[styles.statValue, { color: theme.success }]}>
              {formatCurrency(data?.inventory.potential_revenue || 0)}
            </ThemedText>
            <ThemedText
              style={[styles.statSub, { color: theme.textSecondary }]}
            >
              At current MRP
            </ThemedText>
          </View>
        </View>

        <View
          style={[
            styles.statCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              marginTop: Spacing.md,
            },
          ]}
        >
          <ThemedText
            style={[styles.statLabel, { color: theme.textSecondary }]}
          >
            Potential Profit
          </ThemedText>
          <ThemedText style={[styles.statValue, { color: theme.info }]}>
            {formatCurrency(
              (data?.inventory.potential_revenue || 0) -
                (data?.inventory.total_investment || 0),
            )}
          </ThemedText>
        </View>

        <ThemedText
          style={[
            styles.sectionTitle,
            { color: theme.text, marginTop: Spacing.xl },
          ]}
        >
          Stock by Company
        </ThemedText>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          {data?.distribution.map((item, index) => (
            <View
              key={index}
              style={[
                styles.listItem,
                index !== data.distribution.length - 1 && {
                  borderBottomColor: theme.border,
                  borderBottomWidth: 1,
                },
              ]}
            >
              <View style={styles.itemInfo}>
                <ThemedText style={[styles.itemName, { color: theme.text }]}>
                  {item.company_name || "Unknown"}
                </ThemedText>
                <ThemedText
                  style={[styles.itemDetail, { color: theme.textSecondary }]}
                >
                  {item.product_count} Products
                </ThemedText>
              </View>
              <View style={styles.itemMeta}>
                <ThemedText style={[styles.itemValue, { color: theme.text }]}>
                  {item.stock_level || 0}
                </ThemedText>
                <ThemedText
                  style={[styles.itemDetail, { color: theme.textSecondary }]}
                >
                  Units
                </ThemedText>
              </View>
            </View>
          ))}
          {(!data?.distribution || data.distribution.length === 0) && (
            <ThemedText style={styles.emptyText}>No data available</ThemedText>
          )}
        </View>

        <ThemedText
          style={[
            styles.sectionTitle,
            { color: theme.text, marginTop: Spacing.xl },
          ]}
        >
          Recent Transactions
        </ThemedText>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          {data?.transactions.map((item, index) => (
            <View
              key={index}
              style={[
                styles.listItem,
                index !== data.transactions.length - 1 && {
                  borderBottomColor: theme.border,
                  borderBottomWidth: 1,
                },
              ]}
            >
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor:
                      item.transaction_type === "in"
                        ? isDark
                          ? Colors.dark.successLight
                          : Colors.light.successLight
                        : isDark
                          ? Colors.dark.dangerLight
                          : Colors.light.dangerLight,
                  },
                ]}
              >
                <Feather
                  name={
                    item.transaction_type === "in"
                      ? "arrow-down-left"
                      : "arrow-up-right"
                  }
                  size={16}
                  color={
                    item.transaction_type === "in"
                      ? theme.success
                      : theme.danger
                  }
                />
              </View>
              <View style={styles.itemInfo}>
                <ThemedText style={[styles.itemName, { color: theme.text }]}>
                  {item.product_name}
                </ThemedText>
                <ThemedText
                  style={[styles.itemDetail, { color: theme.textSecondary }]}
                >
                  {new Date(item.date).toLocaleDateString()}
                </ThemedText>
              </View>
              <View style={styles.itemMeta}>
                <ThemedText
                  style={[
                    styles.itemValue,
                    {
                      color:
                        item.transaction_type === "in"
                          ? theme.success
                          : theme.danger,
                    },
                  ]}
                >
                  {item.transaction_type === "in" ? "+" : "-"}
                  {item.quantity}
                </ThemedText>
              </View>
            </View>
          ))}
          {(!data?.transactions || data.transactions.length === 0) && (
            <ThemedText style={styles.emptyText}>
              No transactions yet
            </ThemedText>
          )}
        </View>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  statSub: {
    fontSize: 10,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemDetail: {
    fontSize: 12,
  },
  itemMeta: {
    alignItems: "flex-end",
  },
  itemValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyText: {
    padding: Spacing.xl,
    textAlign: "center",
    opacity: 0.5,
  },
});
