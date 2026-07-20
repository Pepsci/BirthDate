/**
 * Astuces d'onboarding contextuelles — une par écran, affichée uniquement
 * lors de la première visite de l'écran concerné, puis mémorisée pour de bon
 * (expo-secure-store, déjà utilisé ailleurs — évite une dépendance de plus).
 *
 * Usage : <OnboardingTip id="birthdays" text="…" /> en tête d'écran.
 */
import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect } from "expo-router";
import { useThemedStyles, ThemeColors } from "./theme-context";

const KEY_PREFIX = "onboardingTip_";

async function isTipSeen(id: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY_PREFIX + id)) === "1";
  } catch {
    return true; // en cas de doute, ne pas polluer l'écran
  }
}

async function markTipSeen(id: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY_PREFIX + id, "1");
  } catch {
    // silencieux : au pire l'astuce réapparaîtra
  }
}

type Props = {
  /** Identifiant unique et stable de l'astuce (ex. "birthdays"). */
  id: string;
  emoji?: string;
  text: string;
};

export default function OnboardingTip({ id, emoji = "💡", text }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [visible, setVisible] = useState(false);

  // Vérifié à chaque focus : l'astuce n'apparaît que quand l'utilisateur
  // visite réellement cet écran (les onglets sont montés paresseusement).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      isTipSeen(id).then((seen) => {
        if (active && !seen) setVisible(true);
      });
      return () => {
        active = false;
      };
    }, [id]),
  );

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    markTipSeen(id);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.text}>{text}</Text>
      <Pressable onPress={dismiss} hitSlop={8} style={styles.button}>
        <Text style={styles.buttonText}>Compris !</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "stretch", // écrans à contenu centré (ex. Profil)
      gap: 10,
      marginHorizontal: 16,
      marginTop: 10,
      marginBottom: 4,
      padding: 12,
      borderRadius: 12,
      backgroundColor: c.inputBg,
      borderWidth: 1,
      borderColor: c.primary,
    },
    emoji: { fontSize: 20 },
    text: { flex: 1, color: c.text, fontSize: 13, lineHeight: 18 },
    button: {
      backgroundColor: c.primary,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    buttonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  });
