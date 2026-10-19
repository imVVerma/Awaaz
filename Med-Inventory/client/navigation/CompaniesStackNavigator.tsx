import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CompaniesScreen from "@/screens/CompaniesScreen";
import AddCompanyScreen from "@/screens/AddCompanyScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type CompaniesStackParamList = {
  Companies: undefined;
  AddCompany: undefined;
};

const Stack = createNativeStackNavigator<CompaniesStackParamList>();

export default function CompaniesStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Companies"
        component={CompaniesScreen}
        options={{
          headerTitle: "Companies",
        }}
      />
      <Stack.Screen
        name="AddCompany"
        component={AddCompanyScreen}
        options={{
          headerTitle: "Add Company",
        }}
      />
    </Stack.Navigator>
  );
}
