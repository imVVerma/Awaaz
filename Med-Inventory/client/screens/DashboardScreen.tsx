import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
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
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { DashboardStats } from "@shared/types";
import type { DashboardStackParamList } from "@/navigation/DashboardStackNavigator";

type DashboardNavProp = NativeStackNavigationProp<
  DashboardStackParamList,
  "Dashboard"
>;

interface ActivityItem {
  id: number;
  type: "order" | "purchase" | "payment";
  reference: string;
  party_name: string;
  amount: number;
  status: string;
  event_date: string;
  timestamp: string;
}

export default function DashboardScreen() {
  const { theme } = useTheme();
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
    data: activities,
    isLoading: activityLoading,
    refetch: refetchActivity,
  } = useQuery<ActivityItem[]>({
    queryKey: ["/api/dashboard/activity"],
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchActivity()]);
    setRefreshing(false);
  };

  const navigateToReceivables = () => {
    const parent = navigation.getParent();
    if (parent) {
      (parent as any).navigate("ReportsTab", { screen: "ReceivablesAging" });
    }
  };

  const navigateToCreateOrder = () => {
    const parent = navigation.getParent();
    if (parent) {
      (parent as any).navigate("SalesTab", { screen: "CreateOrder" });
    }
  };

  const navigateToCreatePurchase = () => {
    const parent = navigation.getParent();
    if (parent) {
      (parent as any).navigate("PurchasesTab", { screen: "CreatePurchase" });
    }
  };

  const navigateToAwaaz = () => {
    const parent = navigation.getParent();
    if (parent) {
      (parent as any).navigate("AwaazTab");
    }
  };

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
      {/* SECTION 1: COMPACT OPERATIONAL KPI STATUS RIBBON */}
      <View style={styles.kpiRibbon}>
        {/* KPI 1: Low Stock Indicator */}
        <Pressable
          style={[
            styles.kpiCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              borderLeftColor: theme.warning,
            },
          ]}
          onPress={() => navigation.navigate("LowStock")}
          accessibilityLabel="Low Stock Indicator"
        >
          <View style={styles.kpiHeader}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: theme.warningLight },
              ]}
            >
              <Feather name="alert-triangle" size={15} color={theme.warning} />
            </View>
            <ThemedText style={styles.kpiLabel} numberOfLines={1}>
              Low Stock
            </ThemedText>
            <Feather
              name="chevron-right"
              size={14}
              color={theme.textTertiary}
            />
          </View>
          <ThemedText style={styles.kpiValue}>
            {stats?.lowStockCount ?? 0}
          </ThemedText>
          <ThemedText
            style={[styles.kpiSubtext, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {stats?.lowStockCount === 1
              ? "1 medicine low"
              : `${stats?.lowStockCount ?? 0} below threshold`}
          </ThemedText>
        </Pressable>

        {/* KPI 2: Expiring Soon Indicator */}
        <Pressable
          style={[
            styles.kpiCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              borderLeftColor: theme.danger,
            },
          ]}
          onPress={() => navigation.navigate("ExpiringSoon")}
          accessibilityLabel="Expiring Soon Indicator"
        >
          <View style={styles.kpiHeader}>
            <View
              style={[styles.iconBadge, { backgroundColor: theme.dangerLight }]}
            >
              <Feather name="clock" size={15} color={theme.danger} />
            </View>
            <ThemedText style={styles.kpiLabel} numberOfLines={1}>
              Expiring Soon
            </ThemedText>
            <Feather
              name="chevron-right"
              size={14}
              color={theme.textTertiary}
            />
          </View>
          <ThemedText style={styles.kpiValue}>
            {stats?.expiringCount ?? 0}
          </ThemedText>
          <ThemedText
            style={[
              styles.kpiSubtext,
              {
                color:
                  (stats?.expiredCount ?? 0) > 0
                    ? theme.danger
                    : theme.textSecondary,
              },
            ]}
            numberOfLines={1}
          >
            {(stats?.expiredCount ?? 0) > 0
              ? `${stats?.expiredCount} expired lot(s)`
              : `${stats?.expiring30Count ?? 0} lots <30 days`}
          </ThemedText>
        </Pressable>

        {/* KPI 3: Total Customer Receivables */}
        <Pressable
          style={[
            styles.kpiCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              borderLeftColor: theme.primary,
            },
          ]}
          onPress={navigateToReceivables}
          accessibilityLabel="Customer Receivables Indicator"
        >
          <View style={styles.kpiHeader}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: theme.primaryLight },
              ]}
            >
              <Feather name="credit-card" size={15} color={theme.primary} />
            </View>
            <ThemedText style={styles.kpiLabel} numberOfLines={1}>
              Receivables
            </ThemedText>
            <Feather
              name="chevron-right"
              size={14}
              color={theme.textTertiary}
            />
          </View>
          <ThemedText style={styles.kpiValue}>
            ₹
            {(stats?.totalReceivables ?? 0).toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}
          </ThemedText>
          <ThemedText
            style={[
              styles.kpiSubtext,
              {
                color:
                  (stats?.overdueReceivables ?? 0) > 0
                    ? theme.danger
                    : theme.success,
              },
            ]}
            numberOfLines={1}
          >
            {(stats?.overdueReceivables ?? 0) > 0
              ? `₹${(stats?.overdueReceivables ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} overdue`
              : "All accounts current"}
          </ThemedText>
        </Pressable>
      </View>

      {/* SECTION 2: OPERATIONAL SHORTCUTS */}
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}
          onPress={navigateToCreateOrder}
        >
          <Feather name="plus-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <ThemedText style={styles.primaryActionText}>New Sales Invoice</ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.secondaryActionBtn,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
          onPress={navigateToCreatePurchase}
        >
          <Feather
            name="download"
            size={15}
            color={theme.text}
            style={{ marginRight: 6 }}
          />
          <ThemedText style={[styles.secondaryActionText, { color: theme.text }]}>
            Receive Stock
          </ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.secondaryActionBtn,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
          onPress={navigateToAwaaz}
        >
          <Feather
            name="mic"
            size={15}
            color={theme.primary}
            style={{ marginRight: 6 }}
          />
          <ThemedText style={[styles.secondaryActionText, { color: theme.text }]}>
            Ask Awaaz
          </ThemedText>
        </Pressable>
      </View>

      {/* SECTION 3: RECENT OPERATIONAL ACTIVITY */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Feather name="activity" size={18} color={theme.primary} />
            <ThemedText style={styles.sectionTitle}>
              Recent Operational Activity
            </ThemedText>
          </View>
        </View>

        {activityLoading ? (
          <ThemedText
            style={[styles.loadingText, { color: theme.textSecondary }]}
          >
            Loading recent business activity...
          </ThemedText>
        ) : activities && activities.length > 0 ? (
          <View style={styles.activityList}>
            {activities.map((act, index) => {
              const isOrder = act.type === "order";
              const isPurchase = act.type === "purchase";
              const isPayment = act.type === "payment";

              const iconName = isOrder
                ? "file-text"
                : isPurchase
                  ? "package"
                  : "check-circle";

              const iconColor = isOrder
                ? theme.primary
                : isPurchase
                  ? "#8B5CF6"
                  : theme.success;

              const iconBg = isOrder
                ? theme.primaryLight
                : isPurchase
                  ? "#EDE9FE"
                  : theme.badgeSuccessBg;

              const title = isOrder
                ? `Invoice ${act.reference}`
                : isPurchase
                  ? `Stock Received: ${act.reference}`
                  : `Payment: ${act.reference}`;

              const typeBadge = isOrder
                ? "Sales"
                : isPurchase
                  ? "Purchase"
                  : "Collection";

              return (
                <Card
                  key={`${act.type}-${act.id}-${index}`}
                  style={styles.activityCard}
                >
                  <View style={styles.activityItem}>
                    <View
                      style={[
                        styles.activityIconBox,
                        { backgroundColor: iconBg },
                      ]}
                    >
                      <Feather name={iconName} size={16} color={iconColor} />
                    </View>

                    <View style={styles.activityMeta}>
                      <View style={styles.activityTitleRow}>
                        <ThemedText style={styles.activityTitle} numberOfLines={1}>
                          {title}
                        </ThemedText>
                        <View
                          style={[
                            styles.activityBadge,
                            { backgroundColor: theme.backgroundSecondary },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.activityBadgeText,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {typeBadge}
                          </ThemedText>
                        </View>
                      </View>

                      <ThemedText
                        style={[
                          styles.activitySubtitle,
                          { color: theme.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {act.party_name} • {act.event_date ? act.event_date.split("T")[0] : ""}
                      </ThemedText>
                    </View>

                    <View style={styles.activityAmountContainer}>
                      <ThemedText
                        style={[
                          styles.activityAmount,
                          {
                            color: isPayment
                              ? theme.success
                              : theme.text,
                          },
                        ]}
                      >
                        {isPayment ? "+" : ""}₹
                        {Number(act.amount).toLocaleString("en-IN", {
                          maximumFractionDigits: 0,
                        })}
                      </ThemedText>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        ) : (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <Feather name="inbox" size={30} color={theme.textTertiary} />
            <ThemedText style={styles.emptyTitle}>
              No Recent Activity
            </ThemedText>
            <ThemedText
              style={[styles.emptySubtitle, { color: theme.textSecondary }]}
            >
              Transactions, stock arrivals, and customer payments will automatically appear here as they occur.
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
    gap: Spacing.lg,
  },
  kpiRibbon: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  kpiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  kpiSubtext: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  activityList: {
    gap: Spacing.sm,
  },
  activityCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  activityIconBox: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  activityMeta: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  activityTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  activityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  activityBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  activitySubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  activityAmountContainer: {
    alignItems: "flex-end",
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 18,
  },
  loadingText: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: Spacing.md,
  },
});
