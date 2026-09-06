import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

export interface GiftBadge {
  label: string;
  color: string;
  bg: string;
}

/**
 * Carte cadeau générique (grille 2 colonnes) — réutilisée par la wishlist perso,
 * la wishlist d'un ami, les propositions d'événement et les idées cadeaux.
 * À placer dans un conteneur `giftGridStyles.grid`.
 */
export default function GiftGridCard({
  imageUri,
  placeholderEmoji = "🎁",
  title,
  lines = [],
  badge,
  price,
  dimmed,
  onPress,
}: {
  imageUri?: string | null;
  placeholderEmoji?: string;
  title: string;
  lines?: string[];
  badge?: GiftBadge | null;
  price?: number | null;
  dimmed?: boolean;
  onPress?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={[styles.card, dimmed && styles.cardDimmed]}
      onPress={onPress}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.img} />
      ) : (
        <View style={[styles.img, styles.imgPlaceholder]}>
          <Text style={styles.imgEmoji}>{placeholderEmoji}</Text>
        </View>
      )}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {lines.map((l, i) => (
        <Text key={i} style={styles.line} numberOfLines={1}>
          {l}
        </Text>
      ))}
      <View style={styles.footer}>
        {price != null && (
          <View style={styles.pricePill}>
            <Text style={styles.pricePillText}>{price} €</Text>
          </View>
        )}
        {badge && (
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>
              {badge.label}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export const giftGridStyles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
});

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      width: "48.5%",
      // Les cartes d'une rangée sont étirées à la même hauteur (alignItems
      // "stretch" par défaut sur le conteneur en flexWrap) ; on l'assume
      // explicitement pour que `marginTop: "auto"` du pied ait de quoi jouer.
      alignSelf: "stretch",
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 8,
      gap: 4,
    },
    cardDimmed: { opacity: 0.7, backgroundColor: c.cardSoft },
    img: { width: "100%", height: 90, borderRadius: 8 },
    imgPlaceholder: {
      backgroundColor: c.bgSecondary,
      justifyContent: "center",
      alignItems: "center",
    },
    imgEmoji: { fontSize: 30 },
    // ⚠️ Hauteur réservée pour DEUX lignes (numberOfLines={2} à l'usage).
    // Sans elle, une carte au titre court et sa voisine au titre long
    // n'alignaient plus rien de ce qui suit : l'occasion, le prix et le badge
    // se retrouvaient à des hauteurs différentes d'une carte à l'autre.
    // lineHeight est fixé explicitement pour que 2 × lineHeight soit exact
    // (sinon la valeur dépend de la police du système).
    title: {
      color: c.text,
      fontWeight: "700",
      fontSize: 13,
      lineHeight: 17,
      minHeight: 34,
    },
    line: { color: c.sub, fontSize: 12, lineHeight: 16 },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
      // Colle le pied de carte en bas : les cartes d'une même rangée sont
      // étirées à la hauteur de la plus haute, donc sans ça le badge flotte
      // au milieu de la carte la plus courte.
      marginTop: "auto",
      paddingTop: 2,
    },
    pricePill: {
      backgroundColor: c.primarySoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    pricePillText: { color: c.primaryStrong, fontWeight: "700", fontSize: 12 },
    badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontSize: 10, fontWeight: "800" },
  });
