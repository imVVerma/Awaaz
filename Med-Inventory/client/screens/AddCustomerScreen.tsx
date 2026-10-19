import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Card } from "@/components/Card";
import { apiRequest } from "@/lib/query-client";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { CustomersStackParamList } from "@/navigation/CustomersStackNavigator";

type Props = {
  navigation: NativeStackNavigationProp<CustomersStackParamList, "AddCustomer">;
};

export default function AddCustomerScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [storeName, setStoreName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [dlNumber, setDlNumber] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState("15");
  const [creditLimit, setCreditLimit] = useState("50000");
  const [billingAddress, setBillingAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [sameAsBilling, setSameAsBilling] = useState(true);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!storeName.trim()) {
        throw new Error("Store/Pharmacy name is required");
      }
      if (!phone.trim()) {
        throw new Error("Phone number is required");
      }

      return await apiRequest("POST", "/api/customers", {
        store_name: storeName.trim(),
        contact_person: contactPerson.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        gstin: gstin.trim().toUpperCase() || undefined,
        dl_number: dlNumber.trim().toUpperCase() || undefined,
        payment_terms_days: Number(paymentTermsDays) || 15,
        credit_limit: Number(creditLimit) || 50000,
        billing_address: billingAddress.trim() || undefined,
        delivery_address:
          (sameAsBilling ? billingAddress.trim() : deliveryAddress.trim()) ||
          undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      if (Platform.OS === "web") {
        navigation.goBack();
      } else {
        Alert.alert("Success", "Customer registered successfully", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      }
    },
    onError: (error: any) => {
      const msg = error.message || "Failed to create customer";
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    },
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 1. Pharmacy Identity */}
      <Card style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <Feather
            name="home"
            size={18}
            color={theme.primary}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Pharmacy Details
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Pharmacy / Store Name <Text style={{ color: theme.error }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.backgroundDefault,
              },
            ]}
            placeholder="e.g. Apollo Pharmacy Lajpat Nagar"
            placeholderTextColor={theme.textTertiary}
            value={storeName}
            onChangeText={setStoreName}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Contact Person
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              placeholder="e.g. Dr. Rajesh Sharma"
              placeholderTextColor={theme.textTertiary}
              value={contactPerson}
              onChangeText={setContactPerson}
            />
          </View>

          <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Phone Number <Text style={{ color: theme.error }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              placeholder="10-digit mobile"
              placeholderTextColor={theme.textTertiary}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Email Address (Optional)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.backgroundDefault,
              },
            ]}
            placeholder="e.g. orders@apollopharmacy.com"
            placeholderTextColor={theme.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>
      </Card>

      {/* 2. Regulatory & Tax */}
      <Card style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <Feather
            name="file-text"
            size={18}
            color={theme.primary}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Tax & Licensing
          </Text>
        </View>

        <View style={styles.row}>
          <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              GSTIN (Optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              placeholder="15-digit GSTIN"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="characters"
              value={gstin}
              onChangeText={setGstin}
            />
          </View>

          <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Drug License (DL No)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              placeholder="e.g. DL-20B/21B-9988"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="characters"
              value={dlNumber}
              onChangeText={setDlNumber}
            />
          </View>
        </View>
      </Card>

      {/* 3. Credit & Payment Terms */}
      <Card style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <Feather
            name="dollar-sign"
            size={18}
            color={theme.primary}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Credit & Payment Terms
          </Text>
        </View>

        <View style={styles.row}>
          <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Payment Terms (Days)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              placeholder="15"
              placeholderTextColor={theme.textTertiary}
              keyboardType="numeric"
              value={paymentTermsDays}
              onChangeText={setPaymentTermsDays}
            />
          </View>

          <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Credit Limit (₹)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              placeholder="50000"
              placeholderTextColor={theme.textTertiary}
              keyboardType="numeric"
              value={creditLimit}
              onChangeText={setCreditLimit}
            />
          </View>
        </View>
      </Card>

      {/* 4. Addresses */}
      <Card style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <Feather
            name="map-pin"
            size={18}
            color={theme.primary}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Addresses
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Billing Address
          </Text>
          <TextInput
            style={[
              styles.textArea,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.backgroundDefault,
              },
            ]}
            placeholder="Shop address, street, landmark, city, pincode"
            placeholderTextColor={theme.textTertiary}
            multiline
            numberOfLines={3}
            value={billingAddress}
            onChangeText={setBillingAddress}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: theme.text, marginBottom: 0 }]}>
            Delivery address same as billing
          </Text>
          <Switch
            value={sameAsBilling}
            onValueChange={setSameAsBilling}
            trackColor={{ false: theme.border, true: theme.primary }}
          />
        </View>

        {!sameAsBilling && (
          <View style={[styles.fieldGroup, { marginTop: 12 }]}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Delivery Address
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              placeholder="Delivery destination address"
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={3}
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
            />
          </View>
        )}
      </Card>

      {/* Submit Button */}
      <Pressable
        onPress={() => createMutation.mutate()}
        disabled={createMutation.isPending}
        style={({ pressed }) => [
          styles.submitButton,
          {
            backgroundColor: theme.primary,
            opacity: createMutation.isPending ? 0.6 : pressed ? 0.88 : 1,
          },
        ]}
      >
        {createMutation.isPending ? (
          <ActivityIndicator
            size="small"
            color="#FFFFFF"
            style={{ marginRight: 8 }}
          />
        ) : (
          <Feather
            name="check-circle"
            size={18}
            color="#FFFFFF"
            style={{ marginRight: 8 }}
          />
        )}
        <Text style={styles.submitButtonText}>
          {createMutation.isPending ? "Registering..." : "Register Pharmacy"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  formCard: {
    padding: 16,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  fieldGroup: {
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  submitButton: {
    flexDirection: "row",
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
