import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StripeProvider, useStripe } from "@stripe/stripe-react-native";
import { contributeToPool } from "../../../lib/events";

const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

const QUICK_AMOUNTS = [5, 10, 20, 50];

export default function PoolContributeScreen() {
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  // stripeAccountId n'est connu qu'après création du PaymentIntent
  // (charge directe sur le compte de l'organisateur)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  return (
    <StripeProvider
      key={stripeAccountId ?? "default"}
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      stripeAccountId={stripeAccountId ?? undefined}
      merchantIdentifier="merchant.com.birthreminder.app"
    >
      <ContributeForm
        shortId={shortId!}
        clientSecret={clientSecret}
        onIntentCreated={(cs, acc) => {
          setStripeAccountId(acc);
          setClientSecret(cs);
        }}
      />
    </StripeProvider>
  );
}

function ContributeForm({
  shortId,
  clientSecret,
  onIntentCreated,
}: {
  shortId: string;
  clientSecret: string | null;
  onIntentCreated: (clientSecret: string, accountId: string) => void;
}) {
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
  const valid = Number.isFinite(amountCents) && amountCents >= 100;

  const pay = async () => {
    if (!valid || paying) return;
    setError(null);
    setPaying(true);
    try {
      // 1. Créer le PaymentIntent côté back (charge directe organisateur)
      const { clientSecret: cs, stripeAccountId: acc } =
        await contributeToPool(shortId, {
          amount: amountCents,
          message: message.trim() || undefined,
          anonymous,
        });
      onIntentCreated(cs, acc);

      // 2. Laisser le provider se reconfigurer avec le compte connecté
      await new Promise((r) => setTimeout(r, 150));

      // 3. PaymentSheet natif
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: cs,
        merchantDisplayName: "BirthReminder",
        defaultBillingDetails: {},
      });
      if (initError) throw new Error(initError.message);

      const { error: payError } = await presentPaymentSheet();
      if (payError) {
        if (payError.code !== "Canceled") throw new Error(payError.message);
        setPaying(false);
        return; // annulé par l'utilisateur
      }

      Alert.alert("Merci ! 💝", "Ta contribution a bien été enregistrée.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors du paiement.");
      setPaying(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Contribuer à la cagnotte" }} />

      <Text style={styles.label}>Montant (€)</Text>
      <View style={styles.quickRow}>
        {QUICK_AMOUNTS.map((a) => (
          <Pressable
            key={a}
            style={[
              styles.quickBtn,
              amount === String(a) && styles.quickBtnActive,
            ]}
            onPress={() => setAmount(String(a))}
          >
            <Text
              style={[
                styles.quickText,
                amount === String(a) && styles.quickTextActive,
              ]}
            >
              {a} €
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        placeholderTextColor="#9ca3af"
        style={styles.input}
        placeholder="Montant libre (min 1 €)"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={styles.label}>Message (optionnel)</Text>
      <TextInput
        placeholderTextColor="#9ca3af"
        style={[styles.input, { minHeight: 60 }]}
        placeholder="Un petit mot avec ta contribution…"
        multiline
        maxLength={200}
        value={message}
        onChangeText={setMessage}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Contribuer anonymement</Text>
        <Switch
          value={anonymous}
          onValueChange={setAnonymous}
          trackColor={{ true: "#3b82f6" }}
        />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.payBtn, (!valid || paying) && { opacity: 0.5 }]}
        disabled={!valid || paying}
        onPress={pay}
      >
        {paying ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.payText}>
            💳 Payer{valid ? ` ${(amountCents / 100).toFixed(2).replace(".", ",")} €` : ""}
          </Text>
        )}
      </Pressable>

      <Text style={styles.secure}>
        🔒 Paiement sécurisé par Stripe — l'argent va directement à
        l'organisateur.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, gap: 8 },
  label: { fontSize: 13, fontWeight: "700", color: "#6b7280", marginTop: 8 },
  quickRow: { flexDirection: "row", gap: 8 },
  quickBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  quickBtnActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  quickText: { fontWeight: "700", color: "#374151" },
  quickTextActive: { color: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#111827",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  switchLabel: { fontSize: 14, fontWeight: "600", color: "#111827" },
  error: { color: "#b91c1c", textAlign: "center", marginTop: 8 },
  payBtn: {
    backgroundColor: "#10b981",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 12,
  },
  payText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secure: { textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 8 },
});
