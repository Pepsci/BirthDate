import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import DateForm from "./DateForm";
import { DateEntry, deleteDate, updateDate } from "../lib/dates";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * Confirmation puis suppression d'une carte. Partagée entre l'écran plein
 * « Modifier » (date/edit/[id].tsx) et le panneau de droite sur iPad.
 */
export function confirmDeleteDate(
  entry: Pick<DateEntry, "_id" | "name" | "surname">,
  onDeleted: () => void,
  onError: (message: string) => void,
) {
  Alert.alert(
    "Supprimer cette date ?",
    `${entry.name} ${entry.surname ?? ""} sera retiré·e de ta liste.`,
    [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDate(entry._id);
            onDeleted();
          } catch (e: any) {
            onError(e?.message ?? "Erreur lors de la suppression.");
          }
        },
      },
    ],
  );
}

/**
 * Modification d'une carte dans le panneau de droite (vue scindée iPad /
 * pliable) : la fiche reste visible à gauche, le formulaire s'affiche à
 * droite au lieu d'ouvrir une nouvelle page.
 *
 * Même formulaire que l'écran plein (DateForm) ; l'en-tête de l'écran plein
 * (titre + corbeille) est remplacé par une barre propre au panneau.
 */
export default function DateEditPane({
  entry,
  onSaved,
  onDeleted,
  onClose,
}: {
  entry: DateEntry;
  onSaved: () => void;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.pane}>
      <View style={styles.bar}>
        <Text style={styles.title} numberOfLines={1}>
          ✏️ Modifier {entry.name}
        </Text>
        <Pressable
          onPress={() =>
            confirmDeleteDate(entry, onDeleted, (m) =>
              Alert.alert("Suppression impossible", m),
            )
          }
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Supprimer cette date"
        >
          <Text style={styles.delete}>🗑️ Supprimer</Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Fermer la modification"
        >
          <Text style={styles.close}>Fermer</Text>
        </Pressable>
      </View>
      <DateForm
        key={entry._id}
        initial={entry}
        submitLabel="Enregistrer"
        onSubmit={async (payload) => {
          await updateDate(entry._id, payload);
          onSaved();
        }}
      />
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    pane: { flex: 1 },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    title: { flex: 1, fontSize: 16, fontWeight: "700", color: c.text },
    delete: { fontSize: 13, fontWeight: "700", color: c.danger },
    close: { fontSize: 14, fontWeight: "600", color: c.primary },
  });
