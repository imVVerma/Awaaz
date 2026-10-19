import React from "react";
import { View, StyleSheet, Image } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, Colors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface HeaderTitleProps {
  title: string;
  showIcon?: boolean;
}

export default function HeaderTitle({
  title,
  showIcon = false,
}: HeaderTitleProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {showIcon && (
        <Image
          source={require("../../assets/images/icon.png")}
          style={styles.icon}
          resizeMode="contain"
        />
      )}
      <ThemedText style={[styles.title, { color: theme.text }]}>
        {title}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  icon: {
    width: 28,
    height: 28,
    marginRight: Spacing.sm,
    borderRadius: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
});
