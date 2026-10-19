import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ReportsScreen from "@/screens/ReportsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ReportsStackParamList = {
  Reports: undefined;
};

const Stack = createNativeStackNavigator<ReportsStackParamList>();

export default function ReportsStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          headerTitle: "Reports",
        }}
      />
    </Stack.Navigator>
  );
}
