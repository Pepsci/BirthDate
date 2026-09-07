import { useCallback, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useFocusEffect } from "expo-router";
import {
  SharedListAccess,
  fetchSharedListAccess,
  regenerateAccessCode,
  addSharedListViewer,
  removeSharedListViewer,
} from "../../../lib/sharedGifts";
import { FriendEntry, fetchFriends } from "../../../lib/friends";
import BottomSheet from "../../../components/BottomSheet";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../../lib/theme-context";

/**
 * Gestion des accès d'une liste commune — membres uniquement.
 *
 * Trois niveaux coexistent : les membres (créateur et contributeurs, droits
 * complets), les invités internes (consultation et réservation) et les
 * visiteurs du lien public, à qui le code est demandé pour réserver. C'est le
 * seul endroit où on les voit d'un coup et où on peut retirer un accès.
 */
export default function SharedListAccessScreen() {
  const { id, add } = useLocalSearchParams<{ id: string; add?: string }>();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  const [access, setAccess] = useState<SharedListAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [friends, setFriends] = useState<FriendEntry[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setAccess(await fetchSharedListAccess(id));
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement.");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Arrivée depuis « Partager à un contact » : on ouvre directement le
  // sélecteur d'amis. Sans ça, l'utilisateur qui vient de cliquer sur cette
  // action retombe sur l'écran de gestion complet et doit chercher le bouton
  // « ＋ » — un pas de plus pour l'action la plus courante.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (add === "1" && access && !autoOpened.current) {
      autoOpened.current = true;
      openPicker();
    }
    // openPicker dépend de `access`, déjà dans les dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [add, access]);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  const openPicker = async () => {
    setPickerOpen(true);
    try {
      const list = await fetchFriends();
      const already = new Set([
        ...(access?.members ?? []).map((m) => m._id),
        ...(access?.viewers ?? []).map((v) => v.user._id),
      ]);
      setFriends(
        list.filter((f) => f?.friendUser?._id && !already.has(f.friendUser._id)),
      );
    } catch {
      setFriends([]);
    }
  };

  const confirmRevoke = (userId: string, name: string) => {
    Alert.alert(
      "Retirer l'acces ?",
      name + " ne verra plus cette liste. Ses reservations restent en place.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: () => run(() => removeSharedListViewer(id!, userId)),
        },
      ],
    );
  };

  if (!access) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Acces a la liste" }} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Acces a la liste" }} />
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Membres</Text>
        <Text style={styles.hint}>
          Ils peuvent ajouter, modifier et supprimer des idees, et gerer les
          acces.
        </Text>
        {access.members.map((m) => (
          <View key={m._id} style={styles.row}>
            <Text style={styles.name}>
              {m.name} {m.surname ?? ""}
            </Text>
            {access.createdBy === m._id && (
              <Text style={styles.tag}>createur</Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Invites</Text>
          <Pressable style={styles.addBtn} onPress={openPicker}>
            <Text style={styles.addBtnText}>+ Inviter</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          Ils consultent la liste et peuvent reserver un cadeau. Ils ne voient
          pas qui a reserve quoi, et ne modifient jamais la liste.
        </Text>
        {access.viewers.length === 0 && (
          <Text style={styles.empty}>Personne pour l'instant.</Text>
        )}
        {access.viewers.map((v) => (
          <View key={v.user._id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {v.user.name} {v.user.surname ?? ""}
              </Text>
              {v.addedBy?.name && (
                <Text style={styles.hint}>invite par {v.addedBy.name}</Text>
              )}
            </View>
            <Pressable
              style={styles.revokeBtn}
              disabled={busy}
              onPress={() => confirmRevoke(v.user._id, v.user.name)}
            >
              <Text style={styles.revokeText}>Retirer</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Code de reservation</Text>
        <Text style={styles.hint}>
          Demande aux personnes qui arrivent par le lien public, uniquement au
          moment de reserver. Consulter la liste ne l'exige pas.
        </Text>
        {access.accessCode ? (
          <Text style={styles.code}>{access.accessCode}</Text>
        ) : (
          <Text style={styles.empty}>
            Aucun code : toute personne ayant le lien peut reserver.
          </Text>
        )}
        <Pressable
          style={styles.codeBtn}
          disabled={busy}
          onPress={() =>
            Alert.alert(
              access.accessCode ? "Changer le code ?" : "Generer un code ?",
              access.accessCode
                ? "L'ancien code cessera de fonctionner immediatement."
                : "Il sera demande pour reserver depuis le lien public.",
              [
                { text: "Annuler", style: "cancel" },
                {
                  text: "Confirmer",
                  onPress: () => run(() => regenerateAccessCode(id!)),
                },
              ],
            )
          }
        >
          <Text style={styles.codeBtnText}>
            {access.accessCode ? "Changer le code" : "Generer un code"}
          </Text>
        </Pressable>
      </View>

      <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)}>
        <Text style={styles.sheetTitle}>Inviter un contact</Text>
        <Text style={styles.hint}>
          Il pourra consulter la liste et reserver, sans pouvoir la modifier.
        </Text>
        {friends.length === 0 && (
          <Text style={styles.empty}>Aucun contact a inviter.</Text>
        )}
        {friends.map((f) => (
          <Pressable
            key={f.friendship._id}
            style={styles.friendRow}
            disabled={busy}
            onPress={() => {
              setPickerOpen(false);
              run(() => addSharedListViewer(id!, f.friendUser._id));
            }}
          >
            <Text style={styles.name}>
              {f.friendUser.name} {f.friendUser.surname ?? ""}
            </Text>
          </Pressable>
        ))}
      </BottomSheet>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 12, gap: 10, paddingBottom: 40 },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
    },
    error: { color: c.danger, textAlign: "center", padding: 8 },
    card: { backgroundColor: c.card, borderRadius: 14, padding: 14, gap: 6 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: c.text },
    hint: { fontSize: 12, color: c.sub, lineHeight: 17 },
    empty: { fontSize: 13, color: c.faint, marginTop: 4 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    name: { fontSize: 15, fontWeight: "600", color: c.text, flex: 1 },
    tag: {
      fontSize: 11,
      fontWeight: "700",
      color: c.primaryStrong,
      backgroundColor: c.primarySoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    addBtn: {
      backgroundColor: c.primary,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    addBtnText: { color: c.white, fontWeight: "700", fontSize: 12 },
    revokeBtn: {
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    revokeText: { color: c.danger, fontWeight: "700", fontSize: 12 },
    code: {
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: 4,
      color: c.primaryStrong,
      textAlign: "center",
      marginVertical: 8,
    },
    codeBtn: {
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 10,
      paddingVertical: 9,
      alignItems: "center",
      marginTop: 4,
    },
    codeBtnText: { color: c.primary, fontWeight: "700", fontSize: 13 },
    sheetTitle: { fontSize: 17, fontWeight: "800", color: c.text },
    friendRow: {
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
  });
