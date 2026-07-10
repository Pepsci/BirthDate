import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  Share,
  ActivityIndicator,
} from "react-native";
import {
  DirectTransfer,
  BankInfo,
  bankInfoExists,
  fetchBankInfo,
} from "../lib/events";

/**
 * Affiche les moyens de participation hors plateforme (PayPal + IBAN),
 * repris de DirectTransferViewer web. Compte connecté requis pour l'IBAN.
 */
export default function DirectTransferViewer({
  shortId,
  directTransfer,
}: {
  shortId: string;
  directTransfer?: DirectTransfer;
}) {
  const dt = directTransfer ?? {};
  const [ibanExists, setIbanExists] = useState<boolean | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [info, setInfo] = useState<BankInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!dt.ibanEnabled) {
      setIbanExists(false);
      return;
    }
    bankInfoExists(shortId).then(setIbanExists);
  }, [shortId, dt.ibanEnabled]);

  const reveal = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchBankInfo(shortId);
      if (data.exists) {
        setInfo(data);
        setRevealed(true);
      } else {
        setError("Aucun RIB disponible.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Impossible d'afficher le RIB.");
    } finally {
      setLoading(false);
    }
  };

  if (!dt.ibanEnabled && !dt.paypalEnabled) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>💸 Autres moyens de participer</Text>

      {/* PayPal */}
      {dt.paypalEnabled && dt.paypalLink ? (
        <Pressable
          style={styles.payBtn}
          onPress={() => Linking.openURL(dt.paypalLink!)}
        >
          <Text style={styles.payBtnText}>💳 Payer via PayPal</Text>
        </Pressable>
      ) : dt.paypalEnabled && !dt.paypalLink ? (
        <Text style={styles.muted}>
          L'organisateur a activé PayPal mais n'a pas encore renseigné son lien.
        </Text>
      ) : null}

      {/* IBAN */}
      {dt.ibanEnabled &&
        (ibanExists === null ? (
          <ActivityIndicator color="#3b82f6" style={{ marginVertical: 8 }} />
        ) : ibanExists === false ? (
          <Text style={styles.muted}>
            L'organisateur a activé le virement par RIB mais n'a pas encore
            renseigné ses informations.
          </Text>
        ) : !revealed ? (
          <>
            <Pressable
              style={styles.revealBtn}
              disabled={loading}
              onPress={reveal}
            >
              <Text style={styles.revealBtnText}>
                {loading ? "Chargement…" : "🏦 Afficher le RIB"}
              </Text>
            </Pressable>
            {!!error && <Text style={styles.error}>{error}</Text>}
          </>
        ) : (
          <View style={styles.ibanBox}>
            {!!info?.holderName && (
              <View style={styles.row}>
                <Text style={styles.label}>Titulaire</Text>
                <Text style={styles.value}>{info.holderName}</Text>
              </View>
            )}
            <Text style={styles.label}>IBAN</Text>
            <Text style={styles.iban} selectable>
              {info?.iban}
            </Text>
            <Pressable
              style={styles.copyBtn}
              onPress={() =>
                Share.share({ message: info?.iban?.replace(/\s+/g, "") ?? "" })
              }
            >
              <Text style={styles.copyBtnText}>📤 Partager l'IBAN</Text>
            </Pressable>
            <Text style={styles.hint}>
              Astuce : appuie longuement sur l'IBAN pour le copier.
            </Text>
          </View>
        ))}

      <Text style={styles.note}>
        Ces paiements se font directement vers l'organisateur, en dehors de
        BirthReminder.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
    gap: 8,
  },
  title: { fontSize: 14, fontWeight: "800", color: "#111827" },
  muted: { color: "#6b7280", fontSize: 13, lineHeight: 18 },
  payBtn: {
    backgroundColor: "#0070ba",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  payBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  revealBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  revealBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  error: { color: "#b91c1c", fontSize: 13, marginTop: 4 },
  ibanBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: { color: "#6b7280", fontSize: 12, fontWeight: "600" },
  value: { color: "#111827", fontSize: 13, fontWeight: "600" },
  iban: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  copyBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  copyBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  hint: { color: "#9ca3af", fontSize: 11, marginTop: 6, textAlign: "center" },
  note: {
    color: "#9ca3af",
    fontSize: 11,
    lineHeight: 16,
    fontStyle: "italic",
    marginTop: 4,
  },
});
