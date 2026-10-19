import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { Purchase } from "@shared/types";
import type { PurchasesStackParamList } from "@/navigation/PurchasesStackNavigator";

type PurchaseDetailRouteProp = RouteProp<
  PurchasesStackParamList,
  "PurchaseDetail"
>;

export default function PurchaseDetailScreen() {
  const { theme } = useTheme();
  const route = useRoute<PurchaseDetailRouteProp>();
  const tabBarHeight = useBottomTabBarHeight();
  const { purchaseId } = route.params;

  const { data: purchase, isLoading } = useQuery<Purchase>({
    queryKey: [`/api/purchases/${purchaseId}`],
  });

  if (isLoading || !purchase) {
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
        <ThemedText style={{ color: theme.textSecondary }}>
          Loading purchase details...
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabBarHeight + Spacing.xl },
      ]}
    >
      {/* Header Info */}
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <ThemedText style={styles.title}>
              {purchase.purchase_invoice_number}
            </ThemedText>
            <ThemedText
              style={[styles.subtitle, { color: theme.textSecondary }]}
            >
              Inbound Supplier Invoice
            </ThemedText>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: theme.primaryLight },
            ]}
          >
            <ThemedText style={[styles.statusText, { color: theme.primary }]}>
              {purchase.payment_status.toUpperCase()}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.infoGrid, { borderTopColor: theme.border }]}>
          <View style={styles.infoCol}>
            <ThemedText
              style={[styles.infoLabel, { color: theme.textSecondary }]}
            >
              Supplier
            </ThemedText>
            <ThemedText style={styles.infoValue}>
              {purchase.supplier_name}
            </ThemedText>
            {purchase.supplier_phone && (
              <ThemedText
                style={[styles.infoSubtext, { color: theme.textSecondary }]}
              >
                {purchase.supplier_phone}
              </ThemedText>
            )}
          </View>

          <View style={styles.infoCol}>
            <ThemedText
              style={[styles.infoLabel, { color: theme.textSecondary }]}
            >
              Invoice Date
            </ThemedText>
            <ThemedText style={styles.infoValue}>
              {purchase.invoice_date.split("T")[0]}
            </ThemedText>
            {purchase.due_date && (
              <ThemedText
                style={[styles.infoSubtext, { color: theme.textSecondary }]}
              >
                Due: {purchase.due_date.split("T")[0]}
              </ThemedText>
            )}
          </View>
        </View>

        {purchase.notes && (
          <View
            style={[
              styles.notesBox,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <Feather name="file-text" size={14} color={theme.textSecondary} />
            <ThemedText
              style={[styles.notesText, { color: theme.textSecondary }]}
            >
              {purchase.notes}
            </ThemedText>
          </View>
        )}
      </Card>

      {/* Line Items */}
      <Card style={styles.card}>
        <ThemedText style={styles.sectionTitle}>
          Received Medicine Batches ({purchase.items?.length || 0})
        </ThemedText>

        <View style={styles.itemsList}>
          {purchase.items?.map((item, idx) => (
            <View
              key={item.id || idx}
              style={[
                styles.itemRow,
                { borderBottomColor: theme.border },
                idx === (purchase.items?.length || 1) - 1 && {
                  borderBottomWidth: 0,
                },
              ]}
            >
              <View style={styles.itemMain}>
                <ThemedText style={styles.itemName}>
                  {item.product_name}
                </ThemedText>
                <ThemedText
                  style={[styles.itemMeta, { color: theme.textSecondary }]}
                >
                  Mfg: {item.company_name} • Lot: {item.batch_number} • Exp:{" "}
                  {item.expiry_date}
                </ThemedText>
                <ThemedText
                  style={[styles.itemSub, { color: theme.textSecondary }]}
                >
                  MRP: ₹{item.mrp} • Sell: ₹{item.selling_price} • Tax:{" "}
                  {item.tax_rate}%
                </ThemedText>
              </View>

              <View style={styles.itemCostCol}>
                <ThemedText style={styles.itemQty}>
                  {item.quantity} × ₹{item.purchase_price}
                </ThemedText>
                <ThemedText style={styles.itemTotal}>
                  ₹{item.line_total.toFixed(2)}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      </Card>

      {/* Invoice Totals Reconciled */}
      <Card style={styles.card}>
        <ThemedText style={styles.sectionTitle}>Invoice Valuation</ThemedText>
        <View style={styles.calcRow}>
          <ThemedText style={{ color: theme.textSecondary }}>
            Taxable Value:
          </ThemedText>
          <ThemedText style={styles.calcVal}>
            ₹{purchase.subtotal.toFixed(2)}
          </ThemedText>
        </View>
        <View style={styles.calcRow}>
          <ThemedText style={{ color: theme.textSecondary }}>
            GST Amount:
          </ThemedText>
          <ThemedText style={styles.calcVal}>
            ₹{purchase.tax_amount.toFixed(2)}
          </ThemedText>
        </View>
        <View
          style={[
            styles.calcRow,
            styles.grandRow,
            { borderTopColor: theme.border },
          ]}
        >
          <ThemedText style={styles.grandLabel}>
            Total Inbound Invoice:
          </ThemedText>
          <ThemedText style={[styles.grandVal, { color: theme.primary }]}>
            ₹{purchase.total_amount.toFixed(2)}
          </ThemedText>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  infoGrid: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  infoSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  notesBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  notesText: {
    fontSize: 12,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  itemsList: {
    gap: Spacing.xs,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  itemMain: {
    flex: 1,
    marginRight: Spacing.md,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "700",
  },
  itemMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  itemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  itemCostCol: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  itemQty: {
    fontSize: 12,
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  calcVal: {
    fontSize: 14,
    fontWeight: "600",
  },
  grandRow: {
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  grandLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  grandVal: {
    fontSize: 18,
    fontWeight: "800",
  },
});
