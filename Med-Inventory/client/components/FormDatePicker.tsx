import React from "react";
import { View, StyleSheet, Pressable, TextInput, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface FormDatePickerProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  error?: string;
  required?: boolean;
  minDate?: string;
}

export function FormDatePicker({
  label,
  value,
  onChange,
  error,
  required,
  minDate,
}: FormDatePickerProps) {
  const { theme } = useTheme();

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const handleChange = (text: string) => {
    const cleaned = text.replace(/[^0-9-]/g, "");

    if (cleaned.length <= 10) {
      let formatted = cleaned;
      if (cleaned.length >= 4 && cleaned[4] !== "-") {
        formatted = cleaned.slice(0, 4) + "-" + cleaned.slice(4);
      }
      if (cleaned.length >= 7 && cleaned[7] !== "-") {
        formatted = formatted.slice(0, 7) + "-" + formatted.slice(7);
      }
      onChange(formatted);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <ThemedText style={[styles.label, { color: theme.text }]}>
          {label}
        </ThemedText>
        {required ? (
          <ThemedText style={[styles.label, { color: theme.danger }]}>
            {" "}
            *
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: error ? theme.danger : theme.border,
              color: theme.text,
            },
          ]}
          value={value}
          onChangeText={handleChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.textSecondary}
          keyboardType="numeric"
          maxLength={10}
        />
        <View style={styles.iconContainer}>
          <Feather name="calendar" size={18} color={theme.textSecondary} />
        </View>
      </View>

      {error && (
        <ThemedText style={[styles.error, { color: theme.danger }]}>
          {error}
        </ThemedText>
      )}

      {value && !error && (
        <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
          {formatDisplayDate(value)}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  labelRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
  inputWrapper: {
    position: "relative",
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingRight: 44,
    fontSize: 14,
  },
  iconContainer: {
    position: "absolute",
    right: Spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  error: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  hint: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
});
