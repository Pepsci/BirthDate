import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { DMMessage } from "../lib/conversations";
import { occasionEmoji } from "../lib/occasions";
import { DateEntry, fetchDates, addGift } from "../lib/dates";
import BottomSheet from "./BottomSheet";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * Carte "idées cadeaux partagées" dans le chat (message type gift_share).
 * Le destinataire peut sauvegarder les idées sur une de ses fiches.
 */
export default function GiftShareCard({
  message,
  isMine,
}: {
  message: DMMessage;
  isMine: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const [expanded, setExpanded] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);
  const [dates, setDates] = useState<DateEntry[]>([]);
  const [saved, setSaved] = useState(false);

  const personName = message.metadata?.personName;
  const gifts = message.metadata?.gifts ?? [];
  const pending = gifts.filter((g) => !g.purchased);
  const purchased = gifts.filter((g) => g.purchased);

  const openPicker = async () => {
    setPicker(true);
    try {
      setDates(await fetchDates());
    } catch {
      setDates([]);
    }
  };

  const saveTo = async (dateId: string) => {
    if (saving) return;
    setSaving(true);
    try {
      for (const g of gifts) {
        await addGift(dateId, {
          giftName: g.giftName,
          occasion: g.occasion,
          year: g.year,
        });
      }
      setSaved(true);
      setPicker(false);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  return (
    <View
      style={[styles.card, isMine ? styles.cardMine : styles.cardOther]}
    >
      <Pressable style={styles.header} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.headerText}>
          🎁 Idées cadeaux{personName ? ` · ${personName}` : ""}
        </Text>
        <Text style={styles.count}>
          {gifts.length} idée{gifts.length > 1 ? "s" : ""} {expanded ? "▾" : "▸"}
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {gifts.length === 0 && (
            <Text style={styles.empty}>Aucune idée.</Text>
          )}
          {pending.map((g, i) => (
            <Text key={`p${i}`} style={styles.giftRow} numberOfLines={1}>
              {occasionEmoji(g.occasion)} {g.giftName}
              {g.year ? ` · ${g.year}` : ""}
            </Text>
          ))}
          {purchased.map((g, i) => (
            <Text key={`b${i}`} style={styles.giftDone} numberOfLines={1}>
              ✅ {g.giftName}
            </Text>
          ))}

          {!isMine && gifts.length > 0 && !saved && (
            <Pressable style={styles.saveBtn} onPress={openPicker}>
              <Text style={styles.saveBtnText}>💾 Sauvegarder sur une fiche</Text>
            </Pressable>
          )}
          {saved && <Text style={styles.savedMsg}>✅ Sauvegardé</Text>}
        </View>
      )}

      <BottomSheet visible={picker} onClose={() => setPicker(false)}>
        <Text style={styles.sheetTitle}>Sauvegarder sur quelle fiche ?</Text>
        {dates.map((d) => (
          <Pressable
            key={d._id}
            style={styles.dateRow}
            disabled={saving}
            onPress={() => saveTo(d._id)}
          >
            <Text style={styles.dateName}>
              {(d.name || d.linkedUser?.name) ?? "?"}{" "}
              {(d.surname || d.linkedUser?.surname) ?? ""}
            </Text>
          </Pressable>
        ))}
        {dates.length === 0 && (
          <Text style={styles.empty}>Aucune fiche disponible.</Text>
        )}
      </BottomSheet>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      maxWidth: "82%",
      borderRadius: 14,
      padding: 10,
      marginVertical: 3,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    cardMine: { alignSelf: "flex-end", backgroundColor: c.primarySoft },
    cardOther: { alignSelf: "flex-start" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    headerText: { fontWeight: "800", color: c.text, fontSize: 13, flex: 1 },
    count: { color: c.sub, fontSize: 12, fontWeight: "700" },
    body: { marginTop: 8, gap: 4 },
    empty: { color: c.sub, fontSize: 12 },
    giftRow: { color: c.text, fontSize: 13 },
    giftDone: {
      color: c.faint,
      fontSize: 13,
      textDecorationLine: "line-through",
    },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: "center",
      marginTop: 8,
    },
    saveBtnText: { color: c.white, fontWeight: "700", fontSize: 13 },
    savedMsg: {
      color: c.successStrong,
      fontWeight: "700",
      fontSize: 13,
      marginTop: 6,
    },
    sheetTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: c.text,
      marginBottom: 8,
    },
    dateRow: {
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    dateName: { fontSize: 15, fontWeight: "600", color: c.text },
  });
