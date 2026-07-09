import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Switch,
  Share,
} from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { Image } from "react-native";
import {
  WishlistItem,
  WishlistSettings,
  fetchMyWishlist,
  addWishlistItem,
  deleteWishlistItem,
  unreserveItem,
  fetchUrlInfo,
  fetchWishlistSettings,
  toggleWishlistPublic,
  setWishlistFriendCode,
} from "../../lib/wishlist";
import GiftGridCard, { giftGridStyles } from "../../components/GiftGridCard";
import BottomSheet from "../../components/BottomSheet";

export default function MyWishlistScreen() {
  const [items, setItems] = useState<WishlistItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<WishlistItem | null>(null);
  const [settings, setSettings] = useState<WishlistSettings | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const fetchInfos = async () => {
    const u = url.trim();
    if (!u || fetching) return;
    setFetching(true);
    setFetchMsg(null);
    setError(null);
    try {
      const info = await fetchUrlInfo(u.startsWith("http") ? u : `https://${u}`);
      // Toujours récupérer le lien affilié si fourni (Amazon)
      if (info.affiliateUrl) setUrl(info.affiliateUrl);
      if (info.success && info.data) {
        if (info.data.title) setTitle(info.data.title);
        if (info.data.price != null) setPrice(String(info.data.price));
        setImage(info.data.image);
        setDescription(info.data.description);
        setFetchMsg("✅ Infos récupérées — vérifie et ajuste si besoin");
      } else {
        setFetchMsg(info.message ?? "Infos non trouvées — remplis manuellement");
      }
    } catch (e: any) {
      setFetchMsg(e?.message ?? "Erreur lors de la récupération.");
    } finally {
      setFetching(false);
    }
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      const [list, s] = await Promise.all([
        fetchMyWishlist(),
        fetchWishlistSettings().catch(() => null),
      ]);
      setItems(list);
      if (s) setSettings(s);
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement.");
    }
  }, []);

  const onTogglePublic = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    try {
      setSettings(await toggleWishlistPublic());
    } catch (e: any) {
      setError(e?.message ?? "Erreur.");
    } finally {
      setShareBusy(false);
    }
  };

  const onFriendCode = async (action: "generate" | "remove") => {
    if (shareBusy) return;
    setShareBusy(true);
    try {
      const { friendCode } = await setWishlistFriendCode(action);
      setSettings((prev) => (prev ? { ...prev, friendCode } : prev));
    } catch (e: any) {
      setError(e?.message ?? "Erreur.");
    } finally {
      setShareBusy(false);
    }
  };

  const shareLink = () => {
    if (settings?.publicUrl) Share.share({ message: settings.publicUrl });
  };

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

  const add = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addWishlistItem({
        title: title.trim(),
        price: price ? Number(price.replace(",", ".")) : undefined,
        url: url.trim() || undefined,
        image: image ?? undefined,
        description: description ?? undefined,
      });
      setTitle("");
      setPrice("");
      setUrl("");
      setImage(null);
      setDescription(null);
      setFetchMsg(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'ajout.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (item: WishlistItem) => {
    Alert.alert("Supprimer ?", `« ${item.title} » sera retiré de ta wishlist.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteWishlistItem(item._id);
            await load();
          } catch (e: any) {
            setError(e?.message ?? "Erreur lors de la suppression.");
          }
        },
      },
    ]);
  };

  if (items === null) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Ma wishlist" }} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color="#3b82f6" />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Ma wishlist" }} />
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={giftGridStyles.grid}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View style={styles.shareCard}>
            <Pressable
              style={styles.shareHeader}
              onPress={() => setShowShare((v) => !v)}
            >
              <Text style={styles.shareTitle}>
                🔗 Partage public{settings?.isPublic ? "  · Actif" : ""}
              </Text>
              <Text style={styles.shareChevron}>{showShare ? "▾" : "▸"}</Text>
            </Pressable>

            {showShare && settings && (
              <>
                <View style={styles.shareRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.shareRowTitle}>
                      Rendre ma wishlist publique
                    </Text>
                    <Text style={styles.shareRowSub}>
                      Accessible via un lien, sans compte. Aucun nom affiché.
                    </Text>
                  </View>
                  <Switch
                    value={settings.isPublic}
                    onValueChange={onTogglePublic}
                    disabled={shareBusy}
                    trackColor={{ true: "#3b82f6" }}
                  />
                </View>

                {settings.isPublic && !!settings.publicUrl && (
                  <Pressable style={styles.shareBtn} onPress={shareLink}>
                    <Text style={styles.shareBtnText}>📤 Partager le lien</Text>
                  </Pressable>
                )}

                {settings.isPublic && (
                  <View style={styles.shareRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.shareRowTitle}>
                        Code de réservation
                      </Text>
                      <Text style={styles.shareRowSub}>
                        Permet à tes amis de réserver un cadeau
                      </Text>
                    </View>
                    {settings.friendCode ? (
                      <View style={styles.codeRow}>
                        <Text style={styles.friendCode}>
                          {settings.friendCode}
                        </Text>
                        <Pressable
                          hitSlop={8}
                          disabled={shareBusy}
                          onPress={() => onFriendCode("generate")}
                        >
                          <Text style={styles.codeAction}>↻</Text>
                        </Pressable>
                        <Pressable
                          hitSlop={8}
                          disabled={shareBusy}
                          onPress={() => onFriendCode("remove")}
                        >
                          <Text style={styles.codeRemove}>✕</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        style={styles.codeGenBtn}
                        disabled={shareBusy}
                        onPress={() => onFriendCode("generate")}
                      >
                        <Text style={styles.codeGenText}>Générer</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Ta wishlist est vide. Ajoute des idées — tes amis pourront les
            réserver !
          </Text>
        }
        renderItem={({ item }) => {
          const reserved = !!item.reservedBy || !!item.reservedByGuest;
          return (
            <GiftGridCard
              imageUri={item.image}
              title={item.title}
              price={item.price ?? null}
              badge={
                reserved
                  ? { label: "🎁 Réservé", color: "#047857", bg: "#d1fae5" }
                  : { label: "Disponible", color: "#6b7280", bg: "#f3f4f6" }
              }
              onPress={() => setSelected(item)}
            />
          );
        }}
      />

      <BottomSheet visible={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <>
            {selected.image ? (
              <Image source={{ uri: selected.image }} style={styles.sheetImage} />
            ) : (
              <View style={[styles.sheetImage, styles.sheetImagePlaceholder]}>
                <Text style={{ fontSize: 56 }}>🎁</Text>
              </View>
            )}
            <Text style={styles.sheetTitle}>{selected.title}</Text>
            <View style={styles.sheetInfoRow}>
              <Text style={styles.sheetPrice}>
                {selected.price != null ? `${selected.price} €` : "Prix libre"}
              </Text>
              {selected.url ? (
                <Text
                  style={styles.link}
                  onPress={() => Linking.openURL(selected.url!)}
                >
                  🔗 Voir le produit
                </Text>
              ) : null}
            </View>
            {(!!selected.reservedBy || !!selected.reservedByGuest) && (
              <>
                <Text style={styles.sheetReserved}>
                  🎁 Quelqu'un a réservé ce cadeau pour toi
                </Text>
                <Pressable
                  style={styles.sheetUnreserveBtn}
                  disabled={busy}
                  onPress={async () => {
                    const item = selected;
                    setSelected(null);
                    try {
                      await unreserveItem(item._id);
                      await load();
                    } catch (e: any) {
                      setError(e?.message ?? "Erreur.");
                    }
                  }}
                >
                  <Text style={styles.sheetUnreserveText}>
                    ↩️ Annuler la réservation
                  </Text>
                </Pressable>
              </>
            )}
            <Pressable
              style={styles.sheetDeleteBtn}
              onPress={() => {
                const item = selected;
                setSelected(null);
                confirmDelete(item);
              }}
            >
              <Text style={styles.sheetDeleteText}>🗑️ Supprimer</Text>
            </Pressable>
          </>
        )}
      </BottomSheet>

      <View style={styles.form}>
        <View style={styles.formRow}>
          <TextInput placeholderTextColor="#9ca3af"
            style={[styles.input, { flex: 1 }]}
            placeholder="Colle un lien produit…"
            autoCapitalize="none"
            keyboardType="url"
            value={url}
            onChangeText={setUrl}
          />
          <Pressable
            style={[styles.fetchBtn, (!url.trim() || fetching) && { opacity: 0.5 }]}
            disabled={!url.trim() || fetching}
            onPress={fetchInfos}
          >
            <Text style={styles.fetchBtnText}>
              {fetching ? "…" : "🔍 Remplir"}
            </Text>
          </Pressable>
        </View>
        {fetchMsg && <Text style={styles.fetchMsg}>{fetchMsg}</Text>}
        {image && (
          <View style={styles.preview}>
            <Image source={{ uri: image }} style={styles.previewImage} />
            <Pressable hitSlop={8} onPress={() => setImage(null)}>
              <Text style={styles.deleteX}>✕</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.formRow}>
          <TextInput placeholderTextColor="#9ca3af"
            style={[styles.input, { flex: 2 }]}
            placeholder="Nom du souhait *"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput placeholderTextColor="#9ca3af"
            style={[styles.input, { flex: 1 }]}
            placeholder="Prix €"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
          />
        </View>
        <Pressable
          style={[styles.addBtn, (!title.trim() || busy) && { opacity: 0.5 }]}
          disabled={!title.trim() || busy}
          onPress={add}
        >
          <Text style={styles.addBtnText}>{busy ? "Ajout…" : "Ajouter"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  error: { color: "#b91c1c", textAlign: "center", padding: 6 },
  list: { padding: 12, gap: 8 },
  empty: {
    textAlign: "center",
    color: "#6b7280",
    marginTop: 40,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
  },
  itemTitle: { fontWeight: "600", color: "#111827" },
  muted: { color: "#6b7280", fontSize: 12 },
  link: { color: "#3b82f6", fontSize: 12 },
  deleteX: { color: "#ef4444", fontSize: 16, fontWeight: "700" },
  form: {
    padding: 10,
    gap: 8,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
  },
  formRow: { flexDirection: "row", gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    backgroundColor: "#f9fafb",
    color: "#111827",
  },
  addBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "600" },
  fetchBtn: {
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  fetchBtnText: { color: "#3b82f6", fontWeight: "600", fontSize: 13 },
  fetchMsg: { color: "#6b7280", fontSize: 12, textAlign: "center" },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "center",
  },
  previewImage: { width: 64, height: 64, borderRadius: 8 },
  itemImage: { width: 48, height: 48, borderRadius: 8 },

  // Partage public
  shareCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eef2f7",
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  shareHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  shareTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  shareChevron: { fontSize: 16, color: "#9ca3af", fontWeight: "700" },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eef2f7",
  },
  shareRowTitle: { fontSize: 13, fontWeight: "700", color: "#111827" },
  shareRowSub: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  shareBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  friendCode: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2563eb",
    letterSpacing: 1,
  },
  codeAction: { fontSize: 16, color: "#3b82f6", fontWeight: "700" },
  codeRemove: { fontSize: 15, color: "#ef4444", fontWeight: "700" },
  codeGenBtn: {
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  codeGenText: { color: "#3b82f6", fontWeight: "600", fontSize: 13 },

  // Bottom sheet détail
  sheetImage: { width: "100%", height: 180, borderRadius: 14 },
  sheetImagePlaceholder: {
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginTop: 14,
  },
  sheetDesc: { color: "#6b7280", fontSize: 13, marginTop: 6, lineHeight: 19 },
  sheetInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  sheetPrice: { fontSize: 20, fontWeight: "800", color: "#111827" },
  sheetReserved: { color: "#047857", fontSize: 13, marginTop: 10 },
  sheetUnreserveBtn: {
    borderWidth: 1.5,
    borderColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  sheetUnreserveText: { color: "#3b82f6", fontWeight: "700", fontSize: 15 },
  sheetDeleteBtn: {
    borderWidth: 1.5,
    borderColor: "#ef4444",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  sheetDeleteText: { color: "#ef4444", fontWeight: "700", fontSize: 15 },
});
