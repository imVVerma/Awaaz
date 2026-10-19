import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProductsScreen from "@/screens/ProductsScreen";
import AddProductScreen from "@/screens/AddProductScreen";
import EditProductScreen from "@/screens/EditProductScreen";
import ImportCatalogueScreen from "@/screens/ImportCatalogueScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import type { ProductWithCompany } from "@shared/types";

export type ProductsStackParamList = {
  Products: undefined;
  AddProduct: undefined;
  EditProduct: { product: ProductWithCompany };
  ImportCatalogue: undefined;
};

const Stack = createNativeStackNavigator<ProductsStackParamList>();

export default function ProductsStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Products"
        component={ProductsScreen}
        options={{
          headerTitle: "Products",
        }}
      />
      <Stack.Screen
        name="AddProduct"
        component={AddProductScreen}
        options={{
          headerTitle: "Add Product",
        }}
      />
      <Stack.Screen
        name="EditProduct"
        component={EditProductScreen}
        options={{
          headerTitle: "Edit Product",
        }}
      />
      <Stack.Screen
        name="ImportCatalogue"
        component={ImportCatalogueScreen}
        options={{
          headerTitle: "Import Catalogue",
        }}
      />
    </Stack.Navigator>
  );
}
