import { useCallback, useEffect, useState } from "react";
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
} from "react-native";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
} from "expo-router";
import { Platform } from "react-native";
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
  toggleGiftVote,
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

const RSVP_OPTIONS: { status: Exclude<RsvpStatus, "pending">; label: string }[] = [
  { status: "accepted", label: "✅ J'y vais" },
  { status: "maybe", label: "🤷 Peut-être" },
  { status: "declined", label: "❌ Non" },
];

export default function EventDetailScreen() {
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rsvpSending, setRsvpSending] = useState(false);
  const [voteSending, setVoteSending] = useState(false);
  const [gifts, setGifts] = useState<GiftProposal[]>([]);
  const [giftName, setGiftName] = useState("");
  const [giftUrl, setGiftUrl] = useState("");
  const [giftPrice, setGiftPrice] = useState("");
  const [giftImage, setGiftImage] = useState<string | null>(null);
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
      await proposeGift(shortId, {
        name: giftName.trim(),
        url: giftUrl.trim() || undefined,
        price: giftPrice ? Number(giftPrice.replace(",", ".")) : undefined,
        image: giftImage ?? undefined,
      });
      setGiftName("");
      setGiftUrl("");
      setGiftPrice("");
      setGiftImage(null);
      setGiftFetchMsg(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la proposition.");
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
        <ActivityIndicator size="large" color="#3b82f6" />
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
  const location =
    typeof event.fixedLocation === "string"
      ? event.fixedLocation
      : event.fixedLocation?.name ?? event.fixedLocation?.address;
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
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
                style={{ flexDirection: "row" }}
              >
                <Text style={{ fontSize: 20 }}>💬</Text>
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
        {location ? (
          <Pressable onPress={openMaps} hitSlop={6}>
            <Text style={[styles.detail, styles.mapLink]}>
              📍 {location}  <Text style={styles.mapHint}>· Itinéraire ›</Text>
            </Text>
          </Pressable>
        ) : event.locationMode === "vote" ? (
          <Text style={styles.detail}>📍 Lieu au vote</Text>
        ) : null}
        <Text style={styles.detail}>
          👤 Organisé par {event.organizer.name} {event.organizer.surname}
          {isOrganizer ? " (toi)" : ""}
        </Text>
      </View>

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
          <Text style={styles.sectionTitle}>
            📅 Vote pour la date{isOrganizer ? " (résultats)" : ""}
          </Text>
          {event.dateOptions!.map((opt) => {
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
          {!isOrganizer && (
            <Text style={styles.voteHint}>
              Plusieurs choix possibles — appuie pour (dé)cocher.
            </Text>
          )}
        </View>
      )}

      {/* Vote lieu */}
      {showLocationVote && (event.locationOptions?.length ?? 0) > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            📍 Vote pour le lieu{isOrganizer ? " (résultats)" : ""}
          </Text>
          {event.locationOptions!.map((opt) => {
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

      {/* Cadeaux imposés */}
      {event.hasFullAccess &&
        event.giftMode === "imposed" &&
        (event.imposedGifts?.length ?? 0) > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🎁 Cadeaux</Text>
            {event.imposedGifts!.map((g, i) => (
              <View key={g._id ?? i} style={styles.giftRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.giftName}>{g.name}</Text>
                  {g.url ? (
                    <Text
                      style={styles.giftLink}
                      numberOfLines={1}
                      onPress={() => Linking.openURL(g.url!)}
                    >
                      {g.url}
                    </Text>
                  ) : null}
                </View>
                {g.price != null && (
                  <Text style={styles.giftPrice}>{g.price} €</Text>
                )}
              </View>
            ))}
          </View>
        )}

      {/* Propositions de cadeaux */}
      {event.hasFullAccess && event.giftMode === "proposals" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🎁 Propositions de cadeaux</Text>
          {gifts.length === 0 && (
            <Text style={styles.detail}>Aucune proposition pour l'instant.</Text>
          )}
          {gifts.map((g) => {
            const votedByMe = !!user && g.votes.includes(user._id);
            return (
              <View key={g._id} style={styles.giftRow}>
                {g.image ? (
                  <Image source={{ uri: g.image }} style={styles.giftThumb} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.giftName}>{g.name}</Text>
                  <Text style={styles.giftMeta} numberOfLines={1}>
                    {g.proposedBy
                      ? `par ${g.proposedBy.name}`
                      : g.guestName
                        ? `par ${g.guestName}`
                        : ""}
                    {g.price != null ? ` · ${g.price} €` : ""}
                  </Text>
                  {g.url ? (
                    <Text
                      style={styles.giftLink}
                      numberOfLines={1}
                      onPress={() => Linking.openURL(g.url!)}
                    >
                      {g.url}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => onToggleGiftVote(g._id)}
                  disabled={giftSending}
                  style={[styles.giftVote, votedByMe && styles.giftVoteActive]}
                >
                  <Text
                    style={[
                      styles.giftVoteText,
                      votedByMe && styles.giftVoteTextActive,
                    ]}
                  >
                    ❤️ {g.votes.length}
                  </Text>
                </Pressable>
              </View>
            );
          })}

          <Text style={styles.giftFormTitle}>Proposer un cadeau</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput placeholderTextColor="#9ca3af"
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
                <Text style={{ color: "#ef4444", fontWeight: "700" }}>✕</Text>
              </Pressable>
            </View>
          )}
          <TextInput placeholderTextColor="#9ca3af"
            style={styles.input}
            placeholder="Nom du cadeau *"
            value={giftName}
            onChangeText={setGiftName}
          />
          <TextInput placeholderTextColor="#9ca3af"
            style={styles.input}
            placeholder="Prix en € (optionnel)"
            keyboardType="decimal-pad"
            value={giftPrice}
            onChangeText={setGiftPrice}
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
              {giftSending ? "Envoi…" : "Proposer"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Organisation (organizer) */}
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
              <Text style={[styles.orgBtnText, { color: "#ef4444" }]}>
                🗑️ Supprimer
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Cagnotte */}
      {pool?.active && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>💝 Cagnotte</Text>
          <Text style={styles.poolTotal}>
            {((pool.totalCollected ?? 0) / 100).toFixed(2).replace(".", ",")} €
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
          {(pool.contributions ?? []).slice(0, 3).map((c) => (
            <Text key={c.id} style={styles.detail}>
              🎁 {c.contributor ? c.contributor.name : "Anonyme"} —{" "}
              {(c.amount / 100).toFixed(2).replace(".", ",")} €
              {c.message ? ` · « ${c.message} »` : ""}
            </Text>
          ))}
          {!isOrganizer && (
            <Pressable
              style={styles.poolBtn}
              onPress={() => router.push(`/event/pool/${event.shortId}`)}
            >
              <Text style={styles.poolBtnText}>💝 Contribuer</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Partage */}
      {event.hasFullAccess && (isOrganizer || event.allowGuestInvites) && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🔗 Inviter du monde</Text>
          {isOrganizer && (
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
              Code d'accès : <Text style={styles.shareCode}>{share.code}</Text>
            </Text>
          )}
        </View>
      )}

      {/* Participants */}
      {event.hasFullAccess && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Participants ({acceptedCount} confirmé{acceptedCount > 1 ? "s" : ""}
            {" / "}
            {invitations.length} invité{invitations.length > 1 ? "s" : ""})
          </Text>
          {invitations.length === 0 && (
            <Text style={styles.detail}>Personne d'invité pour l'instant.</Text>
          )}
          {invitations.map((inv) => (
            <View key={inv._id} style={styles.participantRow}>
              {inv.user?.avatar ? (
                <Image source={{ uri: inv.user.avatar }} style={styles.pAvatar} />
              ) : (
                <View style={styles.pAvatarFallback}>
                  <Text style={styles.pInitial}>
                    {invitationName(inv)[0]?.toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.pName} numberOfLines={1}>
                {invitationName(inv)}
              </Text>
              <Text style={styles.pStatus}>{RSVP_LABELS[inv.status]}</Text>
            </View>
          ))}
        </View>
      )}

      {!event.hasFullAccess && (
        <View style={styles.card}>
          <Text style={styles.detail}>
            Tu n'es pas invité·e à cet événement — vue publique limitée.
          </Text>
          <Text style={styles.sectionTitle}>Rejoindre avec un code</Text>
          <TextInput placeholderTextColor="#9ca3af"
            style={styles.input}
            placeholder="Code à 6 caractères"
            autoCapitalize="characters"
            maxLength={6}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 12, gap: 10, paddingBottom: 32 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  error: { color: "#b91c1c", textAlign: "center", padding: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" },
  type: { fontSize: 13, color: "#6b7280" },
  description: { color: "#374151", lineHeight: 20, marginTop: 2 },
  detail: { color: "#6b7280", fontSize: 14 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  rsvpRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  rsvpBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  rsvpBtnActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  rsvpBtnText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  rsvpBtnTextActive: { color: "#fff" },
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
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
  },
  pInitial: { color: "#2563eb", fontWeight: "700" },
  pName: { flex: 1, color: "#111827", fontWeight: "500" },
  pStatus: { fontSize: 12, color: "#6b7280" },
  voteOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f9fafb",
  },
  voteOptionActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  voteLabel: { color: "#374151", fontWeight: "600", flexShrink: 1 },
  voteLabelActive: { color: "#fff" },
  voteSub: { color: "#6b7280", fontSize: 12 },
  voteCount: { color: "#6b7280", fontSize: 12, fontWeight: "700" },
  voteHint: { color: "#9ca3af", fontSize: 12, marginTop: 2 },
  giftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  giftName: { color: "#111827", fontWeight: "600" },
  giftMeta: { color: "#6b7280", fontSize: 12 },
  giftLink: { color: "#3b82f6", fontSize: 12 },
  giftPrice: { color: "#111827", fontWeight: "700" },
  giftVote: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#f9fafb",
  },
  giftVoteActive: { backgroundColor: "#fee2e2", borderColor: "#ef4444" },
  giftVoteText: { fontSize: 12, fontWeight: "700", color: "#374151" },
  giftVoteTextActive: { color: "#ef4444" },
  giftFormTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6b7280",
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    backgroundColor: "#fff",
    color: "#111827",
  },
  giftSubmit: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 4,
  },
  giftSubmitText: { color: "#fff", fontWeight: "600" },
  shareBtn: {
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  shareBtnText: { color: "#3b82f6", fontWeight: "600" },
  shareCode: { fontWeight: "700", color: "#111827", letterSpacing: 1 },
  orgRow: { flexDirection: "row", gap: 8 },
  orgBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  orgBtnDanger: { borderColor: "#fecaca" },
  orgBtnText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  poolTotal: { fontSize: 18, fontWeight: "700", color: "#111827" },
  poolBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  poolBarFill: { height: 8, backgroundColor: "#10b981" },
  poolBtn: {
    backgroundColor: "#10b981",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 4,
  },
  poolBtnText: { color: "#fff", fontWeight: "700" },
  chatBadge: {
    backgroundColor: "#ef4444",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    marginLeft: -6,
    marginTop: -8,
  },
  chatBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  mapLink: { color: "#3b82f6" },
  mapHint: { fontSize: 12, color: "#9ca3af" },
  giftFetchBtn: {
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 10,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  giftFetchText: { color: "#3b82f6", fontWeight: "600", fontSize: 12 },
  giftFetchMsg: { color: "#6b7280", fontSize: 12, textAlign: "center" },
  giftPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "center",
  },
  giftPreviewImg: { width: 56, height: 56, borderRadius: 8 },
  giftThumb: { width: 44, height: 44, borderRadius: 8 },
});
