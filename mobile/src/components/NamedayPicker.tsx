import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import BottomSheet from "./BottomSheet";
import { formatNameday } from "../lib/dates";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * Sélecteur de fête (nameday) au format "MM-DD".
 *
 * Grilles mois puis jour plutôt qu'une roue : aucune dépendance native à
 * ajouter (l'app est en TestFlight, on évite un nouveau build natif), et le
 * format MM-JJ n'a plus à être connu de l'utilisateur.
 */
const MONTHS = [
  "janv.", "févr.", "mars", "avril", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

// Février à 29 : une fête est récurrente, elle n'est pas liée à une année.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export default function NamedayPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<number | null>(null);

  // À l'ouverture, on repart du mois déjà enregistré.
  useEffect(() => {
    if (!open) return;
    const mm = value ? Number(value.split("-")[0]) : NaN;
    setMonth(Number.isFinite(mm) && mm >= 1 && mm <= 12 ? mm : null);
  }, [open, value]);

  const pickDay = (day: number) => {
    if (!month) return;
    onChange(
      `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setOpen(false);
  };

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={value ? styles.triggerValue : styles.triggerEmpty}>
          {value ? `🎉 ${formatNameday(value)}` : "Aucune fête définie"}
        </Text>
        <Text style={styles.triggerAction}>{value ? "Modifier" : "Choisir"}</Text>
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.sheetTitle}>
          {month ? `Jour — ${MONTHS[month - 1]}` : "Mois de la fête"}
        </Text>

        {!month ? (
          <View style={styles.grid}>
            {MONTHS.map((label, i) => (
              <Pressable
                key={label}
                style={styles.monthCell}
                onPress={() => setMonth(i + 1)}
              >
                <Text style={styles.cellText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              {Array.from({ length: DAYS_IN_MONTH[month - 1] }, (_, i) => i + 1).map(
                (day) => {
                  const selected =
                    value ===
                    `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  return (
                    <Pressable
                      key={day}
                      style={[styles.dayCell, selected && styles.cellSelected]}
                      onPress={() => pickDay(day)}
                    >
                      <Text
                        style={[styles.cellText, selected && styles.cellTextSelected]}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
            <Pressable style={styles.backBtn} onPress={() => setMonth(null)}>
              <Text style={styles.backBtnText}>← Changer de mois</Text>
            </Pressable>
          </>
        )}

        {value && (
          <Pressable style={styles.clearBtn} onPress={clear}>
            <Text style={styles.clearBtnText}>Retirer la fête</Text>
          </Pressable>
        )}
      </BottomSheet>
    </>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    trigger: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 12,
      backgroundColor: c.inputBg,
    },
    triggerValue: { fontSize: 16, color: c.text, flex: 1 },
    triggerEmpty: { fontSize: 16, color: c.placeholder, flex: 1 },
    triggerAction: { fontSize: 13, fontWeight: "700", color: c.primary },
    sheetTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: c.text,
      marginBottom: 12,
    },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    monthCell: {
      width: "31%",
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      backgroundColor: c.bg,
    },
    dayCell: {
      width: 44,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      backgroundColor: c.bg,
    },
    cellSelected: { backgroundColor: c.primary, borderColor: c.primary },
    cellText: { fontSize: 14, fontWeight: "600", color: c.text },
    cellTextSelected: { color: c.white },
    backBtn: { paddingVertical: 14, alignItems: "center" },
    backBtnText: { color: c.primary, fontWeight: "700", fontSize: 14 },
    clearBtn: { paddingVertical: 12, alignItems: "center" },
    clearBtnText: { color: c.danger, fontWeight: "700", fontSize: 14 },
  });
