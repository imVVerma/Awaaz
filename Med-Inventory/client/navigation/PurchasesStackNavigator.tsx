import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PurchasesScreen from "@/screens/PurchasesScreen";
import CreatePurchaseScreen from "@/screens/CreatePurchaseScreen";
import PurchaseDetailScreen from "@/screens/PurchaseDetailScreen";
import SuppliersScreen from "@/screens/SuppliersScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type PurchasesStackParamList = {
  Purchases: undefined;
  CreatePurchase: undefined;
  PurchaseDetail: { purchaseId: number };
  Suppliers: undefined;
};

const Stack = createNativeStackNavigator<PurchasesStackParamList>();

export default function PurchasesStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Purchases"
        component={PurchasesScreen}
        options={{
          headerTitle: "Inbound Purchases",
        }}
      />
      <Stack.Screen
        name="CreatePurchase"
        component={CreatePurchaseScreen}
        options={{
          headerTitle: "Receive Inbound Invoice",
        }}
      />
      <Stack.Screen
        name="PurchaseDetail"
        component={PurchaseDetailScreen}
        options={{
          headerTitle: "Purchase Invoice Detail",
        }}
      />
      <Stack.Screen
        name="Suppliers"
        component={SuppliersScreen}
        options={{
          headerTitle: "Suppliers & Vendors",
        }}
      />
    </Stack.Navigator>
  );
}
