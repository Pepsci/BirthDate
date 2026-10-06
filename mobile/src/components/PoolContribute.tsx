import { t } from "@/i18n";
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
import { Stack, useRouter } from "expo-router";
import { StripeProvider, useStripe } from "@stripe/stripe-react-native";
import * as WebBrowser from "expo-web-browser";
import { contributeToPool } from "../lib/events";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";
import { formPane } from "../lib/layout";

const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

const QUICK_AMOUNTS = [5, 10, 20, 50];

/**
 * Contribution à la cagnotte d'un événement.
 *
 * Écran plein (`app/event/pool/[shortId].tsx`) ou panneau de droite de la page
 * événement en paysage (`embedded`). `onDone` est appelé après un paiement
 * réussi : par défaut on revient en arrière, en panneau l'appelant recharge
 * l'événement.
 */
export default function PoolContribute({
  shortId,
  embedded = false,
  onDone,
}: {
  shortId: string;
  embedded?: boolean;
  onDone?: () => void;
}) {
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
        shortId={shortId}
        embedded={embedded}
        onDone={onDone}
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
  embedded = false,
  onDone,
}: {
  shortId: string;
  clientSecret: string | null;
  onIntentCreated: (clientSecret: string, accountId: string) => void;
  embedded?: boolean;
  onDone?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  // Garder son nom visible mais masquer le montant aux autres participants
  const [hideAmount, setHideAmount] = useState(false);
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
          hideAmount,
          guestName: displayName.trim() || undefined,
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

      Alert.alert(t("pool:contribute.thanks"), t("pool:contribute.saved"), [
        { text: "OK", onPress: () => (onDone ? onDone() : router.back()) },
      ]);
    } catch (e: any) {
      setError(e?.message ?? t("pool:contribute.payError"));
      setPaying(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      {embedded ? (
        <Text style={styles.embeddedTitle}>{t("pool:contribute.embedded")}</Text>
      ) : (
        <Stack.Screen options={{ title: t("pool:contribute.title") }} />
      )}

      <Text style={styles.label}>{t("pool:contribute.amount")}</Text>
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
        placeholderTextColor={colors.placeholder}
        style={styles.input}
        placeholder={t("pool:contribute.amountPlaceholder")}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={styles.label}>{t("pool:contribute.message")}</Text>
      <TextInput
        placeholderTextColor={colors.placeholder}
        style={[styles.input, { minHeight: 60 }]}
        placeholder={t("pool:contribute.messagePlaceholder")}
        multiline
        maxLength={200}
        value={message}
        onChangeText={setMessage}
      />

      <Text style={styles.label}>{t("pool:contribute.displayName")}</Text>
      <TextInput
        placeholderTextColor={colors.placeholder}
        style={styles.input}
        placeholder={t("pool:contribute.namePlaceholder")}
        maxLength={60}
        value={displayName}
        onChangeText={setDisplayName}
      />
      <Text style={styles.help}>
        {t("pool:contribute.nameHint")}
      </Text>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t("pool:contribute.anonymous")}</Text>
        <Switch
          value={anonymous}
          onValueChange={setAnonymous}
          trackColor={{ true: colors.primary }}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t("pool:contribute.hideAmount")}</Text>
        <Switch
          value={hideAmount}
          onValueChange={setHideAmount}
          trackColor={{ true: colors.primary }}
        />
      </View>

      {hideAmount && (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            {t("pool:contribute.hideAmountInfo")}
          </Text>
        </View>
      )}

      {anonymous && (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            {t("pool:contribute.anonymousInfo")}
          </Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.payBtn, (!valid || paying) && { opacity: 0.5 }]}
        disabled={!valid || paying}
        onPress={pay}
      >
        {paying ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.payText}>
            {t("pool:contribute.pay")}{valid ? ` ${(amountCents / 100).toFixed(2).replace(".", ",")} €` : ""}
          </Text>
        )}
      </Pressable>

      <Text style={styles.secure}>
        {t("pool:contribute.secure")}
      </Text>
      <Text
        style={styles.secureLink}
        onPress={() =>
          WebBrowser.openBrowserAsync("https://stripe.com/fr/legal/ssa")
        }
      >
        {t("pool:contribute.stripeTerms")}
      </Text>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  embeddedTitle: { fontSize: 16, fontWeight: "700", color: c.text },
  content: { padding: 16, gap: 8, ...formPane },
  label: { fontSize: 13, fontWeight: "700", color: c.sub, marginTop: 8 },
  quickRow: { flexDirection: "row", gap: 8 },
  quickBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: c.card,
  },
  quickBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
  quickText: { fontWeight: "700", color: c.text },
  quickTextActive: { color: c.white },
  input: {
    borderWidth: 1,
    borderColor: c.inputBorder,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: c.inputBg,
    color: c.text,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  switchLabel: { fontSize: 14, fontWeight: "600", color: c.text },
  help: { color: c.faint, fontSize: 12, lineHeight: 16, marginTop: 2 },
  noticeBox: {
    backgroundColor: c.warningSoft,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  noticeText: { color: c.warningStrong, fontSize: 12, lineHeight: 17 },
  error: { color: c.danger, textAlign: "center", marginTop: 8 },
  payBtn: {
    backgroundColor: c.success,
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 12,
  },
  payText: { color: c.white, fontWeight: "700", fontSize: 16 },
  secure: { textAlign: "center", color: c.faint, fontSize: 12, marginTop: 8 },
  secureLink: {
    textAlign: "center",
    color: c.faint,
    fontSize: 12,
    marginTop: 4,
    textDecorationLine: "underline",
  },
});
