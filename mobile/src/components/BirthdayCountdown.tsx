import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { timeUntilNext } from "../lib/dates";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * Compte à rebours J/H/M/S en cases dégradées, avec trait de séparation
 * au-dessus. Partagé entre la carte d'accueil et la carte détail.
 *
 * Les couleurs suivent le dégradé du B du logo (haut → bas) :
 * bleu → violet → rose → orange.
 */
export default function BirthdayCountdown({ iso }: { iso: string }) {
  const styles = useThemedStyles(makeStyles);
  const [left, setLeft] = useState(() => timeUntilNext(iso));
  useEffect(() => {
    const t = setInterval(() => setLeft(timeUntilNext(iso)), 1000);
    return () => clearInterval(t);
  }, [iso]);

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
    value: { color: "#fff", fontWeight: "800", fontSize: 15 },
    label: { color: c.sub, fontWeight: "700", fontSize: 10 },
  });
