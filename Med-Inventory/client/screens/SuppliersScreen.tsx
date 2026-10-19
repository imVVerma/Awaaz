import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Modal,
  Alert,
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { FormInput } from "@/components/FormInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, queryClient } from "@/lib/query-client";
import type { Supplier, CreateSupplierInput } from "@shared/types";

export default function SuppliersScreen() {
  const { theme } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [modalVisible, setModalVisible] = React.useState(false);
  const [name, setName] = React.useState("");
  const [contactPerson, setContactPerson] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  const [paymentTerms, setPaymentTerms] = React.useState("30");

  const {
    data: suppliers,
    isLoading,
    refetch,
  } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const createMutation = useMutation({
    mutationFn: async (data: CreateSupplierInput) => {
      const res = await apiRequest("POST", "/api/suppliers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setModalVisible(false);
      setName("");
      setContactPerson("");
      setPhone("");
      setEmail("");
      setAddress("");
      setGstin("");
      setPaymentTerms("30");
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message || "Failed to create supplier");
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Supplier firm name is required");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      contact_person: contactPerson.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      gstin: gstin.trim() || undefined,
      payment_terms_days: parseInt(paymentTerms, 10) || 30,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Notice differentiating Suppliers from Manufacturers */}
      <View
        style={[
          styles.noticeBox,
          {
            backgroundColor: theme.primaryLight,
            borderColor: theme.border,
          },
        ]}
      >
        <Feather name="info" size={16} color={theme.primary} />
        <ThemedText style={[styles.noticeText, { color: theme.primary }]}>
          Suppliers / Vendors issue purchase invoices. Manufacturers own
          medicine brands.
        </ThemedText>
      </View>

      <FlatList
        data={suppliers || []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Card style={styles.supplierCard}>
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: theme.primaryLight },
                ]}
              >
                <Feather name="truck" size={18} color={theme.primary} />
              </View>
              <View style={styles.meta}>
                <ThemedText style={styles.name}>{item.name}</ThemedText>
                {item.contact_person && (
                  <ThemedText
                    style={[styles.contact, { color: theme.textSecondary }]}
                  >
                    Contact: {item.contact_person}
                  </ThemedText>
                )}
              </View>
              <View
                style={[
                  styles.termsBadge,
                  { backgroundColor: theme.backgroundDefault },
                ]}
              >
                <ThemedText
                  style={[styles.termsText, { color: theme.textSecondary }]}
                >
                  {item.payment_terms_days}d Credit
                </ThemedText>
              </View>
            </View>

            {(item.phone || item.gstin || item.address) && (
              <View
                style={[styles.detailsGrid, { borderTopColor: theme.border }]}
              >
                {item.phone && (
                  <View style={styles.detailItem}>
                    <Feather
                      name="phone"
                      size={12}
                      color={theme.textSecondary}
                    />
                    <ThemedText
                      style={[
                        styles.detailText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {item.phone}
                    </ThemedText>
                  </View>
                )}
                {item.gstin && (
                  <View style={styles.detailItem}>
                    <Feather
                      name="shield"
                      size={12}
                      color={theme.textSecondary}
                    />
                    <ThemedText
                      style={[
                        styles.detailText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      GST: {item.gstin}
                    </ThemedText>
                  </View>
                )}
              </View>
            )}
          </Card>
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="truck"
              title="No Suppliers Found"
              message="Register pharmaceutical wholesalers, stockists, and C&F agents to procure goods."
              actionLabel="Add Supplier"
              onAction={() => setModalVisible(true)}
            />
          ) : null
        }
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>
              Add Supplier / Vendor
            </ThemedText>
            <ThemedText
              style={[styles.modalSubtitle, { color: theme.textSecondary }]}
            >
              Wholesaler or clearing &amp; forwarding agent
            </ThemedText>

            <FormInput
              label="Supplier / Firm Name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Apex Pharma Stockists"
              required
            />

            <FormInput
              label="Contact Person"
              value={contactPerson}
              onChangeText={setContactPerson}
              placeholder="e.g. Anil Mehta"
            />

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <FormInput
                  label="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="10 digits"
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.halfInput}>
                <FormInput
                  label="Payment Terms (Days)"
                  value={paymentTerms}
                  onChangeText={setPaymentTerms}
                  placeholder="30"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <FormInput
              label="GSTIN"
              value={gstin}
              onChangeText={setGstin}
              placeholder="15-character GSTIN"
            />

            <FormInput
              label="Warehouse / Billing Address"
              value={address}
              onChangeText={setAddress}
              placeholder="e.g. Industrial Area, Okhla Phase 2"
            />

            <View style={styles.modalActions}>
              <PrimaryButton
                title="Cancel"
                variant="secondary"
                onPress={() => setModalVisible(false)}
                style={styles.modalBtn}
                disabled={createMutation.isPending}
              />
              <PrimaryButton
                title="Save Supplier"
                onPress={handleSubmit}
                style={styles.modalBtn}
                loading={createMutation.isPending}
                icon="check"
              />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  noticeText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  supplierCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  meta: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
  },
  contact: {
    fontSize: 12,
    marginTop: 2,
  },
  termsBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  termsText: {
    fontSize: 11,
    fontWeight: "600",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    borderTopWidth: 1,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalBtn: {
    flex: 1,
  },
});
