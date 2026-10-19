import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { CompanyListItem } from "@/components/CompanyListItem";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SearchBar } from "@/components/SearchBar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, queryClient } from "@/lib/query-client";
import type { Company, ProductWithCompany } from "@shared/types";
import type { CompaniesStackParamList } from "@/navigation/CompaniesStackNavigator";

type CompaniesNavProp = NativeStackNavigationProp<
  CompaniesStackParamList,
  "Companies"
>;

export default function CompaniesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<CompaniesNavProp>();
  const tabBarHeight = useBottomTabBarHeight();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [deleteModal, setDeleteModal] = React.useState<{
    visible: boolean;
    company: Company | null;
  }>({
    visible: false,
    company: null,
  });

  const {
    data: companies,
    isLoading,
    refetch,
  } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: products } = useQuery<ProductWithCompany[]>({
    queryKey: ["/api/products"],
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDeleteModal({ visible: false, company: null });
    },
  });

  const getProductCount = (companyId: number) => {
    if (!products) return 0;
    return products.filter((p) => p.company_id === companyId).length;
  };

  const filteredCompanies = React.useMemo(() => {
    if (!companies) return [];
    if (!searchQuery.trim()) return companies;

    const query = searchQuery.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.contact_info && c.contact_info.toLowerCase().includes(query)),
    );
  }, [companies, searchQuery]);

  const handleDelete = (company: Company) => {
    setDeleteModal({ visible: true, company });
  };

  const confirmDelete = () => {
    if (deleteModal.company) {
      deleteMutation.mutate(deleteModal.company.id);
    }
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate("AddCompany")}
          style={({ pressed }) => [
            { opacity: pressed ? 0.5 : 1, padding: Spacing.sm },
          ]}
          hitSlop={8}
        >
          <Feather name="plus" size={24} color={theme.primary} />
        </Pressable>
      ),
    });
  }, [navigation, theme]);

  if (!isLoading && (!companies || companies.length === 0)) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <EmptyState
          icon="briefcase"
          title="No Companies Yet"
          message="Add your first medical company to start managing your inventory."
          actionLabel="Add Company"
          onAction={() => navigation.navigate("AddCompany")}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search companies..."
        />
      </View>

      <FlatList
        data={filteredCompanies}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <CompanyListItem
            company={item}
            productCount={getProductCount(item.id)}
            onDelete={() => handleDelete(item)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="search"
            title="No Results"
            message="No companies match your search criteria."
          />
        }
      />

      <ConfirmModal
        visible={deleteModal.visible}
        title="Delete Company"
        message={`Are you sure you want to delete "${deleteModal.company?.name}"? This will also delete all products from this company. This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ visible: false, company: null })}
        loading={deleteMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
});
