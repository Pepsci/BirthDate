import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useOfflineStatus } from "../lib/offline-status";
import { useQueueStatus, clearFailures } from "../lib/offline-queue";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * Bandeau d'état hors ligne, en trois cas (du plus important au moins) :
 *  1. des modifications faites hors ligne ont été refusées par le serveur :
 *     on dit lesquelles, jusqu'à ce que l'utilisateur ferme le message ;
 *  2. hors ligne : de quand datent les données, ce qui reste possible et ce
 *     qui ne l'est pas (détail repliable, replié pour toute la session une
 *     fois masqué) ;
 *  3. en ligne mais des modifications attendent encore d'être envoyées.
 */
/** Détail « possible / indisponible » masqué par l'utilisateur (session). */
let detailsHiddenForSession = false;

export default function OfflineBanner() {
  const [detailsHidden, setDetailsHidden] = useState(detailsHiddenForSession);
  const toggleDetails = () => {
    detailsHiddenForSession = !detailsHidden;
    setDetailsHidden(!detailsHidden);
  };
  const styles = useThemedStyles(makeStyles);
  const { offline, lastSync } = useOfflineStatus();
  const { ops, failures, syncing } = useQueueStatus();
  const pending = ops.length;

  if (failures.length > 0) {
    return (
      <View style={[styles.banner, styles.bannerError]} accessibilityRole="alert">
        <Text style={[styles.title, styles.textError]}>
          ⚠️ {failures.length > 1 ? `${failures.length} modifications n'ont pas pu être envoyées` : "Une modification n'a pas pu être envoyée"}
        </Text>
        {failures.map((f, i) => (
          <Text key={i} style={[styles.text, styles.textError]}>
            • {f}
          </Text>
        ))}
        <Pressable onPress={clearFailures} style={styles.dismiss} hitSlop={8}>
          <Text style={[styles.dismissText, styles.textError]}>OK</Text>
        </Pressable>
      </View>
    );
  }

  if (offline) {
    const when = lastSync
      ? new Date(lastSync).toLocaleString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
    return (
      <View style={styles.banner} accessibilityRole="alert">
        <Pressable onPress={toggleDetails} hitSlop={6} style={styles.headerRow}>
          <Text style={[styles.title, styles.headerTitle]}>
            📡 Hors ligne{when ? ` · données du ${when}` : ""}
          </Text>
          <Text style={styles.toggle}>
            {detailsHidden ? "Détails ▸" : "Masquer ▾"}
          </Text>
        </Pressable>
        {pending > 0 && (
          <Text style={styles.text}>
            ⏳ {pending} modification{pending > 1 ? "s" : ""} en attente d'envoi.
          </Text>
        )}
        {!detailsHidden && (
          <>
            <Text style={styles.text}>
              <Text style={styles.label}>✅ Possible : </Text>
              consulter tes dates, l'agenda et les événements déjà ouverts ;
              ajouter, modifier ou supprimer une date (envoyé au retour de la
              connexion).
            </Text>
            <Text style={styles.text}>
              <Text style={styles.label}>🚫 Indisponible : </Text>
              chat, ajout de cadeaux ou de photos, amis, cagnottes, listes
              communes, réponses et votes aux événements.
            </Text>
          </>
        )}
      </View>
    );
  }

  if (pending > 0) {
    return (
      <View style={styles.banner}>
        <Text style={styles.text}>
          ⏳ {syncing ? "Envoi de" : "En attente :"} {pending} modification
          {pending > 1 ? "s" : ""} faite{pending > 1 ? "s" : ""} hors ligne…
        </Text>
      </View>
    );
  }

  return null;
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    banner: {
      backgroundColor: c.warningSoft,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginHorizontal: 12,
      marginTop: 8,
      marginBottom: 4,
    },
    bannerError: { backgroundColor: c.dangerSoft },
    title: { color: c.warningStrong, fontWeight: "700", fontSize: 13 },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    headerTitle: { flex: 1 },
    toggle: { color: c.warningStrong, fontSize: 12, fontWeight: "600" },
    label: { fontWeight: "700" },
    text: { color: c.warningStrong, fontSize: 12, lineHeight: 16, marginTop: 2 },
    textError: { color: c.danger },
    dismiss: { alignSelf: "flex-end", marginTop: 6 },
    dismissText: { fontWeight: "700", fontSize: 13 },
  });
