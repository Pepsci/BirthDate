import { useCallback, useState } from "react";
import { Linking, Pressable, Text, View, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../lib/auth-context";
import {
  AvailableUpdate,
  Announcement,
  fetchHomeBanners,
  dismissAnnouncement,
  dismissUpdate,
} from "../lib/app-update";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * Bandeaux de l'accueil pilotés depuis l'admin web (« Bandeaux app ») :
 *
 *  - « Nouvelle version disponible » : un appui ouvre le Play Store / TestFlight.
 *    Une fois fermé, il ne revient plus pour cette version (mémorisée sur le
 *    téléphone) ; il réapparaît quand une version plus récente est publiée.
 *  - Annonce : titre, message, lien facultatif. Une fois fermée, elle ne
 *    revient plus (id mémorisé sur le téléphone).
 *
 * Vérifiés à chaque retour sur l'accueil (réponse serveur en cache 5 min).
 * Mode compte uniquement : en mode local, aucune requête ne part.
 */
export default function HomeBanners() {
  const { mode } = useAuth();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (mode !== "account") {
        setUpdate(null);
        setAnnouncement(null);
        return;
      }
      let cancelled = false;
      fetchHomeBanners().then((b) => {
        if (cancelled) return;
        setUpdate(b.update);
        setAnnouncement(b.announcement);
      });
      return () => {
        cancelled = true;
      };
    }, [mode]),
  );

  // Lien d'annonce : écran de l'app (/contact) ou page web (https://…)
  const openLink = (url: string) => {
    if (url.startsWith("/")) router.push(url as never);
    else Linking.openURL(url).catch(() => {});
  };

  if (!update && !announcement) return null;

  return (
    <>
      {update && (
        <View style={[styles.banner, styles.update]}>
          <Pressable
            style={styles.body}
            onPress={() => Linking.openURL(update.url).catch(() => {})}
          >
            <Text style={[styles.title, styles.updateText]}>
              {update.title || "✨ Nouvelle version disponible"}
            </Text>
            <Text style={[styles.text, styles.updateText]}>
              {update.message ||
                `BirthReminder ${update.version} est prête. Touche ici pour mettre à jour.`}
            </Text>
          </Pressable>
          <Pressable
            hitSlop={10}
            accessibilityLabel="Masquer"
            onPress={() => {
              dismissUpdate(update.version);
              setUpdate(null);
            }}
          >
            <Text style={[styles.close, styles.updateText]}>✕</Text>
          </Pressable>
        </View>
      )}

      {announcement && (
        <View style={[styles.banner, styles.announce]}>
          <Pressable
            style={styles.body}
            disabled={!announcement.url}
            onPress={() => announcement.url && openLink(announcement.url)}
          >
            {announcement.title && (
              <Text style={[styles.title, styles.announceText]}>
                {announcement.title}
              </Text>
            )}
            {announcement.message && (
              <Text style={[styles.text, styles.announceText]}>
                {announcement.message}
              </Text>
            )}
          </Pressable>
          <Pressable
            hitSlop={10}
            accessibilityLabel="Fermer l'annonce"
            onPress={() => {
              dismissAnnouncement(announcement.id);
              setAnnouncement(null);
            }}
          >
            <Text style={[styles.close, styles.announceText]}>✕</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginHorizontal: 12,
      marginTop: 8,
    },
    update: { backgroundColor: c.primarySoft },
    updateText: { color: c.primaryStrong },
    announce: { backgroundColor: c.accentSoft },
    announceText: { color: c.accentStrong },
    body: { flex: 1 },
    title: { fontSize: 14, fontWeight: "700" },
    text: { fontSize: 12.5, marginTop: 2, lineHeight: 18 },
    close: { fontSize: 16, fontWeight: "700" },
  });
