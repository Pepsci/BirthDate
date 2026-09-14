import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import ReactionIcon, {
  REACTIONS,
  REACTION_LABELS,
  ReactionName,
} from "./icons/ReactionIcon";
import {
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

/**
 * Menu d'actions sur un message : rangée de réactions, puis actions classiques.
 *
 * ⚠️ Remplace un `Alert.alert`, et ce n'est pas cosmétique.
 *
 * Une réaction se pose d'un geste : on vise l'icône, on tape. Dans une alerte
 * système, il aurait fallu une ligne de texte par réaction — « 👍 J'aime »,
 * « ❤️ J'adore »… — soit six lignes à lire avant de choisir, pour une action
 * qui doit être instantanée. La rangée horizontale rend le choix visuel : on
 * reconnaît la forme sans lire.
 *
 * Les actions textuelles (répondre, modifier, supprimer) restent en dessous,
 * en liste, parce qu'elles se lisent — ce sont des décisions, pas des réflexes.
 */

export type MessageAction = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

export default function MessageActionSheet({
  visible,
  currentReaction,
  onReact,
  actions,
  onClose,
}: {
  visible: boolean;
  /** Réaction déjà posée par l'utilisateur, pour la mettre en évidence. */
  currentReaction?: ReactionName | null;
  /** `null` = retirer la réaction en place. */
  onReact: (reaction: ReactionName | null) => void;
  actions: MessageAction[];
  onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Toucher hors de la feuille ferme : sur mobile, c'est le geste attendu
          pour annuler, et il évite d'avoir à viser un bouton. */}
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.reactionRow}>
            {REACTIONS.map((r) => {
              const active = currentReaction === r;
              return (
                <Pressable
                  key={r}
                  accessibilityLabel={REACTION_LABELS[r]}
                  accessibilityRole="button"
                  style={[styles.reactionBtn, active && styles.reactionActive]}
                  onPress={() => {
                    // Retaper la réaction déjà posée la retire : c'est la
                    // bascule attendue, et ça évite une action « retirer »
                    // séparée qu'il faudrait aller chercher.
                    onReact(active ? null : r);
                    onClose();
                  }}
                >
                  <ReactionIcon name={r} size={26} />
                </Pressable>
              );
            })}
          </View>

          {actions.length > 0 && <View style={styles.divider} />}

          {actions.map((a, i) => (
            <Pressable
              key={i}
              style={styles.action}
              onPress={() => {
                a.onPress();
                onClose();
              }}
            >
              <Text
                style={[styles.actionText, a.destructive && styles.destructive]}
              >
                {a.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 14,
      paddingBottom: 30,
    },
    reactionRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingHorizontal: 10,
      paddingBottom: 12,
    },
    reactionBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
    },
    // La réaction déjà posée est cerclée : sans ce repère, on ne sait pas si
    // l'on s'apprête à ajouter ou à retirer.
    reactionActive: {
      backgroundColor: c.primarySoft,
      borderWidth: 1.5,
      borderColor: c.primary,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginBottom: 4,
    },
    action: { paddingVertical: 14, paddingHorizontal: 22 },
    actionText: { fontSize: 15.5, color: c.text },
    destructive: { color: c.danger },
  });
