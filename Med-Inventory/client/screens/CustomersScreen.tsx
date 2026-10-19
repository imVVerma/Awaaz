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
  Linking,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Card } from "@/components/Card";
import type { Customer } from "@shared/types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { CustomersStackParamList } from "@/navigation/CustomersStackNavigator";

type Props = {
  navigation: NativeStackNavigationProp<CustomersStackParamList, "Customers">;
};

type BalanceFilter = "all" | "outstanding" | "overdue";

export default function CustomersScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<BalanceFilter>("all");

  const {
    data: customers,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<
    (Customer & { total_invoices: number; overdue_invoices: number })[]
  >({
    queryKey: ["/api/customers"],
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate("AddCustomer")}
          style={({ pressed }) => [
            styles.headerButton,
            { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather
            name="user-plus"
            size={16}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.headerButtonText}>Add Pharmacy</Text>
        </Pressable>
      ),
    });
  }, [navigation, theme]);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];

    let list = customers;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.store_name.toLowerCase().includes(q) ||
          (c.contact_person && c.contact_person.toLowerCase().includes(q)) ||
          c.phone.includes(q) ||
          (c.gstin && c.gstin.toLowerCase().includes(q)),
      );
    }

    if (filter === "outstanding") {
      list = list.filter((c) => (c.outstanding_balance || 0) > 0);
    } else if (filter === "overdue") {
      list = list.filter((c) => (c.overdue_invoices || 0) > 0);
    }

    return list;
  }, [customers, searchQuery, filter]);

  const handleCall = (phone: string) => {
    if (Platform.OS !== "web") {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const renderCustomerItem = ({
    item,
  }: {
    item: Customer & { total_invoices: number; overdue_invoices: number };
  }) => {
    const isWalkIn =
      item.id === 1 || item.store_name?.toLowerCase().includes("walk-in");
    const balance = isWalkIn ? 0 : item.outstanding_balance || 0;
    const isOverdue = !isWalkIn && item.overdue_invoices > 0;
    const creditLimit = isWalkIn ? 0 : item.credit_limit ?? 50000;
    const creditUtilizedPercent =
      creditLimit > 0
        ? Math.min(100, Math.round((balance / creditLimit) * 100))
        : 0;

    return (
      <Pressable
        onPress={() =>
          navigation.navigate("CustomerDetail", { customerId: item.id })
        }
        style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
      >
        <Card style={styles.customerCard}>
          {/* Header Row */}
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text
                style={[styles.storeName, { color: theme.text }]}
                numberOfLines={1}
              >
                {item.store_name}
              </Text>
              {item.contact_person ? (
                <Text
                  style={[styles.contactPerson, { color: theme.textSecondary }]}
                >
                  {item.contact_person}
                </Text>
              ) : null}
            </View>

            {/* Balance Badge */}
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isWalkIn
                    ? theme.badgeSuccessBg
                    : isOverdue
                      ? theme.badgeDangerBg
                      : balance > 0
                        ? theme.badgeWarningBg
                        : theme.badgeSuccessBg,
                  borderColor: isWalkIn
                    ? theme.badgeSuccessBorder
                    : isOverdue
                      ? theme.badgeDangerBorder
                      : balance > 0
                        ? theme.badgeWarningBorder
                        : theme.badgeSuccessBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: isWalkIn
                      ? theme.badgeSuccessText
                      : isOverdue
                        ? theme.badgeDangerText
                        : balance > 0
                          ? theme.badgeWarningText
                          : theme.badgeSuccessText,
                  },
                ]}
              >
                {isWalkIn
                  ? "Cash Counter"
                  : isOverdue
                    ? `₹${balance.toFixed(0)} Overdue`
                    : balance > 0
                      ? `₹${balance.toFixed(0)} Due`
                      : "Settled"}
              </Text>
            </View>
          </View>

          {/* Details Row */}
          <View style={styles.detailsRow}>
            <Pressable
              onPress={() => handleCall(item.phone)}
              style={styles.detailItem}
            >
              <Feather
                name="phone"
                size={14}
                color={theme.primary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                {item.phone}
              </Text>
            </Pressable>

            {item.gstin ? (
              <View style={styles.detailItem}>
                <Feather
                  name="file-text"
                  size={14}
                  color={theme.textTertiary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[styles.detailText, { color: theme.textSecondary }]}
                >
                  GSTIN: {item.gstin}
                </Text>
              </View>
            ) : null}

            <View style={styles.detailItem}>
              <Feather
                name="clock"
                size={14}
                color={theme.textTertiary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                {isWalkIn ? "Immediate (0d)" : `${item.payment_terms_days}d Terms`}
              </Text>
            </View>
          </View>

          {/* Credit Bar or Walk-in Notice */}
          {isWalkIn ? (
            <View
              style={[
                styles.walkInNotice,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.border,
                },
              ]}
            >
              <Feather
                name="zap"
                size={13}
                color={theme.primary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.walkInNoticeText,
                  { color: theme.textSecondary },
                ]}
              >
                Over-the-counter Cash Customer • Immediate Settlement Only
              </Text>
            </View>
          ) : creditLimit > 0 ? (
            <View style={styles.creditContainer}>
              <View style={styles.creditLabels}>
                <Text
                  style={[styles.creditLabel, { color: theme.textTertiary }]}
                >
                  Credit: ₹{balance.toFixed(0)} / ₹
                  {creditLimit.toLocaleString("en-IN")}
                </Text>
                <Text
                  style={[
                    styles.creditLabel,
                    {
                      color:
                        creditUtilizedPercent > 90
                          ? theme.error
                          : creditUtilizedPercent > 70
                            ? theme.warning
                            : theme.textSecondary,
                    },
                  ]}
                >
                  {creditUtilizedPercent}% used
                </Text>
              </View>
              <View
                style={[
                  styles.progressBarBg,
                  { backgroundColor: theme.backgroundTertiary },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${creditUtilizedPercent}%`,
                      backgroundColor:
                        creditUtilizedPercent > 90
                          ? theme.error
                          : creditUtilizedPercent > 70
                            ? theme.warning
                            : theme.primary,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}

          {/* Footer Actions */}
          <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
            <Text
              style={[styles.invoicesCountText, { color: theme.textTertiary }]}
            >
              {item.total_invoices}{" "}
              {item.total_invoices === 1 ? "Invoice" : "Invoices"}
            </Text>

            <View style={styles.cardActionsGroup}>
              <Pressable
                onPress={() =>
                  navigation.navigate("CreateOrder", { customerId: item.id })
                }
                style={({ pressed }) => [
                  styles.quickActionBtn,
                  {
                    backgroundColor: theme.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Feather
                  name="plus-circle"
                  size={14}
                  color="#FFFFFF"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.quickActionBtnText}>New Order</Text>
              </Pressable>
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
          placeholder="Search by store name, contact, phone, GSTIN..."
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
        <Pressable
          onPress={() => setFilter("all")}
          style={[
            styles.filterPill,
            filter === "all"
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
              { color: filter === "all" ? "#FFFFFF" : theme.textSecondary },
            ]}
          >
            All ({customers?.length || 0})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter("outstanding")}
          style={[
            styles.filterPill,
            filter === "outstanding"
              ? { backgroundColor: theme.warning, borderColor: theme.warning }
              : {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
          ]}
        >
          <Text
            style={[
              styles.filterPillText,
              {
                color:
                  filter === "outstanding" ? "#FFFFFF" : theme.textSecondary,
              },
            ]}
          >
            Outstanding
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter("overdue")}
          style={[
            styles.filterPill,
            filter === "overdue"
              ? { backgroundColor: theme.error, borderColor: theme.error }
              : {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
          ]}
        >
          <Text
            style={[
              styles.filterPillText,
              { color: filter === "overdue" ? "#FFFFFF" : theme.textSecondary },
            ]}
          >
            Overdue
          </Text>
        </Pressable>
      </View>

      {/* Main List */}
      {isLoading ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading customers...
          </Text>
        </View>
      ) : filteredCustomers.length === 0 ? (
        <View style={styles.centeredContainer}>
          <Feather name="users" size={48} color={theme.textTertiary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No pharmacies found
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            {searchQuery
              ? "Try adjusting your search query or filters"
              : "Register your first retail customer or pharmacy"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCustomerItem}
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
  },
  filterPill: {
    paddingHorizontal: 14,
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
  customerCard: {
    padding: 16,
    borderRadius: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  storeName: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  contactPerson: {
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
  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    fontSize: 12,
    fontWeight: "500",
  },
  walkInNotice: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 12,
  },
  walkInNoticeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  creditContainer: {
    marginBottom: 12,
  },
  creditLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  creditLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
  },
  invoicesCountText: {
    fontSize: 12,
  },
  cardActionsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickActionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
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
