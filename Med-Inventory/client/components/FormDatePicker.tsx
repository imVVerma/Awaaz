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
  const { theme, isDark } = useTheme();
  const webDateInputRef = React.useRef<HTMLInputElement | null>(null);

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr || dateStr.length < 10) return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        }
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const handleTextChange = (text: string) => {
    // Allow clean backspacing and numeric/dash input without forced hyphens locking up edits
    const cleaned = text.replace(/[^0-9-]/g, "");
    onChange(cleaned);
  };

  const handleClear = () => {
    onChange("");
  };

  const openWebCalendar = () => {
    if (Platform.OS === "web" && webDateInputRef.current) {
      if (typeof webDateInputRef.current.showPicker === "function") {
        webDateInputRef.current.showPicker();
      } else {
        webDateInputRef.current.focus();
      }
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
        {Platform.OS === "web" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              position: "relative",
            }}
          >
            <input
              ref={webDateInputRef}
              type="date"
              value={value || ""}
              min={minDate}
              onChange={(e) => onChange(e.target.value)}
              style={{
                width: "100%",
                height: 44,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: error ? theme.danger : theme.border,
                borderRadius: BorderRadius.sm,
                paddingLeft: 12,
                paddingRight: 40,
                fontSize: 14,
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                colorScheme: isDark ? "dark" : "light",
                outline: "none",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            />
            {value ? (
              <button
                type="button"
                onClick={handleClear}
                title="Clear date"
                style={{
                  position: "absolute",
                  right: 32,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: theme.textSecondary,
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                ✕
              </button>
            ) : null}
          </div>
        ) : (
          <View style={styles.nativeInputRow}>
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
              onChangeText={handleTextChange}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            {value ? (
              <Pressable
                onPress={handleClear}
                style={styles.clearBtn}
                hitSlop={8}
                accessibilityLabel="Clear date"
              >
                <Feather name="x" size={16} color={theme.textSecondary} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={openWebCalendar}
              style={styles.iconContainer}
              accessibilityLabel="Open calendar picker"
            >
              <Feather name="calendar" size={18} color={theme.primary} />
            </Pressable>
          </View>
        )}
      </View>

      {error ? (
        <ThemedText style={[styles.error, { color: theme.danger }]}>
          {error}
        </ThemedText>
      ) : null}

      {value && !error ? (
        <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
          Selected: {formatDisplayDate(value)}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  labelRow: {
    flexDirection: "row",
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  inputWrapper: {
    position: "relative",
    width: "100%",
  },
  nativeInputRow: {
    position: "relative",
    width: "100%",
    justifyContent: "center",
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingRight: 64,
    fontSize: 14,
  },
  clearBtn: {
    position: "absolute",
    right: 36,
    top: 14,
  },
  iconContainer: {
    position: "absolute",
    right: Spacing.md,
    top: 13,
    cursor: "pointer" as any,
  },
  error: {
    fontSize: 12,
    marginTop: Spacing.xs,
    fontWeight: "500",
  },
  hint: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
});
