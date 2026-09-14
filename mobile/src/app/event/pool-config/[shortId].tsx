import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as WebBrowser from "expo-web-browser";
import {
  PoolInfo,
  fetchPool,
  updatePool,
  stripeOnboardingLink,
  stripeStatus,
  stripeDashboardLink,
  stripeBalance,
  ConnectBalance,
  fetchEvent,
  fetchBankInfo,
  saveBankInfo,
  deleteBankInfo,
  toggleIbanOption,
  setPaypalOption,
  setExternalPoolOption,
  refundPreview,
  refundAll,
  RefundPreview,
} from "../../../lib/events";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../../lib/theme-context";

const IBAN_DURATIONS = [7, 14, 30, 60, 90];

/** Violet de marque Stripe — volontairement hors thème. */
const STRIPE_PURPLE = "#635bff";

export default function PoolConfigScreen() {
  const { shortId } = useLocalSearchParams<{ shortId: string }>();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { colors, resolved } = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<"free" | "goal">("free");
  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeNotReady, setStripeNotReady] = useState(false);
  /*
   * Solde du compte connecté.
   *
   * ⚠️ « Où est mon argent ? » est la question la plus fréquente d'un
   * organisateur, et l'app n'y répondait pas : il fallait retrouver un vieil
   * email de Stripe. Un solde à zéro signifie presque toujours « déjà viré » —
   * d'où l'affichage du dernier virement juste à côté, sans lequel un zéro
   * inquiète au lieu de rassurer.
   */
  const [balance, setBalance] = useState<ConnectBalance | null>(null);
  const [openingDash, setOpeningDash] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [saving, setSaving] = useState(false);

  // Remboursement : le chiffrage est chargé séparément de la cagnotte, parce
  // qu'il reste pertinent quand celle-ci est déjà fermée (annulation,
  // transfert d'organisation).
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [refunding, setRefunding] = useState(false);

  const loadPreview = () => {
    if (!shortId) return;
    refundPreview(shortId)
      .then(setPreview)
      // 403 si on n'est pas l'organisateur : le bloc reste simplement masqué.
      .catch(() => setPreview(null));
  };

  const onRefundAll = () => {
    if (!preview) return;
    Alert.alert(
      "Rembourser tout le monde ?",
      `${preview.count} contribution${preview.count > 1 ? "s" : ""} pour ${(preview.totalRefunded / 100).toFixed(2)} €.\n\nLes contributeurs récupèrent l'intégralité. Cette opération te coûtera ${preview.estimatedCount > 0 ? "environ " : ""}${(preview.feeLoss / 100).toFixed(2)} € : Stripe ne restitue pas les frais des paiements d'origine.\n\nLa cagnotte sera fermée. C'est irréversible.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Rembourser",
          style: "destructive",
          onPress: async () => {
            if (!shortId) return;
            setRefunding(true);
            try {
              const report = await refundAll(shortId);
              loadPreview();
              Alert.alert(
                "Remboursements envoyés",
                report.failed === 0
                  ? `${report.refunded} remboursement${report.refunded > 1 ? "s" : ""} envoyé${report.refunded > 1 ? "s" : ""}. Les contributeurs seront prévenus dès que Stripe les confirme.`
                  : `${report.refunded} réussi${report.refunded > 1 ? "s" : ""}, ${report.failed} en échec. Tu peux relancer : seules les contributions non remboursées seront reprises.`,
              );
            } catch (e: any) {
              setError(e?.message ?? "Erreur lors du remboursement.");
            } finally {
              setRefunding(false);
            }
          },
        },
      ],
    );
  };

  // Virement direct (indépendant de la cagnotte Stripe)
  const [ibanEnabled, setIbanEnabled] = useState(false);
  const [iban, setIban] = useState("");
  const [holderName, setHolderName] = useState("");
  const [ibanDuration, setIbanDuration] = useState(30);
  const [ibanSaved, setIbanSaved] = useState(false);
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [paypalLink, setPaypalLink] = useState("");
  // Cagnotte ouverte sur un autre service (Leetchi, Lydia…). Sans cet
  // emplacement, l'organisateur colle son lien dans le chat, où il descend
  // sous les messages et devient invisible pour les invités suivants.
  const [externalEnabled, setExternalEnabled] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [externalLabel, setExternalLabel] = useState("");

  useEffect(() => {
    if (!shortId) return;
    loadPreview();
    Promise.all([
      fetchPool(shortId)
        .then((p: PoolInfo) => {
          setActive(p.active);
          setMode(p.mode ?? "free");
          setGoal(p.goal ? String(p.goal / 100) : "");
          setDeadline(p.deadline ? new Date(p.deadline) : null);
        })
        .catch(() => {}),
      stripeBalance()
        .then(setBalance)
        .catch(() => {}),
      fetchEvent(shortId)
        .then((ev) => {
          const dt = ev.directTransfer ?? {};
          setIbanEnabled(!!dt.ibanEnabled);
          setPaypalEnabled(!!dt.paypalEnabled);
          setPaypalLink(dt.paypalLink ?? "");
          setExternalEnabled(!!dt.externalPoolEnabled);
          setExternalUrl(dt.externalPoolUrl ?? "");
          setExternalLabel(dt.externalPoolLabel ?? "");
        })
        .catch(() => {}),
      // RIB existant (organisateur → déchiffré) pour préremplir
      fetchBankInfo(shortId)
        .then((b) => {
          if (b.exists) {
            setIbanSaved(true);
            if (b.iban) setIban(b.iban);
            if (b.holderName) setHolderName(b.holderName);
          }
        })
        .catch(() => {}),
    ]).finally(() => setLoaded(true));
  }, [shortId]);

  const connectStripe = async () => {
    if (onboarding) return;
    setOnboarding(true);
    setError(null);
    try {
      // Lien d'onboarding hébergé par Stripe, ouvert dans le navigateur intégré
      const url = await stripeOnboardingLink();
      await WebBrowser.openBrowserAsync(url);
      // Au retour : vérifier si le compte est prêt
      const status = await stripeStatus();
      if (status.ready) {
        setStripeNotReady(false);
        setError(null);
        stripeBalance().then(setBalance).catch(() => {});
      } else {
        setError(
          "Onboarding pas encore terminé — reprends-le quand tu veux avec le même bouton.",
        );
      }
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la connexion Stripe.");
    } finally {
      setOnboarding(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setError(null);
    setStripeNotReady(false);

    // Garde-fou : IBAN activé mais aucun RIB (ni saisi, ni déjà enregistré)
    const cleanIban = iban.replace(/\s+/g, "");
    if (ibanEnabled && !ibanSaved && cleanIban.length < 14) {
      setError("Saisis un IBAN valide ou désactive l'option virement IBAN.");
      return;
    }

    setSaving(true);
    try {
      // 1. Virement direct (indépendant de la cagnotte Stripe)
      if (ibanEnabled) {
        if (cleanIban.length >= 14) {
          await saveBankInfo(shortId!, {
            iban: iban.trim(),
            holderName: holderName.trim() || undefined,
            durationDays: ibanDuration,
          });
        }
        await toggleIbanOption(shortId!, true);
      } else {
        await toggleIbanOption(shortId!, false);
      }
      await setPaypalOption(
        shortId!,
        paypalEnabled,
        paypalEnabled ? paypalLink.trim() : "",
      );

      // Le serveur refuse une cagnotte externe activée sans lien : on
      // n'envoie donc l'activation que si l'URL est renseignée, sinon on
      // enregistrerait une option qui ne s'affiche nulle part.
      await setExternalPoolOption(
        shortId!,
        externalEnabled && !!externalUrl.trim(),
        externalUrl.trim(),
        externalLabel.trim(),
      );

      // 2. Cagnotte Stripe (inchangée)
      await updatePool(shortId!, {
        active,
        mode,
        goal:
          mode === "goal" && goal
            ? Math.round(Number(goal.replace(",", ".")) * 100)
            : null,
        deadline: deadline ? deadline.toISOString() : null,
      });
      router.back();
    } catch (e: any) {
      if (e?.message?.includes("Stripe")) setStripeNotReady(true);
      setError(e?.message ?? "Erreur lors de l'enregistrement.");
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Cagnotte" }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title: "Configurer la cagnotte" }} />

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Cagnotte activée</Text>
          <Text style={styles.hint}>
            Les invités pourront contribuer par carte bancaire
          </Text>
        </View>
        <Switch
          value={active}
          onValueChange={setActive}
          trackColor={{ true: colors.success }}
        />
      </View>

      {/* ── Ce que l'organisateur s'engage à faire ────────────────────────
          Posé ICI, juste après l'interrupteur, et non enterré dans les CGU :
          ouvrir une cagnotte crée une obligation de remboursement en cas
          d'annulation, et cette obligation coûte de l'argent. La découvrir au
          moment d'annuler serait la découvrir trop tard. */}
      {active && (
        <View style={styles.commitBox}>
          <Text style={styles.commitTitle}>Ce que tu t'engages à faire</Text>
          <Text style={styles.commitText}>
            L'argent arrive directement sur ton compte Stripe : BirthReminder ne
            le détient jamais et n'intervient à aucun moment sur les fonds. Tu
            restes le seul responsable de la cagnotte vis-à-vis des
            contributeurs.
          </Text>
          <Text style={styles.commitText}>
            À savoir : si tu rembourses une contribution, les frais prélevés lors
            du paiement d'origine ne te sont pas restitués par Stripe.
          </Text>
          <View style={styles.commitLinks}>
            <Text
              style={styles.commitLink}
              onPress={() =>
                WebBrowser.openBrowserAsync(
                  "https://stripe.com/fr/legal/connect-account"
                )
              }
            >
              Contrat de compte Stripe Connect
            </Text>
            <Text
              style={styles.commitLink}
              onPress={() =>
                WebBrowser.openBrowserAsync("https://stripe.com/fr/legal/ssa")
              }
            >
              Conditions des services Stripe
            </Text>
          </View>
        </View>
      )}

      {active && (
        <>
          <Text style={styles.label}>Mode</Text>
          <View style={styles.modeSwitch}>
            <Pressable
              style={[styles.modeBtn, mode === "free" && styles.modeBtnActive]}
              onPress={() => setMode("free")}
            >
              <Text
                style={[styles.modeText, mode === "free" && styles.modeTextActive]}
              >
                🆓 Libre
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, mode === "goal" && styles.modeBtnActive]}
              onPress={() => setMode("goal")}
            >
              <Text
                style={[styles.modeText, mode === "goal" && styles.modeTextActive]}
              >
                🎯 Objectif
              </Text>
            </Pressable>
          </View>

          {mode === "goal" && (
            <>
              <Text style={styles.label}>Objectif (€)</Text>
              <TextInput
                placeholderTextColor={colors.placeholder}
                style={styles.input}
                placeholder="ex : 150"
                keyboardType="decimal-pad"
                value={goal}
                onChangeText={setGoal}
              />
            </>
          )}

          <Text style={styles.label}>Date limite (optionnel)</Text>
          <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
            <Text style={styles.inputText}>
              {deadline
                ? deadline.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Aucune — appuyer pour choisir"}
            </Text>
          </Pressable>
          {deadline && (
            <Pressable onPress={() => setDeadline(null)}>
              <Text style={styles.clearDeadline}>Retirer la date limite</Text>
            </Pressable>
          )}
          {showPicker && (
            <View style={{ alignItems: "center", width: "100%" }}>
              <DateTimePicker
                value={deadline ?? new Date()}
                mode="date"
                minimumDate={new Date()}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                locale="fr-FR"
                themeVariant={resolved}
                onChange={(e, d) => {
                  if (Platform.OS === "android") setShowPicker(false);
                  if (d && e.type !== "dismissed") setDeadline(d);
                }}
              />
            </View>
          )}
        </>
      )}

      {/* ── Remboursement ──────────────────────────────────────────────────
          Visible dès qu'il y a quelque chose à rembourser, que la cagnotte soit
          encore ouverte ou déjà fermée par une annulation ou un transfert :
          c'est précisément dans ces deux cas qu'on en a besoin. */}
      {(preview?.count ?? 0) > 0 && (
        <>
          <View style={styles.dtDivider} />
          <Text style={styles.dtTitle}>💸 Rembourser les contributeurs</Text>
          <Text style={styles.hint}>
            {preview!.count} contribution{preview!.count > 1 ? "s" : ""} —{" "}
            {(preview!.totalRefunded / 100).toFixed(2)} € seront intégralement
            rendus à leurs auteurs.
          </Text>
          {/* ⚠️ Le chiffre qui compte pour LUI. Stripe ne restitue pas les frais
              de la transaction d'origine : le contributeur récupère tout, et
              l'écart reste à la charge de l'organisateur. Le découvrir après
              coup serait une mauvaise surprise. */}
          <Text style={styles.refundWarn}>
            ⚠️ Cette opération te coûtera{" "}
            {preview!.estimatedCount > 0 ? "environ " : ""}
            {(preview!.feeLoss / 100).toFixed(2)} € : Stripe ne rend pas les
            frais des paiements d'origine.
          </Text>
          {/* Les frais dépendent de la carte utilisée par chaque contributeur
              — 1,5 % pour une carte européenne standard, jusqu'à 3,15 % plus
              conversion pour une carte étrangère. On les relève désormais à
              l'encaissement ; pour les contributions plus anciennes, il ne
              reste qu'une estimation, et l'annoncer comme un chiffre exact
              serait mentir sur une opération irréversible. */}
          {preview!.estimatedCount > 0 && (
            <Text style={styles.refundNote}>
              {preview!.estimatedCount} contribution
              {preview!.estimatedCount > 1 ? "s" : ""} sur {preview!.count} est
              chiffrée au tarif d'une carte européenne standard. Le coût réel
              peut être plus élevé si le paiement venait d'une carte
              professionnelle ou étrangère.
            </Text>
          )}
          <Pressable
            style={[styles.refundBtn, refunding && { opacity: 0.5 }]}
            disabled={refunding}
            onPress={onRefundAll}
          >
            <Text style={styles.refundBtnText}>
              {refunding
                ? "Remboursement en cours…"
                : "Rembourser tout le monde"}
            </Text>
          </Pressable>
        </>
      )}

      {/* ── Virement direct — indépendant de la cagnotte Stripe ── */}
      <View style={styles.dtDivider} />
      <Text style={styles.dtTitle}>💳 Virement direct</Text>
      <Text style={styles.hint}>
        Propose ton IBAN et/ou ton lien PayPal : les invités t'envoient
        l'argent directement, sans activer de cagnotte.
      </Text>

      <View style={[styles.switchRow, { marginTop: 6 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Proposer un IBAN</Text>
          <Text style={styles.hint}>Visible par les invités connectés</Text>
        </View>
        <Switch
          value={ibanEnabled}
          onValueChange={setIbanEnabled}
          trackColor={{ true: colors.success }}
        />
      </View>

      {ibanEnabled && (
        <>
          <TextInput
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            placeholder="FR76 3000 4000 0500 0012 3456 789"
            autoCapitalize="characters"
            autoCorrect={false}
            value={iban}
            onChangeText={setIban}
          />
          <TextInput
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            placeholder="Nom du titulaire (optionnel)"
            value={holderName}
            onChangeText={setHolderName}
          />
          <Text style={styles.label}>Visible pendant</Text>
          <View style={styles.modeSwitch}>
            {IBAN_DURATIONS.map((d) => (
              <Pressable
                key={d}
                style={[styles.modeBtn, ibanDuration === d && styles.modeBtnActive]}
                onPress={() => setIbanDuration(d)}
              >
                <Text
                  style={[
                    styles.modeText,
                    ibanDuration === d && styles.modeTextActive,
                  ]}
                >
                  {d}j
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>
            🔒 L'IBAN est chiffré et supprimé automatiquement après ce délai.
          </Text>
        </>
      )}

      <View style={[styles.switchRow, { marginTop: 10 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Proposer PayPal</Text>
          <Text style={styles.hint}>Lien PayPal.Me public</Text>
        </View>
        <Switch
          value={paypalEnabled}
          onValueChange={setPaypalEnabled}
          trackColor={{ true: colors.success }}
        />
      </View>

      {paypalEnabled && (
        <TextInput
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          placeholder="https://paypal.me/tonpseudo"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={paypalLink}
          onChangeText={setPaypalLink}
        />
      )}

      <View style={[styles.switchRow, { marginTop: 10 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Cagnotte sur un autre service</Text>
          <Text style={styles.hint}>Leetchi, Lydia, Le Pot Commun…</Text>
        </View>
        <Switch
          value={externalEnabled}
          onValueChange={setExternalEnabled}
          trackColor={{ true: colors.success }}
        />
      </View>

      {externalEnabled && (
        <>
          <TextInput
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            placeholder="https://www.leetchi.com/c/..."
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={externalUrl}
            onChangeText={setExternalUrl}
          />
          <TextInput
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            placeholder="Nom affiché (optionnel)"
            maxLength={60}
            value={externalLabel}
            onChangeText={setExternalLabel}
          />
          {/* Dit une fois, clairement, ce que ça implique pour lui. */}
          <Text style={styles.hint}>
            La collecte se déroule entièrement sur le service choisi.
            BirthReminder n'en voit ni les montants ni les participants, ne peut
            rien confirmer en cas de litige et ne pourra rien rembourser : tes
            invités devront s'adresser à toi, ou à ce service.
          </Text>
        </>
      )}

      {!stripeNotReady && balance?.connected && (
        <View style={styles.balanceBox}>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Disponible</Text>
            <Text style={styles.balanceValue}>
              {((balance.availableCents ?? 0) / 100).toFixed(2)} €
            </Text>
          </View>
          {(balance.pendingCents ?? 0) > 0 && (
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>En attente de règlement</Text>
              <Text style={styles.balanceValue}>
                {((balance.pendingCents ?? 0) / 100).toFixed(2)} €
              </Text>
            </View>
          )}

          <Text style={styles.balanceNote}>
            {balance.payouts && balance.payouts.length > 0
              ? `Dernier virement : ${(balance.payouts[0].amount / 100).toFixed(2)} €${
                  balance.payouts[0].arrivalDate
                    ? ` — arrivée le ${new Date(balance.payouts[0].arrivalDate).toLocaleDateString("fr-FR")}`
                    : ""
                }`
              : "Aucun virement pour l'instant. Stripe verse automatiquement sur ton compte bancaire selon son calendrier."}
          </Text>

          <Pressable
            style={[styles.dashBtn, openingDash && { opacity: 0.6 }]}
            disabled={openingDash}
            onPress={async () => {
              setOpeningDash(true);
              setError(null);
              try {
                const url = await stripeDashboardLink();
                await WebBrowser.openBrowserAsync(url);
              } catch (e: any) {
                setError(
                  e?.message ?? "Impossible d'ouvrir ton tableau de bord Stripe.",
                );
              } finally {
                setOpeningDash(false);
              }
            }}
          >
            {openingDash ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.dashBtnText}>Voir mes virements sur Stripe</Text>
            )}
          </Pressable>
          <Text style={styles.hint}>
            Solde, virements et coordonnées bancaires se gèrent depuis ton
            tableau de bord Stripe.
          </Text>
        </View>
      )}

      {stripeNotReady && (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            ⚠️ Pour encaisser la cagnotte, connecte ton compte Stripe (une
            seule fois, environ 5 minutes — identité et RIB demandés par
            Stripe).
          </Text>
          <Pressable
            style={[styles.stripeBtn, onboarding && { opacity: 0.6 }]}
            disabled={onboarding}
            onPress={connectStripe}
          >
            {onboarding ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.stripeBtnText}>
                🔗 Connecter mon compte Stripe
              </Text>
            )}
          </Pressable>
        </View>
      )}
      {error && !stripeNotReady && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        disabled={saving}
        onPress={save}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.saveText}>Enregistrer</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, gap: 8 },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
    },
    label: { fontSize: 13, fontWeight: "700", color: c.sub, marginTop: 10 },
    hint: { color: c.faint, fontSize: 12 },
    // Encadré d'engagement : ton informatif, pas alarmiste — il ne signale
    // pas un danger, il énonce ce à quoi on souscrit en activant.
    commitBox: {
      marginTop: 4,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgSecondary,
      gap: 8,
    },
    commitTitle: { fontWeight: "800", fontSize: 14, color: c.text },
    commitText: { fontSize: 13, lineHeight: 19, color: c.sub },
    balanceBox: {
      marginTop: 14,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgSecondary,
      gap: 4,
    },
    balanceRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 12,
    },
    balanceLabel: { fontSize: 13, color: c.sub },
    balanceValue: { fontSize: 16, fontWeight: "800", color: c.text },
    balanceNote: { fontSize: 12.5, lineHeight: 18, color: c.sub, marginTop: 4 },
    dashBtn: {
      marginTop: 10,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.primary,
      alignItems: "center",
    },
    dashBtnText: { color: c.primary, fontWeight: "700", fontSize: 14 },
    commitLinks: { gap: 4, marginTop: 2 },
    commitLink: {
      fontSize: 12.5,
      lineHeight: 18,
      color: c.primary,
      fontWeight: "600",
      textDecorationLine: "underline",
    },
    refundNote: { fontSize: 12, lineHeight: 17, marginTop: 8 },
    refundWarn: {
      color: c.warning,
      fontSize: 12.5,
      lineHeight: 17,
      marginTop: 6,
      fontWeight: "600",
    },
    refundBtn: {
      marginTop: 10,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.danger,
      alignItems: "center",
    },
    refundBtnText: { color: c.danger, fontWeight: "700", fontSize: 14 },
    dtDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginTop: 20,
      marginBottom: 6,
    },
    dtTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: c.text,
      marginTop: 4,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 14,
    },
    switchLabel: { fontSize: 15, fontWeight: "600", color: c.text },
    modeSwitch: {
      flexDirection: "row",
      backgroundColor: c.bgSecondary,
      borderRadius: 10,
      padding: 3,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 8,
      alignItems: "center",
    },
    modeBtnActive: { backgroundColor: c.card, elevation: 1 },
    modeText: { fontSize: 13, fontWeight: "600", color: c.sub },
    modeTextActive: { color: c.text },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      backgroundColor: c.inputBg,
      color: c.text,
    },
    inputText: { fontSize: 15, color: c.text },
    clearDeadline: { color: c.danger, fontSize: 12, textAlign: "center" },
    warn: { backgroundColor: c.warningSoft, borderRadius: 10, padding: 12 },
    warnText: { color: c.warningStrong, fontSize: 13, lineHeight: 18 },
    stripeBtn: {
      backgroundColor: STRIPE_PURPLE,
      borderRadius: 10,
      padding: 12,
      alignItems: "center",
      marginTop: 10,
    },
    stripeBtnText: { color: c.white, fontWeight: "700" },
    error: { color: c.danger, textAlign: "center", marginTop: 8 },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      padding: 14,
      alignItems: "center",
      marginTop: 12,
    },
    saveText: { color: c.white, fontWeight: "700", fontSize: 15 },
  });
