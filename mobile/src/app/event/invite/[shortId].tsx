import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { FriendEntry, fetchFriends } from "../../../lib/friends";
import { inviteToEvent } from "../../../lib/events";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../../lib/theme-context";

export default function EventInviteScreen() {
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [friends, setFriends] = useState<FriendEntry[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emails, setEmails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchFriends()
      .then((list) => setFriends(list.filter((x) => x?.friendUser?._id)))
      .catch((e) => setError(e?.message ?? "Erreur de chargement."));
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const done = () => router.replace(`/event/${shortId}`);

  const send = async () => {
    if (!shortId || sending) return;
    const externalEmails = emails
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e));
    if (selected.size === 0 && externalEmails.length === 0) {
      done();
      return;
    }
    setSending(true);
    setError(null);
    try {
      await inviteToEvent(shortId, [...selected], externalEmails);
      done();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'envoi des invitations.");
      setSending(false);
    }
  };

  if (!friends) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Inviter" }} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Inviter du monde" }} />

      {error && <Text style={styles.error}>{error}</Text>}

      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.sectionTitle}>Mes amis</Text>
        {friends.length === 0 && (
          <Text style={styles.muted}>
            Pas encore d'amis inscrits — utilise les emails ci-dessous ou le
            lien de partage depuis la page de l'événement.
          </Text>
        )}
        {friends.map((f) => {
          const isSelected = selected.has(f.friendUser._id);
          return (
            <Pressable
              key={f.friendUser._id}
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => toggle(f.friendUser._id)}
            >
              {f.friendUser.avatar ? (
                <Image
                  source={{ uri: f.friendUser.avatar }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.initials}>
                    {f.friendUser.name?.[0]?.toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.name}>
                {f.friendUser.name} {f.friendUser.surname ?? ""}
              </Text>
              <View style={[styles.check, isSelected && styles.checkOn]}>
                {isSelected && <Text style={styles.checkMark}>✓</Text>}
              </View>
            </Pressable>
          );
        })}

        <Text style={styles.sectionTitle}>Par email (non-inscrits)</Text>
        <TextInput placeholderTextColor={colors.placeholder}
          style={styles.input}
          placeholder="emails séparés par des virgules"
          autoCapitalize="none"
          keyboardType="email-address"
          multiline
          value={emails}
          onChangeText={setEmails}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.skipBtn} onPress={done}>
          <Text style={styles.skipText}>Plus tard</Text>
        </Pressable>
        <Pressable
          style={[styles.sendBtn, sending && { opacity: 0.6 }]}
          disabled={sending}
          onPress={send}
        >
          {sending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.sendText}>
              Inviter{selected.size > 0 ? ` (${selected.size})` : ""}
            </Text>
          )}
        </Pressable>
      </View>
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
    error: { color: c.danger, textAlign: "center", padding: 6 },
    list: { padding: 12, gap: 8, paddingBottom: 24 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: c.sub,
      textTransform: "uppercase",
      marginTop: 8,
    },
    muted: { color: c.sub, fontSize: 13, lineHeight: 18 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 11,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    rowSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
    avatar: { width: 38, height: 38, borderRadius: 19 },
    avatarFallback: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.primarySoft,
      justifyContent: "center",
      alignItems: "center",
    },
    initials: { color: c.primaryStrong, fontWeight: "700" },
    name: { flex: 1, fontWeight: "600", color: c.text },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.borderStrong,
      justifyContent: "center",
      alignItems: "center",
    },
    checkOn: { backgroundColor: c.primary, borderColor: c.primary },
    checkMark: { color: c.white, fontWeight: "700", fontSize: 13 },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 11,
      fontSize: 14,
      backgroundColor: c.inputBg,
      color: c.text,
      minHeight: 60,
    },
    footer: {
      flexDirection: "row",
      gap: 10,
      padding: 12,
      backgroundColor: c.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    skipBtn: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingVertical: 13,
      paddingHorizontal: 18,
    },
    skipText: { color: c.sub, fontWeight: "600" },
    sendBtn: {
      flex: 1,
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
    },
    sendText: { color: c.white, fontWeight: "700" },
  });
