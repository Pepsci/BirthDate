import { View, Text, Pressable, StyleSheet, Image, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { deleteAccount } from "../../lib/users";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
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
      </View>

      <Pressable style={styles.logout} onPress={signOut}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </Pressable>

      <Pressable onPress={confirmDelete}>
        <Text style={styles.deleteText}>Supprimer mon compte</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { alignItems: "center", padding: 24, gap: 6, paddingBottom: 48 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
  },
  initials: { fontSize: 30, fontWeight: "700", color: "#2563eb" },
  name: { fontSize: 22, fontWeight: "700", color: "#111827", marginTop: 8 },
  email: { color: "#6b7280" },
  menu: {
    alignSelf: "stretch",
    backgroundColor: "#fff",
    borderRadius: 14,
    marginTop: 20,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  rowEmoji: { fontSize: 18 },
  rowLabel: { flex: 1, fontSize: 15, color: "#111827", fontWeight: "500" },
  chevron: { fontSize: 20, color: "#9ca3af" },
  logout: {
    marginTop: 28,
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  logoutText: { color: "#ef4444", fontWeight: "600" },
  deleteText: {
    color: "#9ca3af",
    fontSize: 12,
    textDecorationLine: "underline",
    marginTop: 16,
  },
});
