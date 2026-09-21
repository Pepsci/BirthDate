import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from "react-native";
import BottomSheet from "./BottomSheet";
import { DateEntry, Gift, fetchDates } from "../lib/dates";
import { occasionEmoji } from "../lib/occasions";
import { fetchMyWishlist } from "../lib/wishlist";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

export interface ImportedGift {
  giftName: string;
  occasion?: string;
  year?: number;
  url?: string;
  price?: number;
  image?: string;
}

/**
 * Sélecteur "Importer depuis une liste" (repris du web ImportGiftModal, mode import) :
 *   Étape 1 : choisir une source — sa propre liste d'envies, ou une fiche qui
 *             a des idées cadeaux
 *   Étape 2 : choisir les idées → onImport(gifts)
 * Le parent gère l'ajout réel (event proposal / idée de carte) puis ferme.
 */
/** Source « Ma liste d'envies », présentée comme une fiche pour l'étape 2. */
const WISHLIST_SOURCE_ID = "__my-wishlist";

export default function ImportGiftSheet({
  visible,
  onClose,
  onImport,
  excludeDateId,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  onImport: (gifts: ImportedGift[]) => Promise<void> | void;
  excludeDateId?: string;
  busy?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [dates, setDates] = useState<DateEntry[] | null>(null);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [source, setSource] = useState<
    (DateEntry & { gifts?: Gift[] }) | null
  >(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Ma liste d'envies, convertie au format des idées de carte
  const [wishlistGifts, setWishlistGifts] = useState<Gift[] | null>(null);
  const isWishlistSource = source?._id === WISHLIST_SOURCE_ID;

  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setSource(null);
    setSelected(new Set());
    setSearch("");
    setDates(null);
    setWishlistGifts(null);
    fetchMyWishlist()
      .then((items) =>
        setWishlistGifts(
          items
            .filter((i) => i && i.title)
            .map(
              (i) =>
                ({
                  _id: i._id,
                  giftName: i.title,
                  url: i.url ?? undefined,
                  price: i.price ?? undefined,
                  image: i.image ?? undefined,
                }) as Gift,
            ),
        ),
      )
      .catch(() => setWishlistGifts([]));
    fetchDates()
      .then((list) =>
        setDates(
          (list as (DateEntry & { gifts?: Gift[] })[]).filter(
            (d) =>
              (d.gifts?.length ?? 0) > 0 && d._id !== excludeDateId,
          ),
        ),
      )
      .catch(() => setDates([]));
  }, [visible, excludeDateId]);

  const sourceGifts = (source?.gifts ?? []).filter((g) => g && g.giftName);
  const filtered = (dates ?? []).filter((d) => {
    const q = search.toLowerCase();
    const name = `${d.name ?? ""} ${d.surname ?? ""}`.toLowerCase();
    return name.includes(q);
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const confirm = async () => {
    const gifts: ImportedGift[] = sourceGifts
      .filter((g) => selected.has(g._id))
      .map((g) => ({
        giftName: g.giftName,
        occasion: g.occasion,
        year: g.year,
        url: g.url ?? undefined,
        price: g.price ?? undefined,
        image: g.image ?? undefined,
      }));
    if (gifts.length === 0) return;
    await onImport(gifts);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {step === 1 ? (
        <>
          <Text style={styles.title}>Importer depuis une liste</Text>
          <Text style={styles.sub}>Choisis une fiche source.</Text>
          <TextInput
            placeholderTextColor={colors.placeholder}
            style={styles.search}
            placeholder="🔍 Rechercher un prénom…"
            value={search}
            onChangeText={setSearch}
          />
          {/* Ma liste d'envies : toujours en tête, masquée si vide */}
          {(wishlistGifts?.length ?? 0) > 0 &&
            "ma liste d'envies".includes(search.trim().toLowerCase()) && (
              <Pressable
                style={styles.dateRow}
                onPress={() => {
                  setSource({
                    _id: WISHLIST_SOURCE_ID,
                    name: "Ma liste d'envies",
                    date: "",
                    family: false,
                    linkedUser: null,
                    gifts: wishlistGifts ?? [],
                  });
                  setSelected(new Set());
                  setStep(2);
                }}
              >
                <View style={styles.rowText}>
                  <Text style={styles.dateName}>⭐ Ma liste d'envies</Text>
                  <Text style={styles.dateMeta}>
                    {wishlistGifts!.length} envie
                    {wishlistGifts!.length > 1 ? "s" : ""}
                  </Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            )}
          {dates === null ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginVertical: 16 }}
            />
          ) : filtered.length === 0 ? (
            (wishlistGifts?.length ?? 0) === 0 && (
              <Text style={styles.empty}>
                Aucune fiche avec des idées cadeaux, et ta liste d'envies est
                vide.
              </Text>
            )
          ) : (
            filtered.map((d) => (
              <Pressable
                key={d._id}
                style={styles.dateRow}
                onPress={() => {
                  setSource(d);
                  setSelected(new Set());
                  setStep(2);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.dateName}>
                    {d.name} {d.surname ?? ""}
                    {d.linkedUser ? " 👥" : d.family ? " 🏠" : ""}
                  </Text>
                  <Text style={styles.dateMeta}>
                    {d.gifts?.length} idée{(d.gifts?.length ?? 0) > 1 ? "s" : ""}
                  </Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            ))
          )}
        </>
      ) : (
        <>
          <Text style={styles.title}>
            {isWishlistSource
              ? "Ma liste d'envies"
              : `Idées de ${source?.name} ${source?.surname ?? ""}`}
          </Text>
          <Text style={styles.sub}>Sélectionne les idées à importer.</Text>
          {sourceGifts.map((g) => (
            <Pressable
              key={g._id}
              style={styles.giftRow}
              onPress={() => toggle(g._id)}
            >
              <Text style={styles.check}>{selected.has(g._id) ? "☑" : "☐"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.giftName} numberOfLines={1}>
                  {g.giftName}
                </Text>
                <Text style={styles.giftMeta} numberOfLines={1}>
                  {isWishlistSource
                    ? g.price != null
                      ? `${g.price} €`
                      : "⭐ Envie"
                    : `${occasionEmoji(g.occasion)} ${g.occasion ?? ""}${
                        g.year ? ` · ${g.year}` : ""
                      }${g.price != null ? ` · ${g.price} €` : ""}`}
                </Text>
              </View>
            </Pressable>
          ))}
          <View style={styles.footer}>
            <Pressable style={styles.ghostBtn} onPress={() => setStep(1)}>
              <Text style={styles.ghostText}>Retour</Text>
            </Pressable>
            <Pressable
              style={[
                styles.primaryBtn,
                (selected.size === 0 || busy) && { opacity: 0.5 },
              ]}
              disabled={selected.size === 0 || busy}
              onPress={confirm}
            >
              <Text style={styles.primaryText}>
                {busy ? "…" : `Ajouter (${selected.size})`}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    title: { fontSize: 18, fontWeight: "800", color: c.text },
    sub: { color: c.sub, fontSize: 13, marginTop: 4, marginBottom: 10 },
    search: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 10,
      fontSize: 14,
      color: c.text,
      marginBottom: 8,
    },
    empty: { color: c.sub, textAlign: "center", marginVertical: 16 },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    rowText: { flex: 1 },
    dateName: { fontSize: 15, fontWeight: "600", color: c.text },
    dateMeta: { fontSize: 12, color: c.sub, marginTop: 2 },
    arrow: { fontSize: 22, color: c.faint },
    giftRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    check: { fontSize: 18, color: c.primary },
    giftName: { fontSize: 14, fontWeight: "600", color: c.text },
    giftMeta: { fontSize: 12, color: c.sub, marginTop: 1 },
    footer: { flexDirection: "row", gap: 10, marginTop: 16 },
    ghostBtn: {
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    ghostText: { color: c.sub, fontWeight: "600" },
    primaryBtn: {
      flex: 1,
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
    },
    primaryText: { color: c.white, fontWeight: "700", fontSize: 15 },
  });
