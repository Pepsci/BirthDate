import { t } from "@/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect } from "expo-router";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";
import { isLocalMode } from "../lib/app-mode";
import { registerForPush } from "../lib/push";

const DISMISS_KEY = "pushBlockedHomeDismissed";

/**
 * Bandeau « les notifications sont bloquées sur ce téléphone ».
 *
 * Pourquoi : après un refus, iOS ne laisse plus l'app reposer la question.
 * Sans ce bandeau, quelqu'un qui a dit non au premier lancement peut cocher
 * tous les réglages de notifications sans jamais rien recevoir, et sans
 * comprendre pourquoi. La seule issue est la page de réglages du téléphone,
 * que le bouton ouvre directement.
 *
 * Deux usages :
 *   - `variant="settings"` (Profil → Notifications) : affiché tant que la
 *     permission est refusée ;
 *   - `variant="home"` (accueil) : même message, mais refermable, et il ne
 *     revient plus une fois fermé.
 *
 * La permission est relue à chaque retour sur l'écran et à chaque retour dans
 * l'app : en revenant des réglages, le bandeau disparaît tout seul, et le
 * téléphone est enregistré pour les notifications sans attendre un
 * redémarrage.
 *
 * Mode sans compte : rien ici, l'écran Profil → Rappels a son propre
 * avertissement (les rappels y sont programmés par le téléphone).
 */
export default function PushBlockedBanner({
  variant,
}: {
  variant: "settings" | "home";
}) {
  const styles = useThemedStyles(makeStyles);
  const [denied, setDenied] = useState(false);
  const [dismissed, setDismissed] = useState(variant === "home");
  const wasDenied = useRef(false);

  const check = useCallback(async () => {
    if (isLocalMode()) return;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      const isDenied = status === "denied";
      // Refusée puis accordée (retour des réglages) : on enregistre le
      // téléphone tout de suite.
      if (wasDenied.current && status === "granted") registerForPush();
      wasDenied.current = isDenied;
      setDenied(isDenied);
    } catch {
      // Lecture impossible : on n'affiche rien plutôt qu'un faux avertissement.
    }
  }, []);

  // Accueil : a-t-il déjà été fermé ?
  useEffect(() => {
    if (variant !== "home") return;
    SecureStore.getItemAsync(DISMISS_KEY)
      .then((value) => setDismissed(value === "1"))
      .catch(() => setDismissed(true));
  }, [variant]);

  useFocusEffect(
    useCallback(() => {
      check();
    }, [check]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => sub.remove();
  }, [check]);

  if (isLocalMode() || !denied || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    SecureStore.setItemAsync(DISMISS_KEY, "1").catch(() => {});
  };

  return (
    <View style={[styles.box, variant === "home" && styles.boxHome]}>
      <Text style={styles.title}>{t("notifs:blocked.title")}</Text>
      <Text style={styles.text}>
        {variant === "home"
          ? t("notifs:blocked.homeText")
          : t("notifs:blocked.settingsText")}
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={() => Linking.openSettings()} hitSlop={8}>
          <Text style={styles.link}>{t("common:actions.openSettings")}</Text>
        </Pressable>
        {variant === "home" && (
          <Pressable onPress={dismiss} hitSlop={8}>
            <Text style={styles.later}>{t("notifs:blocked.later")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    box: {
      backgroundColor: c.warningSoft,
      borderRadius: 14,
      padding: 14,
      gap: 6,
      marginBottom: 12,
    },
    boxHome: { marginHorizontal: 16, marginTop: 10, marginBottom: 4 },
    title: { fontSize: 15, fontWeight: "700", color: c.warningStrong },
    text: { fontSize: 13, lineHeight: 18, color: c.warningStrong },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 20,
      marginTop: 4,
    },
    link: { fontSize: 14, fontWeight: "700", color: c.primary },
    later: { fontSize: 14, fontWeight: "600", color: c.warningStrong },
  });
