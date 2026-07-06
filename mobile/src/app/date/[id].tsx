import { useCallback, useState } from "react";
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
} from "react-native";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
} from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { Switch } from "react-native";
import {
  DateEntry,
  Gift,
  fetchDate,
  addGift,
  updateGift,
  deleteGift,
  setDateNotifications,
  setBirthdayPrefs,
  setNamedayPrefs,
  daysUntil,
  upcomingAge,
  formatBirthday,
  formatNameday,
  countdownLabel,
} from "../../lib/dates";
import {
  WishlistItem,
  fetchUserWishlist,
  reserveItem,
  unreserveItem,
} from "../../lib/wishlist";
import GiftIdeaForm from "../../components/GiftIdeaForm";
import { checkExistingEvent } from "../../lib/events";
import { useUnread } from "../../lib/unread-context";

export default function DateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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

  if (!entry) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Anniversaire" }} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color="#3b82f6" />
        )}
      </View>
    );
  }

  const days = daysUntil(entry.date);
  const gifts = (entry as DateEntry & { gifts?: Gift[] }).gifts ?? [];
  const nameday = entry.nameday ?? entry.linkedUser?.nameday;

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
          title: `${entry.name} ${entry.surname ?? ""}`.trim(),
          headerRight: () =>
            entry.linkedUser ? (
              <Pressable
                onPress={() =>
                  router.push(
                    `/chat/${entry.linkedUser!._id}?name=${encodeURIComponent(entry.name)}`,
                  )
                }
                hitSlop={10}
                style={{ flexDirection: "row" }}
              >
                <Text style={{ fontSize: 18 }}>💬</Text>
                {(byFriend[entry.linkedUser!._id] ?? 0) > 0 && (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>
                      {byFriend[entry.linkedUser!._id]}
                    </Text>
                  </View>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push(`/date/edit/${entry._id}`)}
                hitSlop={10}
              >
                <Text style={{ fontSize: 18 }}>✏️</Text>
              </Pressable>
            ),
        }}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      {/* Infos */}
      <View style={[styles.card, styles.infoCard]}>
        {entry.linkedUser?.avatar ? (
          <Image
            source={{ uri: entry.linkedUser.avatar }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.initials}>
              {entry.name?.[0]?.toUpperCase()}
              {entry.surname?.[0]?.toUpperCase() ?? ""}
            </Text>
          </View>
        )}
        <View style={styles.badgeRow}>
          {entry.linkedUser && <Badge label="AMI" color="#3b82f6" />}
          {entry.family && <Badge label="FAMILLE" color="#f59e0b" />}
        </View>
        <Text style={styles.detail}>
          🎂 {formatBirthday(entry.date)} · {upcomingAge(entry.date)} ans
        </Text>
        {nameday && (
          <Text style={styles.detail}>🎉 Fête : {formatNameday(nameday)}</Text>
        )}
        <View style={[styles.countdown, days === 0 && styles.countdownToday]}>
          <Text
            style={[styles.countdownText, days === 0 && { color: "#fff" }]}
          >
            {countdownLabel(days)}
          </Text>
        </View>
      </View>

      {/* Notifications pour cette date */}
      <View style={styles.card}>
        <View style={styles.notifHeader}>
          <Text style={styles.sectionTitle}>🔔 Rappels</Text>
          <Switch
            value={entry.receiveNotifications !== false}
            disabled={busy}
            onValueChange={(v) => run(() => setDateNotifications(entry._id, v))}
            trackColor={{ true: "#3b82f6" }}
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
                    { v: 1, l: "Veille" },
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

      {/* Événement pour cette personne */}
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

      {/* Mes Cadeaux (mes idées pour cette personne) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🎁 Mes idées cadeaux</Text>
        {gifts.length === 0 && (
          <Text style={styles.muted}>Aucune idée pour l'instant.</Text>
        )}
        {gifts.map((g) => (
          <View key={g._id} style={styles.giftRow}>
            {g.image ? (
              <Image source={{ uri: g.image }} style={styles.wishImage} />
            ) : null}
            <Pressable
              style={[styles.checkbox, g.purchased && styles.checkboxOn]}
              disabled={busy}
              onPress={() =>
                run(() =>
                  updateGift(entry._id, { ...g, purchased: !g.purchased }),
                )
              }
            >
              {g.purchased && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.giftName, g.purchased && styles.giftDone]}
                numberOfLines={1}
              >
                {g.giftName}
              </Text>
              <Text style={styles.muted}>
                {g.occasion} {g.year}
                {g.price != null ? ` · ${g.price} €` : ""}
              </Text>
              {g.url ? (
                <Text
                  style={styles.link}
                  numberOfLines={1}
                  onPress={() => Linking.openURL(g.url!)}
                >
                  Voir l'article
                </Text>
              ) : null}
            </View>
            <Pressable
              hitSlop={8}
              disabled={busy}
              onPress={() =>
                setEditingGift(editingGift?._id === g._id ? null : g)
              }
            >
              <Text style={{ fontSize: 14 }}>✏️</Text>
            </Pressable>
            <Pressable
              hitSlop={8}
              disabled={busy}
              onPress={() => run(() => deleteGift(entry._id, g._id))}
            >
              <Text style={styles.deleteX}>✕</Text>
            </Pressable>
          </View>
        ))}

        {editingGift && (
          <GiftIdeaForm
            key={editingGift._id}
            title={`Modifier « ${editingGift.giftName} »`}
            submitLabel="Enregistrer"
            busy={busy}
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
        {showGiftForm ? (
          <GiftIdeaForm
            busy={busy}
            onSubmit={async (gift) => {
              await run(() => addGift(entry._id, gift));
              setShowGiftForm(false);
            }}
          />
        ) : (
          <Pressable
            style={styles.newIdeaBtn}
            onPress={() => setShowGiftForm(true)}
          >
            <Text style={styles.newIdeaText}>＋ Nouvelle idée</Text>
          </Pressable>
        )}
      </View>

      {/* Sa Wishlist (amis inscrits) */}
      {entry.linkedUser && (
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
          {wishlist?.map((item) => {
            const reservedByMe = item.reservedBy?._id === user?._id;
            const reserved = !!item.reservedBy || !!item.reservedByGuest;
            return (
              <View key={item._id} style={styles.giftRow}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.wishImage} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.giftName} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.muted}>
                    {item.price != null ? `${item.price} € · ` : ""}
                    {reserved
                      ? reservedByMe
                        ? "Réservé par toi"
                        : `Réservé par ${item.reservedBy?.name ?? "un invité"}`
                      : "Disponible"}
                  </Text>
                  {item.url ? (
                    <Text
                      style={styles.link}
                      numberOfLines={1}
                      onPress={() => Linking.openURL(item.url!)}
                    >
                      Voir l'article
                    </Text>
                  ) : null}
                </View>
                {!reserved && (
                  <Pressable
                    style={styles.reserveBtn}
                    disabled={busy}
                    onPress={() => run(() => reserveItem(item._id))}
                  >
                    <Text style={styles.reserveText}>Réserver</Text>
                  </Pressable>
                )}
                {reservedByMe && (
                  <Pressable
                    style={[styles.reserveBtn, styles.unreserveBtn]}
                    disabled={busy}
                    onPress={() => run(() => unreserveItem(item._id))}
                  >
                    <Text style={styles.unreserveText}>Annuler</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
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

const chipStyles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "#f9fafb",
  },
  chipActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  text: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  textActive: { color: "#fff" },
});

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 12, gap: 10, paddingBottom: 40 },
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
    gap: 8,
    shadowColor: "#000",
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
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
  },
  initials: { fontSize: 24, fontWeight: "700", color: "#2563eb" },
  badgeRow: { flexDirection: "row", gap: 6 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  detail: { color: "#374151", fontSize: 14 },
  countdown: {
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 4,
  },
  countdownToday: { backgroundColor: "#3b82f6" },
  countdownText: { color: "#2563eb", fontWeight: "700" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  muted: { color: "#6b7280", fontSize: 12 },
  giftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxOn: { backgroundColor: "#10b981", borderColor: "#10b981" },
  checkmark: { color: "#fff", fontWeight: "700", fontSize: 14 },
  giftName: { color: "#111827", fontWeight: "600" },
  giftDone: { textDecorationLine: "line-through", color: "#9ca3af" },
  deleteX: { color: "#ef4444", fontSize: 16, fontWeight: "700" },
  newIdeaBtn: {
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 6,
  },
  newIdeaText: { color: "#3b82f6", fontWeight: "600" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    backgroundColor: "#fff",
    color: "#111827",
  },
  addBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    width: 42,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontSize: 20, fontWeight: "600" },
  link: { color: "#3b82f6", fontSize: 12 },
  wishImage: { width: 44, height: 44, borderRadius: 8 },
  eventBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  eventBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  notifHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notifLabel: { fontSize: 13, fontWeight: "700", color: "#6b7280", marginTop: 4 },
  notifChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  headerBadge: {
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
  headerBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  reserveBtn: {
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  reserveText: { color: "#3b82f6", fontWeight: "600", fontSize: 12 },
  unreserveBtn: { borderColor: "#ef4444" },
  unreserveText: { color: "#ef4444", fontWeight: "600", fontSize: 12 },
});
