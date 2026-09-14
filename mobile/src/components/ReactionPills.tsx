import { Pressable, StyleSheet, Text, View } from "react-native";
import ReactionIcon, { ReactionName } from "./icons/ReactionIcon";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

export type MessageReaction = { user: string; reaction: ReactionName };

/**
 * Pastilles de réactions affichées sous une bulle.
 *
 * ⚠️ Regroupées par type avec un compteur, jamais une pastille par personne :
 * sur un message d'événement à douze participants, l'affichage individuel
 * déborderait de l'écran et noierait le message lui-même.
 *
 * Le compteur n'apparaît qu'à partir de deux — « ❤️ 1 » est du bruit, la
 * présence de la pastille dit déjà « une personne ».
 *
 * Taper une pastille bascule sa propre réaction : c'est le raccourci qu'on
 * cherche instinctivement pour se joindre à ce qui est déjà là, sans repasser
 * par l'appui long.
 */
export default function ReactionPills({
  reactions,
  myUserId,
  onToggle,
}: {
  reactions?: MessageReaction[] | null;
  myUserId: string | null;
  onToggle?: (reaction: ReactionName) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  if (!reactions || reactions.length === 0) return null;

  const grouped = new Map<ReactionName, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const entry = grouped.get(r.reaction) || { count: 0, mine: false };
    entry.count += 1;
    if (myUserId && r.user === myUserId) entry.mine = true;
    grouped.set(r.reaction, entry);
  }

  return (
    <View style={styles.row}>
      {[...grouped.entries()].map(([name, { count, mine }]) => (
        <Pressable
          key={name}
          hitSlop={4}
          onPress={() => onToggle?.(name)}
          style={[styles.pill, mine && styles.pillMine]}
        >
          <ReactionIcon name={name} size={14} />
          {count > 1 && <Text style={styles.count}>{count}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: -4 },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: c.bgSecondary,
      borderWidth: 1,
      borderColor: c.border,
    },
    // Sa propre réaction est cerclée d'accent : on doit pouvoir repérer d'un
    // coup d'œil ce qu'on a soi-même posé.
    pillMine: { borderColor: c.primary, backgroundColor: c.primarySoft },
    count: { fontSize: 11, fontWeight: "700", color: c.sub },
  });
