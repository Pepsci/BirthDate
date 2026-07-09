import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { timeUntilNext } from "../lib/dates";

/**
 * Compte à rebours J/H/M/S en cases dégradé bleu, avec trait de séparation
 * au-dessus. Partagé entre la carte d'accueil et la carte détail.
 */
export default function BirthdayCountdown({ iso }: { iso: string }) {
  const [left, setLeft] = useState(() => timeUntilNext(iso));
  useEffect(() => {
    const t = setInterval(() => setLeft(timeUntilNext(iso)), 1000);
    return () => clearInterval(t);
  }, [iso]);

  // Dégradé progressif : de bleu clair (J) à bleu foncé (S)
  const cells: [number, string, [string, string]][] = [
    [left.days, "J", ["#93c5fd", "#60a5fa"]],
    [left.hours, "H", ["#60a5fa", "#3b82f6"]],
    [left.minutes, "M", ["#3b82f6", "#2563eb"]],
    [left.seconds, "S", ["#2563eb", "#1e40af"]],
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

const styles = StyleSheet.create({
  row: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
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
  label: { color: "#6b7280", fontWeight: "700", fontSize: 10 },
});
