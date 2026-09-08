import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";
import { fetchMyPools, MyPoolSummary } from "../lib/events";
import {
  setCagnottesVisible,
  setHasPools,
  useCagnottesStrip,
} from "../lib/cagnottes-strip";

const euro = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/**
 * Bandeau "Mes cagnottes" affiché en haut de l'accueil : cagnottes actives
 * des événements que l'utilisateur organise ou auxquels il est invité.
 * Ne s'affiche rien si aucune cagnotte active (pas de state vide bruyant).
 */
export default function MyCagnottesStrip() {
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const [pools, setPools] = useState<MyPoolSummary[]>([]);
  const { visible } = useCagnottesStrip();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchMyPools()
        .then((list) => {
          if (cancelled) return;
          setPools(list);
          // L'en-tête n'a aucun moyen de savoir s'il y a des cagnottes : c'est
          // ce bandeau qui le lui dit, pour que son bouton n'apparaisse que
          // quand il ouvre réellement quelque chose.
          setHasPools(list.length > 0);
        })
        .catch(() => {
          // silencieux : ce n'est qu'un bandeau d'accueil optionnel
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (pools.length === 0) return null;

  // Replié : on ne laisse RIEN, pas même un titre. Le but est de rendre la
  // page des dates à elle-même ; une barre résiduelle la dénaturerait tout
  // autant. Le bandeau se rappelle depuis le bouton de l'en-tête.
  if (!visible) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>🐷 Mes cagnottes</Text>
        <Pressable
          onPress={() => setCagnottesVisible(false)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Masquer mes cagnottes"
        >
          <Text style={styles.collapse}>Masquer ▴</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {pools.map((pool) => {
          const pct =
            pool.mode === "goal" && pool.goal
              ? Math.min(100, Math.round((pool.totalCollected / pool.goal) * 100))
              : null;
          return (
            <Pressable
              key={pool.eventShortId}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/event/${pool.eventShortId}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {pool.eventTitle}
                </Text>
                {pool.isOrganizer && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Organisateur</Text>
                  </View>
                )}
              </View>

              <View style={styles.amountRow}>
                <Text style={styles.amountCurrent}>
                  {euro(pool.totalCollected)}
                </Text>
                {pool.mode === "goal" && pool.goal && (
                  <Text style={styles.amountGoal}> / {euro(pool.goal)}</Text>
                )}
              </View>

              {pct !== null && (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressBar, { width: `${pct}%` }]} />
                </View>
              )}

              <Text style={styles.count}>
                {pool.contributionsCount} contribution
                {pool.contributionsCount > 1 ? "s" : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { paddingTop: 10, paddingBottom: 4 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingRight: 12,
    },
    collapse: { color: c.sub, fontSize: 13, fontWeight: "600" },
    title: {
      fontSize: 15,
      fontWeight: "700",
      color: c.text,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    scroll: { paddingHorizontal: 12, gap: 10 },
    card: {
      width: 200,
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      gap: 6,
      shadowColor: c.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    cardTitle: { flex: 1, fontSize: 13, fontWeight: "700", color: c.text },
    badge: {
      backgroundColor: c.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeText: { fontSize: 9, fontWeight: "700", color: c.primary },
    amountRow: { flexDirection: "row", alignItems: "baseline" },
    amountCurrent: { fontSize: 19, fontWeight: "800", color: c.primary },
    amountGoal: { fontSize: 12, color: c.sub },
    progressTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: c.border,
      overflow: "hidden",
    },
    progressBar: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: c.primary,
    },
    count: { fontSize: 11, color: c.sub },
  });
