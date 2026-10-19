import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomersScreen from "@/screens/CustomersScreen";
import AddCustomerScreen from "@/screens/AddCustomerScreen";
import CustomerDetailScreen from "@/screens/CustomerDetailScreen";
import CreateOrderScreen from "@/screens/CreateOrderScreen";
import OrderDetailScreen from "@/screens/OrderDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type CustomersStackParamList = {
  Customers: undefined;
  AddCustomer: undefined;
  CustomerDetail: { customerId: number };
  CreateOrder: { customerId?: number } | undefined;
  OrderDetail: { orderId: number };
};

const Stack = createNativeStackNavigator<CustomersStackParamList>();

export default function CustomersStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Customers"
        component={CustomersScreen}
        options={{
          headerTitle: "Pharmacies & Retailers",
        }}
      />
      <Stack.Screen
        name="AddCustomer"
        component={AddCustomerScreen}
        options={{
          headerTitle: "Register Pharmacy",
        }}
      />
      <Stack.Screen
        name="CustomerDetail"
        component={CustomerDetailScreen}
        options={{
          headerTitle: "Pharmacy Profile",
        }}
      />
      <Stack.Screen
        name="CreateOrder"
        component={CreateOrderScreen}
        options={{
          headerTitle: "New Sales Invoice",
        }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{
          headerTitle: "Sales Tax Invoice",
        }}
      />
    </Stack.Navigator>
  );
}
