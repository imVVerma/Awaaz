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
import type { Company, CatalogImportPreviewResult } from "@shared/types";

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
  const navigation = useNavigation<any>();

  // Mode: Structured Spreadsheet vs AI Document Scan
  const [importMode, setImportMode] = React.useState<"spreadsheet" | "ai">(
    "spreadsheet",
  );

  // Structured import state
  const [spreadsheetFile, setSpreadsheetFile] = React.useState<File | null>(
    null,
  );
  const [previewResult, setPreviewResult] =
    React.useState<CatalogImportPreviewResult | null>(null);
  const [isAtomic, setIsAtomic] = React.useState<boolean>(true);
  const [rowFilter, setRowFilter] = React.useState<"all" | "errors" | "valid">(
    "all",
  );
  const [commitSummary, setCommitSummary] = React.useState<{
    committedRowsCount: number;
    importedProductsCount: number;
    importedBatchesCount: number;
    createdCompaniesCount: number;
  } | null>(null);

  // AI scan state
  const [aiFile, setAiFile] = React.useState<File | null>(null);
  const [extractedMedicines, setExtractedMedicines] = React.useState<
    ExtractedMedicine[]
  >([]);
  const [selectedCompany, setSelectedCompany] = React.useState<number | null>(
    null,
  );

  // Overall workflow step
  const [step, setStep] = React.useState<"select" | "preview" | "success">(
    "select",
  );

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const aiFileInputRef = React.useRef<HTMLInputElement>(null);

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  // 1. Structured Preview Mutation
  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(getApiUrl("/api/upload/preview"), {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to parse spreadsheet");
      }

      return (await response.json()) as CatalogImportPreviewResult;
    },
    onSuccess: (data) => {
      setPreviewResult(data);
      setStep("preview");
    },
  });

  // 2. Structured Commit Mutation
  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!previewResult) return;
      const rowsToCommit = isAtomic
        ? previewResult.rows
        : previewResult.rows.filter((r) => r.isValid);

      return apiRequest("POST", "/api/upload/commit", {
        rows: rowsToCommit,
        atomic: isAtomic,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setCommitSummary(data);
      setStep("success");
    },
  });

  // 3. AI Scan Mutations
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
      const medicines = (data.medicines || []).map((m: ExtractedMedicine) => ({
        ...m,
        selected: true,
      }));
      setExtractedMedicines(medicines);
      setStep("preview");
    },
  });

  const aiImportMutation = useMutation({
    mutationFn: async () => {
      const selected = extractedMedicines.filter((m) => m.selected);
      return apiRequest("POST", "/api/upload/import", {
        medicines: selected,
        companyId: selectedCompany,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setCommitSummary({
        committedRowsCount: data.importedCount,
        importedProductsCount: data.importedCount,
        importedBatchesCount: data.importedCount,
        createdCompaniesCount: 0,
      });
      setStep("success");
    },
  });

  const handleDownloadTemplate = (format: "csv" | "excel") => {
    const url = getApiUrl(`/api/upload/template/${format}`);
    window.open(url, "_blank");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (importMode === "spreadsheet") {
        setSpreadsheetFile(file);
      } else {
        setAiFile(file);
      }
    }
  };

  const resetImport = () => {
    setSpreadsheetFile(null);
    setPreviewResult(null);
    setAiFile(null);
    setExtractedMedicines([]);
    setSelectedCompany(null);
    setCommitSummary(null);
    setStep("select");
  };

  const companyOptions = React.useMemo(() => {
    return (companies || []).map((c) => ({
      label: c.name,
      value: c.id,
    }));
  }, [companies]);

  const filteredPreviewRows = React.useMemo(() => {
    if (!previewResult) return [];
    if (rowFilter === "errors") {
      return previewResult.rows.filter((r) => !r.isValid);
    }
    if (rowFilter === "valid") {
      return previewResult.rows.filter((r) => r.isValid);
    }
    return previewResult.rows;
  }, [previewResult, rowFilter]);

  if (Platform.OS !== "web") {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <View style={styles.centerContent}>
          <Feather name="upload-cloud" size={64} color={theme.textSecondary} />
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Catalogue Import
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            The catalogue import workflow is optimized for the web interface.
          </ThemedText>
        </View>
      </View>
    );
  }

  // --- STEP 3: SUCCESS VIEW ---
  if (step === "success") {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <ScrollView contentContainerStyle={styles.centerContent}>
          <View
            style={[
              styles.successIconBox,
              {
                backgroundColor: isDark
                  ? Colors.dark.successLight
                  : Colors.light.successLight,
              },
            ]}
          >
            <Feather name="check-circle" size={56} color={theme.success} />
          </View>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Import Completed Successfully!
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Your product catalog and inventory lots have been updated.
          </ThemedText>

          {commitSummary && (
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.summaryRow}>
                <ThemedText style={{ color: theme.textSecondary }}>
                  Total Rows Committed:
                </ThemedText>
                <ThemedText style={{ color: theme.text, fontWeight: "700" }}>
                  {commitSummary.committedRowsCount}
                </ThemedText>
              </View>
              <View style={styles.summaryRow}>
                <ThemedText style={{ color: theme.textSecondary }}>
                  Products Created / Updated:
                </ThemedText>
                <ThemedText style={{ color: theme.text, fontWeight: "700" }}>
                  {commitSummary.importedProductsCount}
                </ThemedText>
              </View>
              <View style={styles.summaryRow}>
                <ThemedText style={{ color: theme.textSecondary }}>
                  Physical Lots & Batches Added:
                </ThemedText>
                <ThemedText style={{ color: theme.text, fontWeight: "700" }}>
                  {commitSummary.importedBatchesCount}
                </ThemedText>
              </View>
              {commitSummary.createdCompaniesCount > 0 && (
                <View style={styles.summaryRow}>
                  <ThemedText style={{ color: theme.textSecondary }}>
                    New Manufacturers Created:
                  </ThemedText>
                  <ThemedText
                    style={{ color: theme.primary, fontWeight: "700" }}
                  >
                    {commitSummary.createdCompaniesCount}
                  </ThemedText>
                </View>
              )}
            </View>
          )}

          <View style={styles.successActions}>
            <PrimaryButton
              title="View Product Catalog"
              onPress={() =>
                navigation.navigate("ProductsTab", { screen: "Products" })
              }
            />
            <Pressable
              onPress={resetImport}
              style={[
                styles.outlineBtn,
                { borderColor: theme.border, marginTop: Spacing.sm },
              ]}
            >
              <ThemedText style={{ color: theme.text, fontWeight: "600" }}>
                Import Another File
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // --- STEP 2: PREVIEW & REVIEW VIEW ---
  if (step === "preview") {
    if (importMode === "spreadsheet" && previewResult) {
      const hasErrors = previewResult.errorRowsCount > 0;
      const canCommit = isAtomic
        ? !hasErrors && previewResult.validRowsCount > 0
        : previewResult.validRowsCount > 0;

      return (
        <View
          style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        >
          {/* Header */}
          <View
            style={[
              styles.previewHeader,
              {
                backgroundColor: theme.backgroundDefault,
                borderBottomColor: theme.border,
              },
            ]}
          >
            <View>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                Review & Validate Import Rows
              </ThemedText>
              <ThemedText
                style={{
                  color: theme.textSecondary,
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                File: {previewResult.filename} ({previewResult.totalRows} rows)
              </ThemedText>
            </View>

            <Pressable
              onPress={() => setStep("select")}
              style={[styles.smallBtn, { borderColor: theme.border }]}
            >
              <Feather name="arrow-left" size={14} color={theme.text} />
              <ThemedText
                style={{ color: theme.text, fontSize: 13, marginLeft: 6 }}
              >
                Back to Upload
              </ThemedText>
            </Pressable>
          </View>

          {/* Validation KPI Badges */}
          <View
            style={[
              styles.kpiContainer,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.kpiItem}>
              <ThemedText style={[styles.kpiNum, { color: theme.text }]}>
                {previewResult.totalRows}
              </ThemedText>
              <ThemedText
                style={[styles.kpiLabel, { color: theme.textSecondary }]}
              >
                Total Rows
              </ThemedText>
            </View>

            <View style={styles.kpiItem}>
              <ThemedText style={[styles.kpiNum, { color: theme.success }]}>
                {previewResult.validRowsCount}
              </ThemedText>
              <ThemedText
                style={[styles.kpiLabel, { color: theme.textSecondary }]}
              >
                Ready to Import
              </ThemedText>
            </View>

            <View style={styles.kpiItem}>
              <ThemedText
                style={[
                  styles.kpiNum,
                  {
                    color:
                      previewResult.errorRowsCount > 0
                        ? theme.danger
                        : theme.textSecondary,
                  },
                ]}
              >
                {previewResult.errorRowsCount}
              </ThemedText>
              <ThemedText
                style={[styles.kpiLabel, { color: theme.textSecondary }]}
              >
                Errors
              </ThemedText>
            </View>

            <View style={styles.kpiItem}>
              <ThemedText
                style={[
                  styles.kpiNum,
                  {
                    color:
                      previewResult.warningCount > 0
                        ? theme.warning
                        : theme.textSecondary,
                  },
                ]}
              >
                {previewResult.warningCount}
              </ThemedText>
              <ThemedText
                style={[styles.kpiLabel, { color: theme.textSecondary }]}
              >
                Warnings
              </ThemedText>
            </View>
          </View>

          {/* Controls: Row filter tabs & Atomic toggle */}
          <View
            style={[
              styles.controlsBar,
              {
                backgroundColor: theme.backgroundDefault,
                borderBottomColor: theme.border,
              },
            ]}
          >
            <View style={styles.filterTabs}>
              <Pressable
                onPress={() => setRowFilter("all")}
                style={[
                  styles.filterTab,
                  rowFilter === "all" && {
                    backgroundColor: theme.primaryLight,
                    borderColor: theme.primary,
                  },
                ]}
              >
                <ThemedText
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color:
                      rowFilter === "all" ? theme.primary : theme.textSecondary,
                  }}
                >
                  All ({previewResult.rows.length})
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => setRowFilter("errors")}
                style={[
                  styles.filterTab,
                  rowFilter === "errors" && {
                    backgroundColor: isDark
                      ? Colors.dark.dangerLight
                      : Colors.light.dangerLight,
                    borderColor: theme.danger,
                  },
                ]}
              >
                <ThemedText
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color:
                      rowFilter === "errors"
                        ? theme.danger
                        : theme.textSecondary,
                  }}
                >
                  Errors ({previewResult.errorRowsCount})
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => setRowFilter("valid")}
                style={[
                  styles.filterTab,
                  rowFilter === "valid" && {
                    backgroundColor: isDark
                      ? Colors.dark.successLight
                      : Colors.light.successLight,
                    borderColor: theme.success,
                  },
                ]}
              >
                <ThemedText
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color:
                      rowFilter === "valid"
                        ? theme.success
                        : theme.textSecondary,
                  }}
                >
                  Valid ({previewResult.validRowsCount})
                </ThemedText>
              </Pressable>
            </View>

            <Pressable
              onPress={() => setIsAtomic(!isAtomic)}
              style={styles.atomicToggle}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: isAtomic ? theme.primary : "transparent",
                    borderColor: isAtomic ? theme.primary : theme.border,
                  },
                ]}
              >
                {isAtomic && <Feather name="check" size={12} color="#fff" />}
              </View>
              <ThemedText style={{ fontSize: 13, color: theme.text }}>
                Atomic Import (All rows must be valid)
              </ThemedText>
            </Pressable>
          </View>

          {/* Row Preview List */}
          <ScrollView style={styles.rowsScrollList}>
            {filteredPreviewRows.length === 0 ? (
              <View style={styles.emptyFilterBox}>
                <ThemedText style={{ color: theme.textSecondary }}>
                  No rows matching the current filter.
                </ThemedText>
              </View>
            ) : (
              filteredPreviewRows.map((row) => (
                <View
                  key={row.rowNumber}
                  style={[
                    styles.previewRowCard,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: !row.isValid
                        ? theme.danger
                        : row.warnings.length > 0
                          ? theme.warning
                          : theme.border,
                    },
                  ]}
                >
                  <View style={styles.rowCardTop}>
                    <View style={styles.rowTitleArea}>
                      <View
                        style={[
                          styles.rowNumberBadge,
                          { backgroundColor: theme.backgroundSecondary },
                        ]}
                      >
                        <ThemedText
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: theme.textSecondary,
                          }}
                        >
                          #{row.rowNumber}
                        </ThemedText>
                      </View>

                      <View>
                        <ThemedText
                          style={[
                            styles.productRowTitle,
                            { color: theme.text },
                          ]}
                        >
                          {row.product_name || "Untitled Product"}
                        </ThemedText>
                        <ThemedText
                          style={{ fontSize: 12, color: theme.textSecondary }}
                        >
                          Mfg: {row.company}{" "}
                          <ThemedText
                            style={{
                              fontSize: 11,
                              color:
                                row.companyStatus === "new"
                                  ? theme.primary
                                  : theme.textSecondary,
                              fontStyle: "italic",
                            }}
                          >
                            (
                            {row.companyStatus === "new"
                              ? "New Company"
                              : "Existing"}
                            )
                          </ThemedText>
                        </ThemedText>
                      </View>
                    </View>

                    {/* Action badge */}
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: !row.isValid
                            ? isDark
                              ? Colors.dark.dangerLight
                              : Colors.light.dangerLight
                            : isDark
                              ? Colors.dark.successLight
                              : Colors.light.successLight,
                        },
                      ]}
                    >
                      <ThemedText
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: !row.isValid ? theme.danger : theme.success,
                        }}
                      >
                        {!row.isValid ? "INVALID" : "VALID"}
                      </ThemedText>
                    </View>
                  </View>

                  {/* Attributes details grid */}
                  <View style={styles.rowDetailsGrid}>
                    {row.sku && (
                      <ThemedText
                        style={[
                          styles.detailItem,
                          { color: theme.textSecondary },
                        ]}
                      >
                        SKU:{" "}
                        <ThemedText style={{ color: theme.text }}>
                          {row.sku}
                        </ThemedText>
                      </ThemedText>
                    )}
                    {row.batch_number && (
                      <ThemedText
                        style={[
                          styles.detailItem,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Batch:{" "}
                        <ThemedText style={{ color: theme.text }}>
                          {row.batch_number}
                        </ThemedText>
                      </ThemedText>
                    )}
                    {row.expiry_date && (
                      <ThemedText
                        style={[
                          styles.detailItem,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Exp:{" "}
                        <ThemedText style={{ color: theme.text }}>
                          {row.expiry_date}
                        </ThemedText>
                      </ThemedText>
                    )}
                    <ThemedText
                      style={[
                        styles.detailItem,
                        { color: theme.textSecondary },
                      ]}
                    >
                      MRP:{" "}
                      <ThemedText style={{ color: theme.text }}>
                        ₹{row.mrp}
                      </ThemedText>
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.detailItem,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Purchase:{" "}
                      <ThemedText style={{ color: theme.text }}>
                        ₹{row.purchase_price}
                      </ThemedText>
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.detailItem,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Sale:{" "}
                      <ThemedText style={{ color: theme.text }}>
                        ₹{row.sale_price}
                      </ThemedText>
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.detailItem,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Opening Qty:{" "}
                      <ThemedText
                        style={{ color: theme.text, fontWeight: "700" }}
                      >
                        {row.quantity}
                      </ThemedText>
                    </ThemedText>
                  </View>

                  {/* Errors */}
                  {row.errors.length > 0 && (
                    <View
                      style={[
                        styles.errorCallout,
                        {
                          backgroundColor: isDark
                            ? Colors.dark.dangerLight
                            : Colors.light.dangerLight,
                        },
                      ]}
                    >
                      <Feather
                        name="alert-circle"
                        size={14}
                        color={theme.danger}
                      />
                      <View style={{ marginLeft: 6, flex: 1 }}>
                        {row.errors.map((err, eIdx) => (
                          <ThemedText
                            key={eIdx}
                            style={{
                              fontSize: 12,
                              color: theme.danger,
                              fontWeight: "600",
                            }}
                          >
                            • {err}
                          </ThemedText>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Warnings */}
                  {row.warnings.length > 0 && (
                    <View
                      style={[
                        styles.warningCallout,
                        {
                          backgroundColor: isDark
                            ? "rgba(234, 179, 8, 0.15)"
                            : "rgba(234, 179, 8, 0.1)",
                        },
                      ]}
                    >
                      <Feather
                        name="alert-triangle"
                        size={14}
                        color={theme.warning}
                      />
                      <View style={{ marginLeft: 6, flex: 1 }}>
                        {row.warnings.map((warn, wIdx) => (
                          <ThemedText
                            key={wIdx}
                            style={{ fontSize: 12, color: theme.warning }}
                          >
                            • {warn}
                          </ThemedText>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>

          {/* Sticky Commit Footer */}
          <View
            style={[
              styles.footer,
              {
                backgroundColor: theme.backgroundDefault,
                borderTopColor: theme.border,
              },
            ]}
          >
            <View style={styles.footerInfo}>
              {!canCommit && isAtomic && hasErrors ? (
                <ThemedText style={{ color: theme.danger, fontSize: 13 }}>
                  Cannot commit: File contains {previewResult.errorRowsCount}{" "}
                  error(s). Uncheck Atomic Import or fix errors.
                </ThemedText>
              ) : (
                <ThemedText
                  style={{ color: theme.textSecondary, fontSize: 13 }}
                >
                  Ready to commit{" "}
                  {isAtomic
                    ? previewResult.validRowsCount
                    : previewResult.validRowsCount}{" "}
                  valid rows to catalog.
                </ThemedText>
              )}
            </View>

            <PrimaryButton
              title={
                commitMutation.isPending
                  ? "Importing to Inventory..."
                  : `Commit & Import (${isAtomic ? previewResult.validRowsCount : previewResult.validRowsCount} Products)`
              }
              onPress={() => commitMutation.mutate()}
              disabled={!canCommit || commitMutation.isPending}
            />
          </View>
        </View>
      );
    }

    // AI Review View (Fallback)
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <View
          style={[
            styles.previewHeader,
            {
              backgroundColor: theme.backgroundDefault,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            Review AI Extracted Medicines
          </ThemedText>
          <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
            {extractedMedicines.filter((m) => m.selected).length} of{" "}
            {extractedMedicines.length} selected
          </ThemedText>
        </View>

        <ScrollView style={styles.rowsScrollList}>
          {extractedMedicines.map((med, idx) => (
            <Pressable
              key={idx}
              onPress={() =>
                setExtractedMedicines((prev) =>
                  prev.map((m, i) =>
                    i === idx ? { ...m, selected: !m.selected } : m,
                  ),
                )
              }
              style={[
                styles.previewRowCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: med.selected ? theme.primary : theme.border,
                },
              ]}
            >
              <View style={styles.rowCardTop}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: med.selected
                          ? theme.primary
                          : "transparent",
                        borderColor: med.selected
                          ? theme.primary
                          : theme.border,
                        marginRight: 10,
                      },
                    ]}
                  >
                    {med.selected && (
                      <Feather name="check" size={12} color="#fff" />
                    )}
                  </View>
                  <ThemedText
                    style={[styles.productRowTitle, { color: theme.text }]}
                  >
                    {med.product_name}
                  </ThemedText>
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
          <View style={{ flex: 1, marginRight: 16 }}>
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
              aiImportMutation.isPending ? "Importing..." : "Confirm Import"
            }
            onPress={() => aiImportMutation.mutate()}
            disabled={!selectedCompany || aiImportMutation.isPending}
          />
        </View>
      </View>
    );
  }

  // --- STEP 1: SELECT & UPLOAD VIEW ---
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView contentContainerStyle={styles.uploadScrollContent}>
        {/* Mode Selector Tabs */}
        <View
          style={[
            styles.modeTabBar,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border,
            },
          ]}
        >
          <Pressable
            onPress={() => setImportMode("spreadsheet")}
            style={[
              styles.modeTab,
              importMode === "spreadsheet" && {
                backgroundColor: theme.backgroundDefault,
                shadowColor: "#000",
                shadowOpacity: 0.05,
                shadowRadius: 4,
              },
            ]}
          >
            <Feather
              name="file-text"
              size={16}
              color={
                importMode === "spreadsheet"
                  ? theme.primary
                  : theme.textSecondary
              }
            />
            <ThemedText
              style={[
                styles.modeTabText,
                {
                  color:
                    importMode === "spreadsheet"
                      ? theme.primary
                      : theme.textSecondary,
                  fontWeight: importMode === "spreadsheet" ? "700" : "500",
                },
              ]}
            >
              Spreadsheet Import (CSV / Excel)
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setImportMode("ai")}
            style={[
              styles.modeTab,
              importMode === "ai" && {
                backgroundColor: theme.backgroundDefault,
                shadowColor: "#000",
                shadowOpacity: 0.05,
                shadowRadius: 4,
              },
            ]}
          >
            <Feather
              name="cpu"
              size={16}
              color={importMode === "ai" ? theme.primary : theme.textSecondary}
            />
            <ThemedText
              style={[
                styles.modeTabText,
                {
                  color:
                    importMode === "ai" ? theme.primary : theme.textSecondary,
                  fontWeight: importMode === "ai" ? "700" : "500",
                },
              ]}
            >
              AI Document Scan (PDF / Invoices)
            </ThemedText>
          </Pressable>
        </View>

        {importMode === "spreadsheet" ? (
          <View style={styles.tabContent}>
            {/* Template Download Card */}
            <View
              style={[
                styles.templateCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.templateCardLeft}>
                <View
                  style={[
                    styles.templateIconCircle,
                    { backgroundColor: theme.primaryLight },
                  ]}
                >
                  <Feather name="download" size={24} color={theme.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText
                    style={[styles.templateTitle, { color: theme.text }]}
                  >
                    Standard Catalog Templates
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.templateSubtitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Download pre-formatted templates with exact headers, sample
                    medicines, and dosage form definitions.
                  </ThemedText>
                </View>
              </View>

              <View style={styles.templateButtonsRow}>
                <Pressable
                  onPress={() => handleDownloadTemplate("csv")}
                  style={[
                    styles.templateDownloadBtn,
                    { borderColor: theme.border },
                  ]}
                >
                  <Feather name="download" size={14} color={theme.text} />
                  <ThemedText
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: theme.text,
                      marginLeft: 6,
                    }}
                  >
                    Download sample CSV template
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => handleDownloadTemplate("excel")}
                  style={[
                    styles.templateDownloadBtn,
                    {
                      borderColor: theme.primary,
                      backgroundColor: theme.primaryLight,
                    },
                  ]}
                >
                  <Feather name="download" size={14} color={theme.primary} />
                  <ThemedText
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: theme.primary,
                      marginLeft: 6,
                    }}
                  >
                    Download sample Excel template (.xlsx)
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />

            {/* Dropzone */}
            <Pressable
              onPress={() => fileInputRef.current?.click()}
              style={[
                styles.dropzoneBox,
                {
                  borderColor: spreadsheetFile ? theme.primary : theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
            >
              {spreadsheetFile ? (
                <View style={styles.fileSelectedView}>
                  <Feather name="file-text" size={38} color={theme.primary} />
                  <ThemedText
                    style={[styles.selectedFileName, { color: theme.text }]}
                  >
                    {spreadsheetFile.name}
                  </ThemedText>
                  <ThemedText
                    style={{ color: theme.textSecondary, fontSize: 12 }}
                  >
                    {(spreadsheetFile.size / 1024).toFixed(1)} KB • Click to
                    choose another file
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.dropzonePrompt}>
                  <Feather
                    name="upload-cloud"
                    size={44}
                    color={theme.textSecondary}
                  />
                  <ThemedText
                    style={[styles.dropzoneTitle, { color: theme.text }]}
                  >
                    Select Excel (.xlsx, .xls) or CSV File
                  </ThemedText>
                  <ThemedText
                    style={{
                      color: theme.textSecondary,
                      fontSize: 13,
                      marginTop: 4,
                    }}
                  >
                    Drag & drop here or click to browse files
                  </ThemedText>
                </View>
              )}
            </Pressable>

            {previewMutation.isError && (
              <View
                style={[
                  styles.errorAlertBox,
                  {
                    backgroundColor: isDark
                      ? Colors.dark.dangerLight
                      : Colors.light.dangerLight,
                  },
                ]}
              >
                <Feather name="alert-circle" size={18} color={theme.danger} />
                <ThemedText
                  style={[styles.errorAlertText, { color: theme.danger }]}
                >
                  {previewMutation.error?.message || "Failed to process file"}
                </ThemedText>
              </View>
            )}

            <View style={styles.actionBtnContainer}>
              {previewMutation.isPending ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <ThemedText
                    style={{ marginLeft: 8, color: theme.textSecondary }}
                  >
                    Parsing and validating spreadsheet rows...
                  </ThemedText>
                </View>
              ) : (
                <PrimaryButton
                  title="Parse & Validate Spreadsheet"
                  onPress={() => {
                    if (spreadsheetFile) {
                      previewMutation.mutate(spreadsheetFile);
                    }
                  }}
                  disabled={!spreadsheetFile}
                />
              )}
            </View>
          </View>
        ) : (
          <View style={styles.tabContent}>
            {/* AI Document Scan Tab Content */}
            <View
              style={[
                styles.templateCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.templateCardLeft}>
                <View
                  style={[
                    styles.templateIconCircle,
                    { backgroundColor: theme.primaryLight },
                  ]}
                >
                  <Feather name="cpu" size={24} color={theme.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText
                    style={[styles.templateTitle, { color: theme.text }]}
                  >
                    AI Document Extraction
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.templateSubtitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Upload scanned distributor invoices or PDF lists. Groq AI
                    will parse lines automatically.
                  </ThemedText>
                </View>
              </View>
            </View>

            <input
              ref={aiFileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />

            <Pressable
              onPress={() => aiFileInputRef.current?.click()}
              style={[
                styles.dropzoneBox,
                {
                  borderColor: aiFile ? theme.primary : theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
            >
              {aiFile ? (
                <View style={styles.fileSelectedView}>
                  <Feather name="file" size={38} color={theme.primary} />
                  <ThemedText
                    style={[styles.selectedFileName, { color: theme.text }]}
                  >
                    {aiFile.name}
                  </ThemedText>
                  <ThemedText
                    style={{ color: theme.textSecondary, fontSize: 12 }}
                  >
                    {(aiFile.size / 1024).toFixed(1)} KB • Click to change
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.dropzonePrompt}>
                  <Feather
                    name="file-text"
                    size={44}
                    color={theme.textSecondary}
                  />
                  <ThemedText
                    style={[styles.dropzoneTitle, { color: theme.text }]}
                  >
                    Select PDF Document or Invoice
                  </ThemedText>
                  <ThemedText
                    style={{
                      color: theme.textSecondary,
                      fontSize: 13,
                      marginTop: 4,
                    }}
                  >
                    Supports scanned invoices, rate lists, and price catalogs
                  </ThemedText>
                </View>
              )}
            </Pressable>

            {extractMutation.isError && (
              <View
                style={[
                  styles.errorAlertBox,
                  {
                    backgroundColor: isDark
                      ? Colors.dark.dangerLight
                      : Colors.light.dangerLight,
                  },
                ]}
              >
                <Feather name="alert-circle" size={18} color={theme.danger} />
                <ThemedText
                  style={[styles.errorAlertText, { color: theme.danger }]}
                >
                  {extractMutation.error?.message ||
                    "Failed to process with AI"}
                </ThemedText>
              </View>
            )}

            <View style={styles.actionBtnContainer}>
              {extractMutation.isPending ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <ThemedText
                    style={{ marginLeft: 8, color: theme.textSecondary }}
                  >
                    Extracting medicines with AI...
                  </ThemedText>
                </View>
              ) : (
                <PrimaryButton
                  title="Extract Medicines with AI"
                  onPress={() => {
                    if (aiFile) extractMutation.mutate(aiFile);
                  }}
                  disabled={!aiFile}
                />
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  uploadScrollContent: {
    padding: Spacing.lg,
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    maxWidth: 600,
    alignSelf: "center",
  },
  modeTabBar: {
    flexDirection: "row",
    padding: 4,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modeTabText: {
    fontSize: 13,
    marginLeft: 8,
  },
  tabContent: {
    gap: Spacing.lg,
  },
  templateCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  templateCardLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  templateIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  templateSubtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  templateButtonsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  templateDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  dropzoneBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
    cursor: "pointer" as any,
  },
  dropzonePrompt: {
    alignItems: "center",
  },
  dropzoneTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: Spacing.md,
  },
  fileSelectedView: {
    alignItems: "center",
  },
  selectedFileName: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: Spacing.sm,
  },
  errorAlertBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  errorAlertText: {
    fontSize: 13,
    flex: 1,
  },
  actionBtnContainer: {
    marginTop: Spacing.sm,
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: Spacing.lg,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    marginTop: Spacing.xs,
    textAlign: "center",
    lineHeight: 20,
  },
  successIconBox: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  summaryCard: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  successActions: {
    width: "100%",
    gap: Spacing.sm,
  },
  outlineBtn: {
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  kpiContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  kpiItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRightWidth: 1,
    borderRightColor: "rgba(0,0,0,0.05)",
  },
  kpiNum: {
    fontSize: 20,
    fontWeight: "800",
  },
  kpiLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: "600",
    marginTop: 2,
  },
  controlsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  filterTabs: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  atomicToggle: {
    flexDirection: "row",
    alignItems: "center",
    cursor: "pointer" as any,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  rowsScrollList: {
    flex: 1,
    padding: Spacing.lg,
  },
  emptyFilterBox: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  previewRowCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  rowCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowTitleArea: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rowNumberBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginRight: 10,
  },
  productRowTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  rowDetailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  detailItem: {
    fontSize: 12,
  },
  errorCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  warningCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
  },
  footerInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
});
