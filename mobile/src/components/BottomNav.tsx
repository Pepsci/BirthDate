import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUnread } from "../lib/unread-context";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

/**
 * Barre de navigation basse réutilisable, calquée sur la tab bar du groupe
 * (tabs). Utile sur les écrans empilés hors des tabs (ex. Agenda) pour garder
 * le menu accessible en bas « comme sur les autres pages ».
 */
const ITEMS: { path: string; label: string; emoji: string; badge?: boolean }[] = [
  { path: "/", label: "Anniversaires", emoji: "🎂" },
  { path: "/events", label: "Événements", emoji: "🎉" },
  { path: "/chats", label: "Chats", emoji: "💬", badge: true },
  { path: "/profile", label: "Profil", emoji: "👤" },
];

export default function BottomNav() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { total } = useUnread();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {ITEMS.map((it) => (
        <Pressable
          key={it.path}
          style={styles.item}
          hitSlop={6}
          onPress={() => router.replace(it.path as never)}
        >
          <View>
            <Text style={styles.emoji}>{it.emoji}</Text>
            {it.badge && total > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {total > 99 ? "99+" : total}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {it.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    bar: {
      flexDirection: "row",
      backgroundColor: c.tabBarBg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    item: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 8,
      paddingBottom: 6,
      gap: 2,
    },
    emoji: { fontSize: 22 },
    label: { fontSize: 11, fontWeight: "600", color: c.faint },
    badge: {
      position: "absolute",
      top: -4,
      right: -10,
      backgroundColor: c.danger,
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
    },
    badgeText: { color: c.white, fontSize: 10, fontWeight: "700" },
  });
