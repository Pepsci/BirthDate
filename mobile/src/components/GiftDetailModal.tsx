import { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  Linking,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";

const SCREEN_H = Dimensions.get("window").height;
import { Gift } from "../lib/dates";
import { occasionEmoji } from "../lib/occasions";
import {
  GIFT_STATUSES,
  GIFT_STATUS_META,
  GiftStatus,
  giftStatusOf,
} from "../lib/giftStatus";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * Modal détail d'un cadeau — bottom sheet (façon web affichage mobile).
 * Gros boutons de statut (À acheter / Acheté / Acheté & à offrir) + Modifier / Supprimer.
 */
export default function GiftDetailModal({
  gift,
  busy,
  onClose,
  onEdit,
  onDelete,
  onSetStatus,
  hidden,
  onToggleHidden,
}: {
  gift: Gift | null;
  busy: boolean;
  onClose: () => void;
  onEdit: (g: Gift) => void;
  onDelete: (g: Gift) => void;
  onSetStatus: (g: Gift, status: GiftStatus) => void;
  /**
   * Idée d'une liste commune masquée aux invités et au lien public.
   * Optionnel : les idées personnelles n'ont personne à qui se cacher, la
   * bascule n'apparaît donc que si l'appelant la fournit.
   */
  hidden?: boolean;
  onToggleHidden?: (g: Gift, next: boolean) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Réinitialise la position à chaque ouverture
  useEffect(() => {
    if (gift) translateY.setValue(0);
  }, [gift, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      // La barre capture le geste dès qu'on la touche
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
      onPanResponderMove: (_, g) => {
        translateY.setValue(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.7) {
          Animated.timing(translateY, {
            toValue: SCREEN_H,
            duration: 220,
            useNativeDriver: true,
          }).start(() => onCloseRef.current());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

  if (!gift) return null;
  const current = giftStatusOf(gift);

  return (
    <Modal
      visible={!!gift}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
        >
          {/* Zone de préhension : glisser vers le bas pour fermer */}
          <View style={styles.handleZone} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>
          {/* Absorbe les taps pour ne pas fermer via l'overlay */}
          <Pressable onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {gift.image ? (
              <Image source={{ uri: gift.image }} style={styles.image} />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <Text style={styles.imageEmoji}>
                  {occasionEmoji(gift.occasion)}
                </Text>
              </View>
            )}

            <Text style={styles.title}>{gift.giftName}</Text>

            <View style={styles.metaRow}>
              {!!gift.occasion && (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>
                    {occasionEmoji(gift.occasion)} {gift.occasion}
                  </Text>
                </View>
              )}
              {!!gift.year && (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>{gift.year}</Text>
                </View>
              )}
            </View>

            <View style={styles.infoRow}>
              {gift.price != null && (
                <Text style={styles.price}>{gift.price} €</Text>
              )}
              {gift.url ? (
                <Text
                  style={styles.link}
                  onPress={() => Linking.openURL(gift.url!)}
                >
                  🔗 Voir le produit
                </Text>
              ) : null}
            </View>

            {/* Statut */}
            <Text style={styles.sectionLabel}>Statut</Text>
            <View style={styles.statusCol}>
              {GIFT_STATUSES.map((s) => {
                const meta = GIFT_STATUS_META[s];
                const active = current === s;
                return (
                  <Pressable
                    key={s}
                    disabled={busy}
                    onPress={() => onSetStatus(gift, s)}
                    style={[
                      styles.statusBtn,
                      active && {
                        backgroundColor: meta.bg,
                        borderColor: meta.color,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBtnText,
                        active && { color: meta.color },
                      ]}
                    >
                      {meta.emoji} {meta.label}
                    </Text>
                    {active && <Text style={styles.statusCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>

            {/* Visibilité pour les invités. Posée au-dessus de Modifier /
                Supprimer parce qu'elle ne change pas l'idée, seulement qui
                la voit — et parce que se tromper ici expose quelque chose
                qu'on voulait garder entre gestionnaires. */}
            {onToggleHidden && (
              <Pressable
                style={[styles.visibilityRow, hidden && styles.visibilityRowOn]}
                disabled={busy}
                onPress={() => onToggleHidden(gift, !hidden)}
              >
                <Text
                  style={[
                    styles.visibilityText,
                    hidden && styles.visibilityTextOn,
                  ]}
                >
                  {hidden
                    ? "🙈 Masquée aux invités · rendre visible"
                    : "👁️ Visible par les invités · masquer"}
                </Text>
                <Text style={styles.visibilityHint}>
                  {hidden
                    ? "Seuls les gestionnaires de la liste la voient."
                    : "Elle apparaît aux invités et sur le lien public."}
                </Text>
              </Pressable>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable
                style={[styles.actionBtn, styles.editBtn]}
                disabled={busy}
                onPress={() => onEdit(gift)}
              >
                <Text style={styles.editBtnText}>✏️ Modifier</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.deleteBtn]}
                disabled={busy}
                onPress={() => onDelete(gift)}
              >
                <Text style={styles.deleteBtnText}>🗑️ Supprimer</Text>
              </Pressable>
            </View>
          </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 16,
      paddingBottom: 28,
      maxHeight: "85%",
    },
    handleZone: {
      alignItems: "center",
      paddingTop: 4,
      paddingBottom: 10,
      marginTop: -4,
    },
    handle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.borderStrong,
    },
    image: { width: "100%", height: 180, borderRadius: 14 },
    imagePlaceholder: {
      backgroundColor: c.bgSecondary,
      justifyContent: "center",
      alignItems: "center",
    },
    imageEmoji: { fontSize: 64 },
    title: {
      fontSize: 20,
      fontWeight: "800",
      color: c.text,
      marginTop: 14,
    },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    metaChip: {
      backgroundColor: c.bgSecondary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    metaChipText: { fontSize: 13, color: c.text, fontWeight: "600" },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 12,
    },
    price: { fontSize: 20, fontWeight: "800", color: c.text },
    link: { color: c.primary, fontWeight: "600", fontSize: 14 },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: c.sub,
      marginTop: 18,
      marginBottom: 8,
    },
    statusCol: { gap: 8 },
    statusBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: c.cardSoft,
    },
    statusBtnText: { fontSize: 16, fontWeight: "700", color: c.text },
    statusCheck: { fontSize: 16, fontWeight: "800", color: c.text },
    visibilityRow: {
      marginTop: 18,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 3,
    },
    visibilityRowOn: { borderColor: c.warningStrong, backgroundColor: c.warningSoft },
    visibilityText: { color: c.text, fontWeight: "700", fontSize: 14 },
    visibilityTextOn: { color: c.warningStrong },
    visibilityHint: { color: c.sub, fontSize: 12 },
    actions: { flexDirection: "row", gap: 12, marginTop: 20 },
    actionBtn: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    editBtn: { backgroundColor: c.primary },
    editBtnText: { color: c.white, fontWeight: "700", fontSize: 15 },
    deleteBtn: { borderWidth: 1.5, borderColor: c.danger },
    deleteBtnText: { color: c.danger, fontWeight: "700", fontSize: 15 },
  });
