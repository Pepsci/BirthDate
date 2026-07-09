import { View, Text, Image, Pressable, StyleSheet } from "react-native";

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

const styles = StyleSheet.create({
  card: {
    width: "48.5%",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eef2f7",
    padding: 8,
    gap: 4,
  },
  cardDimmed: { opacity: 0.7, backgroundColor: "#f9fafb" },
  img: { width: "100%", height: 90, borderRadius: 8 },
  imgPlaceholder: {
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  imgEmoji: { fontSize: 30 },
  title: { color: "#111827", fontWeight: "700", fontSize: 13 },
  line: { color: "#6b7280", fontSize: 12 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 2,
  },
  pricePill: {
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pricePillText: { color: "#2563eb", fontWeight: "700", fontSize: 12 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "800" },
});
