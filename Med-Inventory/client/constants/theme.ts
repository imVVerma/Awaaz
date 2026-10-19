import { Platform } from "react-native";

const primaryBlue = "#2563EB";
const primaryBlueDark = "#3B82F6";

export const Colors = {
  light: {
    text: "#0F172A", // Dark Slate 900
    textSecondary: "#475569", // Slate 600 - High contrast WCAG AAA
    textMuted: "#64748B", // Slate 500
    buttonText: "#FFFFFF",
    tabIconDefault: "#64748B",
    tabIconSelected: primaryBlue,
    link: primaryBlue,
    backgroundRoot: "#F8FAFC", // Slate 50
    backgroundDefault: "#FFFFFF", // Pure White
    backgroundSecondary: "#F1F5F9", // Slate 100
    backgroundTertiary: "#E2E8F0", // Slate 200
    border: "#E2E8F0", // Slate 200
    borderStrong: "#CBD5E1", // Slate 300
    primary: primaryBlue,
    primaryHover: "#1D4ED8",
    primaryLight: "#EFF6FF", // Blue 50
    success: "#16A34A", // Green 600
    successLight: "#DCFCE7", // Green 100
    warning: "#D97706", // Amber 600
    warningLight: "#FEF3C7", // Amber 100
    danger: "#DC2626", // Red 600
    dangerLight: "#FEE2E2", // Red 100
    info: "#0284C7", // Sky 600
    infoLight: "#E0F2FE", // Sky 100
    textTertiary: "#64748B",
    error: "#DC2626",
    badgeSuccessBg: "#DCFCE7",
    badgeSuccessBorder: "#86EFAC",
    badgeSuccessText: "#166534",
    badgeWarningBg: "#FEF3C7",
    badgeWarningBorder: "#FDE68A",
    badgeWarningText: "#92400E",
    badgeDangerBg: "#FEE2E2",
    badgeDangerBorder: "#FECACA",
    badgeDangerText: "#991B1B",
  },
  dark: {
    text: "#F8FAFC",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",
    textTertiary: "#64748B",
    buttonText: "#FFFFFF",
    tabIconDefault: "#94A3B8",
    tabIconSelected: primaryBlueDark,
    link: primaryBlueDark,
    backgroundRoot: "#0F172A",
    backgroundDefault: "#1E293B",
    backgroundSecondary: "#334155",
    backgroundTertiary: "#475569",
    border: "#334155",
    borderStrong: "#475569",
    primary: primaryBlueDark,
    primaryHover: "#2563EB",
    primaryLight: "#1E3A5F",
    success: "#16A34A",
    successLight: "#064E3B",
    warning: "#D97706",
    warningLight: "#78350F",
    danger: "#DC2626",
    dangerLight: "#7F1D1D",
    error: "#EF4444",
    info: "#0284C7",
    infoLight: "#1E3A5F",
    badgeSuccessBg: "#064E3B",
    badgeSuccessBorder: "#047857",
    badgeSuccessText: "#6EE7B7",
    badgeWarningBg: "#78350F",
    badgeWarningBorder: "#B45309",
    badgeWarningText: "#FDE68A",
    badgeDangerBg: "#7F1D1D",
    badgeDangerBorder: "#B91C1C",
    badgeDangerText: "#FCA5A5",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 44,
  buttonHeight: 44,
};

export const BorderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 20,
  "3xl": 24,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 24,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
  label: {
    fontSize: 13,
    fontWeight: "500" as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 14,
    fontWeight: "500" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "'JetBrains Mono', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
};
