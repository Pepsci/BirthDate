import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { attachSharedList } from "../../../lib/sharedGifts";
import { DateEntry, fetchDates, formatBirthday } from "../../../lib/dates";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../../lib/theme-context";

/**
 * Rattacher une liste commune reçue à une de mes cartes.
 *
 * Une liste ne s'affiche dans l'app que posée sur une carte : c'est l'étape
 * qui manque entre « on t'a partagé une liste » et « je la vois ». Deux
 * chemins, comme pour une carte anniversaire reçue — la poser sur une carte
 * que j'ai déjà, ou créer la carte au passage.
 *
 * ⚠️ Une carte ne peut porter qu'UNE liste commune. Si elle en a déjà une
 * autre, le serveur répond 409 ALREADY_HAS_LIST : on demande alors
 * confirmation avant de remplacer, plutôt que d'écraser en silence.
 */
export default function AttachSharedListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  const [dates, setDates] = useState<DateEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Création d'une carte au passage
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [birth, setBirth] = useState("");

  useFocusEffect(
    useCallback(() => {
      fetchDates()
        .then(setDates)
        .catch((e) => setError(e?.message ?? "Erreur de chargement."));
    }, []),
  );

  const done = (dateId: string) => {
    // replace : on ne veut pas revenir sur cet écran avec le bouton retour,
    // le rattachement est fait.
    router.replace(`/date/${dateId}`);
  };

  const attach = async (body: Parameters<typeof attachSharedList>[1]) => {
    if (!id || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await attachSharedList(id, body);
      done(res.dateId);
    } catch (e: any) {
      if (e?.status === 409) {
        Alert.alert(
          "Cette carte a deja une liste",
          "Une carte ne peut porter qu'une seule liste commune. Remplacer l'actuelle par celle-ci ?",
          [
            { text: "Annuler", style: "cancel" },
            {
              text: "Remplacer",
              style: "destructive",
              onPress: () => attach({ ...body, replace: true }),
            },
          ],
        );
      } else {
        setError(e?.message ?? "Erreur.");
      }
    } finally {
      setBusy(false);
    }
  };

  const submitNew = () => {
    if (!name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(birth.trim())) {
      setError("Indique au moins un prenom et une date au format AAAA-MM-JJ.");
      return;
    }
    attach({
      newDate: {
        name: name.trim(),
        surname: surname.trim() || undefined,
        date: birth.trim(),
      },
    });
  };

  if (!dates) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Ajouter la liste" }} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
    );
  }

  // Une carte qui porte deja une liste reste proposee : le remplacement est
  // un choix legitime, il est juste confirme.
  const sorted = [...dates].sort((a, b) =>
    `${a.name ?? ""} ${a.surname ?? ""}`.localeCompare(
      `${b.name ?? ""} ${b.surname ?? ""}`,
      "fr",
      { sensitivity: "base" },
    ),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Ajouter la liste" }} />

      <Text style={styles.intro}>
        Choisis la carte sur laquelle poser cette liste. Tu pourras y consulter
        les idees et reserver un cadeau.
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Une carte existante</Text>
        {sorted.length === 0 && (
          <Text style={styles.empty}>Tu n'as encore aucune carte.</Text>
        )}
        {sorted.map((d) => (
          <Pressable
            key={d._id}
            style={styles.row}
            disabled={busy}
            onPress={() => attach({ dateId: d._id })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {d.name} {d.surname ?? ""}
              </Text>
              <Text style={styles.hint}>
                {d.date ? formatBirthday(d.date) : ""}
                {d.sharedGiftList ? " · a deja une liste commune" : ""}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Pressable
          style={styles.sectionHeader}
          onPress={() => setCreating((v) => !v)}
        >
          <Text style={styles.sectionTitle}>Creer une carte</Text>
          <Text style={styles.chevron}>{creating ? "▾" : "▸"}</Text>
        </Pressable>
        {creating && (
          <>
            <Text style={styles.hint}>
              Pour la personne concernee par cette liste, si tu n'as pas encore
              sa carte.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Prenom"
              placeholderTextColor={colors.placeholder}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Nom (facultatif)"
              placeholderTextColor={colors.placeholder}
              value={surname}
              onChangeText={setSurname}
            />
            <TextInput
              style={styles.input}
              placeholder="Date de naissance (AAAA-MM-JJ)"
              placeholderTextColor={colors.placeholder}
              value={birth}
              onChangeText={setBirth}
              autoCapitalize="none"
            />
            <Pressable
              style={[styles.primaryBtn, busy && { opacity: 0.5 }]}
              disabled={busy}
              onPress={submitNew}
            >
              <Text style={styles.primaryBtnText}>
                Creer la carte et ajouter la liste
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 12, gap: 10, paddingBottom: 40 },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
    },
    intro: { fontSize: 13, color: c.sub, lineHeight: 18, paddingHorizontal: 4 },
    error: { color: c.danger, textAlign: "center", padding: 8 },
    card: { backgroundColor: c.card, borderRadius: 14, padding: 14, gap: 6 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: c.text },
    hint: { fontSize: 12, color: c.sub, lineHeight: 17 },
    empty: { fontSize: 13, color: c.faint, marginTop: 4 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    name: { fontSize: 15, fontWeight: "600", color: c.text },
    chevron: { fontSize: 18, color: c.faint, fontWeight: "700" },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 10,
      fontSize: 14,
      backgroundColor: c.inputBg,
      color: c.text,
      marginTop: 6,
    },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: "center",
      marginTop: 10,
    },
    primaryBtnText: { color: c.white, fontWeight: "700", fontSize: 14 },
  });
