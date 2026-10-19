import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows, Colors } from "@/constants/theme";
import type { ProductWithCompany, ProductBatch } from "@shared/types";

interface ProductListItemProps {
  product: ProductWithCompany;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUpdateStock?: () => void;
  showActions?: boolean;
}

export function ProductListItem({
  product,
  onPress,
  onEdit,
  onDelete,
  onUpdateStock,
  showActions = true,
}: ProductListItemProps) {
  const { theme, isDark } = useTheme();
  const [showBatches, setShowBatches] = React.useState(false);

  const todayStr = React.useMemo(
    () => new Date().toISOString().split("T")[0],
    [],
  );
  const threeMonthsStr = React.useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split("T")[0];
  }, []);

  const batches: ProductBatch[] = React.useMemo(
    () => product.batches || [],
    [product.batches],
  );

  // Calculate sellable vs expired stock quantities
  const { sellableStock, expiredStock } = React.useMemo(() => {
    if (batches.length > 0) {
      let sellable = 0;
      let expired = 0;
      for (const b of batches) {
        if (b.expiry_date <= todayStr) {
          expired += b.current_quantity;
        } else {
          sellable += b.current_quantity;
        }
      }
      return { sellableStock: sellable, expiredStock: expired };
    }
    const isSingleExpired = product.expiry_date <= todayStr;
    return {
      sellableStock: isSingleExpired ? 0 : product.stock_quantity,
      expiredStock: isSingleExpired ? product.stock_quantity : 0,
    };
  }, [batches, product.expiry_date, product.stock_quantity, todayStr]);

  const isCriticalStock = sellableStock === 0;
  const isLowStock =
    !isCriticalStock && sellableStock <= product.minimum_stock_level;

  const hasExpiringBatches = React.useMemo(() => {
    if (batches.length > 0) {
      return batches.some(
        (b) =>
          b.expiry_date > todayStr &&
          b.expiry_date <= threeMonthsStr &&
          b.current_quantity > 0,
      );
    }
    return (
      product.expiry_date > todayStr && product.expiry_date <= threeMonthsStr
    );
  }, [batches, product.expiry_date, todayStr, threeMonthsStr]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: theme.border,
          borderWidth: 1,
          opacity: pressed && onPress ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.mainInfo}>
          <View style={styles.nameHeaderRow}>
            <ThemedText
              style={[styles.productName, { color: theme.text }]}
              numberOfLines={1}
            >
              {product.product_name}
            </ThemedText>

            {product.sku && (
              <View
                style={[
                  styles.skuBadge,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <ThemedText
                  style={{
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: theme.textSecondary,
                  }}
                >
                  {product.sku}
                </ThemedText>
              </View>
            )}
          </View>

          <ThemedText
            style={[styles.companyName, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {product.company_name}
          </ThemedText>

          {product.composition && (
            <ThemedText
              style={[styles.composition, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {product.composition}
            </ThemedText>
          )}
        </View>

        <View style={styles.metaInfo}>
          <View style={styles.metaRow}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              Latest Lot:
            </ThemedText>
            <ThemedText style={[styles.batchNumber, { color: theme.text }]}>
              {product.batch_number}
            </ThemedText>
          </View>

          <View style={styles.metaRow}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              MRP:
            </ThemedText>
            <ThemedText style={[styles.price, { color: theme.text }]}>
              {formatCurrency(product.mrp)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.badges}>
            {/* Stock Level Badge */}
            {isCriticalStock ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isDark
                      ? Colors.dark.dangerLight
                      : Colors.light.dangerLight,
                  },
                ]}
              >
                <ThemedText style={[styles.badgeText, { color: theme.danger }]}>
                  Out of Sellable Stock
                </ThemedText>
              </View>
            ) : isLowStock ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isDark
                      ? Colors.dark.warningLight
                      : Colors.light.warningLight,
                  },
                ]}
              >
                <ThemedText
                  style={[styles.badgeText, { color: theme.warning }]}
                >
                  Low Stock: {sellableStock} units
                </ThemedText>
              </View>
            ) : (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isDark
                      ? Colors.dark.successLight
                      : Colors.light.successLight,
                  },
                ]}
              >
                <ThemedText
                  style={[styles.badgeText, { color: theme.success }]}
                >
                  Sellable: {sellableStock} units
                </ThemedText>
              </View>
            )}

            {/* Expired Stock Isolation Badge */}
            {expiredStock > 0 && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isDark
                      ? Colors.dark.dangerLight
                      : Colors.light.dangerLight,
                  },
                ]}
              >
                <ThemedText style={[styles.badgeText, { color: theme.danger }]}>
                  Expired: {expiredStock}
                </ThemedText>
              </View>
            )}

            {/* Near Expiry Alert Badge */}
            {hasExpiringBatches && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isDark
                      ? Colors.dark.warningLight
                      : Colors.light.warningLight,
                  },
                ]}
              >
                <ThemedText
                  style={[styles.badgeText, { color: theme.warning }]}
                >
                  Expiring Soon
                </ThemedText>
              </View>
            )}

            {/* Batch Count / Expansion Pill */}
            {batches.length > 0 && (
              <Pressable
                onPress={() => setShowBatches(!showBatches)}
                style={[
                  styles.batchTogglePill,
                  {
                    backgroundColor: showBatches
                      ? theme.primaryLight
                      : theme.backgroundSecondary,
                    borderColor: showBatches ? theme.primary : theme.border,
                  },
                ]}
              >
                <Feather
                  name="layers"
                  size={12}
                  color={showBatches ? theme.primary : theme.textSecondary}
                />
                <ThemedText
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    marginLeft: 4,
                    color: showBatches ? theme.primary : theme.textSecondary,
                  }}
                >
                  {batches.length} {batches.length === 1 ? "Batch" : "Batches"}
                </ThemedText>
                <Feather
                  name={showBatches ? "chevron-up" : "chevron-down"}
                  size={12}
                  color={showBatches ? theme.primary : theme.textSecondary}
                  style={{ marginLeft: 2 }}
                />
              </Pressable>
            )}
          </View>

          {showActions && (
            <View style={styles.actions}>
              {onUpdateStock && (
                <Pressable
                  onPress={onUpdateStock}
                  style={({ pressed }) => [
                    styles.actionButton,
                    { opacity: pressed ? 0.5 : 1 },
                  ]}
                  hitSlop={8}
                  accessibilityLabel="Adjust Stock"
                >
                  <Feather name="refresh-cw" size={17} color={theme.info} />
                </Pressable>
              )}
              {onEdit && (
                <Pressable
                  onPress={onEdit}
                  style={({ pressed }) => [
                    styles.actionButton,
                    { opacity: pressed ? 0.5 : 1 },
                  ]}
                  hitSlop={8}
                  accessibilityLabel="Edit Product"
                >
                  <Feather name="edit-2" size={17} color={theme.primary} />
                </Pressable>
              )}
              {onDelete && (
                <Pressable
                  onPress={onDelete}
                  style={({ pressed }) => [
                    styles.actionButton,
                    { opacity: pressed ? 0.5 : 1 },
                  ]}
                  hitSlop={8}
                  accessibilityLabel="Delete Product"
                >
                  <Feather name="trash-2" size={17} color={theme.danger} />
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Expandable Batch-Level Disclosures */}
        {showBatches && batches.length > 0 && (
          <View
            style={[
              styles.batchesExpandedContainer,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
              },
            ]}
          >
            <ThemedText
              style={{
                fontSize: 12,
                fontWeight: "700",
                textTransform: "uppercase",
                color: theme.textSecondary,
                marginBottom: Spacing.xs,
              }}
            >
              Physical Lots & Batches Breakdown:
            </ThemedText>

            {batches.map((b) => {
              const isLotExpired = b.expiry_date <= todayStr;
              const isLotNearExpiry =
                !isLotExpired && b.expiry_date <= threeMonthsStr;

              return (
                <View
                  key={b.id}
                  style={[
                    styles.batchDetailRow,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: isLotExpired
                        ? theme.danger
                        : isLotNearExpiry
                          ? theme.warning
                          : theme.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <ThemedText
                        style={{
                          fontSize: 13,
                          fontFamily: "monospace",
                          fontWeight: "700",
                          color: theme.text,
                        }}
                      >
                        {b.batch_number}
                      </ThemedText>
                      {isLotExpired ? (
                        <View
                          style={[
                            styles.miniBadge,
                            {
                              backgroundColor: isDark
                                ? Colors.dark.dangerLight
                                : Colors.light.dangerLight,
                            },
                          ]}
                        >
                          <ThemedText
                            style={{
                              fontSize: 10,
                              color: theme.danger,
                              fontWeight: "700",
                            }}
                          >
                            EXPIRED
                          </ThemedText>
                        </View>
                      ) : isLotNearExpiry ? (
                        <View
                          style={[
                            styles.miniBadge,
                            {
                              backgroundColor: isDark
                                ? Colors.dark.warningLight
                                : Colors.light.warningLight,
                            },
                          ]}
                        >
                          <ThemedText
                            style={{
                              fontSize: 10,
                              color: theme.warning,
                              fontWeight: "700",
                            }}
                          >
                            EXP SOON
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>

                    <ThemedText
                      style={{
                        fontSize: 12,
                        color: theme.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      Exp: {formatDate(b.expiry_date)} • Cost: ₹
                      {b.purchase_price} • Sale: ₹{b.selling_price}
                    </ThemedText>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <ThemedText
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: isLotExpired ? theme.textSecondary : theme.text,
                      }}
                    >
                      {b.current_quantity} units
                    </ThemedText>
                    <ThemedText
                      style={{ fontSize: 11, color: theme.textSecondary }}
                    >
                      MRP: ₹{b.mrp}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  content: {
    padding: Spacing.lg,
  },
  mainInfo: {
    marginBottom: Spacing.md,
  },
  nameHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  skuBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginLeft: 8,
  },
  companyName: {
    fontSize: 13,
    marginBottom: 2,
  },
  composition: {
    fontSize: 12,
    fontStyle: "italic",
  },
  metaInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    fontSize: 12,
    marginRight: Spacing.xs,
  },
  batchNumber: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  price: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    flex: 1,
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  batchTogglePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginLeft: Spacing.md,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  batchesExpandedContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  batchDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  miniBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 6,
  },
});
