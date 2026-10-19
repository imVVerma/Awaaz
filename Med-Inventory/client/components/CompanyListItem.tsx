import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import type { Company } from "@shared/types";

interface CompanyListItemProps {
  company: Company;
  productCount?: number;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function CompanyListItem({
  company,
  productCount = 0,
  onPress,
  onEdit,
  onDelete,
}: CompanyListItemProps) {
  const { theme } = useTheme();

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
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: theme.primaryLight },
          ]}
        >
          <Feather name="briefcase" size={20} color={theme.primary} />
        </View>

        <View style={styles.info}>
          <ThemedText
            style={[styles.name, { color: theme.text }]}
            numberOfLines={1}
          >
            {company.name}
          </ThemedText>
          {company.contact_info && (
            <ThemedText
              style={[styles.contact, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {company.contact_info}
            </ThemedText>
          )}
          <ThemedText
            style={[styles.productCount, { color: theme.textSecondary }]}
          >
            {productCount} {productCount === 1 ? "product" : "products"}
          </ThemedText>
        </View>

        <View style={styles.actions}>
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
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  contact: {
    fontSize: 13,
    marginBottom: 2,
  },
  productCount: {
    fontSize: 12,
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
