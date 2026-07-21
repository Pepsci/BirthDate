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
import { OCCASIONS } from "../lib/occasions";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

export interface GiftIdeaPayload {
  giftName: string;
  occasion: string;
  year: number;
  url?: string;
  price?: number;
  image?: string;
}

/**
 * Formulaire complet d'idée cadeau — miroir de "Nouvelle idée" du web :
 * lien produit + récupération auto des infos, ou saisie 100 % manuelle.
 */
export default function GiftIdeaForm({
  onSubmit,
  onCancel,
  busy,
  initial,
  submitLabel = "Ajouter",
  title = "Nouvelle idée",
}: {
  onSubmit: (gift: GiftIdeaPayload) => Promise<void>;
  onCancel?: () => void;
  busy: boolean;
  initial?: Partial<GiftIdeaPayload>;
  submitLabel?: string;
  title?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
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
      <TextInput placeholderTextColor={colors.placeholder}
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
      <TextInput placeholderTextColor={colors.placeholder}
        style={styles.input}
        placeholder="Nom du cadeau *"
        value={name}
        onChangeText={setName}
      />

      <View style={styles.chips}>
        {OCCASIONS.map((o) => {
          const active = occasion === o.value;
          return (
            <Pressable
              key={o.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setOccasion(o.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {o.emoji} {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        <TextInput placeholderTextColor={colors.placeholder}
          style={[styles.input, { flex: 1 }]}
          placeholder="Année"
          keyboardType="number-pad"
          maxLength={4}
          value={year}
          onChangeText={setYear}
        />
        <TextInput placeholderTextColor={colors.placeholder}
          style={[styles.input, { flex: 1 }]}
          placeholder="Prix (€)"
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
        />
      </View>

      <TextInput placeholderTextColor={colors.placeholder}
        style={styles.input}
        placeholder="URL de l'image (optionnel)"
        autoCapitalize="none"
        keyboardType="url"
        value={image}
        onChangeText={setImage}
      />

      <View style={styles.submitRow}>
        {onCancel && (
          <Pressable
            style={styles.cancel}
            disabled={busy}
            onPress={onCancel}
          >
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
        )}
        <Pressable
          style={[
            styles.submit,
            { flex: 1 },
            (!name.trim() || busy) && { opacity: 0.5 },
          ]}
          disabled={!name.trim() || busy}
          onPress={submit}
        >
          <Text style={styles.submitText}>{busy ? "…" : submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    form: { gap: 8, marginTop: 8 },
    title: {
      fontSize: 14,
      fontWeight: "700",
      color: c.sub,
      textAlign: "center",
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
    fetchBtn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      padding: 11,
      alignItems: "center",
    },
    fetchBtnText: { color: c.white, fontWeight: "600", fontSize: 13 },
    msg: { color: c.sub, fontSize: 12, textAlign: "center" },
    preview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      alignSelf: "center",
    },
    previewImage: { width: 64, height: 64, borderRadius: 8 },
    deleteX: { color: c.danger, fontSize: 16, fontWeight: "700" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: c.cardSoft,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 12, fontWeight: "600", color: c.text },
    chipTextActive: { color: c.white },
    row: { flexDirection: "row", gap: 8 },
    submitRow: { flexDirection: "row", gap: 8 },
    submit: {
      backgroundColor: c.success,
      borderRadius: 10,
      padding: 12,
      alignItems: "center",
    },
    submitText: { color: c.white, fontWeight: "600", fontSize: 15 },
    cancel: {
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelText: { color: c.sub, fontWeight: "600", fontSize: 15 },
  });
