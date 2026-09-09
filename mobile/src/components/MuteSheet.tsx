import { View, Text, Pressable, StyleSheet } from "react-native";
import BottomSheet from "./BottomSheet";
import {
  ChatMute,
  MUTE_CHOICES,
  MuteDuration,
  muteLabel,
} from "../lib/mutes";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * Choix de la durée du silencieux d'une conversation.
 *
 * ⚠️ Le texte dit ce qui est coupé ET ce qui ne l'est pas. Couper les
 * notifications d'une conversation ne la fait pas disparaître : elle continue
 * de remonter dans la liste avec son badge. Sans cette phrase, quelqu'un qui
 * coupe croit ne plus rien recevoir du tout, et s'étonne de voir des non-lus.
 */
export default function MuteSheet({
  visible,
  mute,
  onClose,
  onSelect,
  onClear,
}: {
  visible: boolean;
  mute: ChatMute | null;
  onClose: () => void;
  onSelect: (d: MuteDuration) => void;
  onClear: () => void;
}) {
  const styles = useThemedStyles(makeStyles);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>
        {mute ? "Notifications coupées" : "Couper les notifications"}
      </Text>
      <Text style={styles.sub}>
        {mute
          ? `Coupées ${muteLabel(mute.until)}. La conversation reste visible et ses messages non lus continuent d'apparaître.`
          : "Ton téléphone ne sonnera plus pour cette conversation. Elle reste visible dans ta liste, avec ses messages non lus."}
      </Text>

      {MUTE_CHOICES.map((c) => (
        <Pressable
          key={c.value}
          style={styles.row}
          onPress={() => {
            onSelect(c.value);
            onClose();
          }}
        >
          <Text style={styles.rowText}>{c.label}</Text>
        </Pressable>
      ))}

      {mute && (
        <Pressable
          style={styles.reactivate}
          onPress={() => {
            onClear();
            onClose();
          }}
        >
          <Text style={styles.reactivateText}>🔔 Réactiver les notifications</Text>
        </Pressable>
      )}
    </BottomSheet>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    title: { fontSize: 18, fontWeight: "800", color: c.text },
    sub: { color: c.sub, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 12 },
    row: {
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    rowText: { fontSize: 15, fontWeight: "600", color: c.text },
    reactivate: {
      marginTop: 14,
      paddingVertical: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.primary,
      alignItems: "center",
    },
    reactivateText: { color: c.primary, fontWeight: "700", fontSize: 14.5 },
  });
