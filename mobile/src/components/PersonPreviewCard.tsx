import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Easing,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Avatar from "./Avatar";
import { fetchFriendCardSummary, FriendCardSummary } from "../lib/friends";
import { useTheme, useThemedStyles, ThemeColors } from "../lib/theme-context";

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function ageOf(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  )
    age--;
  return age;
}

function nextBirthdayOf(birthDate: string): string {
  const today = new Date();
  const birth = new Date(birthDate);
  let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
  return `${next.getDate()} ${MONTHS_FR[next.getMonth()]}`;
}

/**
 * Carte qui glisse depuis le haut au tap sur le nom d'un contact dans le
 * chat : âge, anniversaire, nombre de cadeaux dans sa liste, et la liste
 * commune si elle existe (rien sinon). Équivalent mobile du composant web
 * PersonPreviewCard.jsx — même endpoint GET /friends/:id/card-summary.
 */
export default function PersonPreviewCard({
  friendId,
  visible,
  onClose,
}: {
  friendId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [summary, setSummary] = useState<FriendCardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const translateY = useRef(new Animated.Value(-400)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(false);
    let cancelled = false;
    fetchFriendCardSummary(friendId)
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 18,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      cancelled = true;
    };
  }, [visible, friendId]);

  const close = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -400,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const goToProfile = () => {
    if (!summary?.dateId) return;
    close();
    router.push(`/date/${summary.dateId}`);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <Animated.View
        style={[
          styles.card,
          { paddingTop: insets.top + 14, transform: [{ translateY }] },
        ]}
      >
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {!loading && error && (
          <Text style={styles.loadingText}>Impossible de charger ce profil.</Text>
        )}

        {!loading && !error && summary && (
          <>
            <View style={styles.header}>
              <Avatar uri={summary.avatar} name={summary.name} surname={summary.surname} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {summary.name} {summary.surname}
                </Text>
                {summary.birthDate && (
                  <Text style={styles.age}>{ageOf(summary.birthDate)} ans</Text>
                )}
              </View>
              <Pressable onPress={close} hitSlop={10} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.body}>
              {summary.birthDate && (
                <View style={styles.row}>
                  <Text style={styles.icon}>🎂</Text>
                  <Text style={styles.rowText}>
                    Anniversaire le {nextBirthdayOf(summary.birthDate)}
                  </Text>
                </View>
              )}
              <View style={styles.row}>
                <Text style={styles.icon}>🎁</Text>
                <Text style={styles.rowText}>
                  {summary.wishlistCount > 0
                    ? `${summary.wishlistCount} idée${summary.wishlistCount > 1 ? "s" : ""} dans sa liste`
                    : "Aucune idée cadeau partagée"}
                </Text>
              </View>
              {summary.sharedGiftList && (
                <View style={[styles.row, styles.sharedRow]}>
                  <Text style={styles.icon}>🤝</Text>
                  <Text style={styles.rowText}>
                    Liste commune — {summary.sharedGiftList.giftCount} cadeau
                    {summary.sharedGiftList.giftCount > 1 ? "x" : ""}
                  </Text>
                </View>
              )}

              {summary.dateId && (
                <Pressable
                  onPress={goToProfile}
                  style={({ pressed }) => [
                    styles.profileBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.profileBtnText}>Voir le profil</Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.25)",
    },
    card: {
      backgroundColor: c.card,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
      paddingBottom: 18,
      paddingHorizontal: 18,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 6,
    },
    loadingWrap: { paddingVertical: 24, alignItems: "center" },
    loadingText: { color: c.sub, textAlign: "center", paddingVertical: 24 },
    header: { flexDirection: "row", alignItems: "center", gap: 12 },
    name: { fontSize: 17, fontWeight: "700", color: c.text },
    age: { fontSize: 13, color: c.sub, marginTop: 2 },
    closeBtn: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
    },
    closeText: { fontSize: 15, color: c.sub },
    body: { marginTop: 14, gap: 10 },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    rowText: { fontSize: 14, color: c.text, flexShrink: 1 },
    icon: { fontSize: 17 },
    sharedRow: {
      backgroundColor: c.primarySoft,
      padding: 10,
      borderRadius: 10,
    },
    profileBtn: {
      marginTop: 4,
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
    },
    profileBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  });
