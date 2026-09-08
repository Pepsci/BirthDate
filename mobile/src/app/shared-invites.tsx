import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import {
  SharedInvitation,
  MySharedList,
  SharedListPending,
  fetchSharedInvitations,
  fetchListsSharedWithMe,
  fetchMySharedLists,
  acceptSharedInvitation,
  declineSharedInvitation,
  leaveSharedList,
} from "../lib/sharedGifts";
import { DateEntry, fetchDates } from "../lib/dates";
import BottomSheet from "../components/BottomSheet";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

export default function SharedInvitesScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { colors } = useTheme();
  const [invites, setInvites] = useState<SharedInvitation[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sélection de carte pour accepter
  const [accepting, setAccepting] = useState<SharedInvitation | null>(null);
  const [dates, setDates] = useState<DateEntry[]>([]);
  // Listes qu'on m'a partagées en lecture et que je n'ai pas encore posées sur
  // une carte. Sans cette liste, supprimer la notification les rendrait
  // définitivement introuvables.
  const [pending, setPending] = useState<SharedListPending[]>([]);
  // Listes déjà rattachées, que je gère ou où je suis invité. Sans elles, cet
  // écran ne montrait que ce qui est « en attente » — une liste active
  // n'était atteignable que par la carte de la personne concernée.
  const [mine, setMine] = useState<MySharedList[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [inv, shared, active] = await Promise.all([
        fetchSharedInvitations(),
        fetchListsSharedWithMe().catch(() => []),
        fetchMySharedLists().catch(() => []),
      ]);
      setInvites(inv);
      setPending(shared);
      // Une liste non rattachée figure déjà dans `pending`, avec son bouton de
      // rattachement : la répéter ici n'apporterait rien.
      setMine(active.filter((l) => l.dateId));
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openAccept = async (inv: SharedInvitation) => {
    setAccepting(inv);
    try {
      setDates(await fetchDates());
    } catch {
      setDates([]);
    }
  };

  /**
   * @param target carte existante, ou `{ newDate: {} }` pour la créer au
   *   passage — le serveur reprend alors le nom et la date de naissance depuis
   *   la carte de celui qui invite, qui décrit la même personne.
   */
  const confirmAccept = async (
    target: { dateId: string } | { newDate: Record<string, unknown> },
  ) => {
    if (!accepting || busy) return;
    setBusy(true);
    try {
      const res = await acceptSharedInvitation(accepting._id, target);
      const created = "newDate" in target;
      setAccepting(null);
      // Une carte tout juste créée n'est visible nulle part tant qu'on n'y va
      // pas : on emmène dessus, la liste commune y est déjà posée.
      if (created && res.dateId) {
        router.replace(`/date/${res.dateId}`);
        return;
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  // Prénom de la personne concernée, repris de l'invitation.
  const acceptTargetName = accepting
    ? [accepting.fromDate?.name, accepting.fromDate?.surname]
        .filter(Boolean)
        .join(" ") ||
      accepting.label ||
      null
    : null;

  /**
   * Quitter depuis le menu. Confirmation obligatoire : pour un membre, partir
   * fait perdre l'accès à une liste qu'il a peut-être remplie, et le geste
   * est ici à un doigt d'un simple appui pour ouvrir.
   */
  const leave = (l: MySharedList) => {
    const isMember = l.role === "member";
    Alert.alert(
      isMember ? "Quitter la liste ?" : "Ne plus suivre cette liste ?",
      isMember
        ? "Tu ne verras plus les idées de cette liste, et elle sera retirée de ta carte. Les autres membres la gardent."
        : "Elle sera retirée de ta carte. Tu pourras y revenir si on te la repartage.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: isMember ? "Quitter" : "Ne plus suivre",
          style: "destructive",
          onPress: async () => {
            if (busy) return;
            setBusy(true);
            try {
              await leaveSharedList(l._id);
              await load();
            } catch (e: any) {
              setError(e?.message ?? "Erreur.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const decline = async (inv: SharedInvitation) => {
    if (busy) return;
    setBusy(true);
    try {
      await declineSharedInvitation(inv._id);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  if (!invites) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Listes communes" }} />
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
      <Stack.Screen options={{ title: "Listes communes" }} />
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={invites}
        keyExtractor={(i) => i._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View>
            {/* Listes déjà actives. Elles n'apparaissaient nulle part dans ce
                menu : une fois l'invitation acceptée, la liste n'était plus
                joignable que par la carte de la personne concernée. */}
            {mine.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.sectionTitle}>Mes listes communes</Text>
                {mine.map((l) => (
                  <Pressable
                    key={l._id}
                    style={[styles.card, { marginBottom: 10 }]}
                    // `focus=shared` ouvre la carte directement sur la liste :
                    // atterrir sur la fiche de la personne puis chercher le
                    // bon onglet n'est pas ce qu'on demande en choisissant une
                    // liste dans un menu de listes.
                    onPress={() =>
                      router.push(`/date/${l.dateId}?focus=shared`)
                    }
                  >
                    <Text style={styles.cardText}>
                      <Text style={styles.bold}>
                        {l.personName || l.label || "Liste commune"}
                      </Text>
                      {"\n"}
                      {l.giftCount} idée{l.giftCount > 1 ? "s" : ""} ·{" "}
                      {l.role === "member"
                        ? `${l.memberCount} gestionnaire${l.memberCount > 1 ? "s" : ""}`
                        : "invité en lecture"}
                    </Text>
                    <View style={styles.mineActions}>
                      {l.role === "member" && (
                        <Pressable
                          style={styles.manageBtn}
                          disabled={busy}
                          onPress={() =>
                            router.push(`/shared-list/${l._id}/access`)
                          }
                        >
                          <Text style={styles.manageBtnText}>
                            Gérer l'accès
                          </Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={styles.leaveBtn}
                        disabled={busy}
                        onPress={() => leave(l)}
                      >
                        <Text style={styles.leaveBtnText}>
                          {l.role === "member" ? "Quitter" : "Ne plus suivre"}
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
            {pending.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.sectionTitle}>Listes partagées avec toi</Text>
              {pending.map((l) => (
                <Pressable
                  key={l._id}
                  style={styles.card}
                  onPress={() => router.push(`/shared-list/${l._id}/attach`)}
                >
                  <Text style={styles.cardText}>
                    <Text style={styles.bold}>
                      {l.from
                        ? `${l.from.name} ${l.from.surname ?? ""}`.trim()
                        : "Quelqu'un"}
                    </Text>{" "}
                    t'a partagé une liste
                    {l.label ? ` pour ${l.label}` : ""} — {l.giftCount} idée
                    {l.giftCount > 1 ? "s" : ""}.
                  </Text>
                  <Text style={styles.pendingHint}>
                    Appuie pour l'ajouter à une carte et pouvoir réserver.
                  </Text>
                </Pressable>
              ))}
            </View>
            )}
          </View>
        }
        ListEmptyComponent={
          pending.length > 0 || mine.length > 0 ? null : (
            <Text style={styles.empty}>Aucune invitation en attente.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardText}>
              <Text style={styles.bold}>
                {item.fromUser?.name} {item.fromUser?.surname ?? ""}
              </Text>{" "}
              veut créer une liste de cadeaux commune
              {item.label ? ` pour ${item.label}` : ""}.
            </Text>
            <View style={styles.actions}>
              <Pressable
                style={styles.declineBtn}
                disabled={busy}
                onPress={() => decline(item)}
              >
                <Text style={styles.declineText}>Refuser</Text>
              </Pressable>
              <Pressable
                style={styles.acceptBtn}
                disabled={busy}
                onPress={() => openAccept(item)}
              >
                <Text style={styles.acceptText}>Accepter</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <BottomSheet visible={!!accepting} onClose={() => setAccepting(null)}>
        <Text style={styles.sheetTitle}>Associer à quelle carte ?</Text>
        <Text style={styles.sheetSub}>
          Une liste commune s'affiche sur la carte de la personne concernée.
          Choisis-en une, ou crée-la.
        </Text>

        {/* Créer la carte au passage. C'était le blocage : il fallait DÉJÀ
            avoir enregistré la personne pour accepter, alors qu'on est
            justement invité à préparer le cadeau de quelqu'un qu'on n'a pas
            forcément dans son carnet. Nom et date viennent de l'invitation. */}
        {acceptTargetName && (
          <Pressable
            style={styles.createRow}
            disabled={busy}
            onPress={() => confirmAccept({ newDate: {} })}
          >
            <Text style={styles.createRowText}>
              ➕ Créer la carte de {acceptTargetName}
            </Text>
          </Pressable>
        )}

        {dates.map((d) => (
          <Pressable
            key={d._id}
            style={styles.dateRow}
            disabled={busy}
            onPress={() => confirmAccept({ dateId: d._id })}
          >
            <Text style={styles.dateName}>
              {(d.name || d.linkedUser?.name) ?? "?"}{" "}
              {(d.surname || d.linkedUser?.surname) ?? ""}
            </Text>
            <Text style={styles.dateBadge}>
              {d.linkedUser ? "Ami" : d.family ? "Famille" : "Manuelle"}
            </Text>
          </Pressable>
        ))}
        {dates.length === 0 && (
          <Text style={styles.empty}>
            Tu n'as encore aucune carte — utilise le bouton ci-dessus.
          </Text>
        )}
      </BottomSheet>
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
  list: { padding: 12, gap: 10 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: c.sub,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  pendingHint: { fontSize: 12, color: c.primary, marginTop: 6 },
  // Bouton secondaire posé DANS la carte : la carte entière ouvre la liste,
  // ce bouton emmène sur la gestion des accès sans quitter l'écran par erreur.
  manageBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  manageBtnText: { color: c.sub, fontWeight: "600", fontSize: 13 },
  mineActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  // Départ volontairement discret : c'est une sortie, pas une invitation.
  leaveBtn: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  leaveBtnText: { color: c.danger, fontWeight: "600", fontSize: 13 },
  empty: { textAlign: "center", color: c.sub, marginTop: 32 },
  card: {
    backgroundColor: c.card,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardText: { color: c.text, fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: "800", color: c.text },
  actions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  declineBtn: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  declineText: { color: c.sub, fontWeight: "600" },
  acceptBtn: {
    backgroundColor: c.primary,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  acceptText: { color: c.white, fontWeight: "700" },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: c.text },
  sheetSub: { color: c.sub, fontSize: 13, marginTop: 4, marginBottom: 12 },
  // Action « créer la carte » : mise en avant par rapport aux cartes existantes
  // — c'est le seul chemin disponible quand l'utilisateur n'en a aucune.
  createRow: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primary,
    alignItems: "center",
  },
  createRowText: { color: c.primary, fontWeight: "700", fontSize: 14.5 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  dateName: { fontSize: 15, fontWeight: "600", color: c.text },
  dateBadge: { fontSize: 12, color: c.sub },
});
