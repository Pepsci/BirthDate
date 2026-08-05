import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { DMMessage } from "../lib/conversations";
import {
  createDate,
  fetchDates,
  formatBirthday,
  formatFullDate,
  formatNameday,
} from "../lib/dates";
import { addFriendById } from "../lib/friends";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

/**
 * Carte anniversaire partagée dans le chat (message type date_share).
 *
 * Le destinataire peut l'ajouter à ses propres dates en un tap. Les idées
 * cadeaux ne sont volontairement jamais transmises : c'est ce qui distingue
 * ce partage de gift_share.
 */
export default function DateShareCard({
  message,
  isMine,
}: {
  message: DMMessage;
  isMine: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  const m = message.metadata ?? {};
  const name = m.name ?? m.personName ?? "";
  const surname = m.surname ?? "";
  const birthDate = m.birthDate ?? null;
  const nameday = m.nameday ?? null;
  const linkedUserId = m.linkedUserId ?? null;
  const fullName = `${name}${surname ? ` ${surname}` : ""}`.trim();

  // Demande d'ami : la personne doit accepter. Si elle accepte, le serveur
  // crée les cartes liées des deux côtés (createFriendDates) — d'où le fait
  // qu'on ne crée pas de carte manuelle en parallèle ici.
  const sendFriendRequest = async () => {
    if (requesting || !linkedUserId) return;
    setRequesting(true);
    setError(null);
    try {
      await addFriendById(linkedUserId);
      setRequested(true);
    } catch (e: any) {
      setError(e?.message ?? "Impossible d'envoyer la demande.");
    } finally {
      setRequesting(false);
    }
  };

  const add = async () => {
    if (saving || !birthDate || !name) return;
    setSaving(true);
    setError(null);
    try {
      // Doublon = même prénom/nom et même jour d'anniversaire.
      const mine = await fetchDates();
      const shared = new Date(birthDate);
      const exists = mine.some((d) => {
        const dd = new Date(d.date);
        return (
          (d.name ?? "").toLowerCase() === name.toLowerCase() &&
          (d.surname ?? "").toLowerCase() === surname.toLowerCase() &&
          dd.getMonth() === shared.getMonth() &&
          dd.getDate() === shared.getDate()
        );
      });
      if (exists) {
        setError("Déjà dans vos anniversaires.");
        return;
      }
      await createDate({
        name,
        surname: surname || undefined,
        date: birthDate,
        nameday,
      });
      setAdded(true);
    } catch (e: any) {
      setError(e?.message ?? "Impossible d'ajouter cette date.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, isMine ? styles.cardMine : styles.cardOther]}>
      <Text style={styles.header}>🎂 Carte anniversaire</Text>
      <Text style={styles.name}>{fullName || "Sans nom"}</Text>
      {birthDate && (
        <Text style={styles.line}>
          Né(e) le {formatFullDate(birthDate)} · fêté le{" "}
          {formatBirthday(birthDate)}
        </Text>
      )}
      {nameday && <Text style={styles.line}>🎉 Fête le {formatNameday(nameday)}</Text>}
      <Text style={styles.note}>Les idées cadeaux ne sont pas partagées.</Text>

      {!isMine && linkedUserId && !requested && !added && (
        <Pressable
          style={[styles.friendBtn, requesting && { opacity: 0.6 }]}
          onPress={sendFriendRequest}
          disabled={requesting}
        >
          {requesting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.friendBtnText}>👥 Ajouter en ami</Text>
          )}
        </Pressable>
      )}
      {requested && (
        <Text style={styles.added}>
          ✅ Demande envoyée — sa carte se créera s'il accepte
        </Text>
      )}

      {!isMine && !added && !requested && (
        <Pressable
          style={[
            styles.addBtn,
            linkedUserId && styles.addBtnSecondary,
            saving && { opacity: 0.6 },
          ]}
          onPress={add}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator
              color={linkedUserId ? undefined : "#fff"}
              size="small"
            />
          ) : (
            <Text
              style={[
                styles.addBtnText,
                linkedUserId && styles.addBtnTextSecondary,
              ]}
            >
              {linkedUserId
                ? "🎂 Juste créer la carte"
                : "＋ Ajouter à mes anniversaires"}
            </Text>
          )}
        </Pressable>
      )}
      {added && <Text style={styles.added}>✅ Ajouté à vos anniversaires</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      maxWidth: "82%",
      borderRadius: 14,
      padding: 10,
      marginVertical: 3,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      gap: 2,
    },
    cardMine: { alignSelf: "flex-end", backgroundColor: c.primarySoft },
    cardOther: { alignSelf: "flex-start" },
    header: { fontWeight: "800", color: c.sub, fontSize: 12 },
    name: { fontWeight: "800", color: c.text, fontSize: 15, marginTop: 2 },
    line: { color: c.text, fontSize: 13 },
    note: { color: c.faint, fontSize: 11, marginTop: 4, fontStyle: "italic" },
    addBtn: {
      backgroundColor: c.primary,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: "center",
      marginTop: 8,
    },
    addBtnText: { color: c.white, fontWeight: "700", fontSize: 13 },
    addBtnSecondary: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: c.border,
      marginTop: 6,
    },
    addBtnTextSecondary: { color: c.sub },
    // Mise en relation = action principale quand la personne est inscrite ;
    // « juste créer la carte » devient alors l'option secondaire.
    friendBtn: {
      backgroundColor: c.primary,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: "center",
      marginTop: 8,
    },
    friendBtnText: { color: c.white, fontWeight: "700", fontSize: 13 },
    added: {
      color: c.successStrong,
      fontWeight: "700",
      fontSize: 13,
      marginTop: 6,
    },
    error: { color: c.danger, fontSize: 12, marginTop: 6 },
  });
