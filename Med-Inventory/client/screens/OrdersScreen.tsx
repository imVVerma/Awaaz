import React, { useState, useMemo, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Card } from "@/components/Card";
import type { Order } from "@shared/types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { OrdersStackParamList } from "@/navigation/OrdersStackNavigator";

type Props = {
  navigation: NativeStackNavigationProp<OrdersStackParamList, "Orders">;
};

type OrderFilter =
  | "all"
  | "Outstanding"
  | "Overdue"
  | "Paid"
  | "Partially Paid";

export default function OrdersScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("all");

  const {
    data: orders,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<(Order & { customer_name: string; items_count: number })[]>({
    queryKey: ["/api/orders"],
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate("CreateOrder")}
          style={({ pressed }) => [
            styles.headerButton,
            { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather
            name="plus-circle"
            size={16}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.headerButtonText}>New Invoice</Text>
        </Pressable>
      ),
    });
  }, [navigation, theme]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    let list = orders;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.invoice_number.toLowerCase().includes(q) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(q)),
      );
    }

    if (filter !== "all") {
      list = list.filter((o) => o.status === filter);
    }

    return list;
  }, [orders, searchQuery, filter]);

  const renderOrderItem = ({
    item,
  }: {
    item: Order & { customer_name: string; items_count: number };
  }) => {
    const isPaid = item.status === "Paid";
    const isOverdue = item.status === "Overdue";
    const remaining = item.total_amount - item.paid_amount;

    return (
      <Pressable
        onPress={() => navigation.navigate("OrderDetail", { orderId: item.id })}
        style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
      >
        <Card style={styles.orderCard}>
          <View style={styles.orderCardHeader}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.invoiceNumber, { color: theme.text }]}>
                {item.invoice_number}
              </Text>
              <Text
                style={[styles.customerName, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {item.customer_name}
              </Text>
            </View>

            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isPaid
                    ? theme.badgeSuccessBg
                    : isOverdue
                      ? theme.badgeDangerBg
                      : theme.badgeWarningBg,
                  borderColor: isPaid
                    ? theme.badgeSuccessBorder
                    : isOverdue
                      ? theme.badgeDangerBorder
                      : theme.badgeWarningBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: isPaid
                      ? theme.badgeSuccessText
                      : isOverdue
                        ? theme.badgeDangerText
                        : theme.badgeWarningText,
                  },
                ]}
              >
                {item.status}
              </Text>
            </View>
          </View>

          {/* Dates & Items */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather
                name="calendar"
                size={13}
                color={theme.textTertiary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                Date: {item.order_date}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Feather
                name="clock"
                size={13}
                color={theme.textTertiary}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.metaText,
                  { color: isOverdue ? theme.error : theme.textSecondary },
                ]}
              >
                Due: {item.due_date}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Feather
                name="package"
                size={13}
                color={theme.textTertiary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {item.items_count} {item.items_count === 1 ? "Item" : "Items"}
              </Text>
            </View>
          </View>

          {/* Financials Row */}
          <View
            style={[styles.financialsRow, { borderTopColor: theme.border }]}
          >
            <View>
              <Text style={[styles.finLabel, { color: theme.textTertiary }]}>
                Invoice Total
              </Text>
              <Text style={[styles.finTotal, { color: theme.text }]}>
                ₹{item.total_amount.toFixed(2)}
              </Text>
            </View>

            <View style={{ alignItems: "center" }}>
              <Text style={[styles.finLabel, { color: theme.textTertiary }]}>
                Paid Amount
              </Text>
              <Text style={[styles.finPaid, { color: theme.success }]}>
                ₹{item.paid_amount.toFixed(2)}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.finLabel, { color: theme.textTertiary }]}>
                Balance Due
              </Text>
              <Text
                style={[
                  styles.finDue,
                  {
                    color: isOverdue
                      ? theme.error
                      : remaining > 0
                        ? theme.warning
                        : theme.success,
                  },
                ]}
              >
                ₹{remaining.toFixed(2)}
              </Text>
            </View>
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: theme.border,
          },
        ]}
      >
        <Feather
          name="search"
          size={18}
          color={theme.textTertiary}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search by invoice # or customer pharmacy..."
          placeholderTextColor={theme.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => setSearchQuery("")}
            style={styles.clearSearchBtn}
          >
            <Feather name="x" size={16} color={theme.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterPillsContainer}>
        {(
          ["all", "Outstanding", "Overdue", "Paid", "Partially Paid"] as const
        ).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => setFilter(mode)}
            style={[
              styles.filterPill,
              filter === mode
                ? { backgroundColor: theme.primary, borderColor: theme.primary }
                : {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: filter === mode ? "#FFFFFF" : theme.textSecondary },
              ]}
            >
              {mode === "all" ? `All (${orders?.length || 0})` : mode}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Invoices List */}
      {isLoading ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading invoices...
          </Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.centeredContainer}>
          <Feather name="file-text" size={48} color={theme.textTertiary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No invoices found
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            {searchQuery
              ? "Try adjusting your search query"
              : "Create your first sales order invoice"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginRight: 8,
  },
  headerButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterPillsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
    flexWrap: "wrap",
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  orderCard: {
    padding: 16,
    borderRadius: 12,
  },
  orderCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: "800",
  },
  customerName: {
    fontSize: 13,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  financialsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
  },
  finLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  finTotal: {
    fontSize: 15,
    fontWeight: "700",
  },
  finPaid: {
    fontSize: 15,
    fontWeight: "700",
  },
  finDue: {
    fontSize: 15,
    fontWeight: "700",
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
