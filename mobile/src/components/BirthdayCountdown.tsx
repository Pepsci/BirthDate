import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { timeUntil, timeUntilNext } from "../lib/dates";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * Compte à rebours J/H/M/S en cases dégradées, avec trait de séparation
 * au-dessus. Partagé entre les cartes d'anniversaire (accueil, détail) et les cartes
 * d'événement.
 *
 * Les couleurs suivent le dégradé du B du logo (haut → bas) :
 * bleu → violet → rose → orange.
 *
 * Deux modes :
 *   - `iso`   : anniversaire, prochaine occurrence (récurrence annuelle) ;
 *   - `until` : date unique (événement), s'arrête à zéro.
 */
export default function BirthdayCountdown(
  props: { iso: string; until?: never } | { until: Date; iso?: never },
) {
  const styles = useThemedStyles(makeStyles);
  const untilMs = props.until?.getTime();
  const compute = () =>
    untilMs != null
      ? timeUntil(new Date(untilMs))
      : timeUntilNext(props.iso as string);
  const [left, setLeft] = useState(compute);
  useEffect(() => {
    setLeft(compute());
    const t = setInterval(() => setLeft(compute()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.iso, untilMs]);

  // Progression sur le dégradé du logo : J bleu → H violet → M rose → S orange
  const cells: [number, string, [string, string]][] = [
    [left.days, "J", ["#3B82F6", "#8B5CF6"]],
    [left.hours, "H", ["#8B5CF6", "#EC4899"]],
    [left.minutes, "M", ["#EC4899", "#F59E0B"]],
    [left.seconds, "S", ["#F59E0B", "#FF8C00"]],
  ];

  return (
    <View style={styles.row}>
      {cells.map(([value, label, colors]) => (
        <View key={label} style={styles.cell}>
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.box}
          >
            <Text style={styles.value}>{value}</Text>
          </LinearGradient>
          <Text style={styles.label}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: {
      alignSelf: "stretch",
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "flex-start",
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    cell: { alignItems: "center", gap: 3 },
    box: {
      minWidth: 34,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    value: { color: c.white, fontWeight: "800", fontSize: 15 },
    label: { color: c.sub, fontWeight: "700", fontSize: 10 },
  });
