import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows, Colors } from "@/constants/theme";
import type { ProductWithCompany } from "@shared/types";

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

  const isLowStock = product.stock_quantity <= product.minimum_stock_level;
  const isCriticalStock = product.stock_quantity === 0;

  const expiryDate = new Date(product.expiry_date);
  const today = new Date();
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
  const isExpiringSoon = expiryDate <= threeMonthsFromNow && expiryDate > today;
  const isExpired = expiryDate <= today;

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
          opacity: pressed && onPress ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.mainInfo}>
          <ThemedText
            style={[styles.productName, { color: theme.text }]}
            numberOfLines={1}
          >
            {product.product_name}
          </ThemedText>
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
              Batch:
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
                  Out of Stock
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
                  Low Stock: {product.stock_quantity}
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
                  Stock: {product.stock_quantity}
                </ThemedText>
              </View>
            )}

            {isExpired ? (
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
                  Expired
                </ThemedText>
              </View>
            ) : isExpiringSoon ? (
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
                  Exp: {formatDate(product.expiry_date)}
                </ThemedText>
              </View>
            ) : null}
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
                >
                  <Feather name="refresh-cw" size={18} color={theme.info} />
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
                >
                  <Feather name="edit-2" size={18} color={theme.primary} />
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
                >
                  <Feather name="trash-2" size={18} color={theme.danger} />
                </Pressable>
              )}
            </View>
          )}
        </View>
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
  productName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
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
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginLeft: Spacing.md,
  },
  actionButton: {
    padding: Spacing.xs,
  },
});
