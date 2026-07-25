import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  TextInput,
  Linking,
  Share,
  Alert,
  Animated,
} from "react-native";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
} from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { fetchUrlInfo } from "../../lib/wishlist";
import {
  EventDetail,
  RsvpStatus,
  fetchEvent,
  sendRsvp,
  voteDate,
  voteLocation,
  GiftProposal,
  fetchGifts,
  proposeGift,
  updateGiftProposal,
  toggleGiftVote,
  toggleGiftSelection,
  deleteGiftProposal,
  fetchShare,
  joinEventByCode,
  deleteEvent,
  fetchPool,
  PoolInfo,
  fetchMessages,
  dateKey,
  countDateVotes,
  countLocationVotes,
  eventDate,
  formatEventDate,
  invitationName,
  EVENT_TYPE_LABELS,
  STATUS_LABELS,
  RSVP_LABELS,
} from "../../lib/events";
import Avatar from "../../components/Avatar";
import GiftGridCard, { giftGridStyles } from "../../components/GiftGridCard";
import BottomSheet from "../../components/BottomSheet";
import ImportGiftSheet, { ImportedGift } from "../../components/ImportGiftSheet";
import DirectTransferViewer from "../../components/DirectTransferViewer";
import EventLocationMap from "../../components/EventLocationMap";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";

/** Bandeau d'annulation : surface inversée, sombre dans les deux thèmes. */
const UNDO_BG = "#111827";
const UNDO_TEXT = "#f9fafb";
const UNDO_ACTION = "#93c5fd";
const UNDO_TRACK = "rgba(255,255,255,0.2)";

const RSVP_OPTIONS: { status: Exclude<RsvpStatus, "pending">; label: string }[] = [
  { status: "accepted", label: "✅ J'y vais" },
  { status: "maybe", label: "🤷 Peut-être" },
  { status: "declined", label: "❌ Non" },
];

export default function EventDetailScreen() {
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rsvpSending, setRsvpSending] = useState(false);
  const [voteSending, setVoteSending] = useState(false);
  const [gifts, setGifts] = useState<GiftProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<GiftProposal | null>(
    null,
  );
  const [eventView, setEventView] = useState<"info" | "gifts">("info");
  const [showGiftForm, setShowGiftForm] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GiftProposal | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteProgress = useRef(new Animated.Value(0)).current;
  const DELETE_DELAY = 5000;
  const [showPool, setShowPool] = useState(true);
  const [showInvite, setShowInvite] = useState(true);
  const [showParticipants, setShowParticipants] = useState(true);
  const [showDateVoteSection, setShowDateVoteSection] = useState(true);
  const [showLocationVoteSection, setShowLocationVoteSection] = useState(true);
  const insets = useSafeAreaInsets();
  const [giftName, setGiftName] = useState("");
  const [giftUrl, setGiftUrl] = useState("");
  const [giftPrice, setGiftPrice] = useState("");
  const [giftImage, setGiftImage] = useState<string | null>(null);
  // Id de la proposition en cours d'édition (null = ajout).
  const [editingGiftId, setEditingGiftId] = useState<string | null>(null);
  const [giftFetching, setGiftFetching] = useState(false);
  const [giftFetchMsg, setGiftFetchMsg] = useState<string | null>(null);
  const [giftSending, setGiftSending] = useState(false);

  const onFetchGiftInfos = async () => {
    const u = giftUrl.trim();
    if (!u || giftFetching) return;
    setGiftFetching(true);
    setGiftFetchMsg(null);
    try {
      const info = await fetchUrlInfo(u.startsWith("http") ? u : `https://${u}`);
      if (info.affiliateUrl) setGiftUrl(info.affiliateUrl);
      if (info.success && info.data) {
        if (info.data.title) setGiftName(info.data.title);
        if (info.data.price != null) setGiftPrice(String(info.data.price));
        setGiftImage(info.data.image);
        setGiftFetchMsg("✅ Infos récupérées — vérifie et ajuste si besoin");
      } else {
        setGiftFetchMsg(
          info.message ?? "Infos non trouvées — remplis manuellement",
        );
      }
    } catch (e: any) {
      setGiftFetchMsg(e?.message ?? "Erreur lors de la récupération.");
    } finally {
      setGiftFetching(false);
    }
  };
  const [share, setShare] = useState<{ url: string; code: string } | null>(null);
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [chatUnread, setChatUnread] = useState(0);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!shortId) return;
    try {
      setError(null);
      const ev = await fetchEvent(shortId);
      setEvent(ev);
      if (ev.hasFullAccess && ev.giftMode === "proposals") {
        setGifts(await fetchGifts(shortId));
      }
      fetchPool(shortId).then(setPool).catch(() => {});
      if (ev.hasFullAccess && user?._id) {
        fetchMessages(shortId)
          .then((msgs) =>
            setChatUnread(
              msgs.filter(
                (m) =>
                  m.sender?._id !== user._id &&
                  !(m.readBy ?? []).some((r) => r.user === user._id),
              ).length,
            ),
          )
          .catch(() => {});
      }
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement.");
    }
  }, [shortId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Recharge quand on revient sur la page (après édition, cagnotte…)
  useFocusEffect(
    useCallback(() => {
      if (!loading) load();
    }, [load, loading]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onRsvp = async (status: Exclude<RsvpStatus, "pending">) => {
    if (!shortId || rsvpSending) return;
    setRsvpSending(true);
    try {
      await sendRsvp(shortId, status);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la réponse.");
    } finally {
      setRsvpSending(false);
    }
  };

  const onVoteDate = async (optionIso: string) => {
    if (!shortId || !event || voteSending) return;
    const mine = myInvitation(event)?.dateVote ?? [];
    const key = dateKey(optionIso);
    const next = mine.some((v) => dateKey(v) === key)
      ? mine.filter((v) => dateKey(v) !== key)
      : [...mine, optionIso];
    setVoteSending(true);
    try {
      await voteDate(shortId, next);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors du vote.");
    } finally {
      setVoteSending(false);
    }
  };

  const onVoteLocation = async (locationId: string) => {
    if (!shortId || voteSending) return;
    setVoteSending(true);
    try {
      await voteLocation(shortId, locationId);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors du vote.");
    } finally {
      setVoteSending(false);
    }
  };

  const onProposeGift = async () => {
    if (!shortId || !giftName.trim() || giftSending) return;
    setGiftSending(true);
    try {
      if (editingGiftId) {
        await updateGiftProposal(shortId, editingGiftId, {
          name: giftName.trim(),
          // Chaînes vides → le backend efface le champ.
          url: giftUrl.trim(),
          price: giftPrice ? Number(giftPrice.replace(",", ".")) : undefined,
          image: giftImage ?? "",
        });
      } else {
        await proposeGift(shortId, {
          name: giftName.trim(),
          url: giftUrl.trim() || undefined,
          price: giftPrice ? Number(giftPrice.replace(",", ".")) : undefined,
          image: giftImage ?? undefined,
        });
      }
      setGiftName("");
      setGiftUrl("");
      setGiftPrice("");
      setGiftImage(null);
      setGiftFetchMsg(null);
      setEditingGiftId(null);
      setShowGiftForm(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la proposition.");
    } finally {
      setGiftSending(false);
    }
  };

  // Pré-remplit le formulaire pour modifier sa propre proposition.
  const startEditGift = (g: GiftProposal) => {
    setEditingGiftId(g._id);
    setGiftName(g.name);
    setGiftUrl(g.url ?? "");
    setGiftPrice(g.price != null ? String(g.price) : "");
    setGiftImage(g.image ?? null);
    setGiftFetchMsg(null);
    setSelectedProposal(null);
    setShowGiftForm(true);
  };

  const importGifts = async (imported: ImportedGift[]) => {
    if (!shortId) return;
    setGiftSending(true);
    try {
      for (const g of imported) {
        await proposeGift(shortId, {
          name: g.giftName,
          url: g.url || undefined,
          price: g.price ?? undefined,
          image: g.image ?? undefined,
        });
      }
      setImportOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'import.");
    } finally {
      setGiftSending(false);
    }
  };

  const onToggleGiftVote = async (giftId: string) => {
    if (!shortId || giftSending) return;
    setGiftSending(true);
    try {
      await toggleGiftVote(shortId, giftId);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors du vote.");
    } finally {
      setGiftSending(false);
    }
  };

  const onToggleGiftSelection = async (giftId: string) => {
    if (!shortId || giftSending) return;
    setGiftSending(true);
    try {
      await toggleGiftSelection(shortId, giftId);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la sélection.");
    } finally {
      setGiftSending(false);
    }
  };

  // Suppression avec délai + annulation (bandeau bas d'écran)
  const finalizeDelete = async (g: GiftProposal) => {
    deleteTimer.current = null;
    setPendingDelete(null);
    if (!shortId) return;
    try {
      await deleteGiftProposal(shortId, g._id);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la suppression.");
    }
  };

  const onDeleteGift = (g: GiftProposal) => {
    // Une suppression déjà en attente ? on la confirme d'abord.
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    if (pendingDelete && pendingDelete._id !== g._id) {
      finalizeDelete(pendingDelete);
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

  useEffect(() => {
    return () => {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
    };
  }, []);

  const onJoin = async () => {
    if (!shortId || !joinCode.trim() || joining) return;
    setJoining(true);
    try {
      await joinEventByCode(shortId, joinCode.trim());
      setJoinCode("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Code invalide.");
    } finally {
      setJoining(false);
    }
  };

  const openMaps = () => {
    if (!event) return;
    const loc =
      event.selectedLocation ??
      (typeof event.fixedLocation === "object" ? event.fixedLocation : null);
    const label =
      typeof event.fixedLocation === "string"
        ? event.fixedLocation
        : (loc?.name ?? loc?.address ?? "");
    const coords = loc?.coordinates;
    const q = encodeURIComponent(label || "Événement");

    if (Platform.OS === "android") {
      // Android affiche nativement le choix entre les apps de cartes
      const url =
        coords?.lat && coords?.lng
          ? `geo:${coords.lat},${coords.lng}?q=${coords.lat},${coords.lng}(${q})`
          : `geo:0,0?q=${q}`;
      Linking.openURL(url).catch(() => {});
      return;
    }

    // iOS : détecter les apps GPS installées, menu seulement si plusieurs
    const hasCoords = !!(coords?.lat && coords?.lng);
    const appleUrl = hasCoords
      ? `http://maps.apple.com/?ll=${coords!.lat},${coords!.lng}&q=${q}`
      : `http://maps.apple.com/?q=${q}`;
    const googleUrl = hasCoords
      ? `comgooglemaps://?q=${coords!.lat},${coords!.lng}`
      : `comgooglemaps://?q=${q}`;
    const wazeUrl = hasCoords
      ? `waze://?ll=${coords!.lat},${coords!.lng}&navigate=yes`
      : `waze://?q=${q}`;

    (async () => {
      const options: { text: string; url: string }[] = [
        { text: "🍎 Plans", url: appleUrl },
      ];
      // canOpenURL exige LSApplicationQueriesSchemes (ok en dev build ;
      // dans Expo Go, dépend de la liste blanche d'Expo)
      try {
        if (await Linking.canOpenURL("comgooglemaps://")) {
          options.push({ text: "🗺️ Google Maps", url: googleUrl });
        }
      } catch {}
      try {
        if (await Linking.canOpenURL("waze://")) {
          options.push({ text: "🚗 Waze", url: wazeUrl });
        }
      } catch {}

      if (options.length === 1) {
        // Une seule app détectée → ouverture directe
        Linking.openURL(options[0].url).catch(() => {});
        return;
      }
      Alert.alert("Itinéraire", label || undefined, [
        ...options.map((o) => ({
          text: o.text,
          onPress: () => Linking.openURL(o.url).catch(() => {}),
        })),
        { text: "Annuler", style: "cancel" as const },
      ]);
    })();
  };

  const onShare = async () => {
    if (!shortId) return;
    try {
      const s = share ?? (await fetchShare(shortId));
      setShare(s);
      await Share.share({
        message: `Rejoins l'événement "${event?.title}" sur BirthReminder : ${s.url} (code : ${s.code})`,
      });
    } catch (e: any) {
      if (e?.message) setError(e.message);
    }
  };

  const onSharePool = async () => {
    if (!shortId) return;
    try {
      const s = share ?? (await fetchShare(shortId));
      setShare(s);
      const poolUrl = s.url.replace("/event/", "/pool/");
      await Share.share({
        message: `Participe à la cagnotte pour « ${event?.title} » sur BirthReminder : ${poolUrl}`,
      });
    } catch (e: any) {
      if (e?.message) setError(e.message);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Supprimer cet événement ?",
      "Invitations, votes, cadeaux et messages seront supprimés définitivement.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEvent(shortId!);
              router.replace("/events");
            } catch (e: any) {
              setError(e?.message ?? "Erreur lors de la suppression.");
            }
          },
        },
      ],
    );
  };

  function myInvitation(ev: typeof event) {
    return ev?.invitations?.find((i) => i.user?._id === user?._id) ?? null;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Événement" }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Événement" }} />
        <Text style={styles.error}>{error ?? "Événement introuvable."}</Text>
      </View>
    );
  }

  const d = eventDate(event);
  const isOrganizer = event.organizer?._id === user?._id;
  const invitations = event.invitations ?? [];
  const acceptedCount = invitations.filter((i) => i.status === "accepted").length;
  const mine = invitations.find((i) => i.user?._id === user?._id) ?? null;
  const showDateVote =
    event.hasFullAccess && event.dateMode === "vote" && !event.selectedDate;
  const showLocationVote =
    event.hasFullAccess &&
    event.locationMode === "vote" &&
    !event.selectedLocation?.name;

  // Cadeau en cours de suppression masqué de la liste (annulable)
  const visibleGifts = pendingDelete
    ? gifts.filter((g) => g._id !== pendingDelete._id)
    : gifts;

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 40 + insets.bottom },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Stack.Screen
        options={{
          title: event.title,
          headerRight: () =>
            event.hasFullAccess ? (
              <Pressable
                onPress={() => {
                  setChatUnread(0);
                  router.push(`/event/chat/${event.shortId}`);
                }}
                hitSlop={10}
                style={{
                  flexDirection: "row",
                  minWidth: 36,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    includeFontPadding: false,
                    textAlignVertical: "center",
                  }}
                >
                  💬
                </Text>
                {chatUnread > 0 && (
                  <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>{chatUnread}</Text>
                  </View>
                )}
              </Pressable>
            ) : null,
        }}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      {/* En-tête */}
      <View style={styles.card}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.type}>
          {EVENT_TYPE_LABELS[event.type]} · {STATUS_LABELS[event.status]}
        </Text>
        {event.description ? (
          <Text style={styles.description}>{event.description}</Text>
        ) : null}
        <Text style={styles.detail}>
          📅 {d ? formatEventDate(d) : "Date au vote"}
        </Text>
        <Text style={styles.detail}>
          👤 Organisé par {event.organizer.name} {event.organizer.surname}
          {isOrganizer ? " (toi)" : ""}
        </Text>
      </View>

      {eventView === "info" && (
        <>
      {/* Lieu + carte */}
      {event.hasFullAccess &&
        event.locationMode === "fixed" &&
        (typeof event.fixedLocation === "object"
          ? event.fixedLocation?.name || event.fixedLocation?.address
          : !!event.fixedLocation) && (
          <EventLocationMap
            name={
              typeof event.fixedLocation === "object"
                ? event.fixedLocation?.name
                : event.fixedLocation
            }
            address={
              typeof event.fixedLocation === "object"
                ? event.fixedLocation?.address
                : undefined
            }
            coordinates={
              typeof event.fixedLocation === "object"
                ? event.fixedLocation?.coordinates
                : null
            }
            onOpenMaps={openMaps}
          />
        )}

      {/* Organisation (organizer) — juste après les infos */}
      {isOrganizer && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>⚙️ Organisation</Text>
          <View style={styles.orgRow}>
            <Pressable
              style={styles.orgBtn}
              onPress={() => router.push(`/event/edit/${event.shortId}`)}
            >
              <Text style={styles.orgBtnText}>✏️ Modifier</Text>
            </Pressable>
            <Pressable
              style={styles.orgBtn}
              onPress={() => router.push(`/event/pool-config/${event.shortId}`)}
            >
              <Text style={styles.orgBtnText}>💳 Cagnotte</Text>
            </Pressable>
            <Pressable
              style={[styles.orgBtn, styles.orgBtnDanger]}
              onPress={confirmDelete}
            >
              <Text style={[styles.orgBtnText, { color: colors.danger }]}>
                🗑️ Supprimer
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* RSVP */}
      {event.hasFullAccess && !isOrganizer && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ta réponse</Text>
          <View style={styles.rsvpRow}>
            {RSVP_OPTIONS.map((opt) => {
              const active = event.myRsvpStatus === opt.status;
              return (
                <Pressable
                  key={opt.status}
                  onPress={() => onRsvp(opt.status)}
                  disabled={rsvpSending}
                  style={[styles.rsvpBtn, active && styles.rsvpBtnActive]}
                >
                  <Text
                    style={[styles.rsvpBtnText, active && styles.rsvpBtnTextActive]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Vote date */}
      {showDateVote && (event.dateOptions?.length ?? 0) > 0 && (
        <View style={styles.card}>
          <SectionHeader
            title={`📅 Vote pour la date${isOrganizer ? " (résultats)" : ""}`}
            open={showDateVoteSection}
            onToggle={() => setShowDateVoteSection((v) => !v)}
          />
          {showDateVoteSection &&
            event.dateOptions!.map((opt) => {
            const votes = countDateVotes(invitations, opt);
            const votedByMe = (mine?.dateVote ?? []).some(
              (v) => dateKey(v) === dateKey(opt),
            );
            return (
              <Pressable
                key={opt}
                disabled={isOrganizer || voteSending}
                onPress={() => onVoteDate(opt)}
                style={[styles.voteOption, votedByMe && styles.voteOptionActive]}
              >
                <Text
                  style={[styles.voteLabel, votedByMe && styles.voteLabelActive]}
                >
                  {formatEventDate(new Date(opt))}
                </Text>
                <Text style={[styles.voteCount, votedByMe && styles.voteLabelActive]}>
                  {votes} vote{votes > 1 ? "s" : ""}
                </Text>
              </Pressable>
            );
          })}
          {showDateVoteSection && !isOrganizer && (
            <Text style={styles.voteHint}>
              Plusieurs choix possibles — appuie pour (dé)cocher.
            </Text>
          )}
        </View>
      )}

      {/* Vote lieu */}
      {showLocationVote && (event.locationOptions?.length ?? 0) > 0 && (
        <View style={styles.card}>
          <SectionHeader
            title={`📍 Vote pour le lieu${isOrganizer ? " (résultats)" : ""}`}
            open={showLocationVoteSection}
            onToggle={() => setShowLocationVoteSection((v) => !v)}
          />
          {showLocationVoteSection &&
            event.locationOptions!.map((opt) => {
            const votes = countLocationVotes(invitations, opt._id);
            const votedByMe = mine?.locationVote === opt._id;
            return (
              <Pressable
                key={opt._id}
                disabled={isOrganizer || voteSending}
                onPress={() => onVoteLocation(opt._id)}
                style={[styles.voteOption, votedByMe && styles.voteOptionActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.voteLabel, votedByMe && styles.voteLabelActive]}
                    numberOfLines={1}
                  >
                    {opt.name ?? opt.address ?? "Lieu"}
                  </Text>
                  {opt.name && opt.address ? (
                    <Text
                      style={[styles.voteSub, votedByMe && styles.voteLabelActive]}
                      numberOfLines={1}
                    >
                      {opt.address}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.voteCount, votedByMe && styles.voteLabelActive]}>
                  {votes} vote{votes > 1 ? "s" : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

        </>
      )}

      {eventView === "gifts" && (
        <>
      <Pressable style={styles.backBtn} onPress={() => setEventView("info")}>
        <Text style={styles.backBtnText}>‹ Retour à l'événement</Text>
      </Pressable>

      {/* Cadeaux imposés */}
      {event.hasFullAccess &&
        event.giftMode === "imposed" &&
        (event.imposedGifts?.length ?? 0) > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🎁 Cadeaux</Text>
            <View style={giftGridStyles.grid}>
              {event.imposedGifts!.map((g, i) => (
                <GiftGridCard
                  key={g._id ?? i}
                  imageUri={(g as { image?: string }).image}
                  title={g.name}
                  price={g.price ?? null}
                  onPress={() => g.url && Linking.openURL(g.url)}
                />
              ))}
            </View>
          </View>
        )}

      {/* Propositions de cadeaux */}
      {event.hasFullAccess && event.giftMode === "proposals" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🎁 Propositions</Text>
          <View style={styles.giftBtnRow}>
            <Pressable
              style={[styles.proposeTopBtn, { flex: 1 }]}
              onPress={() => {
                if (showGiftForm) {
                  setShowGiftForm(false);
                  setEditingGiftId(null);
                } else {
                  setEditingGiftId(null);
                  setGiftName("");
                  setGiftUrl("");
                  setGiftPrice("");
                  setGiftImage(null);
                  setGiftFetchMsg(null);
                  setShowGiftForm(true);
                }
              }}
            >
              <Text style={styles.proposeTopText}>
                {showGiftForm
                  ? "✕ Fermer"
                  : "＋ Proposer un cadeau"}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.importBtn, { flex: 1, marginTop: 0 }]}
              onPress={() => setImportOpen(true)}
            >
              <Text style={styles.importText}>📋 Importer</Text>
            </Pressable>
          </View>

          {showGiftForm && (
            <>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput placeholderTextColor={colors.placeholder}
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Lien du produit (optionnel)"
                  autoCapitalize="none"
                  keyboardType="url"
                  value={giftUrl}
                  onChangeText={setGiftUrl}
                />
                <Pressable
                  style={[
                    styles.giftFetchBtn,
                    (!giftUrl.trim() || giftFetching) && { opacity: 0.5 },
                  ]}
                  disabled={!giftUrl.trim() || giftFetching}
                  onPress={onFetchGiftInfos}
                >
                  <Text style={styles.giftFetchText}>
                    {giftFetching ? "…" : "🔍 Remplir"}
                  </Text>
                </Pressable>
              </View>
              {giftFetchMsg && (
                <Text style={styles.giftFetchMsg}>{giftFetchMsg}</Text>
              )}
              {giftImage && (
                <View style={styles.giftPreview}>
                  <Image source={{ uri: giftImage }} style={styles.giftPreviewImg} />
                  <Pressable hitSlop={8} onPress={() => setGiftImage(null)}>
                    <Text style={{ color: colors.danger, fontWeight: "700" }}>
                      ✕
                    </Text>
                  </Pressable>
                </View>
              )}
              <TextInput placeholderTextColor={colors.placeholder}
                style={styles.input}
                placeholder="Nom du cadeau *"
                value={giftName}
                onChangeText={setGiftName}
              />
              <TextInput placeholderTextColor={colors.placeholder}
                style={styles.input}
                placeholder="Prix en € (optionnel)"
                keyboardType="decimal-pad"
                value={giftPrice}
                onChangeText={setGiftPrice}
              />
              <TextInput placeholderTextColor={colors.placeholder}
                style={styles.input}
                placeholder="URL de l'image (optionnel)"
                autoCapitalize="none"
                keyboardType="url"
                value={giftImage ?? ""}
                onChangeText={(v) => setGiftImage(v.trim() ? v : null)}
              />
              <Pressable
                onPress={onProposeGift}
                disabled={giftSending || !giftName.trim()}
                style={[
                  styles.giftSubmit,
                  (!giftName.trim() || giftSending) && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.giftSubmitText}>
                  {giftSending
                    ? "Envoi…"
                    : editingGiftId
                      ? "Enregistrer"
                      : "Proposer"}
                </Text>
              </Pressable>
            </>
          )}

          {visibleGifts.length === 0 && (
            <Text style={styles.detail}>Aucune proposition pour l'instant.</Text>
          )}
          <View style={giftGridStyles.grid}>
            {visibleGifts.map((g) => {
              const votedByMe = !!user && g.votes.includes(user._id);
              const by = g.proposedBy
                ? `par ${g.proposedBy.name}`
                : g.guestName
                  ? `par ${g.guestName}`
                  : "";
              const lines = [
                by,
                `❤️ ${g.votes.length} vote${g.votes.length > 1 ? "s" : ""}`,
              ].filter(Boolean) as string[];
              return (
                <GiftGridCard
                  key={g._id}
                  imageUri={g.image}
                  title={g.name}
                  lines={lines}
                  price={g.price ?? null}
                  dimmed={false}
                  badge={
                    g.selected
                      ? {
                          label: "⭐ Retenu",
                          color: colors.warningStrong,
                          bg: colors.warningSoft,
                        }
                      : votedByMe
                        ? {
                            label: "❤️ Voté",
                            color: colors.favoriteStrong,
                            bg: colors.favoriteSoft,
                          }
                        : null
                  }
                  onPress={() => setSelectedProposal(g)}
                />
              );
            })}
          </View>

          <BottomSheet
            visible={!!selectedProposal}
            onClose={() => setSelectedProposal(null)}
          >
            {selectedProposal &&
              (() => {
                const g = selectedProposal;
                const votedByMe = !!user && g.votes.includes(user._id);
                const by = g.proposedBy
                  ? `Proposé par ${g.proposedBy.name}`
                  : g.guestName
                    ? `Proposé par ${g.guestName}`
                    : "";
                return (
                  <>
                    {g.image ? (
                      <Image source={{ uri: g.image }} style={styles.sheetImage} />
                    ) : (
                      <View
                        style={[styles.sheetImage, styles.sheetImgPlaceholder]}
                      >
                        <Text style={{ fontSize: 56 }}>🎁</Text>
                      </View>
                    )}
                    <Text style={styles.sheetTitle}>{g.name}</Text>
                    {!!by && <Text style={styles.sheetMeta}>{by}</Text>}
                    <View style={styles.sheetInfoRow}>
                      <Text style={styles.sheetPrice}>
                        {g.price != null ? `${g.price} €` : ""}
                      </Text>
                      {g.url ? (
                        <Text
                          style={styles.giftLink}
                          onPress={() => Linking.openURL(g.url!)}
                        >
                          🔗 Voir le produit
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      disabled={giftSending}
                      style={[
                        styles.sheetVoteBtn,
                        votedByMe && styles.sheetVoteBtnActive,
                      ]}
                      onPress={() => {
                        setSelectedProposal(null);
                        onToggleGiftVote(g._id);
                      }}
                    >
                      <Text
                        style={[
                          styles.sheetVoteText,
                          votedByMe && styles.sheetVoteTextActive,
                        ]}
                      >
                        {votedByMe ? "❤️ Voté" : "🤍 Voter"} · {g.votes.length}
                      </Text>
                    </Pressable>
                    {isOrganizer && (
                      <Pressable
                        disabled={giftSending}
                        style={[
                          styles.sheetSelectBtn,
                          g.selected && styles.sheetSelectBtnActive,
                        ]}
                        onPress={() => {
                          setSelectedProposal(null);
                          onToggleGiftSelection(g._id);
                        }}
                      >
                        <Text
                          style={[
                            styles.sheetSelectText,
                            g.selected && styles.sheetSelectTextActive,
                          ]}
                        >
                          {g.selected
                            ? "⭐ Retiré de la sélection"
                            : "⭐ Retenir ce cadeau"}
                        </Text>
                      </Pressable>
                    )}
                    {g.proposedBy?._id === user?._id && (
                      <Pressable
                        disabled={giftSending}
                        style={styles.sheetSelectBtn}
                        onPress={() => startEditGift(g)}
                      >
                        <Text style={styles.sheetSelectText}>
                          ✏️ Modifier mon cadeau
                        </Text>
                      </Pressable>
                    )}
                    {(isOrganizer ||
                      g.proposedBy?._id === user?._id) && (
                      <Pressable
                        disabled={giftSending}
                        style={styles.sheetDeleteBtn}
                        onPress={() => {
                          setSelectedProposal(null);
                          onDeleteGift(g);
                        }}
                      >
                        <Text style={styles.sheetDeleteText}>
                          🗑️ Supprimer{" "}
                          {isOrganizer && g.proposedBy?._id !== user?._id
                            ? "(organisateur)"
                            : ""}
                        </Text>
                      </Pressable>
                    )}
                  </>
                );
              })()}
          </BottomSheet>
        </View>
      )}
        </>
      )}

      {eventView === "info" && (
        <>
      {/* Cagnotte */}
      {pool?.active && (
        <View style={styles.card}>
          <SectionHeader
            title={
              showPool
                ? "💝 Cagnotte"
                : `💝 Cagnotte · ${((pool.totalCollected ?? 0) / 100)
                    .toFixed(2)
                    .replace(".", ",")} €${
                    pool.mode === "goal" && pool.goal
                      ? ` / ${(pool.goal / 100).toFixed(0)} €`
                      : ""
                  }`
            }
            open={showPool}
            onToggle={() => setShowPool((v) => !v)}
          />
          {showPool && (
            <>
              <Text style={styles.poolTotal}>
                {((pool.totalCollected ?? 0) / 100)
                  .toFixed(2)
                  .replace(".", ",")}{" "}
                €
                {pool.mode === "goal" && pool.goal
                  ? ` / ${(pool.goal / 100).toFixed(0)} €`
                  : ""}
                <Text style={styles.detail}>
                  {"  ·  "}
                  {pool.contributionsCount ?? 0} participation
                  {(pool.contributionsCount ?? 0) > 1 ? "s" : ""}
                </Text>
              </Text>
              {pool.mode === "goal" && pool.goal ? (
                <View style={styles.poolBarBg}>
                  <View
                    style={[
                      styles.poolBarFill,
                      {
                        width: `${Math.min(100, Math.round(((pool.totalCollected ?? 0) / pool.goal) * 100))}%`,
                      },
                    ]}
                  />
                </View>
              ) : null}
              {(pool.contributions ?? []).length > 0 && (
                <View style={styles.contribList}>
                  <Text style={styles.contribHeader}>
                    Participants ({pool.contributions!.length})
                  </Text>
                  {pool.contributions!.map((c) => (
                    <View key={c.id} style={styles.contribRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.contribName} numberOfLines={1}>
                          {c.contributor
                            ? `${c.contributor.name}${
                                c.contributor.surname
                                  ? " " + c.contributor.surname
                                  : ""
                              }`
                            : "🕶️ Anonyme"}
                        </Text>
                        {!!c.message && (
                          <Text style={styles.contribMsg} numberOfLines={2}>
                            « {c.message} »
                          </Text>
                        )}
                      </View>
                      <Text style={styles.contribAmount}>
                        {(c.amount / 100).toFixed(2).replace(".", ",")} €
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {!isOrganizer && (
                <Pressable
                  style={styles.poolBtn}
                  onPress={() => router.push(`/event/pool/${event.shortId}`)}
                >
                  <Text style={styles.poolBtnText}>💝 Contribuer</Text>
                </Pressable>
              )}

              <Pressable style={styles.poolShareBtn} onPress={onSharePool}>
                <Text style={styles.poolShareText}>
                  📤 Partager la cagnotte
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* Virement direct — section autonome (visible même sans cagnotte) */}
      {event.hasFullAccess &&
        (event.directTransfer?.ibanEnabled ||
          event.directTransfer?.paypalEnabled) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>💳 Virement direct</Text>
            <DirectTransferViewer
              shortId={event.shortId}
              directTransfer={event.directTransfer}
            />
          </View>
        )}

      {/* Partage */}
      {event.hasFullAccess && (isOrganizer || event.allowGuestInvites) && (
        <View style={styles.card}>
          <SectionHeader
            title="🔗 Inviter du monde"
            open={showInvite}
            onToggle={() => setShowInvite((v) => !v)}
          />
          {showInvite && (
            <>
              {(isOrganizer || event.allowGuestInvites) && (
                <Pressable
                  style={styles.shareBtn}
                  onPress={() => router.push(`/event/invite/${event.shortId}`)}
                >
                  <Text style={styles.shareBtnText}>👥 Inviter mes amis</Text>
                </Pressable>
              )}
              <Pressable style={styles.shareBtn} onPress={onShare}>
                <Text style={styles.shareBtnText}>Partager le lien + code</Text>
              </Pressable>
              {share && (
                <Text style={styles.detail}>
                  Code d'accès :{" "}
                  <Text style={styles.shareCode}>{share.code}</Text>
                </Text>
              )}
            </>
          )}
        </View>
      )}

      {/* Participants */}
      {event.hasFullAccess && (
        <View style={styles.card}>
          <SectionHeader
            title={`Participants (${acceptedCount} / ${invitations.length})`}
            open={showParticipants}
            onToggle={() => setShowParticipants((v) => !v)}
          />
          {showParticipants && (
            <>
              {invitations.length === 0 && (
                <Text style={styles.detail}>
                  Personne d'invité pour l'instant.
                </Text>
              )}
              {invitations.map((inv) => (
                <View key={inv._id} style={styles.participantRow}>
                  <Avatar
                    uri={inv.user?.avatar}
                    name={inv.user?.name || invitationName(inv)}
                    surname={inv.user?.surname}
                    size={36}
                  />
                  <Text style={styles.pName} numberOfLines={1}>
                    {invitationName(inv)}
                  </Text>
                  <Text style={styles.pStatus}>{RSVP_LABELS[inv.status]}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {event.hasFullAccess && event.giftMode !== "none" && (
        <Pressable
          style={styles.giftsBtn}
          onPress={() => setEventView("gifts")}
        >
          <Text style={styles.giftsBtnText} numberOfLines={1}>
            🎁 Voir les cadeaux
          </Text>
        </Pressable>
      )}
        </>
      )}

      {!event.hasFullAccess && (
        <View style={styles.card}>
          <Text style={styles.detail}>
            Tu n'es pas invité·e à cet événement — vue publique limitée.
          </Text>
          <Text style={styles.sectionTitle}>Rejoindre avec un code</Text>
          <TextInput placeholderTextColor={colors.placeholder}
            style={styles.input}
            placeholder="Code d'accès (6 à 8 caractères)"
            autoCapitalize="characters"
            maxLength={8}
            value={joinCode}
            onChangeText={setJoinCode}
          />
          <Pressable
            onPress={onJoin}
            disabled={joining || joinCode.trim().length < 6}
            style={[
              styles.giftSubmit,
              (joining || joinCode.trim().length < 6) && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.giftSubmitText}>
              {joining ? "Vérification…" : "Rejoindre"}
            </Text>
          </Pressable>
        </View>
      )}

      <ImportGiftSheet
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={importGifts}
        busy={giftSending}
      />
    </ScrollView>

      {pendingDelete && (
        <View style={styles.undoBar}>
          <View style={styles.undoRow}>
            <Text style={styles.undoText} numberOfLines={1}>
              « {pendingDelete.name} » supprimé
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

function SectionHeader({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable style={styles.collapseHeader} onPress={onToggle} hitSlop={6}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.collapseChevron}>{open ? "▾" : "▸"}</Text>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  collapseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  collapseChevron: { fontSize: 16, color: c.faint, fontWeight: "700" },
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 12, gap: 10, paddingBottom: 32 },
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
    gap: 6,
    shadowColor: c.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: { fontSize: 20, fontWeight: "700", color: c.text },
  type: { fontSize: 13, color: c.sub },
  description: { color: c.text, lineHeight: 20, marginTop: 2 },
  detail: { color: c.sub, fontSize: 14 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: c.text },
  rsvpRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  rsvpBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: c.cardSoft,
  },
  rsvpBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
  rsvpBtnText: { fontSize: 13, fontWeight: "600", color: c.text },
  rsvpBtnTextActive: { color: c.white },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  pAvatar: { width: 32, height: 32, borderRadius: 16 },
  pAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  pInitial: { color: c.primaryStrong, fontWeight: "700" },
  pName: { flex: 1, color: c.text, fontWeight: "500" },
  pStatus: { fontSize: 12, color: c.sub },
  voteOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: c.cardSoft,
  },
  voteOptionActive: { backgroundColor: c.primary, borderColor: c.primary },
  voteLabel: { color: c.text, fontWeight: "600", flexShrink: 1 },
  voteLabelActive: { color: c.white },
  voteSub: { color: c.sub, fontSize: 12 },
  voteCount: { color: c.sub, fontSize: 12, fontWeight: "700" },
  voteHint: { color: c.faint, fontSize: 12, marginTop: 2 },
  giftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  giftName: { color: c.text, fontWeight: "600" },
  giftMeta: { color: c.sub, fontSize: 12 },
  giftLink: { color: c.primary, fontSize: 12 },
  giftPrice: { color: c.text, fontWeight: "700" },
  giftVote: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: c.cardSoft,
  },
  giftVoteActive: { backgroundColor: c.dangerSoft, borderColor: c.danger },
  giftVoteText: { fontSize: 12, fontWeight: "700", color: c.text },
  giftVoteTextActive: { color: c.danger },

  // Bottom sheet proposition
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
  sheetMeta: { color: c.sub, fontSize: 13, marginTop: 4 },
  sheetInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  sheetPrice: { fontSize: 20, fontWeight: "800", color: c.text },
  sheetVoteBtn: {
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
    backgroundColor: c.cardSoft,
  },
  sheetVoteBtnActive: {
    backgroundColor: c.favoriteSoft,
    borderColor: c.favorite,
  },
  sheetVoteText: { fontSize: 15, fontWeight: "700", color: c.text },
  sheetVoteTextActive: { color: c.favoriteStrong },
  sheetSelectBtn: {
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    backgroundColor: c.cardSoft,
  },
  sheetSelectBtnActive: {
    backgroundColor: c.warningSoft,
    borderColor: c.warning,
  },
  sheetSelectText: { fontSize: 15, fontWeight: "700", color: c.text },
  sheetSelectTextActive: { color: c.warningStrong },
  sheetDeleteBtn: {
    borderWidth: 1,
    borderColor: c.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  sheetDeleteText: { fontSize: 15, fontWeight: "700", color: c.danger },
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

  // En-tête section propositions + bouton "Proposer" en haut
  giftsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  proposeTopBtn: {
    backgroundColor: c.primary,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  proposeTopText: { color: c.white, fontWeight: "700", fontSize: 13 },
  importBtn: {
    borderWidth: 1,
    borderColor: c.primary,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
    marginTop: 8,
  },
  importText: { color: c.primary, fontWeight: "600", fontSize: 13 },
  giftBtnRow: { flexDirection: "row", gap: 8, marginTop: 8 },

  // Vues accueil/cadeaux
  backBtn: { paddingVertical: 6, paddingHorizontal: 2 },
  backBtnText: { color: c.primary, fontWeight: "700", fontSize: 15 },
  giftsBtn: {
    backgroundColor: c.card,
    borderWidth: 1.5,
    borderColor: c.primary,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  giftsBtnText: { color: c.primary, fontWeight: "700", fontSize: 15 },
  giftFormTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: c.sub,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: c.inputBorder,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    backgroundColor: c.inputBg,
    color: c.text,
  },
  giftSubmit: {
    backgroundColor: c.primary,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 4,
  },
  giftSubmitText: { color: c.white, fontWeight: "600" },
  shareBtn: {
    borderWidth: 1,
    borderColor: c.primary,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  shareBtnText: { color: c.primary, fontWeight: "600" },
  shareCode: { fontWeight: "700", color: c.text, letterSpacing: 1 },
  orgRow: { flexDirection: "row", gap: 8 },
  orgBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: c.cardSoft,
  },
  orgBtnDanger: { borderColor: c.danger },
  orgBtnText: { fontSize: 12, fontWeight: "600", color: c.text },
  poolTotal: { fontSize: 18, fontWeight: "700", color: c.text },
  poolBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: c.border,
    overflow: "hidden",
  },
  poolBarFill: { height: 8, backgroundColor: c.success },
  poolBtn: {
    backgroundColor: c.success,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 4,
  },
  poolBtnText: { color: c.white, fontWeight: "700" },
  poolShareBtn: {
    borderWidth: 1,
    borderColor: c.primary,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },
  poolShareText: { color: c.primary, fontWeight: "700", fontSize: 13 },
  contribList: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    paddingTop: 8,
  },
  contribHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: c.sub,
    marginBottom: 4,
  },
  contribRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  contribName: { fontSize: 14, fontWeight: "600", color: c.text },
  contribMsg: { fontSize: 12, color: c.sub, marginTop: 1 },
  contribAmount: { fontSize: 15, fontWeight: "800", color: c.success },
  chatBadge: {
    backgroundColor: c.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    marginLeft: -6,
    marginTop: -8,
  },
  chatBadgeText: { color: c.white, fontSize: 10, fontWeight: "700" },
  mapLink: { color: c.primary },
  mapHint: { fontSize: 12, color: c.faint },
  giftFetchBtn: {
    borderWidth: 1,
    borderColor: c.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  giftFetchText: { color: c.primary, fontWeight: "600", fontSize: 12 },
  giftFetchMsg: { color: c.sub, fontSize: 12, textAlign: "center" },
  giftPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "center",
  },
  giftPreviewImg: { width: 56, height: 56, borderRadius: 8 },
  giftThumb: { width: 44, height: 44, borderRadius: 8 },
  });
