import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  onPress?: () => void;
}

export function StatCard({
  title,
  value,
  icon,
  color,
  onPress,
}: StatCardProps) {
  const { theme } = useTheme();

  const content = (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: color + "20" }]}>
          <Feather name={icon} size={20} color={color} />
        </View>
      </View>
      <ThemedText style={[styles.value, { color: theme.text }]}>
        {value}
      </ThemedText>
      <ThemedText style={[styles.title, { color: theme.textSecondary }]}>
        {title}
      </ThemedText>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    minHeight: 120,
    ...Shadows.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  value: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: 14,
  },
});
