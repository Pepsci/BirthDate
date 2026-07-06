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
} from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { Image } from "react-native";
import {
  WishlistItem,
  fetchMyWishlist,
  addWishlistItem,
  deleteWishlistItem,
  fetchUrlInfo,
} from "../../lib/wishlist";

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
      setItems(await fetchMyWishlist());
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
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
            <View style={styles.itemRow}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.itemImage} />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.muted}>
                  {item.price != null ? `${item.price} €` : "Prix libre"}
                  {reserved ? " · 🎁 réservé par quelqu'un" : ""}
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
              <Pressable hitSlop={8} onPress={() => confirmDelete(item)}>
                <Text style={styles.deleteX}>✕</Text>
              </Pressable>
            </View>
          );
        }}
      />

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
});
