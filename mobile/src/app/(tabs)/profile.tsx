import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { deleteAccount } from "../../lib/users";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
  ThemeMode,
} from "../../lib/theme-context";

const SITE = "https://birthreminder.com";
const LEGAL_LINKS: { emoji: string; label: string; url: string }[] = [
  { emoji: "📄", label: "Conditions d'utilisation (CGU)", url: `${SITE}/cgu` },
  { emoji: "🔒", label: "Politique de confidentialité", url: `${SITE}/privacy` },
  { emoji: "🍪", label: "Cookies", url: `${SITE}/cookies` },
  { emoji: "⚖️", label: "Mentions légales", url: `${SITE}/mentions-legales` },
];

const THEME_OPTIONS: { v: ThemeMode; l: string }[] = [
  { v: "system", l: "⚙️ Système" },
  { v: "light", l: "☀️ Clair" },
  { v: "dark", l: "🌙 Sombre" },
];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { mode, setMode } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const avatar = (user as { avatar?: string } | null)?.avatar;

  const confirmDelete = () => {
    Alert.alert(
      "Supprimer ton compte ?",
      "Ton compte sera désactivé puis définitivement supprimé. Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer mon compte",
          style: "destructive",
          onPress: async () => {
            try {
              if (user?._id) await deleteAccount(user._id);
              await signOut();
            } catch (e: any) {
              Alert.alert("Erreur", e?.message ?? "Suppression impossible.");
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.initials}>
            {user?.name?.[0]?.toUpperCase()}
            {user?.surname?.[0]?.toUpperCase()}
          </Text>
        </View>
      )}
      <Text style={styles.name}>
        {user?.name} {user?.surname}
      </Text>
      <Text style={styles.email}>{user?.email}</Text>

      <View style={styles.menu}>
        <MenuRow
          emoji="👥"
          label="Mes amis"
          onPress={() => router.push("/friends")}
        />
        <MenuRow
          emoji="✏️"
          label="Mes informations"
          onPress={() => router.push("/profile/edit")}
        />
        <MenuRow
          emoji="🔔"
          label="Notifications email"
          onPress={() => router.push("/profile/notifications")}
        />
        <MenuRow
          emoji="🎀"
          label="Ma wishlist"
          onPress={() => router.push("/profile/wishlist")}
        />
        <MenuRow
          emoji="🔑"
          label="Changer mon mot de passe"
          onPress={() => router.push("/profile/password")}
        />
        <MenuRow
          emoji="🔐"
          label="Chiffrement & sécurité"
          onPress={() => router.push("/profile/e2e")}
        />
        <MenuRow
          emoji="🚫"
          label="Utilisateurs bloqués"
          onPress={() => router.push("/profile/blocked")}
        />
      </View>

      {/* ── Apparence ── */}
      <Text style={styles.sectionLabel}>Apparence</Text>
      <View style={styles.themeRow}>
        {THEME_OPTIONS.map(({ v, l }) => (
          <Pressable
            key={v}
            style={[styles.themeChip, mode === v && styles.themeChipActive]}
            onPress={() => setMode(v)}
          >
            <Text
              style={[
                styles.themeChipText,
                mode === v && styles.themeChipTextActive,
              ]}
            >
              {l}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Légal & support</Text>
      <View style={styles.menu}>
        <MenuRow
          emoji="📖"
          label="Guide d'utilisation"
          onPress={() => router.push("/guide")}
        />
        {LEGAL_LINKS.map((l) => (
          <MenuRow
            key={l.url}
            emoji={l.emoji}
            label={l.label}
            onPress={() => Linking.openURL(l.url)}
          />
        ))}
      </View>

      <Pressable style={styles.logout} onPress={signOut}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </Pressable>

      <Pressable onPress={confirmDelete}>
        <Text style={styles.deleteText}>Supprimer mon compte</Text>
      </Pressable>

      <Pressable
        style={styles.contactBtn}
        onPress={() => router.push("/support")}
      >
        <Text style={styles.contactBtnText}>✉️ Contacter le support</Text>
      </Pressable>
    </ScrollView>
  );
}

function MenuRow({
  emoji,
  label,
  onPress,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { alignItems: "center", padding: 24, gap: 6, paddingBottom: 48 },
    avatar: { width: 88, height: 88, borderRadius: 44 },
    avatarFallback: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.primarySoft,
      justifyContent: "center",
      alignItems: "center",
    },
    initials: { fontSize: 30, fontWeight: "700", color: c.primary },
    name: { fontSize: 22, fontWeight: "700", color: c.text, marginTop: 8 },
    email: { color: c.sub },
    menu: {
      alignSelf: "stretch",
      backgroundColor: c.card,
      borderRadius: 14,
      marginTop: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: c.border,
    },
    sectionLabel: {
      alignSelf: "flex-start",
      color: c.sub,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      marginTop: 24,
      marginBottom: -8,
    },
    themeRow: {
      alignSelf: "stretch",
      flexDirection: "row",
      gap: 8,
      marginTop: 20,
    },
    themeChip: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: "center",
      backgroundColor: c.card,
    },
    themeChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    themeChipText: { fontSize: 13, fontWeight: "600", color: c.sub },
    themeChipTextActive: { color: "#fff" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowEmoji: { fontSize: 18 },
    rowLabel: { flex: 1, fontSize: 15, color: c.text, fontWeight: "500" },
    chevron: { fontSize: 20, color: c.faint },
    logout: {
      marginTop: 28,
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 28,
    },
    logoutText: { color: c.danger, fontWeight: "600" },
    deleteText: {
      color: c.faint,
      fontSize: 12,
      textDecorationLine: "underline",
      marginTop: 16,
    },
    contactBtn: {
      marginTop: 24,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    contactBtnText: { color: c.primary, fontWeight: "600" },
  });
