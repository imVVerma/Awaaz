import React from "react";
import { View, StyleSheet, Modal, Pressable, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { ProductWithCompany } from "@shared/types";

interface StockUpdateModalProps {
  visible: boolean;
  product: ProductWithCompany | null;
  onClose: () => void;
  onUpdate: (
    productId: number,
    quantity: number,
    type: "add" | "remove",
  ) => void;
  loading?: boolean;
}

export function StockUpdateModal({
  visible,
  product,
  onClose,
  onUpdate,
  loading = false,
}: StockUpdateModalProps) {
  const { theme } = useTheme();
  const [quantity, setQuantity] = React.useState("1");
  const [updateType, setUpdateType] = React.useState<"add" | "remove">("add");

  React.useEffect(() => {
    if (visible) {
      setQuantity("1");
      setUpdateType("add");
    }
  }, [visible]);

  const handleUpdate = () => {
    const qty = parseInt(quantity, 10);
    if (product && qty > 0) {
      onUpdate(product.id, qty, updateType);
    }
  };

  const incrementQuantity = () => {
    const current = parseInt(quantity, 10) || 0;
    setQuantity(String(current + 1));
  };

  const decrementQuantity = () => {
    const current = parseInt(quantity, 10) || 0;
    if (current > 1) {
      setQuantity(String(current - 1));
    }
  };

  const currentStock = product?.stock_quantity ?? 0;
  const qty = parseInt(quantity, 10) || 0;
  const newStock =
    updateType === "add" ? currentStock + qty : Math.max(0, currentStock - qty);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.modal, { backgroundColor: theme.backgroundDefault }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              Update Stock
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          {product && (
            <>
              <ThemedText style={[styles.productName, { color: theme.text }]}>
                {product.product_name}
              </ThemedText>
              <ThemedText
                style={[styles.currentStock, { color: theme.textSecondary }]}
              >
                Current Stock: {currentStock}
              </ThemedText>

              <View style={styles.typeSelector}>
                <Pressable
                  style={[
                    styles.typeButton,
                    {
                      backgroundColor:
                        updateType === "add"
                          ? theme.primary
                          : theme.backgroundSecondary,
                      borderColor:
                        updateType === "add" ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setUpdateType("add")}
                >
                  <Feather
                    name="plus"
                    size={18}
                    color={updateType === "add" ? "#fff" : theme.text}
                  />
                  <ThemedText
                    style={[
                      styles.typeButtonText,
                      { color: updateType === "add" ? "#fff" : theme.text },
                    ]}
                  >
                    Add Stock
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.typeButton,
                    {
                      backgroundColor:
                        updateType === "remove"
                          ? theme.danger
                          : theme.backgroundSecondary,
                      borderColor:
                        updateType === "remove" ? theme.danger : theme.border,
                    },
                  ]}
                  onPress={() => setUpdateType("remove")}
                >
                  <Feather
                    name="minus"
                    size={18}
                    color={updateType === "remove" ? "#fff" : theme.text}
                  />
                  <ThemedText
                    style={[
                      styles.typeButtonText,
                      { color: updateType === "remove" ? "#fff" : theme.text },
                    ]}
                  >
                    Remove Stock
                  </ThemedText>
                </Pressable>
              </View>

              <View style={styles.quantityContainer}>
                <ThemedText
                  style={[styles.label, { color: theme.textSecondary }]}
                >
                  Quantity
                </ThemedText>
                <View style={styles.quantityRow}>
                  <Pressable
                    style={[
                      styles.quantityButton,
                      { backgroundColor: theme.backgroundSecondary },
                    ]}
                    onPress={decrementQuantity}
                  >
                    <Feather name="minus" size={20} color={theme.text} />
                  </Pressable>
                  <TextInput
                    style={[
                      styles.quantityInput,
                      {
                        color: theme.text,
                        backgroundColor: theme.backgroundSecondary,
                        borderColor: theme.border,
                      },
                    ]}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                  <Pressable
                    style={[
                      styles.quantityButton,
                      { backgroundColor: theme.backgroundSecondary },
                    ]}
                    onPress={incrementQuantity}
                  >
                    <Feather name="plus" size={20} color={theme.text} />
                  </Pressable>
                </View>
              </View>

              <View
                style={[
                  styles.preview,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <ThemedText
                  style={[styles.previewLabel, { color: theme.textSecondary }]}
                >
                  New Stock Level
                </ThemedText>
                <ThemedText
                  style={[styles.previewValue, { color: theme.text }]}
                >
                  {newStock}
                </ThemedText>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={[styles.cancelButton, { borderColor: theme.border }]}
                  onPress={onClose}
                >
                  <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title={loading ? "Updating..." : "Update Stock"}
                    onPress={handleUpdate}
                    disabled={loading || qty <= 0}
                  />
                </View>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  productName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  currentStock: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  typeSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  quantityContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityInput: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 18,
    fontWeight: "600",
  },
  preview: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  previewLabel: {
    fontSize: 12,
    marginBottom: Spacing.xs,
  },
  previewValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  cancelButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
