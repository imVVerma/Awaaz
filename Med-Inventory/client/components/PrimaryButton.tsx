import React from "react";
import {
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  title,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  style,
}: PrimaryButtonProps) {
  const { theme } = useTheme();

  const getColors = () => {
    switch (variant) {
      case "danger":
        return { bg: theme.danger, text: "#FFFFFF" };
      case "secondary":
        return { bg: theme.backgroundSecondary, text: theme.text };
      default:
        return { bg: theme.primary, text: "#FFFFFF" };
    }
  };

  const colors = getColors();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.bg,
          opacity: pressed || disabled || loading ? 0.7 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <>
          {icon && (
            <Feather
              name={icon}
              size={18}
              color={colors.text}
              style={styles.icon}
            />
          )}
          <ThemedText style={[styles.text, { color: colors.text }]}>
            {title}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 44,
    borderRadius: BorderRadius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  text: {
    fontSize: 15,
    fontWeight: "600",
  },
});
