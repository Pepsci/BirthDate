import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Thème global mobile — équivalent du ThemeContext web (variables.css).
 *
 * - mode "system" : suit le réglage de l'appareil (défaut)
 * - mode "light" / "dark" : choix manuel, persisté entre les lancements
 *
 * Usage dans un écran :
 *   const makeStyles = (c: ThemeColors) => StyleSheet.create({ ... });
 *   const styles = useThemedStyles(makeStyles);
 *   const { colors, resolved, setMode } = useTheme();
 */

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedMode = "light" | "dark";

const THEME_KEY = "themeMode";

// Tokens alignés sur front/src/styles/variables.css
export const LIGHT = {
  // Fond
  bg: "#f9fafb",
  bgSecondary: "#f3f4f6",
  card: "#ffffff",
  cardSoft: "#f9fafb",
  // Texte
  text: "#111827",
  sub: "#6b7280",
  faint: "#9ca3af",
  // Bordures
  border: "#e5e7eb",
  borderStrong: "#d1d5db",
  // Marque & états
  primary: "#3b82f6",
  primarySoft: "rgba(59,130,246,0.10)",
  // Équivalent du --primary-dark du web. Sert au texte bleu accentué
  // (jour courant de l'agenda, liens actifs). La valeur s'écarte du fond
  // dans chaque thème : plus foncée en clair, plus claire en sombre.
  primaryStrong: "#2563eb",
  primaryLight: "#60a5fa",
  accent: "#8b5cf6",
  accentSoft: "rgba(139,92,246,0.12)",
  accentStrong: "#7c3aed",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
  // Bandeaux d'alerte : fond teinté + texte accentué lisible dessus.
  warningSoft: "#fef3c7",
  warningStrong: "#92400e",
  successSoft: "#d1fae5",
  successStrong: "#047857",
  dangerSoft: "rgba(239,68,68,0.12)",
  // État « voté / favori » — le rose des votes cadeaux d'un événement.
  favorite: "#ec4899",
  favoriteSoft: "#fce7f3",
  favoriteStrong: "#be185d",
  // Inputs
  inputBg: "#ffffff",
  inputBorder: "#dddddd",
  placeholder: "#9ca3af",
  // Divers
  overlay: "rgba(0,0,0,0.45)",
  shadow: "#000000",
  tabBarBg: "#ffffff",
  headerBg: "#ffffff",
  white: "#ffffff",
};

export const DARK: ThemeColors = {
  bg: "#0b1120",
  bgSecondary: "#0f172a",
  card: "#151d31",
  cardSoft: "#111a2e",
  text: "#f1f5f9",
  sub: "#94a3b8",
  faint: "#64748b",
  border: "#243147",
  borderStrong: "#334155",
  primary: "#3b82f6",
  primarySoft: "rgba(59,130,246,0.16)",
  primaryStrong: "#93c5fd",
  primaryLight: "#60a5fa",
  accent: "#8b5cf6",
  accentSoft: "rgba(139,92,246,0.18)",
  accentStrong: "#a78bfa",
  success: "#10b981",
  danger: "#f87171",
  warning: "#f59e0b",
  warningSoft: "rgba(245,158,11,0.16)",
  warningStrong: "#fcd34d",
  successSoft: "rgba(16,185,129,0.16)",
  successStrong: "#6ee7b7",
  dangerSoft: "rgba(248,113,113,0.16)",
  favorite: "#ec4899",
  favoriteSoft: "rgba(236,72,153,0.18)",
  favoriteStrong: "#f9a8d4",
  inputBg: "#151d31",
  inputBorder: "#334155",
  placeholder: "#64748b",
  overlay: "rgba(0,0,0,0.6)",
  shadow: "#000000",
  tabBarBg: "#0f172a",
  headerBg: "#0f172a",
  white: "#ffffff",
};

export type ThemeColors = typeof LIGHT;

interface ThemeContextValue {
  /** Préférence : system / light / dark */
  mode: ThemeMode;
  /** Thème effectivement appliqué */
  resolved: ResolvedMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  resolved: "light",
  colors: LIGHT,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  // Restaure la préférence sauvegardée
  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        setModeState(saved);
      }
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    SecureStore.setItemAsync(THEME_KEY, m).catch(() => {});
  };

  const resolved: ResolvedMode =
    mode === "system" ? (system === "dark" ? "dark" : "light") : mode;

  const value = useMemo(
    () => ({
      mode,
      resolved,
      colors: resolved === "dark" ? DARK : LIGHT,
      setMode,
    }),
    [mode, resolved],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Construit une StyleSheet thémée, re-générée quand le thème change.
 * La factory doit être définie au niveau module (référence stable).
 */
export function useThemedStyles<T>(factory: (c: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
