import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { Stack } from "expo-router";
import { CHANGELOG, ChangelogEntry } from "../../lib/changelog";
import {
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";
import { usePersistedCollapse } from "../../lib/collapse-prefs";

const COLLAPSE_SCOPE = "profile_changelog";

/** "8 août 2026" */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ChangelogScreen() {
  const styles = useThemedStyles(makeStyles);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Notes de mise à jour" }} />

      {CHANGELOG.map((entry, i) => (
        // Repliée par défaut sauf la plus récente, mais l'état choisi par
        // l'utilisateur est mémorisé (même mécanisme que les événements).
        <ChangelogCard key={entry.version} entry={entry} defaultOpen={i === 0} />
      ))}
    </ScrollView>
  );
}

function ChangelogCard({
  entry,
  defaultOpen,
}: {
  entry: ChangelogEntry;
  defaultOpen: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = usePersistedCollapse(
    COLLAPSE_SCOPE,
    entry.version,
    defaultOpen,
  );

  return (
    <View style={styles.card}>
      <Pressable style={styles.headerRow} onPress={() => setOpen(!open)}>
        <Text style={styles.title}>{entry.title}</Text>
        <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
        <Text style={styles.version}>v{entry.version}</Text>
      </Pressable>
      <Text style={styles.date}>
        {formatDate(entry.date)} · build {entry.build}
      </Text>

      {open && (
        <>
          {entry.note && <Text style={styles.note}>{entry.note}</Text>}
          <View style={styles.items}>
            {entry.items.map((item, i) => (
              <Text key={i} style={styles.item}>
                {item}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 12, gap: 12, paddingBottom: 32 },
    card: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 16,
      gap: 4,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: { fontSize: 17, fontWeight: "700", color: c.text, flex: 1 },
    chevron: { fontSize: 13, color: c.faint, fontWeight: "700", marginLeft: 6 },
    version: { fontSize: 12, fontWeight: "700", color: c.primary, marginLeft: 6 },
    date: { fontSize: 12, color: c.sub, marginBottom: 8 },
    note: {
      fontSize: 12,
      fontStyle: "italic",
      color: c.sub,
      backgroundColor: c.inputBg,
      borderRadius: 8,
      padding: 8,
      marginBottom: 8,
    },
    items: { gap: 8 },
    item: { fontSize: 14, color: c.text, lineHeight: 20 },
  });
