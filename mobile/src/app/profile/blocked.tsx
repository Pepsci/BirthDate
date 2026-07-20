import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import {
  BlockedUser,
  getBlockedUsers,
  unblockUser,
} from "../../lib/moderation";
import {
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";

export default function BlockedUsersScreen() {
  const styles = useThemedStyles(makeStyles);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBlocked(await getBlockedUsers());
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmUnblock = (u: BlockedUser) => {
    Alert.alert(`Débloquer ${u.name} ?`, "Son contenu redeviendra visible.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Débloquer",
        onPress: async () => {
          try {
            await unblockUser(u._id);
            setBlocked((prev) => prev.filter((b) => b._id !== u._id));
          } catch (e: any) {
            Alert.alert("Erreur", e?.message ?? "Déblocage impossible.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Utilisateurs bloqués" }} />
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Utilisateurs bloqués" }} />
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={blocked}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.initials}>
                  {item.name?.[0]?.toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.name}>
              {item.name} {item.surname ?? ""}
            </Text>
            <Pressable
              style={styles.unblockBtn}
              onPress={() => confirmUnblock(item)}
            >
              <Text style={styles.unblockText}>Débloquer</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Aucun utilisateur bloqué.{"\n"}Tu peux bloquer quelqu'un depuis un
            chat (menu ⋯) ou en signalant un message.
          </Text>
        }
      />
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
    },
    error: { color: c.danger, textAlign: "center", padding: 8 },
    list: { padding: 16, gap: 10 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
    },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarFallback: {
      backgroundColor: c.primarySoft,
      justifyContent: "center",
      alignItems: "center",
    },
    initials: { fontWeight: "700", color: c.primary },
    name: { flex: 1, fontSize: 15, fontWeight: "600", color: c.text },
    unblockBtn: {
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    unblockText: { color: c.primary, fontWeight: "600", fontSize: 13 },
    empty: {
      textAlign: "center",
      color: c.sub,
      marginTop: 60,
      lineHeight: 22,
    },
  });
