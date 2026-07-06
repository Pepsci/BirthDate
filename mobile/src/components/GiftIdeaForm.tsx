import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
} from "react-native";
import { fetchUrlInfo } from "../lib/wishlist";

export interface GiftIdeaPayload {
  giftName: string;
  occasion: string;
  year: number;
  url?: string;
  price?: number;
  image?: string;
}

const OCCASIONS = ["🎂 Anniversaire", "🎄 Noël", "💝 Saint-Valentin", "🎁 Autre"];

/**
 * Formulaire complet d'idée cadeau — miroir de "Nouvelle idée" du web :
 * lien produit + récupération auto des infos, ou saisie 100 % manuelle.
 */
export default function GiftIdeaForm({
  onSubmit,
  busy,
  initial,
  submitLabel = "Ajouter",
  title = "Nouvelle idée",
}: {
  onSubmit: (gift: GiftIdeaPayload) => Promise<void>;
  busy: boolean;
  initial?: Partial<GiftIdeaPayload>;
  submitLabel?: string;
  title?: string;
}) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [name, setName] = useState(initial?.giftName ?? "");
  const [occasion, setOccasion] = useState(initial?.occasion ?? "Anniversaire");
  const [year, setYear] = useState(
    String(initial?.year ?? new Date().getFullYear()),
  );
  const [price, setPrice] = useState(
    initial?.price != null ? String(initial.price) : "",
  );
  const [image, setImage] = useState(initial?.image ?? "");
  const [fetching, setFetching] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchInfos = async () => {
    const u = url.trim();
    if (!u || fetching) return;
    setFetching(true);
    setMsg(null);
    try {
      const info = await fetchUrlInfo(u.startsWith("http") ? u : `https://${u}`);
      if (info.affiliateUrl) setUrl(info.affiliateUrl);
      if (info.success && info.data) {
        if (info.data.title) setName(info.data.title);
        if (info.data.price != null) setPrice(String(info.data.price));
        if (info.data.image) setImage(info.data.image);
        setMsg("✅ Infos récupérées — vérifie et ajuste si besoin");
      } else {
        setMsg(info.message ?? "Infos non trouvées — remplis manuellement");
      }
    } catch (e: any) {
      setMsg(e?.message ?? "Erreur lors de la récupération.");
    } finally {
      setFetching(false);
    }
  };

  const submit = async () => {
    if (!name.trim() || busy) return;
    await onSubmit({
      giftName: name.trim(),
      occasion,
      year: parseInt(year, 10) || new Date().getFullYear(),
      url: url.trim() || undefined,
      price: price ? Number(price.replace(",", ".")) : undefined,
      image: image.trim() || undefined,
    });
    setUrl("");
    setName("");
    setPrice("");
    setImage("");
    setMsg(null);
  };

  return (
    <View style={styles.form}>
      <Text style={styles.title}>{title}</Text>

      {/* Lien + fetch */}
      <TextInput placeholderTextColor="#9ca3af"
        style={styles.input}
        placeholder="Lien du produit (URL)"
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
          {fetching ? "Récupération…" : "🔍 Récupérer les infos avec le lien"}
        </Text>
      </Pressable>
      {msg && <Text style={styles.msg}>{msg}</Text>}

      {image ? (
        <View style={styles.preview}>
          <Image source={{ uri: image }} style={styles.previewImage} />
          <Pressable hitSlop={8} onPress={() => setImage("")}>
            <Text style={styles.deleteX}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Saisie manuelle */}
      <TextInput placeholderTextColor="#9ca3af"
        style={styles.input}
        placeholder="Nom du cadeau *"
        value={name}
        onChangeText={setName}
      />

      <View style={styles.chips}>
        {OCCASIONS.map((o) => {
          const value = o.split(" ").slice(1).join(" ");
          const active = occasion === value;
          return (
            <Pressable
              key={o}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setOccasion(value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {o}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        <TextInput placeholderTextColor="#9ca3af"
          style={[styles.input, { flex: 1 }]}
          placeholder="Année"
          keyboardType="number-pad"
          maxLength={4}
          value={year}
          onChangeText={setYear}
        />
        <TextInput placeholderTextColor="#9ca3af"
          style={[styles.input, { flex: 1 }]}
          placeholder="Prix (€)"
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
        />
      </View>

      <TextInput placeholderTextColor="#9ca3af"
        style={styles.input}
        placeholder="URL de l'image (optionnel)"
        autoCapitalize="none"
        keyboardType="url"
        value={image}
        onChangeText={setImage}
      />

      <Pressable
        style={[styles.submit, (!name.trim() || busy) && { opacity: 0.5 }]}
        disabled={!name.trim() || busy}
        onPress={submit}
      >
        <Text style={styles.submitText}>{busy ? "…" : submitLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8, marginTop: 8 },
  title: { fontSize: 14, fontWeight: "700", color: "#6b7280", textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    backgroundColor: "#fff",
    color: "#111827",
  },
  fetchBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    padding: 11,
    alignItems: "center",
  },
  fetchBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  msg: { color: "#6b7280", fontSize: 12, textAlign: "center" },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "center",
  },
  previewImage: { width: 64, height: 64, borderRadius: 8 },
  deleteX: { color: "#ef4444", fontSize: 16, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#f9fafb",
  },
  chipActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  chipTextActive: { color: "#fff" },
  row: { flexDirection: "row", gap: 8 },
  submit: {
    backgroundColor: "#10b981",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
