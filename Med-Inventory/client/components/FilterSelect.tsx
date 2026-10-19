import React from "react";
import { View, StyleSheet, Pressable, Modal, FlatList } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FilterOption {
  label: string;
  value: string | number;
}

interface FilterSelectProps {
  value: string | number;
  options: FilterOption[];
  onChange: (value: string | number) => void;
  placeholder?: string;
}

export function FilterSelect({
  value,
  options,
  onChange,
  placeholder = "Filter",
}: FilterSelectProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedOption = options.find((opt) => opt.value === value);
  const isFiltered = value !== "all";

  return (
    <>
      <Pressable
        style={[
          styles.button,
          {
            backgroundColor: isFiltered
              ? theme.primaryLight
              : theme.backgroundDefault,
            borderColor: isFiltered ? theme.primary : theme.border,
          },
        ]}
        onPress={() => setIsOpen(true)}
      >
        <Feather
          name="filter"
          size={16}
          color={isFiltered ? theme.primary : theme.textSecondary}
        />
        <ThemedText
          style={[
            styles.buttonText,
            { color: isFiltered ? theme.primary : theme.textSecondary },
          ]}
          numberOfLines={1}
        >
          {selectedOption?.label || placeholder}
        </ThemedText>
        <Feather
          name="chevron-down"
          size={16}
          color={isFiltered ? theme.primary : theme.textSecondary}
        />
      </Pressable>

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
                Filter by Company
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
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  buttonText: {
    fontSize: 14,
    maxWidth: 100,
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
