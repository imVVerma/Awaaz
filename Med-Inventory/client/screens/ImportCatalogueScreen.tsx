import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { FormSelect } from "@/components/FormSelect";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { apiRequest, queryClient, getApiUrl } from "@/lib/query-client";
import type { Company } from "@shared/types";

interface ExtractedMedicine {
  product_name: string;
  composition?: string;
  batch_number?: string;
  expiry_date?: string;
  mrp?: number;
  purchase_price?: number;
  stock_quantity?: number;
  minimum_stock_level?: number;
  selected?: boolean;
}

export default function ImportCatalogueScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [extractedMedicines, setExtractedMedicines] = React.useState<
    ExtractedMedicine[]
  >([]);
  const [selectedCompany, setSelectedCompany] = React.useState<number | null>(
    null,
  );
  const [step, setStep] = React.useState<"upload" | "review" | "success">(
    "upload",
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const extractMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(getApiUrl("/api/upload/extract"), {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to extract medicines");
      }

      return response.json();
    },
    onSuccess: (data) => {
      const medicines = data.medicines.map((m: ExtractedMedicine) => ({
        ...m,
        selected: true,
      }));
      setExtractedMedicines(medicines);
      setStep("review");
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const selectedMedicines = extractedMedicines.filter((m) => m.selected);
      return apiRequest("POST", "/api/upload/import", {
        medicines: selectedMedicines,
        companyId: selectedCompany,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setStep("success");
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      extractMutation.mutate(selectedFile);
    }
  };

  const toggleMedicine = (index: number) => {
    setExtractedMedicines((prev) =>
      prev.map((m, i) => (i === index ? { ...m, selected: !m.selected } : m)),
    );
  };

  const selectAll = () => {
    setExtractedMedicines((prev) =>
      prev.map((m) => ({ ...m, selected: true })),
    );
  };

  const deselectAll = () => {
    setExtractedMedicines((prev) =>
      prev.map((m) => ({ ...m, selected: false })),
    );
  };

  const handleImport = () => {
    if (selectedCompany) {
      importMutation.mutate();
    }
  };

  const selectedCount = extractedMedicines.filter((m) => m.selected).length;

  const companyOptions = React.useMemo(() => {
    return (companies || []).map((c) => ({
      label: c.name,
      value: c.id,
    }));
  }, [companies]);

  if (Platform.OS !== "web") {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <View style={styles.centerContent}>
          <Feather name="upload-cloud" size={64} color={theme.textSecondary} />
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Import Feature
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            The catalogue import feature is only available on the web version.
          </ThemedText>
        </View>
      </View>
    );
  }

  if (step === "success") {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <View style={styles.centerContent}>
          <View
            style={[
              styles.successIcon,
              {
                backgroundColor: isDark
                  ? Colors.dark.successLight
                  : Colors.light.successLight,
              },
            ]}
          >
            <Feather name="check" size={48} color={theme.success} />
          </View>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Import Successful!
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {selectedCount} medicines have been added to your inventory.
          </ThemedText>
          <View style={styles.successActions}>
            <PrimaryButton
              title="View Products"
              onPress={() => navigation.goBack()}
            />
          </View>
        </View>
      </View>
    );
  }

  if (step === "review") {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
            Review Extracted Medicines
          </ThemedText>
          <ThemedText
            style={[styles.headerSubtitle, { color: theme.textSecondary }]}
          >
            {selectedCount} of {extractedMedicines.length} selected
          </ThemedText>
        </View>

        <View
          style={[
            styles.selectionBar,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Pressable onPress={selectAll} style={styles.selectionButton}>
            <ThemedText style={{ color: theme.primary }}>Select All</ThemedText>
          </Pressable>
          <Pressable onPress={deselectAll} style={styles.selectionButton}>
            <ThemedText style={{ color: theme.textSecondary }}>
              Deselect All
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView style={styles.reviewList}>
          {extractedMedicines.map((medicine, index) => (
            <Pressable
              key={index}
              onPress={() => toggleMedicine(index)}
              style={[
                styles.medicineItem,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: medicine.selected ? theme.primary : theme.border,
                },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: medicine.selected
                      ? theme.primary
                      : "transparent",
                    borderColor: medicine.selected
                      ? theme.primary
                      : theme.border,
                  },
                ]}
              >
                {medicine.selected && (
                  <Feather name="check" size={14} color="#fff" />
                )}
              </View>
              <View style={styles.medicineInfo}>
                <ThemedText
                  style={[styles.medicineName, { color: theme.text }]}
                >
                  {medicine.product_name}
                </ThemedText>
                {medicine.composition && (
                  <ThemedText
                    style={[
                      styles.medicineDetail,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {medicine.composition}
                  </ThemedText>
                )}
                <View style={styles.medicineMetaRow}>
                  {medicine.mrp !== undefined && (
                    <ThemedText
                      style={[
                        styles.medicineMeta,
                        { color: theme.textSecondary },
                      ]}
                    >
                      MRP: ₹{medicine.mrp}
                    </ThemedText>
                  )}
                  {medicine.stock_quantity !== undefined && (
                    <ThemedText
                      style={[
                        styles.medicineMeta,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Qty: {medicine.stock_quantity}
                    </ThemedText>
                  )}
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.backgroundDefault,
              borderTopColor: theme.border,
            },
          ]}
        >
          <View style={styles.companySelect}>
            <FormSelect
              label="Assign to Company"
              value={selectedCompany || ""}
              options={companyOptions}
              onChange={(val) => setSelectedCompany(Number(val))}
              placeholder="Select Company"
            />
          </View>
          <PrimaryButton
            title={
              importMutation.isPending
                ? "Importing..."
                : `Import ${selectedCount} Medicines`
            }
            onPress={handleImport}
            disabled={
              selectedCount === 0 ||
              !selectedCompany ||
              importMutation.isPending
            }
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView contentContainerStyle={styles.uploadContent}>
        <View style={styles.centerContent}>
          <View
            style={[
              styles.uploadIcon,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Feather name="upload-cloud" size={48} color={theme.primary} />
          </View>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Import Medicine Catalogue
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Upload an Excel or PDF file containing medicine data. Our AI will
            extract the relevant information automatically.
          </ThemedText>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />

          <Pressable
            onPress={() => fileInputRef.current?.click()}
            style={[
              styles.dropZone,
              {
                borderColor: selectedFile ? theme.primary : theme.border,
                backgroundColor: theme.backgroundDefault,
              },
            ]}
          >
            {selectedFile ? (
              <View style={styles.selectedFileInfo}>
                <Feather name="file-text" size={32} color={theme.primary} />
                <ThemedText style={[styles.fileName, { color: theme.text }]}>
                  {selectedFile.name}
                </ThemedText>
                <ThemedText
                  style={[styles.fileSize, { color: theme.textSecondary }]}
                >
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </ThemedText>
              </View>
            ) : (
              <View style={styles.dropZoneContent}>
                <Feather
                  name="file-plus"
                  size={32}
                  color={theme.textSecondary}
                />
                <ThemedText
                  style={[styles.dropZoneText, { color: theme.textSecondary }]}
                >
                  Click to select a file
                </ThemedText>
                <ThemedText
                  style={[styles.dropZoneHint, { color: theme.textSecondary }]}
                >
                  Supports PDF, Excel (.xlsx, .xls), CSV
                </ThemedText>
              </View>
            )}
          </Pressable>

          {extractMutation.isError && (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: isDark
                    ? Colors.dark.dangerLight
                    : Colors.light.dangerLight,
                },
              ]}
            >
              <Feather name="alert-circle" size={18} color={theme.danger} />
              <ThemedText style={[styles.errorText, { color: theme.danger }]}>
                {extractMutation.error?.message || "Failed to process file"}
              </ThemedText>
            </View>
          )}

          <View style={styles.buttonContainer}>
            {extractMutation.isPending ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <ThemedText
                  style={[styles.loadingText, { color: theme.textSecondary }]}
                >
                  Analyzing document with AI...
                </ThemedText>
              </View>
            ) : (
              <PrimaryButton
                title="Extract Medicines"
                onPress={handleUpload}
                disabled={!selectedFile}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  uploadContent: {
    flexGrow: 1,
    padding: Spacing.xl,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  uploadIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 400,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  dropZone: {
    width: "100%",
    maxWidth: 400,
    padding: Spacing["3xl"],
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
    cursor: "pointer",
  },
  dropZoneContent: {
    alignItems: "center",
  },
  dropZoneText: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: Spacing.md,
  },
  dropZoneHint: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  selectedFileInfo: {
    alignItems: "center",
  },
  fileName: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: Spacing.md,
  },
  fileSize: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  buttonContainer: {
    width: "100%",
    maxWidth: 300,
  },
  loadingContainer: {
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    width: "100%",
    maxWidth: 400,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  selectionBar: {
    flexDirection: "row",
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  selectionButton: {
    padding: Spacing.sm,
  },
  reviewList: {
    flex: 1,
    padding: Spacing.lg,
  },
  medicineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    marginTop: 2,
  },
  medicineInfo: {
    flex: 1,
  },
  medicineName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  medicineDetail: {
    fontSize: 13,
    marginBottom: Spacing.xs,
  },
  medicineMetaRow: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  medicineMeta: {
    fontSize: 12,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    gap: Spacing.lg,
  },
  companySelect: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: 14,
  },
  successActions: {
    width: "100%",
    maxWidth: 300,
    marginTop: Spacing.lg,
  },
});
