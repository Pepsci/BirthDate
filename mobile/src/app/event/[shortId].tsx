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
  acceptLeadTransfer,
  cancelEvent,
  cancelLeadTransfer,
  deleteEvent,
  leaveEvent,
  offerLeadTransfer,
  uncancelEvent,
  fetchPool,
  PoolInfo,
  fetchMessages,
  dateKey,
  countDateVotes,
  countLocationVotes,
  eventDate,
  eventLocationLabel,
  formatEventDate,
  invitationName,
  EVENT_TYPE_LABELS,
  STATUS_LABELS,
  RSVP_LABELS,
} from "../../lib/events";
import {
  addToDeviceCalendar,
  getLinkedEventId,
  isCalendarAvailable,
  removeFromDeviceCalendar,
} from "../../lib/calendar";
import Avatar from "../../components/Avatar";
import GiftGridCard, { giftGridStyles } from "../../components/GiftGridCard";
import BottomSheet from "../../components/BottomSheet";
import HeaderIconButton from "../../components/HeaderIconButton";
import { useScrollBoundsGuard } from "../../lib/use-scroll-bounds-guard";
import ImportGiftSheet, { ImportedGift } from "../../components/ImportGiftSheet";
import DirectTransferViewer from "../../components/DirectTransferViewer";
import EventLocationMap from "../../components/EventLocationMap";
import { usePersistedCollapse } from "../../lib/collapse-prefs";
import * as Clipboard from "expo-clipboard";
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
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  // null = pas encore vérifié, false = absent de l'agenda, true = présent.
  const [inCalendar, setInCalendar] = useState<boolean | null>(null);
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
  // Repli/déploiement des encarts, mémorisé par événement (SecureStore) pour
  // rester dans l'état choisi par l'utilisateur après un aller-retour sur
  // l'écran — même mécanisme que `stats-scope.ts`.
  const collapseScope = `event_${shortId}`;
  const [showPool, setShowPool] = usePersistedCollapse(collapseScope, "pool");
  const [showInvite, setShowInvite] = usePersistedCollapse(
    collapseScope,
    "invite",
  );
  const [showParticipants, setShowParticipants] = usePersistedCollapse(
    collapseScope,
    "participants",
  );
  const [showDateVoteSection, setShowDateVoteSection] = usePersistedCollapse(
    collapseScope,
    "dateVote",
  );
  const [showLocationVoteSection, setShowLocationVoteSection] =
    usePersistedCollapse(collapseScope, "locationVote");
  const insets = useSafeAreaInsets();
  // Voir use-scroll-bounds-guard : les encarts repliables font rétrécir le
  // contenu, ce qui laissait la vue calée au-delà de sa propre hauteur.
  const scrollGuard = useScrollBoundsGuard();
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

  // Présence dans l'agenda, revérifiée à chaque affichage de l'écran : si
  // l'entrée a été supprimée à la main dans le calendrier, le bouton doit
  // repasser à « Ajouter » plutôt que de mentir.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!shortId) return;
      getLinkedEventId(shortId).then((id) => {
        if (alive) setInCalendar(!!id);
      });
      return () => {
        alive = false;
      };
    }, [shortId]),
  );

  // Export vers le calendrier natif. Aucune synchronisation ensuite : si
  // l'organisateur change la date, l'entrée déjà créée reste telle quelle —
  // l'utilisateur reçoit la notif "nouvelle date" et peut la retirer/rajouter.
  const onAddToCalendar = async () => {
    if (!event || addingToCalendar) return;
    const start = eventDate(event);
    if (!start) return;
    setAddingToCalendar(true);
    try {
      const ok = await addToDeviceCalendar({
        eventKey: event.shortId,
        title: event.title,
        startDate: start,
        location: eventLocationLabel(event),
        notes: event.description
          ? `${event.description}\n\nbirthreminder.com/event/${event.shortId}`
          : `Événement BirthReminder — birthreminder.com/event/${event.shortId}`,
      });
      if (ok) setInCalendar(true);
    } finally {
      setAddingToCalendar(false);
    }
  };

  const onRemoveFromCalendar = () => {
    if (!event || addingToCalendar) return;
    Alert.alert(
      "Retirer du calendrier ?",
      `« ${event.title} » sera supprimé de ton calendrier. L'événement reste dans BirthReminder.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: async () => {
            setAddingToCalendar(true);
            try {
              const ok = await removeFromDeviceCalendar(event.shortId);
              if (ok) setInCalendar(false);
            } finally {
              setAddingToCalendar(false);
            }
          },
        },
      ],
    );
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

  // Retour visuel de la copie : sans lui, appuyer sur « Copier le code » ne
  // produit rien de perceptible et on appuie trois fois.
  const [codeCopied, setCodeCopied] = useState(false);

  const onCopyCode = async () => {
    if (!shortId) return;
    try {
      const sh = share ?? (await fetchShare(shortId));
      setShare(sh);
      await Clipboard.setStringAsync(sh.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (e: any) {
      if (e?.message) setError(e.message);
    }
  };

  // Feuille de saisie du motif. On ne passe pas par Alert.prompt : il n'existe
  // que sur iOS, et un motif d'annulation mérite mieux qu'un champ d'une ligne
  // absent sur Android.
  const [cancelSheet, setCancelSheet] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const doCancel = async () => {
    if (!shortId || cancelling) return;
    setCancelling(true);
    try {
      const res = await cancelEvent(shortId, cancelReason.trim());
      setCancelSheet(false);
      setCancelReason("");
      await load();
      Alert.alert(
        "Événement annulé",
        res.poolFrozen
          ? "Tes invités ont été prévenus. La cagnotte est fermée : plus aucune contribution ne peut arriver. Les sommes déjà versées ne sont pas remboursées automatiquement."
          : "Tes invités ont été prévenus par notification et par email.",
      );
    } catch (e: any) {
      setError(e?.message ?? "Impossible d'annuler l'événement.");
    } finally {
      setCancelling(false);
    }
  };

  const confirmUncancel = () => {
    Alert.alert(
      "Rétablir cet événement ?",
      "Tous les invités seront prévenus qu'il aura finalement lieu. La cagnotte, elle, reste fermée : tu peux la rouvrir depuis l'écran cagnotte.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Rétablir",
          onPress: async () => {
            try {
              await uncancelEvent(shortId!);
              await load();
            } catch (e: any) {
              setError(e?.message ?? "Impossible de rétablir l'événement.");
            }
          },
        },
      ],
    );
  };

  // ── Transfert d'organisation ──────────────────────────────────────────────
  const [transferSheet, setTransferSheet] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const pendingTransferTo = event?.pendingTransfer?.toUser ?? null;
  const iAmTransferTarget =
    !!pendingTransferTo && pendingTransferTo._id === user?._id;

  const onOfferTransfer = async (targetId: string, targetName: string) => {
    if (!shortId || transferBusy) return;
    setTransferBusy(true);
    try {
      const res = await offerLeadTransfer(shortId, targetId);
      setTransferSheet(false);
      await load();
      Alert.alert(
        "Proposition envoyée",
        res.pool.count > 0
          ? `${targetName} doit accepter. Attention : la cagnotte ne suivra pas — les ${(res.pool.total / 100).toFixed(2)} € déjà versés resteront sur ton compte Stripe, et c'est à toi de les rembourser ou de les reverser.`
          : `${targetName} doit accepter pour que le transfert prenne effet. D'ici là, tu restes l'organisateur.`,
      );
    } catch (e: any) {
      setError(e?.message ?? "Impossible de proposer le transfert.");
    } finally {
      setTransferBusy(false);
    }
  };

  const onWithdrawTransfer = async () => {
    if (!shortId || transferBusy) return;
    setTransferBusy(true);
    try {
      await cancelLeadTransfer(shortId);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur.");
    } finally {
      setTransferBusy(false);
    }
  };

  const onAcceptTransfer = () => {
    Alert.alert(
      "Reprendre l'organisation ?",
      "Tu deviendras responsable des invitations, des votes et de l'organisation. La cagnotte de l'organisateur actuel sera fermée : les sommes déjà versées restent sur son compte, tu peux ouvrir la tienne ensuite.",
      [
        { text: "Plus tard", style: "cancel" },
        {
          text: "Accepter",
          onPress: async () => {
            if (!shortId) return;
            setTransferBusy(true);
            try {
              await acceptLeadTransfer(shortId);
              await load();
            } catch (e: any) {
              setError(e?.message ?? "Impossible d'accepter le transfert.");
            } finally {
              setTransferBusy(false);
            }
          },
        },
      ],
    );
  };

  const confirmLeave = () => {
    Alert.alert(
      "Quitter cet événement ?",
      "Tu ne verras plus ses informations ni son chat. L'organisateur pourra t'inviter à nouveau.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Quitter",
          style: "destructive",
          onPress: async () => {
            try {
              await leaveEvent(shortId!);
              router.replace("/events");
            } catch (e: any) {
              setError(e?.message ?? "Impossible de quitter l'événement.");
            }
          },
        },
      ],
    );
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
  // Depuis le correctif serveur, l'organisateur a sa propre EventInvitation
  // (statut "accepted") et apparaît donc naturellement dans la liste. Les
  // événements créés AVANT ce correctif n'en ont pas : on synthétise sa ligne
  // pour qu'ils s'affichent comme les nouveaux, sans migration de la base.
  const rawInvitations = event.invitations ?? [];
  const organizerListed =
    !event.organizer?._id ||
    rawInvitations.some((i) => i.user?._id === event.organizer!._id);
  const invitations: typeof rawInvitations = organizerListed
    ? rawInvitations
    : [
        {
          _id: `organizer-${event.organizer!._id}`,
          user: {
            _id: event.organizer!._id,
            name: event.organizer!.name,
            surname: event.organizer!.surname ?? "",
            avatar: event.organizer!.avatar,
          },
          status: "accepted",
        },
        ...rawInvitations,
      ];
  const acceptedCount = invitations.filter((i) => i.status === "accepted").length;
  const mine = invitations.find((i) => i.user?._id === user?._id) ?? null;
  // ⚠️ Un événement annulé n'accepte plus aucune participation. Le serveur le
  // refuse désormais (409 EVENT_CANCELLED), mais il faut aussi retirer les
  // boutons : sinon l'invité vote dans le vide, et surtout chaque tentative
  // notifiait l'organisateur — qui recevait « X a voté pour le 12 mars » sur
  // un événement qu'il venait d'annuler.
  const isCancelled = event.status === "cancelled";
  const showDateVote =
    event.hasFullAccess &&
    !isCancelled &&
    event.dateMode === "vote" &&
    !event.selectedDate;
  const showLocationVote =
    event.hasFullAccess &&
    !isCancelled &&
    event.locationMode === "vote" &&
    !event.selectedLocation?.name;

  // Cadeau en cours de suppression masqué de la liste (annulable)
  const visibleGifts = pendingDelete
    ? gifts.filter((g) => g._id !== pendingDelete._id)
    : gifts;

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      {...scrollGuard}
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
      {/* Taille fixe + badge en absolu (cf. HeaderIconButton) : le bouton
          apparaissait sinon étiré sur toute la largeur de la barre tant que sa
          mesure n'était pas arrivée. */}
      <Stack.Screen
        options={{
          title: event.title,
          headerRight: () =>
            event.hasFullAccess ? (
              <HeaderIconButton
                name="chat"
                accessibilityLabel="Ouvrir le chat de l'événement"
                badge={chatUnread}
                onPress={() => {
                  setChatUnread(0);
                  router.push(`/event/chat/${event.shortId}`);
                }}
              />
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
        {/* Export vers le calendrier natif — masqué tant que la date est au
            vote (rien de ferme à inscrire) et si le module natif manque dans
            ce binaire. Le bouton bascule en « déjà ajouté » pour ne plus
            créer de doublon à chaque appui. */}
        {d && isCalendarAvailable() && (
          <Pressable
            style={[styles.calendarBtn, inCalendar && styles.calendarBtnDone]}
            disabled={addingToCalendar || inCalendar === null}
            onPress={inCalendar ? onRemoveFromCalendar : onAddToCalendar}
          >
            {addingToCalendar ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.calendarBtnText,
                  inCalendar && styles.calendarBtnTextDone,
                ]}
              >
                {inCalendar
                  ? "✓ Dans ton calendrier — appuie pour retirer"
                  : "🗓️ Ajouter à mon calendrier"}
              </Text>
            )}
          </Pressable>
        )}
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

      {/* Bandeau d'annulation — avant tout le reste : c'est l'information qui
          conditionne la lecture de toute la page. */}
      {event.status === "cancelled" && (
        <View style={styles.cancelledCard}>
          <Text style={styles.cancelledTitle}>❌ Événement annulé</Text>
          <Text style={styles.cancelledText}>
            {event.cancellationReason
              ? event.cancellationReason
              : "L'organisateur n'a pas indiqué de raison."}
          </Text>
          <Text style={styles.cancelledHint}>
            La page reste consultable, mais l'événement n'aura pas lieu. Si tu
            l'avais ajouté à ton agenda, pense à l'y supprimer.
          </Text>
        </View>
      )}

      {/* Proposition de transfert reçue — au-dessus de tout : c'est une
          décision à prendre, pas une information à faire défiler. */}
      {iAmTransferTarget && (
        <View style={styles.transferCard}>
          <Text style={styles.transferTitle}>🤝 On te propose d'organiser</Text>
          <Text style={styles.cancelledText}>
            {event.pendingTransfer?.requestedBy?.name ?? "L'organisateur"} te
            propose de reprendre l'organisation de « {event.title} ».
          </Text>
          <Text style={styles.cancelledHint}>
            Tu deviendrais responsable des invitations, des votes et de
            l'organisation. Une éventuelle cagnotte ne suit pas : les sommes
            déjà versées restent sur le compte de l'organisateur actuel.
          </Text>
          <View style={styles.orgRow}>
            <Pressable
              style={styles.orgBtn}
              disabled={transferBusy}
              onPress={onAcceptTransfer}
            >
              <Text style={styles.orgBtnText}>✅ Accepter</Text>
            </Pressable>
            <Pressable
              style={[styles.orgBtn, styles.orgBtnDanger]}
              disabled={transferBusy}
              onPress={onWithdrawTransfer}
            >
              <Text style={[styles.orgBtnText, { color: colors.danger }]}>
                Refuser
              </Text>
            </Pressable>
          </View>
        </View>
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
            {pendingTransferTo ? (
              <Pressable
                style={styles.orgBtn}
                disabled={transferBusy}
                onPress={onWithdrawTransfer}
              >
                <Text style={styles.orgBtnText}>
                  ⏳ En attente de {pendingTransferTo.name} — retirer
                </Text>
              </Pressable>
            ) : (
              event.status !== "cancelled" && (
                <Pressable
                  style={styles.orgBtn}
                  onPress={() => setTransferSheet(true)}
                >
                  <Text style={styles.orgBtnText}>🤝 Transférer</Text>
                </Pressable>
              )
            )}
            {/* Annuler avant supprimer : le serveur refuse désormais de
                supprimer un événement publié sans passer par l'annulation, pour
                que les invités soient prévenus au lieu de le voir disparaître.
                L'ordre des boutons reflète ce chemin. */}
            {event.status === "cancelled" ? (
              <Pressable style={styles.orgBtn} onPress={confirmUncancel}>
                <Text style={styles.orgBtnText}>↩️ Rétablir</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.orgBtn, styles.orgBtnDanger]}
                onPress={() => setCancelSheet(true)}
              >
                <Text style={[styles.orgBtnText, { color: colors.danger }]}>
                  ❌ Annuler
                </Text>
              </Pressable>
            )}
            {(event.status === "cancelled" || event.status === "draft") && (
              <Pressable
                style={[styles.orgBtn, styles.orgBtnDanger]}
                onPress={confirmDelete}
              >
                <Text style={[styles.orgBtnText, { color: colors.danger }]}>
                  🗑️ Supprimer
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* RSVP */}
      {event.hasFullAccess && !isOrganizer && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ta réponse</Text>
          {isCancelled && (
            <Text style={styles.cancelledHint}>
              L'événement est annulé : les réponses sont closes.
            </Text>
          )}
          {/* Grisé plutôt que retiré : l'invité doit pouvoir relire ce qu'il
              avait répondu, même si l'événement n'a plus lieu. */}
          <View
            style={[styles.rsvpRow, isCancelled && { opacity: 0.4 }]}
            pointerEvents={isCancelled ? "none" : "auto"}
          >
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

          {/* Quitter : discret et en bas de la carte réponse, pas dans une
              carte à lui. Répondre « non » et quitter sont deux choses
              différentes — décliner laisse l'organisateur informé, quitter
              retire l'invitation — et les placer côte à côte rend la nuance
              lisible au moment où elle se pose. */}
          <Pressable style={styles.leaveBtn} onPress={confirmLeave}>
            <Text style={styles.leaveBtnText}>🚪 Quitter l'événement</Text>
          </Pressable>
        </View>
      )}

      {/* Vote date */}
      {showDateVote && (event.dateOptions?.length ?? 0) > 0 && (
        <View style={styles.card}>
          <SectionHeader
            title={`📅 Vote pour la date${isOrganizer ? " (résultats)" : ""}`}
            open={showDateVoteSection}
            onToggle={() => setShowDateVoteSection(!showDateVoteSection)}
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
            onToggle={() => setShowLocationVoteSection(!showLocationVoteSection)}
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
      {event.hasFullAccess && !isCancelled && event.giftMode === "proposals" && (
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
            onToggle={() => setShowPool(!showPool)}
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
            onToggle={() => setShowInvite(!showInvite)}
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
              {/* Copier le code seul : partager le lien complet ouvre la feuille
                  de partage du système, alors qu'on veut souvent juste coller
                  le code dans une conversation déjà ouverte ailleurs. */}
              <Pressable style={styles.shareBtn} onPress={onCopyCode}>
                <Text style={styles.shareBtnText}>
                  {codeCopied ? "✓ Code copié" : "📋 Copier le code d'accès"}
                </Text>
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
            onToggle={() => setShowParticipants(!showParticipants)}
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

      {/* Choix du repreneur. Seuls les participants AYANT CONFIRMÉ apparaissent :
          le serveur refuse les autres, et proposer l'organisation à quelqu'un
          qui a décliné — ou qui n'a pas de compte — n'a pas de sens. */}
      <BottomSheet
        visible={transferSheet}
        onClose={() => setTransferSheet(false)}
      >
        <Text style={styles.sheetTitle}>Transférer l'organisation</Text>
        <Text style={styles.cancelledHint}>
          La personne choisie devra accepter. Tant qu'elle n'a pas répondu, tu
          restes l'organisateur.
          {pool?.active || (pool?.totalCollected ?? 0) > 0
            ? " La cagnotte ne suivra pas : les sommes déjà versées restent sur ton compte Stripe, à toi de les rembourser ou de les reverser."
            : ""}
        </Text>
        {(() => {
          const eligible = (invitations ?? []).filter(
            (inv) => inv.user && inv.status === "accepted" && inv.user._id !== user?._id,
          );
          if (eligible.length === 0) {
            return (
              <Text style={styles.cancelledHint}>
                Personne n'a encore confirmé sa présence : il n'y a personne à
                qui transférer pour l'instant.
              </Text>
            );
          }
          return eligible.map((inv) => (
            <Pressable
              key={inv._id}
              style={styles.transferRow}
              disabled={transferBusy}
              onPress={() =>
                onOfferTransfer(inv.user!._id, inv.user!.name)
              }
            >
              <Text style={styles.transferName}>
                {inv.user!.name} {inv.user!.surname}
              </Text>
              <Text style={styles.orgBtnText}>Proposer →</Text>
            </Pressable>
          ));
        })()}
      </BottomSheet>

      {/* Motif d'annulation. Le champ est facultatif : forcer une justification
          pousse à écrire n'importe quoi, et un motif inventé vaut moins qu'une
          absence de motif assumée — le message dit alors simplement que
          l'organisateur n'en a pas donné. */}
      <BottomSheet visible={cancelSheet} onClose={() => setCancelSheet(false)}>
        <Text style={styles.sheetTitle}>Annuler l'événement</Text>
        <Text style={styles.cancelledHint}>
          Tous les invités seront prévenus par notification et par email.
          L'événement restera consultable, barré, avec ton motif. Tu pourras le
          rétablir ou le supprimer ensuite.
          {pool?.active
            ? " La cagnotte sera fermée : plus aucune contribution ne pourra arriver. Les sommes déjà versées ne sont pas remboursées automatiquement."
            : ""}
        </Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
          placeholder="Motif (facultatif) — ex : salle indisponible"
          placeholderTextColor={colors.placeholder}
          multiline
          maxLength={500}
          value={cancelReason}
          onChangeText={setCancelReason}
        />
        <Pressable
          onPress={doCancel}
          disabled={cancelling}
          style={[styles.sheetDeleteBtn, cancelling && { opacity: 0.5 }]}
        >
          <Text style={styles.sheetDeleteText}>
            {cancelling ? "Annulation…" : "❌ Confirmer l'annulation"}
          </Text>
        </Pressable>
      </BottomSheet>
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
  // Action secondaire : bordurée plutôt que pleine, pour ne pas concurrencer
  // le RSVP qui reste l'action principale de cette carte.
  calendarBtn: {
    borderWidth: 1,
    borderColor: c.primary,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
    marginTop: 10,
  },
  calendarBtnText: { color: c.primary, fontWeight: "700", fontSize: 14 },
  // État « déjà ajouté » : vert et discret, c'est une confirmation, pas un
  // appel à l'action.
  calendarBtnDone: { borderColor: c.success },
  calendarBtnTextDone: { color: c.successStrong, fontSize: 13 },
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
  leaveBtn: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    alignItems: "center",
  },
  leaveBtnText: { color: c.danger, fontSize: 13, fontWeight: "600" },
  transferCard: {
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  transferTitle: { color: c.primary, fontWeight: "800", fontSize: 16 },
  transferRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  transferName: { color: c.text, fontSize: 15, fontWeight: "600" },
  cancelledCard: {
    backgroundColor: c.dangerSoft ?? "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: c.danger,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  cancelledTitle: { color: c.danger, fontWeight: "800", fontSize: 16 },
  cancelledText: { color: c.text, fontSize: 14, lineHeight: 19 },
  cancelledHint: { color: c.sub, fontSize: 12, lineHeight: 17 },
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
