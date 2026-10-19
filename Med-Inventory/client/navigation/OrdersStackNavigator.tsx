import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import OrdersScreen from "@/screens/OrdersScreen";
import CreateOrderScreen from "@/screens/CreateOrderScreen";
import OrderDetailScreen from "@/screens/OrderDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type OrdersStackParamList = {
  Orders: undefined;
  CreateOrder: { customerId?: number } | undefined;
  OrderDetail: { orderId: number };
};

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export default function OrdersStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          headerTitle: "Sales & Invoices",
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
          headerTitle: "Tax Invoice",
        }}
      />
    </Stack.Navigator>
  );
}
