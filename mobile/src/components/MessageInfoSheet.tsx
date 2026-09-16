import { StyleSheet, Text, View } from "react-native";
import BottomSheet from "./BottomSheet";
import type { DMMessage } from "../lib/conversations";
import { getReceiptTimes, formatReceiptDate } from "../lib/receipts";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * « Infos message », comme sur WhatsApp : quand un de mes messages a été
 * envoyé, distribué et lu. Uniquement sur mes propres messages.
 */
export default function MessageInfoSheet({
  message,
  preview,
  myUserId,
  onClose,
}: {
  message: DMMessage | null;
  preview: string;
  myUserId: string | null;
  onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  if (!message) return null;

  const { sentAt, deliveredAt, readAt } = getReceiptTimes(message, myUserId);
  const rows = [
    { key: "read", ticks: "✓✓", label: "Lu", date: readAt },
    { key: "delivered", ticks: "✓✓", label: "Distribué", date: deliveredAt },
    { key: "sent", ticks: "✓", label: "Envoyé", date: sentAt },
  ];

  return (
    <BottomSheet visible={!!message} onClose={onClose}>
      <Text style={styles.title}>Infos message</Text>
      {preview ? (
        <Text style={styles.preview} numberOfLines={3}>
          {preview}
        </Text>
      ) : null}
      {rows.map((row, i) => (
        <View
          key={row.key}
          style={[styles.row, i === rows.length - 1 && styles.rowLast]}
        >
          <Text style={[styles.ticks, row.key === "read" && styles.ticksRead]}>
            {row.ticks}
          </Text>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.date}>{formatReceiptDate(row.date)}</Text>
        </View>
      ))}
    </BottomSheet>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    title: { fontSize: 17, fontWeight: "700", color: c.text, marginBottom: 12 },
    preview: {
      backgroundColor: c.primary,
      color: "#ffffff",
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      fontSize: 15,
      lineHeight: 20,
      marginBottom: 12,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowLast: { borderBottomWidth: 0 },
    ticks: { width: 28, color: c.faint, fontWeight: "700" },
    ticksRead: { color: c.primary },
    label: { flex: 1, fontSize: 15, color: c.text },
    date: { fontSize: 14, color: c.sub },
  });
