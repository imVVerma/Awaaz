import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DashboardScreen from "@/screens/DashboardScreen";
import LowStockScreen from "@/screens/LowStockScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import HeaderTitle from "@/components/HeaderTitle";

export type DashboardStackParamList = {
  Dashboard: undefined;
  LowStock: undefined;
};

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export default function DashboardStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerTitle: () => <HeaderTitle title="MedStock" showIcon />,
        }}
      />
      <Stack.Screen
        name="LowStock"
        component={LowStockScreen}
        options={{
          headerTitle: "Low Stock Items",
        }}
      />
    </Stack.Navigator>
  );
}
