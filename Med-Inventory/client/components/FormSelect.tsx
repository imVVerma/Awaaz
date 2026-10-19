import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SelectOption {
  label: string;
  value: string | number;
}

interface FormSelectProps {
  label: string;
  placeholder?: string;
  value: string | number | null;
  options: SelectOption[];
  onChange: (value: string | number) => void;
  error?: string;
  required?: boolean;
}

export function FormSelect({
  label,
  placeholder = "Select an option",
  value,
  options,
  onChange,
  error,
  required,
}: FormSelectProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

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

      <Pressable
        style={[
          styles.select,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: error ? theme.danger : theme.border,
          },
        ]}
        onPress={() => setIsOpen(true)}
      >
        <ThemedText
          style={[
            styles.selectText,
            { color: selectedOption ? theme.text : theme.textSecondary },
          ]}
          numberOfLines={1}
        >
          {selectedOption?.label || placeholder}
        </ThemedText>
        <Feather name="chevron-down" size={20} color={theme.textSecondary} />
      </Pressable>

      {error && (
        <ThemedText style={[styles.error, { color: theme.danger }]}>
          {error}
        </ThemedText>
      )}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setIsOpen(false)}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.backgroundDefault,
                marginTop: insets.top + 100,
                marginBottom: insets.bottom + 100,
              },
            ]}
          >
            <View
              style={[styles.modalHeader, { borderBottomColor: theme.border }]}
            >
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                {label}
              </ThemedText>
              <Pressable onPress={() => setIsOpen(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor:
                        item.value === value
                          ? theme.primaryLight
                          : pressed
                            ? theme.backgroundSecondary
                            : "transparent",
                    },
                  ]}
                  onPress={() => {
                    onChange(item.value);
                    setIsOpen(false);
                  }}
                >
                  <ThemedText
                    style={[
                      styles.optionText,
                      {
                        color:
                          item.value === value ? theme.primary : theme.text,
                        fontWeight: item.value === value ? "600" : "400",
                      },
                    ]}
                  >
                    {item.label}
                  </ThemedText>
                  {item.value === value && (
                    <Feather name="check" size={20} color={theme.primary} />
                  )}
                </Pressable>
              )}
              contentContainerStyle={styles.optionsList}
            />
          </View>
        </Pressable>
      </Modal>
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
  select: {
    height: 44,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    fontSize: 14,
    flex: 1,
    marginRight: Spacing.sm,
  },
  error: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  modalContent: {
    borderRadius: BorderRadius.lg,
    maxHeight: 400,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  optionsList: {
    paddingVertical: Spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  optionText: {
    fontSize: 16,
    flex: 1,
  },
});
