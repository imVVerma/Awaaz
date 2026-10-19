import React from "react";
import { View, StyleSheet, Alert } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { FormInput } from "@/components/FormInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { apiRequest, queryClient } from "@/lib/query-client";
import type { CreateCompanyInput } from "@shared/types";

export default function AddCompanyScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const tabBarHeight = useBottomTabBarHeight();

  const [name, setName] = React.useState("");
  const [contactInfo, setContactInfo] = React.useState("");
  const [errors, setErrors] = React.useState<{ name?: string }>({});

  const mutation = useMutation({
    mutationFn: async (data: CreateCompanyInput) => {
      const res = await apiRequest("POST", "/api/companies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      navigation.goBack();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to create company");
    },
  });

  const validate = () => {
    const newErrors: { name?: string } = {};

    if (!name.trim()) {
      newErrors.name = "Company name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    mutation.mutate({
      name: name.trim(),
      contact_info: contactInfo.trim() || undefined,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + Spacing["2xl"] },
        ]}
      >
        <FormInput
          label="Company Name"
          value={name}
          onChangeText={setName}
          placeholder="Enter company name"
          required
          error={errors.name}
          autoFocus
        />

        <FormInput
          label="Contact Information"
          value={contactInfo}
          onChangeText={setContactInfo}
          placeholder="Phone, email, or address (optional)"
          multiline
        />

        <View style={styles.actions}>
          <PrimaryButton
            title="Cancel"
            variant="secondary"
            onPress={() => navigation.goBack()}
            style={styles.button}
            disabled={mutation.isPending}
          />
          <PrimaryButton
            title="Add Company"
            onPress={handleSubmit}
            style={styles.button}
            loading={mutation.isPending}
            icon="plus"
          />
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  button: {
    flex: 1,
  },
});
