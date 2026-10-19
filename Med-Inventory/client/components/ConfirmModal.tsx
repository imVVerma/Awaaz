import React from "react";
import { View, StyleSheet, Modal, Pressable } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmModalProps) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <View
          style={[styles.content, { backgroundColor: theme.backgroundDefault }]}
          onStartShouldSetResponder={() => true}
        >
          <ThemedText style={[styles.title, { color: theme.text }]}>
            {title}
          </ThemedText>
          <ThemedText style={[styles.message, { color: theme.textSecondary }]}>
            {message}
          </ThemedText>
          <View style={styles.actions}>
            <PrimaryButton
              title={cancelText}
              variant="secondary"
              onPress={onCancel}
              style={styles.button}
              disabled={loading}
            />
            <PrimaryButton
              title={confirmText}
              variant={confirmVariant}
              onPress={onConfirm}
              style={styles.button}
              loading={loading}
            />
          </View>
        </View>
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
    paddingHorizontal: Spacing.xl,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
    ...Shadows.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  message: {
    fontSize: 14,
    marginBottom: Spacing["2xl"],
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  button: {
    flex: 1,
  },
});
