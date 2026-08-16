import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Linking,
  Animated,
  Alert,
} from "react-native";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
} from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { Switch } from "react-native";
import { Image as ExpoImage } from "expo-image";
import {
  DateEntry,
  Gift,
  fetchDate,
  addGift,
  updateGift,
  deleteGift,
  setDateFamily,
  setDateNotifications,
  setBirthdayPrefs,
  setNamedayPrefs,
  daysUntil,
  currentAge,
  formatAge,
  formatFullDate,
  formatNameday,
} from "../../lib/dates";
import {
  WishlistItem,
  fetchUserWishlist,
  reserveItem,
  unreserveItem,
} from "../../lib/wishlist";
import GiftIdeaForm from "../../components/GiftIdeaForm";
import GiftDetailModal from "../../components/GiftDetailModal";
import GiftGridCard, { giftGridStyles } from "../../components/GiftGridCard";
import BottomSheet from "../../components/BottomSheet";
import HeaderIconButton from "../../components/HeaderIconButton";
import BirthdayCountdown from "../../components/BirthdayCountdown";
import ImportGiftSheet, { ImportedGift } from "../../components/ImportGiftSheet";
import { FriendEntry, fetchFriends } from "../../lib/friends";
import { getSocket } from "../../lib/socket";
import { startConversation } from "../../lib/conversations";
import {
  SharedGiftList,
  SharedGift,
  SentInvitation,
  fetchSharedList,
  inviteSharedList,
  addSharedGift,
  updateSharedGift,
  deleteSharedGift,
  leaveSharedList,
  fetchSentSharedInvitations,
  cancelSharedInvitation,
} from "../../lib/sharedGifts";
import { OCCASIONS, occasionEmoji } from "../../lib/occasions";
import {
  GIFT_STATUS_META,
  GiftStatus,
  giftStatusOf,
  nextGiftStatus,
  purchasedFromStatus,
} from "../../lib/giftStatus";
import { checkExistingEvent } from "../../lib/events";
import { useUnread } from "../../lib/unread-context";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";

/**
 * Bandeau « annuler la suppression » : surface volontairement inversée,
 * elle reste sombre dans les deux thèmes pour se détacher du contenu.
 * Ces valeurs ne passent donc pas par les tokens.
 */
const UNDO_BG = "#111827";
const UNDO_TEXT = "#f9fafb";
const UNDO_ACTION = "#93c5fd";
const UNDO_TRACK = "rgba(255,255,255,0.2)";

export default function DateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const { byFriend } = useUnread();
  const [entry, setEntry] = useState<DateEntry | null>(null);
  const [wishlist, setWishlist] = useState<WishlistItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGiftForm, setShowGiftForm] = useState(false);
  const [existingEventId, setExistingEventId] = useState<string | null>(null);
  const [editingGift, setEditingGift] = useState<Gift | null>(null);
  const [busy, setBusy] = useState(false);
  // Vue de la carte : "info" (accueil) ou "gifts" (cadeaux plein écran)
  const [view, setView] = useState<"info" | "gifts">("info");
  // Mode "liste commune seule" (ouvert via son bouton dédié) → masque les onglets
  const [sharedOnly, setSharedOnly] = useState(false);
  // Vue cadeaux : mes idées / sa wishlist / liste commune
  const [giftTab, setGiftTab] = useState<"ideas" | "wishlist" | "shared">(
    "ideas",
  );
  // Filtre des idées par occasion ("all" ou une valeur d'occasion)
  const [giftFilter, setGiftFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [selectedWish, setSelectedWish] = useState<WishlistItem | null>(null);
  // Liste commune
  const [sharedList, setSharedList] = useState<SharedGiftList | null>(null);
  const [sentInvites, setSentInvites] = useState<SentInvitation[]>([]);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  // Flux d'invitation liste commune : ami → mode de partage → (sélection)
  const [inviteStep, setInviteStep] = useState<"friend" | "mode" | "select">(
    "friend",
  );
  const [inviteFriendId, setInviteFriendId] = useState<string | null>(null);
  const [inviteSel, setInviteSel] = useState<Set<string>>(new Set());
  const [showSharedForm, setShowSharedForm] = useState(false);
  const [editingSharedGift, setEditingSharedGift] = useState<SharedGift | null>(
    null,
  );
  const [selectedSharedGift, setSelectedSharedGift] =
    useState<SharedGift | null>(null);
  // Partage d'idées cadeaux dans le chat
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStep, setShareStep] = useState<1 | 2>(1);
  const [shareSel, setShareSel] = useState<Set<string>>(new Set());
  const [shareFriends, setShareFriends] = useState<FriendEntry[]>([]);
  const [cardShareOpen, setCardShareOpen] = useState(false);
  const [cardShareSending, setCardShareSending] = useState(false);
  const [cardShareSent, setCardShareSent] = useState(false);
  const [shareSending, setShareSending] = useState(false);
  const [shareSent, setShareSent] = useState(false);
  // Destinataire choisi dans les feuilles de partage. Un tap sur un nom ne fait
  // que sélectionner : l'envoi n'a lieu qu'au bouton « Envoyer à … ». Avant,
  // le tap envoyait directement, et une erreur de doigt partageait la carte de
  // quelqu'un à la mauvaise personne — sans annulation possible.
  const [cardShareTarget, setCardShareTarget] = useState<FriendEntry | null>(
    null,
  );
  const [giftShareTarget, setGiftShareTarget] = useState<FriendEntry | null>(
    null,
  );
  const [importOpen, setImportOpen] = useState(false);
  const [importSharedOpen, setImportSharedOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Gift | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteProgress = useRef(new Animated.Value(0)).current;
  const DELETE_DELAY = 5000;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const d = await fetchDate(id);
      setEntry(d);
      checkExistingEvent(d.linkedUser?._id ?? d._id)
        .then(setExistingEventId)
        .catch(() => {});
      if (d.linkedUser?._id) {
        try {
          const wl = await fetchUserWishlist(d.linkedUser._id);
          setWishlist(wl.data);
        } catch {
          setWishlist(null); // wishlist privée ou désactivée
        }
      }
      if (d.sharedGiftList) {
        try {
          setSharedList(await fetchSharedList(d.sharedGiftList));
        } catch {
          setSharedList(null);
        }
        setSentInvites([]);
      } else {
        setSharedList(null);
        try {
          setSentInvites(await fetchSentSharedInvitations(d._id));
        } catch {
          setSentInvites([]);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement.");
    }
  }, [id]);

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

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  const setGiftStatus = (g: Gift, status: GiftStatus) => {
    setSelectedGift((prev) =>
      prev && prev._id === g._id
        ? { ...prev, status, purchased: purchasedFromStatus(status) }
        : prev,
    );
    run(() =>
      updateGift(entry!._id, {
        ...g,
        status,
        purchased: purchasedFromStatus(status),
      }),
    );
  };

  const cycleGiftStatus = (g: Gift) =>
    setGiftStatus(g, nextGiftStatus(giftStatusOf(g)));

  // Suppression avec délai + annulation (bandeau bas d'écran)
  const finalizeDelete = (g: Gift) => {
    deleteTimer.current = null;
    setPendingDelete(null);
    run(() => deleteGift(entry!._id, g._id));
  };

  const requestDelete = (g: Gift) => {
    // Une suppression déjà en attente ? on la confirme d'abord.
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    if (pendingDelete && pendingDelete._id !== g._id) {
      run(() => deleteGift(entry!._id, pendingDelete._id));
    }
    setPendingDelete(g);
    deleteProgress.setValue(0);
    Animated.timing(deleteProgress, {
      toValue: 1,
      duration: DELETE_DELAY,
      useNativeDriver: false,
    }).start();
    deleteTimer.current = setTimeout(() => finalizeDelete(g), DELETE_DELAY);
  };

  const undoDelete = () => {
    if (deleteTimer.current) {
      clearTimeout(deleteTimer.current);
      deleteTimer.current = null;
    }
    deleteProgress.stopAnimation();
    setPendingDelete(null);
  };

  // Nettoyage du timer si on quitte l'écran (le cadeau reste)
  useEffect(() => {
    return () => {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
    };
  }, []);

  // ── Liste commune ──────────────────────────────────────────────────────────
  const reloadShared = async () => {
    if (entry?.sharedGiftList) {
      try {
        setSharedList(await fetchSharedList(entry.sharedGiftList));
      } catch {
        /* ignore */
      }
    }
  };

  const runShared = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await reloadShared();
    } catch (e: any) {
      setError(e?.message ?? "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  const setSharedGiftStatus = (g: SharedGift, status: GiftStatus) => {
    setSelectedSharedGift((prev) =>
      prev && prev._id === g._id
        ? { ...prev, status, purchased: purchasedFromStatus(status) }
        : prev,
    );
    runShared(() =>
      updateSharedGift(entry!.sharedGiftList!, g._id, {
        status,
        purchased: purchasedFromStatus(status),
      }),
    );
  };

  const openFriendPicker = async () => {
    setInviteMsg(null);
    // Réinitialise le flux d'invitation (ami → mode → sélection)
    setInviteStep("friend");
    setInviteFriendId(null);
    setInviteSel(new Set());
    setShowFriendPicker(true);
    try {
      const list = await fetchFriends();
      setFriends(list.filter((f) => f?.friendUser?._id));
    } catch {
      setFriends([]);
    }
  };

  // Étape 1 : ami choisi → s'il y a des idées sur la carte, proposer le mode ;
  // sinon envoyer directement (liste vide, "tout partager").
  const pickInviteFriend = (friendId: string) => {
    setInviteFriendId(friendId);
    const hasGifts = ((entry as DateEntry & { gifts?: Gift[] }).gifts?.length ?? 0) > 0;
    if (hasGifts) {
      setInviteSel(new Set());
      setInviteStep("mode");
    } else {
      sendInvite(friendId, "full");
    }
  };

  const toggleInviteGift = (id: string) =>
    setInviteSel((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const sendInvite = async (
    friendId: string,
    mode: "full" | "selective",
    giftIds?: string[],
  ) => {
    setShowFriendPicker(false);
    setInviteStep("friend");
    try {
      await inviteSharedList(friendId, entry!._id, { mode, giftIds });
      setInviteMsg("Invitation envoyée ✅ En attente de la réponse.");
      try {
        setSentInvites(await fetchSentSharedInvitations(entry!._id));
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'invitation.");
    }
  };

  const cancelInvite = async (id: string) => {
    try {
      await cancelSharedInvitation(id);
      setSentInvites((prev) => prev.filter((i) => i._id !== id));
      setInviteMsg(null);
    } catch (e: any) {
      setError(e?.message ?? "Erreur.");
    }
  };

  // ── Partage d'idées cadeaux dans le chat ────────────────────────────────────
  const openShare = () => {
    setShareStep(1);
    setShareSel(new Set());
    setShareSent(false);
    setGiftShareTarget(null);
    setShareOpen(true);
  };
  const toggleShareGift = (id: string) =>
    setShareSel((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const goShareStep2 = async () => {
    setShareStep(2);
    try {
      const list = await fetchFriends();
      const excl = entry?.linkedUser?._id;
      setShareFriends(
        list.filter((f) => f?.friendUser?._id && f.friendUser._id !== excl),
      );
    } catch {
      setShareFriends([]);
    }
  };
  // ── Partage de la carte anniversaire (type date_share) ──────────────────
  // Volontairement séparé du partage d'idées : aucun cadeau n'est transmis,
  // le destinataire reçoit juste de quoi recréer la carte chez lui.
  const openCardShare = async () => {
    setCardShareSent(false);
    setCardShareTarget(null);
    setCardShareOpen(true);
    try {
      const list = await fetchFriends();
      const excl = entry?.linkedUser?._id;
      setShareFriends(
        list.filter((f) => f?.friendUser?._id && f.friendUser._id !== excl),
      );
    } catch {
      setShareFriends([]);
    }
  };

  const sendCardShare = async (friendId: string) => {
    if (cardShareSending || !entry) return;
    setCardShareSending(true);
    try {
      const conv = await startConversation(friendId);
      const personName =
        `${entry.name}${entry.surname ? " " + entry.surname : ""}`.trim();
      const s = await getSocket();
      s.emit("message:send", {
        conversationId: conv._id,
        content: `🎂 Anniversaire de ${personName}`,
        type: "date_share",
        metadata: {
          personName,
          personId: entry._id,
          name: entry.name,
          surname: entry.surname ?? "",
          birthDate: entry.date,
          nameday: entry.nameday ?? entry.linkedUser?.nameday ?? null,
          // Présent seulement si la carte est liée à un inscrit : permet au
          // destinataire de lui envoyer une demande d'ami. On transmet l'_id,
          // jamais l'email — un ObjectId est opaque hors de l'app.
          linkedUserId: entry.linkedUser?._id ?? null,
        },
        tempId: `temp-${Date.now()}`,
      });
      setCardShareSent(true);
      setTimeout(() => setCardShareOpen(false), 900);
    } catch (e: any) {
      setError(e?.message ?? "Erreur d'envoi.");
    } finally {
      setCardShareSending(false);
    }
  };

  const sendShare = async (friendId: string) => {
    if (shareSending || !entry) return;
    setShareSending(true);
    try {
      const conv = await startConversation(friendId);
      const selectedGifts = (
        (entry as DateEntry & { gifts?: Gift[] }).gifts ?? []
      )
        .filter((g) => shareSel.has(g._id))
        .map((g) => ({
          giftName: g.giftName,
          occasion: g.occasion,
          year: g.year,
          purchased: g.purchased,
        }));
      const personName = `${entry.name}${entry.surname ? " " + entry.surname : ""}`.trim();
      const s = await getSocket();
      s.emit("message:send", {
        conversationId: conv._id,
        content: `🎁 Idées cadeaux pour ${personName}`,
        type: "gift_share",
        metadata: { personName, personId: entry._id, gifts: selectedGifts },
        tempId: `temp-${Date.now()}`,
      });
      setShareSent(true);
      setTimeout(() => setShareOpen(false), 900);
    } catch (e: any) {
      setError(e?.message ?? "Erreur d'envoi.");
    } finally {
      setShareSending(false);
    }
  };

  const importGifts = async (imported: ImportedGift[]) => {
    await run(async () => {
      for (const g of imported) {
        await addGift(entry!._id, {
          giftName: g.giftName,
          occasion: g.occasion,
          year: g.year,
          url: g.url,
          price: g.price,
          image: g.image,
        });
      }
    });
    setImportOpen(false);
  };

  // Importer des idées (depuis une de mes cartes) dans la liste commune
  const importSharedGifts = async (imported: ImportedGift[]) => {
    if (!entry?.sharedGiftList) return;
    await runShared(async () => {
      for (const g of imported) {
        await addSharedGift(entry.sharedGiftList!, {
          giftName: g.giftName,
          occasion: g.occasion,
          year: g.year,
          url: g.url,
          price: g.price,
          image: g.image,
        });
      }
    });
    setImportSharedOpen(false);
  };

  const onLeaveShared = () => {
    if (!entry?.sharedGiftList) return;
    Alert.alert(
      "Quitter la liste commune ?",
      "Tu ne verras plus cette liste. Les autres membres la gardent.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Quitter",
          style: "destructive",
          onPress: async () => {
            try {
              await leaveSharedList(entry.sharedGiftList!);
              setSharedList(null);
              await load();
            } catch (e: any) {
              setError(e?.message ?? "Erreur.");
            }
          },
        },
      ],
    );
  };

  // Options d'en-tête mémoïsées.
  //
  // Elles étaient déclarées en objet littéral avec un `headerRight` en fonction
  // fléchée : à chaque rendu de cet écran — et il en a beaucoup, une trentaine
  // d'états y vivent — react-navigation recevait de nouvelles options et
  // reconstruisait le bouton natif de la barre. C'est pendant ces
  // reconstructions à répétition que le bouton apparaissait étiré, faute d'être
  // mesuré à temps. Avec un objet stable, il n'est reconstruit que si son
  // contenu change réellement.
  //
  // ⚠️ useMemo doit rester AVANT le `if (!entry)` ci-dessous : un hook ne peut
  // pas être placé après un retour anticipé.
  const linkedUserId = entry?.linkedUser?._id;
  const chatUnreadCount = linkedUserId ? (byFriend[linkedUserId] ?? 0) : 0;
  const headerOptions = useMemo(
    () => ({
      title: `${entry?.name ?? ""} ${entry?.surname ?? ""}`.trim(),
      headerRight: () =>
        linkedUserId ? (
          <HeaderIconButton
            emoji="💬"
            accessibilityLabel="Ouvrir la discussion"
            badge={chatUnreadCount}
            onPress={() =>
              router.push(
                `/chat/${linkedUserId}?name=${encodeURIComponent(entry?.name ?? "")}`,
              )
            }
          />
        ) : (
          <HeaderIconButton
            emoji="✏️"
            accessibilityLabel="Modifier la carte"
            onPress={() => router.push(`/date/edit/${entry?._id}`)}
          />
        ),
    }),
    [entry?._id, entry?.name, entry?.surname, linkedUserId, chatUnreadCount, router],
  );

  if (!entry) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Anniversaire" }} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
    );
  }

  // Date d'anniversaire : sur l'entrée manuelle, sinon sur l'ami lié.
  const birthISO = entry.date || entry.linkedUser?.birthDate || null;
  const days = birthISO ? daysUntil(birthISO) : null;
  const allGifts = (entry as DateEntry & { gifts?: Gift[] }).gifts ?? [];
  // Masque le cadeau en cours de suppression (annulable)
  const gifts = pendingDelete
    ? allGifts.filter((g) => g._id !== pendingDelete._id)
    : allGifts;
  const filteredGifts =
    giftFilter === "all"
      ? gifts
      : gifts.filter((g) => g.occasion === giftFilter);
  const nameday = entry.nameday ?? entry.linkedUser?.nameday;

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Stack.Screen options={headerOptions} />

      {error && <Text style={styles.error}>{error}</Text>}

      {view === "info" && (
        <>
      {/* Infos */}
      <View style={[styles.card, styles.infoCard]}>
        <View style={styles.avatarFallback}>
          <Text style={styles.initials}>
            {`${(entry.name || entry.linkedUser?.name)?.[0] ?? ""}${
              (entry.surname || entry.linkedUser?.surname)?.[0] ?? ""
            }`.toUpperCase() || "?"}
          </Text>
          {!!(entry.linkedUser?.avatar || entry.photo) &&
            (entry.linkedUser?.avatar || entry.photo)!.trim().length > 0 && (
              <ExpoImage
                source={{ uri: entry.linkedUser?.avatar || entry.photo! }}
                style={[StyleSheet.absoluteFill as any, { borderRadius: 36 }]}
                contentFit="cover"
              />
            )}
        </View>
        <View style={styles.badgeRow}>
          {entry.linkedUser && <Badge label="AMI" color={colors.primary} />}
          {entry.family && <Badge label="FAMILLE" color={colors.warning} />}
        </View>
        {birthISO && (
          <Text style={styles.detail}>
            🎂 {formatFullDate(birthISO)} · {formatAge(currentAge(birthISO))}
          </Text>
        )}
        {nameday && (
          <Text style={styles.detail}>🎉 Fête : {formatNameday(nameday)}</Text>
        )}
        {birthISO &&
          (days === 0 ? (
            <View style={styles.countdownTodayBox}>
              <Text style={styles.countdownTodayText}>Aujourd'hui 🎂</Text>
            </View>
          ) : (
            <BirthdayCountdown iso={birthISO} />
          ))}

        {entry.linkedUser && (
          <Pressable
            style={[
              styles.familyBtn,
              entry.family && styles.familyBtnActive,
            ]}
            disabled={busy}
            onPress={() =>
              run(() => setDateFamily(entry._id, !entry.family))
            }
          >
            <Text
              style={[
                styles.familyBtnText,
                entry.family && styles.familyBtnTextActive,
              ]}
            >
              {entry.family
                ? "🏠 Retirer de la famille"
                : "🏠 Ajouter à la famille"}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Notifications pour cette date */}
      <View style={styles.card}>
        <View style={styles.notifHeader}>
          <Text style={styles.sectionTitle}>🔔 Rappels</Text>
          <Switch
            value={entry.receiveNotifications !== false}
            disabled={busy}
            onValueChange={(v) => run(() => setDateNotifications(entry._id, v))}
            trackColor={{ true: colors.primary }}
          />
        </View>

        {entry.receiveNotifications !== false && (
          <>
            <Text style={styles.notifLabel}>🎂 Anniversaire</Text>
            <View style={styles.notifChips}>
              <NotifChip
                label="Jour J"
                active={entry.notificationPreferences?.notifyOnBirthday !== false}
                disabled={busy}
                onPress={() =>
                  run(() =>
                    setBirthdayPrefs(entry._id, {
                      timings: entry.notificationPreferences?.timings ?? [1],
                      notifyOnBirthday:
                        entry.notificationPreferences?.notifyOnBirthday === false,
                    }),
                  )
                }
              />
              {[
                { v: 1, l: "J-1" },
                { v: 3, l: "J-3" },
                { v: 7, l: "J-7" },
                { v: 14, l: "J-14" },
                { v: 30, l: "J-30" },
              ].map(({ v, l }) => {
                const timings = entry.notificationPreferences?.timings ?? [1];
                const active = timings.includes(v);
                return (
                  <NotifChip
                    key={v}
                    label={l}
                    active={active}
                    disabled={busy}
                    onPress={() =>
                      run(() =>
                        setBirthdayPrefs(entry._id, {
                          timings: active
                            ? timings.filter((t) => t !== v)
                            : [...timings, v],
                          notifyOnBirthday:
                            entry.notificationPreferences?.notifyOnBirthday !==
                            false,
                        }),
                      )
                    }
                  />
                );
              })}
            </View>

            {nameday && (
              <>
                <Text style={styles.notifLabel}>🎉 Fête</Text>
                <View style={styles.notifChips}>
                  <NotifChip
                    label="Jour J"
                    active={entry.namedayPreferences?.notifyOnNameday !== false}
                    disabled={busy}
                    onPress={() =>
                      run(() =>
                        setNamedayPrefs(entry._id, {
                          timings: entry.namedayPreferences?.timings ?? [1],
                          notifyOnNameday:
                            entry.namedayPreferences?.notifyOnNameday === false,
                        }),
                      )
                    }
                  />
                  {[
                    { v: 1, l: "J-1" },
                    { v: 7, l: "J-7" },
                  ].map(({ v, l }) => {
                    const timings = entry.namedayPreferences?.timings ?? [1];
                    const active = timings.includes(v);
                    return (
                      <NotifChip
                        key={v}
                        label={l}
                        active={active}
                        disabled={busy}
                        onPress={() =>
                          run(() =>
                            setNamedayPrefs(entry._id, {
                              timings: active
                                ? timings.filter((t) => t !== v)
                                : [...timings, v],
                              notifyOnNameday:
                                entry.namedayPreferences?.notifyOnNameday !==
                                false,
                            }),
                          )
                        }
                      />
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </View>

      {/* Boutons sous les infos */}
      <Pressable
        style={styles.eventBtn}
        onPress={() =>
          existingEventId
            ? router.push(`/event/${existingEventId}`)
            : router.push(
                entry.linkedUser
                  ? `/event/new?forPerson=${entry.linkedUser._id}&personName=${encodeURIComponent(entry.name)}`
                  : `/event/new?forDate=${entry._id}&personName=${encodeURIComponent(entry.name)}`,
              )
        }
      >
        <Text style={styles.eventBtnText}>
          {existingEventId
            ? "🎉 Voir l'événement organisé"
            : "🎉 Organiser un événement"}
        </Text>
      </Pressable>

      <Pressable
        style={styles.giftsBtn}
        onPress={() => {
          setSharedOnly(false);
          setGiftTab("ideas");
          setView("gifts");
        }}
      >
        <Text style={styles.giftsBtnText}>🎁 Voir les cadeaux</Text>
      </Pressable>

      <Pressable
        style={styles.sharedBtn}
        onPress={() => {
          setSharedOnly(true);
          setGiftTab("shared");
          setView("gifts");
        }}
      >
        <Text style={styles.sharedBtnText}>👥 Liste commune</Text>
      </Pressable>

      {/* Partage de la carte elle-même (sans les cadeaux) */}
      <Pressable style={styles.shareCardBtn} onPress={openCardShare}>
        <Text style={styles.shareCardText}>📤 Partager cette carte</Text>
      </Pressable>
        </>
      )}

      {view === "gifts" && (
        <>
      {/* Retour à l'accueil de la carte */}
      <Pressable
        style={styles.backBtn}
        onPress={() => {
          setSharedOnly(false);
          setView("info");
        }}
      >
        <Text style={styles.backBtnText}>‹ Retour à la carte</Text>
      </Pressable>

      {!sharedOnly && (
        <View style={styles.giftTabs}>
          <Pressable
            style={[styles.giftTab, giftTab === "ideas" && styles.giftTabActive]}
            onPress={() => setGiftTab("ideas")}
          >
            <Text
              style={[
                styles.giftTabText,
                giftTab === "ideas" && styles.giftTabTextActive,
              ]}
            >
              🎁 Mes idées
            </Text>
          </Pressable>
          {entry.linkedUser && (
            <Pressable
              style={[
                styles.giftTab,
                giftTab === "wishlist" && styles.giftTabActive,
              ]}
              onPress={() => setGiftTab("wishlist")}
            >
              <Text
                style={[
                  styles.giftTabText,
                  giftTab === "wishlist" && styles.giftTabTextActive,
                ]}
              >
                🎀 Sa wishlist
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {giftTab === "ideas" && (
      <View style={styles.card}>
        <View style={styles.giftsHeader}>
          <Text style={styles.sectionTitle}>🎁 Mes idées cadeaux</Text>
          <Pressable
            style={styles.newIdeaBtnTop}
            onPress={() => {
              setEditingGift(null);
              setShowGiftForm((v) => !v);
            }}
          >
            <Text style={styles.newIdeaTopText}>
              {showGiftForm ? "✕ Fermer" : "＋ Nouvelle idée"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.importBtn}
          onPress={() => setImportOpen(true)}
        >
          <Text style={styles.importText}>📋 Importer depuis une liste</Text>
        </Pressable>

        {((entry as DateEntry & { gifts?: Gift[] }).gifts?.length ?? 0) > 0 && (
          <Pressable style={styles.shareChatBtn} onPress={openShare}>
            <Text style={styles.shareChatText}>
              📤 Partager ces idées dans le chat
            </Text>
          </Pressable>
        )}

        {showGiftForm && (
          <GiftIdeaForm
            busy={busy}
            onCancel={() => setShowGiftForm(false)}
            onSubmit={async (gift) => {
              await run(() => addGift(entry._id, gift));
              setShowGiftForm(false);
            }}
          />
        )}
        {editingGift && (
          <GiftIdeaForm
            key={editingGift._id}
            title={`Modifier « ${editingGift.giftName} »`}
            submitLabel="Enregistrer"
            busy={busy}
            onCancel={() => setEditingGift(null)}
            initial={{
              giftName: editingGift.giftName,
              occasion: editingGift.occasion,
              year: editingGift.year,
              url: editingGift.url ?? undefined,
              price: editingGift.price ?? undefined,
              image: editingGift.image ?? undefined,
            }}
            onSubmit={async (gift) => {
              await run(() =>
                updateGift(entry._id, {
                  ...editingGift,
                  ...gift,
                  url: gift.url ?? null,
                  price: gift.price ?? null,
                  image: gift.image ?? null,
                }),
              );
              setEditingGift(null);
            }}
          />
        )}

        {/* Filtre par occasion — bouton déroulant */}
        {gifts.length > 0 && (
          <>
            <Pressable
              style={[
                styles.filterToggle,
                (showFilters || giftFilter !== "all") && styles.filterToggleOn,
              ]}
              onPress={() => {
                if (showFilters) setGiftFilter("all"); // fermer → réaffiche tout
                setShowFilters((v) => !v);
              }}
            >
              <Text
                style={[
                  styles.filterToggleText,
                  (showFilters || giftFilter !== "all") &&
                    styles.filterToggleTextOn,
                ]}
              >
                {showFilters
                  ? "✕ Fermer le filtre"
                  : giftFilter === "all"
                    ? "🔎 Filtrer par occasion"
                    : `🔎 ${occasionEmoji(giftFilter)} ${giftFilter}`}
              </Text>
            </Pressable>

            {showFilters && (
              <View style={styles.filterWrap}>
                <Pressable
                  style={[
                    styles.filterChip,
                    giftFilter === "all" && styles.filterChipOn,
                  ]}
                  onPress={() => setGiftFilter("all")}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      giftFilter === "all" && styles.filterChipTextOn,
                    ]}
                  >
                    Tous
                  </Text>
                </Pressable>
                {OCCASIONS.filter((o) =>
                  gifts.some((g) => g.occasion === o.value),
                ).map((o) => (
                  <Pressable
                    key={o.value}
                    style={[
                      styles.filterChip,
                      giftFilter === o.value && styles.filterChipOn,
                    ]}
                    onPress={() => setGiftFilter(o.value)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        giftFilter === o.value && styles.filterChipTextOn,
                      ]}
                    >
                      {o.emoji} {o.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}

        {filteredGifts.length === 0 && (
          <Text style={styles.muted}>
            {gifts.length === 0
              ? "Aucune idée pour l'instant."
              : "Aucune idée pour ce filtre."}
          </Text>
        )}

        <View style={styles.giftGrid}>
          {filteredGifts.map((g) => {
            const st = giftStatusOf(g);
            const meta = GIFT_STATUS_META[st];
            return (
              <Pressable
                key={g._id}
                style={[
                  styles.giftGridCard,
                  st !== "to_buy" && styles.giftCardDone,
                ]}
                onPress={() => setSelectedGift(g)}
              >
                {g.image ? (
                  <Image source={{ uri: g.image }} style={styles.giftGridImg} />
                ) : (
                  <View style={[styles.giftGridImg, styles.giftCardNoImg]}>
                    <Text style={styles.giftGridEmoji}>
                      {occasionEmoji(g.occasion)}
                    </Text>
                  </View>
                )}
                <Text style={styles.giftName} numberOfLines={2}>
                  {g.giftName}
                </Text>
                <Text style={styles.giftMeta} numberOfLines={1}>
                  {occasionEmoji(g.occasion)} {g.occasion}
                  {g.year ? ` · ${g.year}` : ""}
                </Text>
                <View style={styles.giftGridRow}>
                  {g.price != null && (
                    <View style={styles.pricePill}>
                      <Text style={styles.pricePillText}>{g.price} €</Text>
                    </View>
                  )}
                  <Pressable
                    disabled={busy}
                    onPress={() => cycleGiftStatus(g)}
                    style={[styles.giftBadge, { backgroundColor: meta.bg }]}
                  >
                    <Text style={[styles.giftBadgeText, { color: meta.color }]}>
                      {meta.emoji} {meta.short}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      )}

      {/* Sa Wishlist (amis inscrits) */}
      {entry.linkedUser && giftTab === "wishlist" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            🎀 La wishlist de {entry.name}
          </Text>
          {wishlist === null && (
            <Text style={styles.muted}>
              Wishlist privée ou non disponible.
            </Text>
          )}
          {wishlist?.length === 0 && (
            <Text style={styles.muted}>Sa wishlist est vide.</Text>
          )}
          {(() => {
            // On masque les cadeaux déjà réservés par quelqu'un d'autre ;
            // on garde les disponibles + ceux qu'on a réservés soi-même.
            const visibleWishlist = (wishlist ?? []).filter((item) => {
              const reservedByMe = item.reservedBy?._id === user?._id;
              const reservedByOther =
                (!!item.reservedBy && !reservedByMe) || !!item.reservedByGuest;
              return !reservedByOther;
            });
            if ((wishlist?.length ?? 0) > 0 && visibleWishlist.length === 0) {
              return (
                <Text style={styles.muted}>
                  Tous les cadeaux disponibles ont été réservés 🎁
                </Text>
              );
            }
            return (
              <View style={giftGridStyles.grid}>
                {visibleWishlist.map((item) => {
                  const reservedByMe = item.reservedBy?._id === user?._id;
                  return (
                    <GiftGridCard
                      key={item._id}
                      imageUri={item.image}
                      placeholderEmoji="🎀"
                      title={item.title}
                      price={item.price ?? null}
                      badge={
                        reservedByMe
                          ? {
                              label: "Réservé par toi",
                              color: colors.successStrong,
                              bg: colors.successSoft,
                            }
                          : {
                              label: "Disponible",
                              color: colors.sub,
                              bg: colors.bgSecondary,
                            }
                      }
                      onPress={() => setSelectedWish(item)}
                    />
                  );
                })}
              </View>
            );
          })()}
        </View>
      )}

      {giftTab === "shared" && (
        <View style={styles.card}>
          {!entry.sharedGiftList ? (
            <>
              <Text style={styles.sectionTitle}>👥 Liste commune</Text>
              <Text style={styles.muted}>
                Partage une liste d'idées cadeaux avec un proche : vous la voyez
                et l'éditez tous les deux.
              </Text>
              {inviteMsg && <Text style={styles.inviteMsg}>{inviteMsg}</Text>}
              <Pressable style={styles.eventBtn} onPress={openFriendPicker}>
                <Text style={styles.eventBtnText}>
                  ＋ Créer une liste commune
                </Text>
              </Pressable>

              {sentInvites.map((inv) => (
                <View key={inv._id} style={styles.sentRow}>
                  <Text style={styles.muted} numberOfLines={1}>
                    En attente de {inv.toUser?.name} {inv.toUser?.surname ?? ""}…
                  </Text>
                  <Pressable
                    hitSlop={8}
                    disabled={busy}
                    onPress={() => cancelInvite(inv._id)}
                  >
                    <Text style={styles.cancelInvite}>Annuler</Text>
                  </Pressable>
                </View>
              ))}
            </>
          ) : !sharedList ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginVertical: 16 }}
            />
          ) : (
            <>
              <View style={styles.giftsHeader}>
                <Text style={styles.sectionTitle}>👥 Idées communes</Text>
                <Pressable
                  style={styles.newIdeaBtnTop}
                  onPress={() => {
                    setEditingSharedGift(null);
                    setShowSharedForm((v) => !v);
                  }}
                >
                  <Text style={styles.newIdeaTopText}>
                    {showSharedForm ? "✕ Fermer" : "＋ Ajouter"}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.muted}>
                Membres :{" "}
                {sharedList.members
                  .map((m) => `${m.name}${m.surname ? " " + m.surname : ""}`)
                  .join(", ")}
              </Text>

              <Pressable
                style={styles.importBtn}
                onPress={() => setImportSharedOpen(true)}
              >
                <Text style={styles.importText}>
                  📋 Importer des idées depuis une liste
                </Text>
              </Pressable>

              {showSharedForm && (
                <GiftIdeaForm
                  busy={busy}
                  onCancel={() => setShowSharedForm(false)}
                  onSubmit={async (gift) => {
                    await runShared(() =>
                      addSharedGift(entry.sharedGiftList!, gift),
                    );
                    setShowSharedForm(false);
                  }}
                />
              )}
              {editingSharedGift && (
                <GiftIdeaForm
                  key={editingSharedGift._id}
                  title={`Modifier « ${editingSharedGift.giftName} »`}
                  submitLabel="Enregistrer"
                  busy={busy}
                  onCancel={() => setEditingSharedGift(null)}
                  initial={{
                    giftName: editingSharedGift.giftName,
                    occasion: editingSharedGift.occasion,
                    year: editingSharedGift.year,
                    url: editingSharedGift.url ?? undefined,
                    price: editingSharedGift.price ?? undefined,
                    image: editingSharedGift.image ?? undefined,
                  }}
                  onSubmit={async (gift) => {
                    await runShared(() =>
                      updateSharedGift(
                        entry.sharedGiftList!,
                        editingSharedGift._id,
                        {
                          ...gift,
                          url: gift.url ?? null,
                          price: gift.price ?? null,
                          image: gift.image ?? null,
                        },
                      ),
                    );
                    setEditingSharedGift(null);
                  }}
                />
              )}

              {sharedList.gifts.length === 0 && (
                <Text style={styles.muted}>Aucune idée commune pour l'instant.</Text>
              )}

              <View style={styles.giftGrid}>
                {sharedList.gifts.map((g) => {
                  const st = giftStatusOf(g);
                  const meta = GIFT_STATUS_META[st];
                  return (
                    <Pressable
                      key={g._id}
                      style={[
                        styles.giftGridCard,
                        st !== "to_buy" && styles.giftCardDone,
                      ]}
                      onPress={() => setSelectedSharedGift(g)}
                    >
                      {g.image ? (
                        <Image
                          source={{ uri: g.image }}
                          style={styles.giftGridImg}
                        />
                      ) : (
                        <View style={[styles.giftGridImg, styles.giftCardNoImg]}>
                          <Text style={styles.giftGridEmoji}>
                            {occasionEmoji(g.occasion)}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.giftName} numberOfLines={2}>
                        {g.giftName}
                      </Text>
                      <Text style={styles.giftMeta} numberOfLines={1}>
                        {occasionEmoji(g.occasion)} {g.occasion}
                        {g.addedBy?.name ? ` · ${g.addedBy.name}` : ""}
                      </Text>
                      <View style={styles.giftGridRow}>
                        {g.price != null && (
                          <View style={styles.pricePill}>
                            <Text style={styles.pricePillText}>{g.price} €</Text>
                          </View>
                        )}
                        <Pressable
                          disabled={busy}
                          onPress={() =>
                            setSharedGiftStatus(g, nextGiftStatus(st))
                          }
                          style={[styles.giftBadge, { backgroundColor: meta.bg }]}
                        >
                          <Text
                            style={[styles.giftBadgeText, { color: meta.color }]}
                          >
                            {meta.emoji} {meta.short}
                          </Text>
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable onPress={onLeaveShared} style={{ marginTop: 6 }}>
                <Text style={styles.leaveShared}>Quitter la liste commune</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
        </>
      )}

      <GiftDetailModal
        gift={selectedGift}
        busy={busy}
        onClose={() => setSelectedGift(null)}
        onSetStatus={(g, status) => setGiftStatus(g, status)}
        onEdit={(g) => {
          setSelectedGift(null);
          setShowGiftForm(false);
          setEditingGift(g);
        }}
        onDelete={(g) => {
          setSelectedGift(null);
          requestDelete(g);
        }}
      />

      <BottomSheet
        visible={!!selectedWish}
        onClose={() => setSelectedWish(null)}
      >
        {selectedWish &&
          (() => {
            const w = selectedWish;
            const reservedByMe = w.reservedBy?._id === user?._id;
            const reserved = !!w.reservedBy || !!w.reservedByGuest;
            return (
              <>
                {w.image ? (
                  <Image source={{ uri: w.image }} style={styles.sheetImage} />
                ) : (
                  <View style={[styles.sheetImage, styles.sheetImgPlaceholder]}>
                    <Text style={{ fontSize: 56 }}>🎀</Text>
                  </View>
                )}
                <Text style={styles.sheetTitle}>{w.title}</Text>
                <View style={styles.sheetInfoRow}>
                  <Text style={styles.sheetPrice}>
                    {w.price != null ? `${w.price} €` : "Prix libre"}
                  </Text>
                  {w.url ? (
                    <Text
                      style={styles.link}
                      onPress={() => Linking.openURL(w.url!)}
                    >
                      🔗 Voir le produit
                    </Text>
                  ) : null}
                </View>
                {reserved && !reservedByMe && (
                  <Text style={styles.sheetReserved}>
                    🧑 Déjà réservé par quelqu'un
                  </Text>
                )}
                {!reserved && (
                  <Pressable
                    style={styles.sheetPrimaryBtn}
                    disabled={busy}
                    onPress={() => {
                      setSelectedWish(null);
                      run(() => reserveItem(w._id));
                    }}
                  >
                    <Text style={styles.sheetPrimaryText}>🎁 Je réserve</Text>
                  </Pressable>
                )}
                {reservedByMe && (
                  <Pressable
                    style={styles.sheetGhostBtn}
                    disabled={busy}
                    onPress={() => {
                      setSelectedWish(null);
                      run(() => unreserveItem(w._id));
                    }}
                  >
                    <Text style={styles.sheetGhostText}>
                      ↩️ Annuler ma réservation
                    </Text>
                  </Pressable>
                )}
              </>
            );
          })()}
      </BottomSheet>

      {/* Détail d'un cadeau commun (réutilise le modal cadeau) */}
      <GiftDetailModal
        gift={selectedSharedGift as Gift | null}
        busy={busy}
        onClose={() => setSelectedSharedGift(null)}
        onSetStatus={(g, status) =>
          setSharedGiftStatus(g as SharedGift, status)
        }
        onEdit={(g) => {
          setSelectedSharedGift(null);
          setShowSharedForm(false);
          setEditingSharedGift(g as SharedGift);
        }}
        onDelete={(g) => {
          setSelectedSharedGift(null);
          runShared(() => deleteSharedGift(entry.sharedGiftList!, g._id));
        }}
      />

      {/* Sélecteur d'ami + mode de partage pour créer une liste commune */}
      <BottomSheet
        visible={showFriendPicker}
        onClose={() => setShowFriendPicker(false)}
      >
        {inviteStep === "friend" && (
          <>
            <Text style={styles.sheetTitle}>Avec qui créer la liste ?</Text>
            <Text style={styles.muted}>
              Choisis un ami. Il recevra une invitation à rejoindre la liste.
            </Text>
            {friends.map((f) => (
              <Pressable
                key={f.friendship._id}
                style={styles.friendRow}
                onPress={() => pickInviteFriend(f.friendUser._id)}
              >
                <Text style={styles.friendName}>
                  {f.friendUser.name} {f.friendUser.surname ?? ""}
                </Text>
              </Pressable>
            ))}
            {friends.length === 0 && (
              <Text style={styles.muted}>Aucun ami disponible.</Text>
            )}
          </>
        )}

        {inviteStep === "mode" && (
          <>
            <Text style={styles.sheetTitle}>Que partager ?</Text>
            <Text style={styles.muted}>
              Choisis les idées à inclure dans la liste commune.
            </Text>
            <Pressable
              style={styles.sheetPrimaryBtn}
              onPress={() =>
                inviteFriendId && sendInvite(inviteFriendId, "full")
              }
            >
              <Text style={styles.sheetPrimaryText}>
                🎁 Tout partager ({allGifts.length} idée
                {allGifts.length > 1 ? "s" : ""})
              </Text>
            </Pressable>
            <Pressable
              style={styles.inviteAltBtn}
              onPress={() => {
                setInviteSel(new Set());
                setInviteStep("select");
              }}
            >
              <Text style={styles.inviteAltText}>
                ✅ Choisir les idées à partager
              </Text>
            </Pressable>
          </>
        )}

        {inviteStep === "select" && (
          <>
            <Text style={styles.sheetTitle}>Idées à partager</Text>
            <Text style={styles.muted}>
              Sélectionne les idées à inclure dans la liste commune.
            </Text>
            {allGifts.map((g) => (
              <Pressable
                key={g._id}
                style={styles.shareGiftRow}
                onPress={() => toggleInviteGift(g._id)}
              >
                <Text style={styles.shareCheck}>
                  {inviteSel.has(g._id) ? "☑" : "☐"}
                </Text>
                <Text style={styles.shareGiftName} numberOfLines={1}>
                  {g.giftName}
                </Text>
              </Pressable>
            ))}
            <View style={styles.inviteFooter}>
              <Pressable
                style={styles.inviteBackBtn}
                onPress={() => setInviteStep("mode")}
              >
                <Text style={styles.inviteBackText}>Retour</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.sheetPrimaryBtn,
                  { flex: 1 },
                  inviteSel.size === 0 && { opacity: 0.5 },
                ]}
                disabled={inviteSel.size === 0}
                onPress={() =>
                  inviteFriendId &&
                  sendInvite(
                    inviteFriendId,
                    "selective",
                    Array.from(inviteSel),
                  )
                }
              >
                <Text style={styles.sheetPrimaryText}>
                  Envoyer ({inviteSel.size})
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </BottomSheet>

      {/* Partage d'idées cadeaux dans le chat */}
      <BottomSheet visible={shareOpen} onClose={() => setShareOpen(false)}>
        {shareStep === 1 ? (
          <>
            <Text style={styles.sheetTitle}>Partager des idées</Text>
            <Text style={styles.muted}>Sélectionne les idées à partager.</Text>
            {allGifts.map((g) => (
              <Pressable
                key={g._id}
                style={styles.shareGiftRow}
                onPress={() => toggleShareGift(g._id)}
              >
                <Text style={styles.shareCheck}>
                  {shareSel.has(g._id) ? "☑" : "☐"}
                </Text>
                <Text style={styles.shareGiftName} numberOfLines={1}>
                  {g.giftName}
                  {g.purchased ? " · ✅" : ""}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[
                styles.sheetPrimaryBtn,
                shareSel.size === 0 && { opacity: 0.5 },
              ]}
              disabled={shareSel.size === 0}
              onPress={goShareStep2}
            >
              <Text style={styles.sheetPrimaryText}>
                Suivant → ({shareSel.size})
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.sheetTitle}>Envoyer à…</Text>
            {shareSent ? (
              <Text style={styles.savedShare}>✅ Envoyé !</Text>
            ) : (
              <>
                {shareFriends.map((f) => {
                  const picked =
                    giftShareTarget?.friendship._id === f.friendship._id;
                  return (
                    <Pressable
                      key={f.friendship._id}
                      style={[
                        styles.friendRow,
                        picked && styles.friendRowPicked,
                      ]}
                      disabled={shareSending}
                      onPress={() => setGiftShareTarget(picked ? null : f)}
                    >
                      <Text style={styles.friendCheck}>
                        {picked ? "◉" : "○"}
                      </Text>
                      <Text style={styles.friendName}>
                        {f.friendUser.name} {f.friendUser.surname ?? ""}
                      </Text>
                    </Pressable>
                  );
                })}
                {shareFriends.length === 0 && (
                  <Text style={styles.muted}>Aucun ami disponible.</Text>
                )}
                {shareFriends.length > 0 && (
                  <Pressable
                    style={[
                      styles.sheetPrimaryBtn,
                      (!giftShareTarget || shareSending) && { opacity: 0.5 },
                    ]}
                    disabled={!giftShareTarget || shareSending}
                    onPress={() =>
                      giftShareTarget &&
                      sendShare(giftShareTarget.friendUser._id)
                    }
                  >
                    {shareSending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.sheetPrimaryText}>
                        {giftShareTarget
                          ? `Envoyer à ${giftShareTarget.friendUser.name}`
                          : "Choisis un destinataire"}
                      </Text>
                    )}
                  </Pressable>
                )}
              </>
            )}
          </>
        )}
      </BottomSheet>

      <BottomSheet
        visible={cardShareOpen}
        onClose={() => setCardShareOpen(false)}
      >
        <Text style={styles.sheetTitle}>Partager cette carte</Text>
        {cardShareSent ? (
          <Text style={styles.savedShare}>✅ Envoyé !</Text>
        ) : (
          <>
            <Text style={styles.muted}>
              Votre ami pourra l'ajouter à ses anniversaires. Vos idées cadeaux
              ne sont pas partagées.
            </Text>
            {shareFriends.map((f) => {
              const picked =
                cardShareTarget?.friendship._id === f.friendship._id;
              return (
                <Pressable
                  key={f.friendship._id}
                  style={[styles.friendRow, picked && styles.friendRowPicked]}
                  disabled={cardShareSending}
                  onPress={() => setCardShareTarget(picked ? null : f)}
                >
                  <Text style={styles.friendCheck}>{picked ? "◉" : "○"}</Text>
                  <Text style={styles.friendName}>
                    {f.friendUser.name} {f.friendUser.surname ?? ""}
                  </Text>
                </Pressable>
              );
            })}
            {shareFriends.length === 0 && (
              <Text style={styles.muted}>Aucun ami disponible.</Text>
            )}
            {shareFriends.length > 0 && (
              <Pressable
                style={[
                  styles.sheetPrimaryBtn,
                  (!cardShareTarget || cardShareSending) && { opacity: 0.5 },
                ]}
                disabled={!cardShareTarget || cardShareSending}
                onPress={() =>
                  cardShareTarget &&
                  sendCardShare(cardShareTarget.friendUser._id)
                }
              >
                {cardShareSending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.sheetPrimaryText}>
                    {cardShareTarget
                      ? `Envoyer à ${cardShareTarget.friendUser.name}`
                      : "Choisis un destinataire"}
                  </Text>
                )}
              </Pressable>
            )}
          </>
        )}
      </BottomSheet>

      <ImportGiftSheet
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={importGifts}
        excludeDateId={entry?._id}
        busy={busy}
      />

      {/* Import d'idées vers la liste commune */}
      <ImportGiftSheet
        visible={importSharedOpen}
        onClose={() => setImportSharedOpen(false)}
        onImport={importSharedGifts}
        excludeDateId={entry?._id}
        busy={busy}
      />
    </ScrollView>

      {pendingDelete && (
        <View style={styles.undoBar}>
          <View style={styles.undoRow}>
            <Text style={styles.undoText} numberOfLines={1}>
              « {pendingDelete.giftName} » supprimé
            </Text>
            <Pressable onPress={undoDelete} hitSlop={8}>
              <Text style={styles.undoAction}>Annuler la suppression</Text>
            </Pressable>
          </View>
          <View style={styles.undoTrack}>
            <Animated.View
              style={[
                styles.undoProgress,
                {
                  width: deleteProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["100%", "0%"],
                  }),
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function NotifChip({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const chipStyles = useThemedStyles(makeChipStyles);
  return (
    <Pressable
      style={[chipStyles.chip, active && chipStyles.chipActive]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={[chipStyles.text, active && chipStyles.textActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeChipStyles = (c: ThemeColors) =>
  StyleSheet.create({
    chip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      paddingVertical: 5,
      paddingHorizontal: 10,
      backgroundColor: c.cardSoft,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    text: { fontSize: 12, fontWeight: "600", color: c.sub },
    textActive: { color: c.white },
  });

function Badge({ label, color }: { label: string; color: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
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
  card: {
    backgroundColor: c.card,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    shadowColor: c.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  infoCard: { alignItems: "center", gap: 6 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  initials: { fontSize: 24, fontWeight: "700", color: c.primaryStrong },
  badgeRow: { flexDirection: "row", gap: 6 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: c.white, fontSize: 10, fontWeight: "700" },
  detail: { color: c.text, fontSize: 14 },
  countdown: {
    backgroundColor: c.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 4,
  },
  countdownToday: { backgroundColor: c.primary },
  countdownText: { color: c.primaryStrong, fontWeight: "700" },
  countdownTodayBox: {
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  countdownTodayText: { color: c.success, fontWeight: "800", fontSize: 15 },
  familyBtn: {
    alignSelf: "stretch",
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: c.warning,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  familyBtnActive: { backgroundColor: c.warningSoft },
  familyBtnText: { color: c.warningStrong, fontWeight: "700", fontSize: 14 },
  familyBtnTextActive: { color: c.warningStrong },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: c.text },
  muted: { color: c.sub, fontSize: 12 },
  giftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.borderStrong,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxOn: { backgroundColor: c.success, borderColor: c.success },
  checkmark: { color: c.white, fontWeight: "700", fontSize: 14 },
  giftName: { color: c.text, fontWeight: "600" },
  giftDone: { textDecorationLine: "line-through", color: c.faint },
  deleteX: { color: c.danger, fontSize: 16, fontWeight: "700" },
  newIdeaBtn: {
    borderWidth: 1,
    borderColor: c.primary,
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 6,
  },
  newIdeaText: { color: c.primary, fontWeight: "600" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.inputBorder,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    backgroundColor: c.inputBg,
    color: c.text,
  },
  addBtn: {
    backgroundColor: c.primary,
    borderRadius: 10,
    width: 42,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: { color: c.white, fontSize: 20, fontWeight: "600" },
  link: { color: c.primary, fontSize: 12 },
  wishImage: { width: 44, height: 44, borderRadius: 8 },
  eventBtn: {
    backgroundColor: c.primary,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  eventBtnText: { color: c.white, fontWeight: "700", fontSize: 15 },
  notifHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notifLabel: { fontSize: 13, fontWeight: "700", color: c.sub, marginTop: 4 },
  notifChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reserveBtn: {
    borderWidth: 1,
    borderColor: c.primary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  reserveText: { color: c.primary, fontWeight: "600", fontSize: 12 },
  unreserveBtn: { borderColor: c.danger },
  unreserveText: { color: c.danger, fontWeight: "600", fontSize: 12 },

  // Bouton "Voir les cadeaux" (accueil carte)
  giftsBtn: {
    backgroundColor: c.card,
    borderWidth: 1.5,
    borderColor: c.primary,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  giftsBtnText: { color: c.primary, fontWeight: "700", fontSize: 15 },
  sharedBtn: {
    backgroundColor: c.card,
    borderWidth: 1.5,
    borderColor: c.accent,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  sharedBtnText: { color: c.accentStrong, fontWeight: "700", fontSize: 15 },

  // Partage de la carte : action secondaire, moins appuyée que les 3 boutons
  // d'action au-dessus (événement, cadeaux, liste commune).
  shareCardBtn: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
  },
  shareCardText: { color: c.sub, fontWeight: "700", fontSize: 14 },

  // Retour + bascule (vue cadeaux)
  backBtn: { paddingVertical: 6, paddingHorizontal: 2 },
  backBtnText: { color: c.primary, fontWeight: "700", fontSize: 15 },
  giftTabs: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: c.bgSecondary,
    borderRadius: 12,
    padding: 4,
  },
  giftTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9,
  },
  giftTabActive: {
    backgroundColor: c.card,
    shadowColor: c.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  giftTabText: { fontSize: 13, fontWeight: "700", color: c.sub },
  giftTabTextActive: { color: c.text },

  // Cartes cadeaux (style web)
  giftCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: c.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 10,
    marginBottom: 10,
  },
  giftCardDone: { opacity: 0.7, backgroundColor: c.cardSoft },
  giftCardImg: { width: 64, height: 64, borderRadius: 10 },
  giftCardNoImg: {
    backgroundColor: c.bgSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  giftCardNoImgTxt: { fontSize: 26 },
  giftCardBody: { flex: 1, gap: 4 },
  giftCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  giftMeta: { color: c.sub, fontSize: 12 },
  giftCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  pricePill: {
    backgroundColor: c.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pricePillText: { color: c.primaryStrong, fontWeight: "700", fontSize: 12 },
  giftBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  giftBadgePending: { backgroundColor: c.warningSoft },
  giftBadgeDone: { backgroundColor: c.successSoft },
  giftBadgeText: { fontSize: 10, fontWeight: "800" },
  giftBadgeTextPending: { color: c.warningStrong },
  giftBadgeTextDone: { color: c.successStrong },
  giftCardActions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
  },
  giftActionEdit: { color: c.primary, fontWeight: "600", fontSize: 14 },
  giftActionDel: { color: c.danger, fontWeight: "600", fontSize: 14 },
  giftCardActionBtn: { alignSelf: "flex-start", marginTop: 4 },

  // En-tête section idées + bouton "Nouvelle idée" en haut
  giftsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  newIdeaBtnTop: {
    backgroundColor: c.primary,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  newIdeaTopText: { color: c.white, fontWeight: "700", fontSize: 13 },

  // Filtre par occasion (bouton déroulant + panneau qui revient à la ligne)
  filterToggle: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: c.cardSoft,
  },
  filterToggleOn: { borderColor: c.primary, backgroundColor: c.primarySoft },
  filterToggleText: { fontSize: 13, fontWeight: "700", color: c.text },
  filterToggleTextOn: { color: c.primaryStrong },
  filterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 4,
  },
  filterRow: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  filterChip: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: c.cardSoft,
  },
  filterChipOn: { backgroundColor: c.primary, borderColor: c.primary },
  filterChipText: { fontSize: 12, fontWeight: "600", color: c.text },
  filterChipTextOn: { color: c.white },

  // Grille 2 colonnes
  giftGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  giftGridCard: {
    width: "48.5%",
    backgroundColor: c.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 8,
    gap: 4,
  },
  giftGridImg: { width: "100%", height: 90, borderRadius: 8 },
  giftGridEmoji: { fontSize: 30 },
  giftGridRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  giftGridActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    marginTop: 2,
  },

  // Bottom sheet wishlist
  sheetImage: { width: "100%", height: 180, borderRadius: 14 },
  sheetImgPlaceholder: {
    backgroundColor: c.bgSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: c.text,
    marginTop: 14,
  },
  sheetInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  sheetPrice: { fontSize: 20, fontWeight: "800", color: c.text },
  sheetReserved: { color: c.sub, fontSize: 13, marginTop: 10 },
  sheetPrimaryBtn: {
    backgroundColor: c.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
  },
  sheetPrimaryText: { color: c.white, fontWeight: "700", fontSize: 15 },
  inviteAltBtn: {
    borderWidth: 1.5,
    borderColor: c.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  inviteAltText: { color: c.primary, fontWeight: "700", fontSize: 15 },
  inviteFooter: { flexDirection: "row", gap: 10, marginTop: 16 },
  inviteBackBtn: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteBackText: { color: c.sub, fontWeight: "600", fontSize: 15 },
  sheetGhostBtn: {
    borderWidth: 1.5,
    borderColor: c.borderStrong,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
  },
  sheetGhostText: { color: c.text, fontWeight: "700", fontSize: 15 },
  inviteMsg: { color: c.successStrong, fontSize: 13, marginTop: 4 },
  sentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  cancelInvite: { color: c.danger, fontWeight: "700", fontSize: 13 },
  leaveShared: {
    color: c.danger,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  // Destinataire sélectionné : fond teinté, pour qu'on voie sans ambiguïté à
  // qui on est sur le point d'envoyer avant d'appuyer sur « Envoyer à … ».
  friendRowPicked: { backgroundColor: c.primarySoft, borderRadius: 10 },
  friendCheck: { fontSize: 16, color: c.primary, width: 18 },
  friendName: { fontSize: 15, fontWeight: "600", color: c.text },
  shareChatBtn: {
    borderWidth: 1,
    borderColor: c.primary,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
    marginTop: 4,
  },
  shareChatText: { color: c.primary, fontWeight: "600", fontSize: 13 },
  importBtn: {
    borderWidth: 1,
    borderColor: c.primary,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  importText: { color: c.primary, fontWeight: "600", fontSize: 13 },
  shareGiftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  shareCheck: { fontSize: 18, color: c.primary },
  shareGiftName: { flex: 1, fontSize: 14, color: c.text },
  savedShare: {
    color: c.successStrong,
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
    marginVertical: 16,
  },

  // Bandeau "annuler la suppression"
  undoBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 20,
    backgroundColor: UNDO_BG,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    shadowColor: c.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  undoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  undoText: { color: UNDO_TEXT, fontSize: 13, flex: 1 },
  undoAction: { color: UNDO_ACTION, fontWeight: "700", fontSize: 13 },
  undoTrack: {
    height: 3,
    backgroundColor: UNDO_TRACK,
    borderRadius: 2,
    marginTop: 10,
    overflow: "hidden",
  },
  undoProgress: {
    height: 3,
    backgroundColor: c.primaryLight,
    borderRadius: 2,
  },
  });
