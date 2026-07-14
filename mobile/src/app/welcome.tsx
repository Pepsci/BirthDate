import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../lib/auth-context";
import { fetchPublicStats, PublicStats } from "../lib/stats";
import { markWelcomeSeen } from "../lib/welcome-gate";

const LOGO_MARK = require("../../assets/images/logo-mark.png");
const LOGO_FULL = require("../../assets/images/logo-full-dark.png");

const GRADIENT = ["#3b82f6", "#8b5cf6", "#ec4899"] as const;

const FEATURES = [
  { emoji: "🔔", title: "Rappels intelligents", text: "Anniversaires et fêtes, notifiés au bon moment." },
  { emoji: "📅", title: "Agenda", text: "Vue mois ou semaine, toutes vos dates d'un coup d'œil." },
  { emoji: "🎉", title: "Événements", text: "Votes date & lieu, invitations, chat en temps réel." },
  { emoji: "🎁", title: "Wishlist & cadeaux", text: "Partagez vos envies, trouvez le cadeau parfait." },
];

const STEPS = [
  { num: "1", title: "Ajoutez vos proches", text: "Anniversaires, fêtes, ou connectez-vous avec vos amis inscrits." },
  { num: "2", title: "Recevez vos rappels", text: "Notification la veille et le jour J — plus jamais d'oubli." },
  { num: "3", title: "Célébrez ensemble", text: "Organisez un événement, discutez et choisissez le cadeau à plusieurs." },
];

function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      ]),
      Animated.delay(450),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => onDone());
  }, [logoOpacity, logoScale, overlayOpacity, onDone]);

  return (
    <Animated.View style={[styles.splashOverlay, { opacity: overlayOpacity }]} pointerEvents="none">
      <Animated.Image
        source={LOGO_MARK}
        style={[styles.splashLogo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

function StatCard({ emoji, value, label, highlight }: { emoji: string; value: number | null; label: string; highlight?: boolean }) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      {value === null ? (
        <ActivityIndicator size="small" color="#8b5cf6" />
      ) : (
        <Text style={[styles.statValue, highlight && styles.statValueHot]}>{value}</Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    fetchPublicStats().then(setStats).catch(() => setStatsError(true));
  }, []);

  const go = (path: string) => {
    markWelcomeSeen();
    router.replace(path as never);
  };

  return (
    <View style={styles.flex}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <Image source={LOGO_FULL} style={styles.heroLogo} resizeMode="contain" />
          <Text style={styles.tagline}>N'oubliez plus jamais un anniversaire</Text>
          <Text style={styles.subTagline}>
            Rappels, agenda, événements et cadeaux — tout au même endroit, entre amis.
          </Text>

          <Text style={styles.sectionLabel}>🌍 SUR TOUTE LA COMMUNAUTÉ</Text>
          {statsError ? (
            <Text style={styles.statsError}>Impossible de charger les stats pour le moment.</Text>
          ) : (
            <View style={styles.statsGrid}>
              <StatCard emoji="🎂" value={stats ? stats.today : null} label="Anniversaires aujourd'hui" highlight={!!stats && stats.today > 0} />
              <StatCard emoji="📅" value={stats ? stats.thisMonth : null} label="Ce mois-ci" />
              <StatCard emoji="🗓️" value={stats ? stats.thisYear : null} label="Cette année" />
              <StatCard emoji="🎉" value={stats ? stats.totalUsers : null} label="Membres inscrits" />
            </View>
          )}

          {user ? (
            <>
              <Text style={styles.hello}>Bienvenue {user.name} 👋</Text>
              <Pressable onPress={() => go("/")} style={({ pressed }) => pressed && { opacity: 0.8 }}>
                <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
                  <Text style={styles.primaryText}>Commencer 🎉</Text>
                </LinearGradient>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={() => go("/login")} style={({ pressed }) => pressed && { opacity: 0.8 }}>
                <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
                  <Text style={styles.primaryText}>Se connecter</Text>
                </LinearGradient>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]} onPress={() => go("/signup")}>
                <Text style={styles.secondaryText}>Créer un compte gratuitement</Text>
              </Pressable>
            </>
          )}

          <Text style={styles.sectionTitle}>Tout pour ne rien oublier</Text>
          <View style={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <View style={styles.featureIconBubble}>
                  <Text style={styles.featureEmoji}>{f.emoji}</Text>
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Comment ça marche ?</Text>
          <View style={styles.steps}>
            {STEPS.map((s) => (
              <View key={s.num} style={styles.stepRow}>
                <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stepBadge}>
                  <Text style={styles.stepNum}>{s.num}</Text>
                </LinearGradient>
                <View style={styles.flex}>
                  <Text style={styles.stepTitle}>{s.title}</Text>
                  <Text style={styles.stepText}>{s.text}</Text>
                </View>
              </View>
            ))}
          </View>

          <LinearGradient
            colors={["rgba(59,130,246,0.18)", "rgba(236,72,153,0.18)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.banner}
          >
            <Text style={styles.bannerEmoji}>🥳</Text>
            <View style={styles.flex}>
              <Text style={styles.bannerTitle}>Organisez le prochain anniversaire</Text>
              <Text style={styles.bannerText}>
                Créez un événement, invitez vos amis (même sans compte) et décidez ensemble de la date, du lieu et du cadeau.
              </Text>
            </View>
          </LinearGradient>

          <Text style={styles.footer}>birthreminder.com</Text>
        </ScrollView>
      </SafeAreaView>

      {!splashDone && <AnimatedSplash onDone={() => setSplashDone(true)} />}
    </View>
  );
}

const BG = "#0b1120";
const CARD_BG = "rgba(255,255,255,0.05)";
const CARD_BORDER = "rgba(255,255,255,0.09)";

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BG },
  container: { padding: 24, paddingBottom: 48 },
  splashOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: BG, alignItems: "center", justifyContent: "center", zIndex: 10 },
  splashLogo: { width: 150, height: 232 },
  heroLogo: { width: 190, height: 223, alignSelf: "center", marginTop: 4 },
  tagline: { fontSize: 22, fontWeight: "800", color: "#f1f5f9", textAlign: "center", marginTop: 18 },
  subTagline: { fontSize: 14, color: "#94a3b8", textAlign: "center", marginTop: 8, marginBottom: 30, lineHeight: 20 },
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: "#94a3b8", textAlign: "center", marginBottom: 12 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  statCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: CARD_BG, borderRadius: 18, borderWidth: 1, borderColor: CARD_BORDER, paddingVertical: 18, paddingHorizontal: 10, alignItems: "center", gap: 4 },
  statCardHighlight: { borderColor: "#f59e0b" },
  statEmoji: { fontSize: 24 },
  statValue: { fontSize: 28, fontWeight: "800", color: "#c7d2fe" },
  statValueHot: { color: "#f59e0b" },
  statLabel: { fontSize: 11, color: "#94a3b8", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 },
  statsError: { color: "#94a3b8", textAlign: "center", marginBottom: 24, fontStyle: "italic" },
  hello: { fontSize: 17, fontWeight: "600", color: "#f1f5f9", textAlign: "center", marginBottom: 12 },
  primaryBtn: { borderRadius: 14, padding: 17, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 14, padding: 15, alignItems: "center", marginTop: 10 },
  secondaryText: { color: "#e2e8f0", fontWeight: "600", fontSize: 15 },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: "#f1f5f9", textAlign: "center", marginTop: 40, marginBottom: 16 },
  featuresGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  featureCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: CARD_BG, borderRadius: 18, borderWidth: 1, borderColor: CARD_BORDER, padding: 16, gap: 8 },
  featureIconBubble: { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(139,92,246,0.18)", alignItems: "center", justifyContent: "center" },
  featureEmoji: { fontSize: 22 },
  featureTitle: { fontSize: 14, fontWeight: "700", color: "#f1f5f9" },
  featureText: { fontSize: 12, color: "#94a3b8", lineHeight: 17 },
  steps: { gap: 14 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 14, backgroundColor: CARD_BG, borderRadius: 18, borderWidth: 1, borderColor: CARD_BORDER, padding: 16 },
  stepBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  stepNum: { color: "#fff", fontWeight: "800", fontSize: 15 },
  stepTitle: { fontSize: 15, fontWeight: "700", color: "#f1f5f9" },
  stepText: { fontSize: 13, color: "#94a3b8", marginTop: 3, lineHeight: 18 },
  banner: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 18, borderWidth: 1, borderColor: "rgba(139,92,246,0.35)", padding: 18, marginTop: 40 },
  bannerEmoji: { fontSize: 32 },
  bannerTitle: { fontSize: 15, fontWeight: "700", color: "#f1f5f9" },
  bannerText: { fontSize: 12.5, color: "#cbd5e1", marginTop: 4, lineHeight: 18 },
  footer: { textAlign: "center", color: "#475569", fontSize: 12, marginTop: 36 },
});
