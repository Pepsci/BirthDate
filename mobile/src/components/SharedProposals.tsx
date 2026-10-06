import { t } from "@/i18n";
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import {
  SharedGiftList,
  SharedGiftProposal,
  proposeSharedGift,
  withdrawSharedProposal,
  decideSharedProposal,
} from "../lib/sharedGifts";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";
import { isLocalMode } from "../lib/app-mode";

/**
 * Propositions d'idées sur une liste commune.
 *
 * Deux visages selon le rôle (`list.myRole`) :
 *   - invité : un bouton « Proposer une idée », un petit formulaire, et la
 *     liste de SES propositions en attente, qu'il peut retirer ;
 *   - gestionnaire : les propositions de tous les invités, avec Accepter
 *     (l'idée entre dans la liste) et Refuser (elle disparaît).
 *
 * Le serveur ne renvoie à chacun que ce qu'il a le droit de voir : ce
 * composant n'a donc rien à filtrer, il affiche `list.proposals` tel quel.
 * Chaque action renvoie la liste à jour, remontée par `onChange`.
 *
 * Mode sans compte : les listes communes n'existent pas, on n'affiche rien.
 */
export default function SharedProposals({
  list,
  onChange,
  onError,
}: {
  list: SharedGiftList;
  onChange: (next: SharedGiftList) => void;
  onError: (message: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [giftName, setGiftName] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (isLocalMode()) return null;

  const isMember = (list.myRole ?? "member") === "member";
  const proposals = list.proposals ?? [];

  /** Lance un appel, remonte la liste à jour ou le message d'erreur. */
  const run = async (fn: () => Promise<SharedGiftList>) => {
    if (busy) return false;
    setBusy(true);
    try {
      onChange(await fn());
      return true;
    } catch (e: any) {
      onError(e?.message ?? t("common:errors.generic"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!giftName.trim()) {
      setFormError(t("date:proposals.nameRequired"));
      return;
    }
    setFormError(null);
    const parsed = Number(price.replace(",", "."));
    const ok = await run(() =>
      proposeSharedGift(list._id, {
        giftName: giftName.trim(),
        url: url.trim() || undefined,
        price: price.trim() && Number.isFinite(parsed) ? parsed : null,
      }),
    );
    if (ok) {
      setGiftName("");
      setUrl("");
      setPrice("");
      setOpen(false);
    }
  };

  const proposerName = (p: SharedGiftProposal) =>
    `${p.proposedBy?.name ?? ""} ${p.proposedBy?.surname ?? ""}`.trim() ||
    t("date:proposals.someone");

  const confirmDecline = (p: SharedGiftProposal) =>
    Alert.alert(
      t("date:proposals.declineTitle"),
      t("date:proposals.declineText", {
        name: proposerName(p),
        gift: p.giftName,
      }),
      [
        { text: t("common:actions.cancel"), style: "cancel" },
        {
          text: t("date:proposals.decline"),
          style: "destructive",
          onPress: () => {
            run(() => decideSharedProposal(list._id, p._id, "decline"));
          },
        },
      ],
    );

  const details = (p: SharedGiftProposal) => (
    <>
      <Text style={styles.name}>{p.giftName}</Text>
      {p.price != null && <Text style={styles.meta}>{p.price} €</Text>}
      {!!p.url && (
        <Pressable onPress={() => Linking.openURL(p.url!)} hitSlop={6}>
          <Text style={styles.link} numberOfLines={1}>
            {p.url}
          </Text>
        </Pressable>
      )}
    </>
  );

  // ── Gestionnaire ──────────────────────────────────────────────────────────
  if (isMember) {
    if (proposals.length === 0) return null;
    return (
      <View style={styles.box}>
        <Text style={styles.title}>
          {t("date:proposals.pendingTitle")} ({proposals.length})
        </Text>
        {proposals.map((p) => (
          <View key={p._id} style={styles.row}>
            {details(p)}
            <Text style={styles.meta}>
              {t("date:proposals.from", { name: proposerName(p) })}
            </Text>
            <View style={styles.actions}>
              <Pressable
                style={[styles.btn, styles.btnPrimary]}
                disabled={busy}
                onPress={() =>
                  run(() => decideSharedProposal(list._id, p._id, "accept"))
                }
              >
                <Text style={styles.btnPrimaryText}>
                  {t("date:proposals.accept")}
                </Text>
              </Pressable>
              <Pressable
                style={styles.btn}
                disabled={busy}
                onPress={() => confirmDecline(p)}
              >
                <Text style={styles.btnText}>
                  {t("date:proposals.decline")}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    );
  }

  // ── Invité ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.box}>
      {!open ? (
        <Pressable style={styles.proposeBtn} onPress={() => setOpen(true)}>
          <Text style={styles.proposeBtnText}>
            {t("date:proposals.proposeBtn")}
          </Text>
        </Pressable>
      ) : (
        <View>
          <Text style={styles.title}>{t("date:proposals.formTitle")}</Text>
          <Text style={styles.meta}>{t("date:proposals.formHint")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("date:proposals.namePlaceholder")}
            placeholderTextColor={colors.placeholder}
            value={giftName}
            onChangeText={setGiftName}
            maxLength={120}
          />
          <TextInput
            style={styles.input}
            placeholder={t("date:proposals.urlPlaceholder")}
            placeholderTextColor={colors.placeholder}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TextInput
            style={styles.input}
            placeholder={t("date:proposals.pricePlaceholder")}
            placeholderTextColor={colors.placeholder}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
          {formError && <Text style={styles.error}>{formError}</Text>}
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              disabled={busy}
              onPress={submit}
            >
              <Text style={styles.btnPrimaryText}>
                {t("date:proposals.send")}
              </Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              disabled={busy}
              onPress={() => {
                setOpen(false);
                setFormError(null);
              }}
            >
              <Text style={styles.btnText}>{t("common:actions.cancel")}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {proposals.length > 0 && (
        <View style={styles.mine}>
          <Text style={styles.title}>{t("date:proposals.mineTitle")}</Text>
          {proposals.map((p) => (
            <View key={p._id} style={styles.row}>
              {details(p)}
              <Pressable
                hitSlop={8}
                disabled={busy}
                onPress={() =>
                  run(() => withdrawSharedProposal(list._id, p._id))
                }
              >
                <Text style={styles.withdraw}>
                  {t("date:proposals.withdraw")}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    box: {
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.cardSoft,
    },
    title: { fontSize: 15, fontWeight: "700", color: c.text, marginBottom: 4 },
    row: {
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: 4,
    },
    name: { fontSize: 15, fontWeight: "600", color: c.text },
    meta: { fontSize: 13, color: c.sub },
    link: { fontSize: 13, color: c.primary },
    actions: { flexDirection: "row", gap: 8, marginTop: 8 },
    btn: {
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    btnText: { fontSize: 14, fontWeight: "600", color: c.text },
    btnPrimary: { backgroundColor: c.primary, borderColor: c.primary },
    btnPrimaryText: { fontSize: 14, fontWeight: "600", color: "#fff" },
    proposeBtn: { paddingVertical: 4, alignItems: "center" },
    proposeBtnText: { fontSize: 15, fontWeight: "600", color: c.primary },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 10,
      fontSize: 14,
      backgroundColor: c.inputBg,
      color: c.text,
      marginTop: 8,
    },
    error: { fontSize: 13, color: c.danger, marginTop: 6 },
    mine: { marginTop: 12 },
    withdraw: { fontSize: 13, fontWeight: "600", color: c.danger },
  });
