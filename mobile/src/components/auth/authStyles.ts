import { StyleSheet } from "react-native";
import { ThemeColors } from "../../lib/theme-context";

/**
 * Styles partagés par les trois panneaux de l'écran /login
 * (connexion, inscription, mot de passe oublié).
 *
 * Référence de module stable → utilisable directement avec useThemedStyles.
 */
export const makeAuthStyles = (c: ThemeColors) =>
  StyleSheet.create({
    page: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 16,
      gap: 10,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      textAlign: "center",
      color: c.text,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 13.5,
      textAlign: "center",
      color: c.sub,
      marginBottom: 10,
      lineHeight: 19,
    },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      backgroundColor: c.inputBg,
      color: c.text,
    },
    hint: { color: c.faint, fontSize: 12, textAlign: "center" },
    error: { color: c.danger, textAlign: "center" },
    warn: {
      color: c.warning,
      fontSize: 12,
      textAlign: "center",
      marginTop: 10,
      lineHeight: 17,
    },
    button: {
      backgroundColor: c.primary,
      borderRadius: 10,
      padding: 15,
      alignItems: "center",
      marginTop: 8,
    },
    buttonText: { color: c.white, fontSize: 16, fontWeight: "600" },
    link: {
      color: c.primary,
      textAlign: "center",
      marginTop: 12,
      fontSize: 14,
    },
    doneText: { color: c.sub, textAlign: "center", lineHeight: 22 },
    // Date de naissance (inscription)
    pickerWrap: { alignItems: "center", width: "100%" },
    dateText: { fontSize: 16, color: c.text },
    datePlaceholder: { fontSize: 16, color: c.placeholder },
    // Conditions d'utilisation (inscription)
    termsRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 4,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: c.inputBorder,
      backgroundColor: c.inputBg,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 1,
    },
    checkboxOn: { backgroundColor: c.primary, borderColor: c.primary },
    checkmark: { color: c.white, fontSize: 14, fontWeight: "700" },
    termsText: { flex: 1, color: c.sub, fontSize: 13, lineHeight: 18 },
    termsLink: { color: c.primary, textDecorationLine: "underline" },
  });

/** Index des panneaux dans le pager de /login. */
export const PANELS = { login: 0, signup: 1, forgot: 2 } as const;
export type PanelName = keyof typeof PANELS;
