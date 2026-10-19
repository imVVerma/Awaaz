import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { SearchBar } from "@/components/SearchBar";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { Purchase } from "@shared/types";
import type { PurchasesStackParamList } from "@/navigation/PurchasesStackNavigator";

type PurchasesNavProp = NativeStackNavigationProp<
  PurchasesStackParamList,
  "Purchases"
>;

export default function PurchasesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<PurchasesNavProp>();
  const tabBarHeight = useBottomTabBarHeight();
  const [search, setSearch] = React.useState("");

  const {
    data: purchases,
    isLoading,
    refetch,
  } = useQuery<Purchase[]>({
    queryKey: ["/api/purchases"],
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filteredPurchases = React.useMemo(() => {
    if (!purchases) return [];
    if (!search.trim()) return purchases;
    const q = search.toLowerCase();
    return purchases.filter(
      (p) =>
        p.purchase_invoice_number.toLowerCase().includes(q) ||
        (p.supplier_name && p.supplier_name.toLowerCase().includes(q)),
    );
  }, [purchases, search]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => navigation.navigate("Suppliers")}
            style={({ pressed }) => [
              styles.headerBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            hitSlop={8}
            accessibilityLabel="Manage Suppliers"
          >
            <Feather name="truck" size={20} color={theme.primary} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("CreatePurchase")}
            style={({ pressed }) => [
              styles.headerBtn,
              {
                opacity: pressed ? 0.6 : 1,
                backgroundColor: theme.primaryLight,
              },
            ]}
            hitSlop={8}
            accessibilityLabel="Receive Inbound Purchase"
          >
            <Feather name="plus" size={20} color={theme.primary} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, theme]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={styles.searchBarWrapper}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by supplier or invoice #..."
        />
      </View>

      <FlatList
        data={filteredPurchases}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Card
            style={styles.invoiceCard}
            onPress={() =>
              navigation.navigate("PurchaseDetail", { purchaseId: item.id })
            }
          >
            <View style={styles.cardHeader}>
              <View style={styles.headerLeft}>
                <ThemedText style={styles.invoiceNum}>
                  {item.purchase_invoice_number}
                </ThemedText>
                <ThemedText
                  style={[styles.supplierName, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.supplier_name}
                </ThemedText>
              </View>
              <View style={styles.amountBadge}>
                <ThemedText style={styles.totalAmount}>
                  ₹
                  {item.total_amount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </ThemedText>
                <ThemedText
                  style={[styles.statusText, { color: theme.primary }]}
                >
                  Inbound • {item.payment_status.toUpperCase()}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
              <ThemedText
                style={[styles.metaText, { color: theme.textSecondary }]}
              >
                Date: {item.invoice_date.split("T")[0]} •{" "}
                {item.items_count || 0} line items
              </ThemedText>
              <Feather
                name="chevron-right"
                size={16}
                color={theme.textSecondary}
              />
            </View>
          </Card>
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="truck"
              title="No Inbound Purchases"
              message="Record stock purchases received from pharmaceutical suppliers and wholesalers to increase inventory lots."
              actionLabel="Receive Inbound Invoice"
              onAction={() => navigation.navigate("CreatePurchase")}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBarWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  invoiceCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  invoiceNum: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  supplierName: {
    fontSize: 13,
  },
  amountBadge: {
    alignItems: "flex-end",
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: "800",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
  metaText: {
    fontSize: 12,
  },
});
