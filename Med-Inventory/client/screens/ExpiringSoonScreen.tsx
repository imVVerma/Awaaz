import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { ExpiringBatchItem } from "@shared/types";

type ExpiryWindow = "30" | "60" | "90" | "expired";

export default function ExpiringSoonScreen() {
  const { theme } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const [selectedWindow, setSelectedWindow] =
    React.useState<ExpiryWindow>("90");

  const queryUrl =
    selectedWindow === "expired"
      ? "/api/batches/expiring?status=expired"
      : `/api/batches/expiring?days=${selectedWindow}`;

  const {
    data: batches,
    isLoading,
    refetch,
  } = useQuery<ExpiringBatchItem[]>({
    queryKey: [queryUrl],
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getBadgeStyle = (item: ExpiringBatchItem) => {
    if (item.is_expired) {
      return {
        bg: theme.dangerLight,
        text: theme.danger,
        label: `Expired (${Math.abs(item.days_until_expiry)}d ago)`,
      };
    }
    if (item.days_until_expiry <= 30) {
      return {
        bg: theme.dangerLight,
        text: theme.danger,
        label: `${item.days_until_expiry} days left`,
      };
    }
    if (item.days_until_expiry <= 60) {
      return {
        bg: theme.warningLight,
        text: theme.warning,
        label: `${item.days_until_expiry} days left`,
      };
    }
    return {
      bg: theme.infoLight,
      text: theme.info,
      label: `${item.days_until_expiry} days left`,
    };
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Expiry Window Filter Pills */}
      <View
        style={[
          styles.filterBar,
          {
            backgroundColor: theme.backgroundDefault,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable
          onPress={() => setSelectedWindow("30")}
          style={[
            styles.filterPill,
            selectedWindow === "30" && {
              backgroundColor: theme.danger,
              borderColor: theme.danger,
            },
          ]}
        >
          <ThemedText
            style={[
              styles.filterText,
              {
                color:
                  selectedWindow === "30" ? "#FFFFFF" : theme.textSecondary,
              },
            ]}
          >
            &lt; 30 Days
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => setSelectedWindow("60")}
          style={[
            styles.filterPill,
            selectedWindow === "60" && {
              backgroundColor: theme.warning,
              borderColor: theme.warning,
            },
          ]}
        >
          <ThemedText
            style={[
              styles.filterText,
              {
                color:
                  selectedWindow === "60" ? "#FFFFFF" : theme.textSecondary,
              },
            ]}
          >
            &lt; 60 Days
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => setSelectedWindow("90")}
          style={[
            styles.filterPill,
            selectedWindow === "90" && {
              backgroundColor: theme.primary,
              borderColor: theme.primary,
            },
          ]}
        >
          <ThemedText
            style={[
              styles.filterText,
              {
                color:
                  selectedWindow === "90" ? "#FFFFFF" : theme.textSecondary,
              },
            ]}
          >
            &lt; 90 Days
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => setSelectedWindow("expired")}
          style={[
            styles.filterPill,
            selectedWindow === "expired" && {
              backgroundColor: "#DC2626",
              borderColor: "#DC2626",
            },
          ]}
        >
          <ThemedText
            style={[
              styles.filterText,
              {
                color:
                  selectedWindow === "expired"
                    ? "#FFFFFF"
                    : theme.textSecondary,
              },
            ]}
          >
            Expired Lots
          </ThemedText>
        </Pressable>
      </View>

      <FlatList
        data={batches || []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const badge = getBadgeStyle(item);
          return (
            <Card style={styles.batchCard}>
              <View style={styles.batchHeader}>
                <View style={styles.batchInfo}>
                  <ThemedText style={styles.productName} numberOfLines={1}>
                    {item.product_name}
                  </ThemedText>
                  <ThemedText
                    style={[styles.companyName, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {item.company_name}
                  </ThemedText>
                </View>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <ThemedText style={[styles.badgeText, { color: badge.text }]}>
                    {badge.label}
                  </ThemedText>
                </View>
              </View>

              <View
                style={[styles.detailsRow, { borderTopColor: theme.border }]}
              >
                <View style={styles.detailCol}>
                  <ThemedText
                    style={[styles.detailLabel, { color: theme.textSecondary }]}
                  >
                    Batch Lot
                  </ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {item.batch_number}
                  </ThemedText>
                </View>

                <View style={styles.detailCol}>
                  <ThemedText
                    style={[styles.detailLabel, { color: theme.textSecondary }]}
                  >
                    Expiry Date
                  </ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {item.expiry_date}
                  </ThemedText>
                </View>

                <View style={styles.detailCol}>
                  <ThemedText
                    style={[styles.detailLabel, { color: theme.textSecondary }]}
                  >
                    Remaining Units
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.detailValue,
                      {
                        color: item.is_expired ? theme.danger : theme.text,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {item.current_quantity}
                  </ThemedText>
                </View>
              </View>
            </Card>
          );
        }}
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
              icon={selectedWindow === "expired" ? "shield" : "clock"}
              title={
                selectedWindow === "expired"
                  ? "No Expired Stock"
                  : `No Batches Expiring in < ${selectedWindow} Days`
              }
              message={
                selectedWindow === "expired"
                  ? "There are no expired medicine lots in your active inventory."
                  : "All current batches have sufficient shelf life."
              }
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
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: {
    fontSize: 12,
    fontWeight: "600",
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  batchCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  batchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  batchInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  productName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  companyName: {
    fontSize: 13,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
  detailCol: {
    alignItems: "flex-start",
  },
  detailLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
  },
});
