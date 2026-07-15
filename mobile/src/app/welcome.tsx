import { useEffect, useMemo, useRef, useState } from "react";
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
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../lib/auth-context";
import { useTheme } from "../lib/theme-context";
import { fetchPublicStats, PublicStats } from "../lib/stats";
import { hasSeenWelcome, markWelcomeSeen } from "../lib/welcome-gate";

const LOGO_MARK = require("../../assets/images/logo-mark.png"); // B bougie — lisible sur les deux thèmes
// Calques du logo pour l'animation d'ouverture (découpés du SVG)
const LOGO_B = require("../../assets/images/logo-b.png");
const LOGO_WAX = require("../../assets/images/logo-wax.png");
const LOGO_FLAME = require("../../assets/images/logo-flame.png");
const LOGO_GLOW = require("../../assets/images/logo-glow.png");

const GRADIENT = ["#3b82f6", "#8b5cf6", "#ec4899"] as const;

// ─── Thèmes ─────────────────────────────────────────────────────────────────
// Palettes visuelles propres au welcome (plus riches que le thème global).
// La sélection dark/light est pilotée par le ThemeContext global.
const THEMES = {
  dark: {
    bg: "#0b1120",
    card: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.09)",
    text: "#f1f5f9",
    sub: "#94a3b8",
    faint: "#475569",
    statValue: "#c7d2fe",
    toggleBg: "rgba(255,255,255,0.08)",
    secondaryBorder: "rgba(255,255,255,0.25)",
    secondaryText: "#e2e8f0",
  },
  light: {
    bg: "#f6f7fb",
    card: "#ffffff",
    border: "#e5e7ef",
    text: "#0f172a",
    sub: "#64748b",
    faint: "#94a3b8",
    statValue: "#4f46e5",
    toggleBg: "#ffffff",
    secondaryBorder: "#c7d2fe",
    secondaryText: "#4f46e5",
  },
} as const;

type ThemeName = keyof typeof THEMES;
type Theme = (typeof THEMES)[ThemeName];

const FEATURES = [
  { emoji: "🔔", title: "Rappels intelligents", text: "Anniversaires et fêtes, notifiés au bon moment. Plus jamais d'oubli." },
  { emoji: "📅", title: "Agenda", text: "Vue mois ou semaine, toutes vos dates importantes d'un coup d'œil." },
  { emoji: "🎉", title: "Événements", text: "Votes pour la date et le lieu, invitations, chat de groupe en temps réel." },
  { emoji: "🎁", title: "Wishlist & cadeaux", text: "Partagez vos envies et trouvez le cadeau parfait, ensemble." },
  { emoji: "💬", title: "Messagerie", text: "Discutez avec vos amis directement dans l'app, en privé." },
];

const STEPS = [
  { num: "1", title: "Ajoutez vos proches", text: "Anniversaires, fêtes, ou connectez-vous avec vos amis inscrits." },
  { num: "2", title: "Recevez vos rappels", text: "Notification la veille et le jour J — plus jamais d'oubli." },
  { num: "3", title: "Célébrez ensemble", text: "Organisez un événement, discutez et choisissez le cadeau à plusieurs." },
];

// ─── Emojis flottants du hero ───────────────────────────────────────────────
const FLOATERS = [
  { emoji: "🎂", left: "8%", top: 10, size: 26, delay: 0, duration: 2600 },
  { emoji: "🎈", left: "82%", top: 24, size: 24, delay: 600, duration: 3100 },
  { emoji: "✨", left: "70%", top: 120, size: 20, delay: 1200, duration: 2300 },
  { emoji: "🎁", left: "14%", top: 130, size: 22, delay: 900, duration: 2900 },
  { emoji: "🥳", left: "88%", top: 92, size: 20, delay: 300, duration: 2700 },
] as const;

function FloatingEmoji({
  emoji,
  left,
  top,
  size,
  delay,
  duration,
}: (typeof FLOATERS)[number]) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay, duration]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.65, 0.3] });

  return (
    <Animated.Text
      style={{ position: "absolute", left, top, fontSize: size, opacity, transform: [{ translateY }] }}
      pointerEvents="none"
    >
      {emoji}
    </Animated.Text>
  );
}

// ─── Splash animé ───────────────────────────────────────────────────────────
function AnimatedSplash({ bg, onDone }: { bg: string; onDone: () => void }) {
  // Séquence : le B monte → la cire apparaît → la flamme s'allume (halo)
  // et vacille → fondu vers la page.
  const bOpacity = useRef(new Animated.Value(0)).current;
  const bShift = useRef(new Animated.Value(36)).current;
  const waxOpacity = useRef(new Animated.Value(0)).current;
  const flameIn = useRef(new Animated.Value(0)).current;
  const flicker = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const flickerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 1, duration: 240, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    Animated.sequence([
      // 1. Le B monte en fondu
      Animated.parallel([
        Animated.timing(bOpacity, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(bShift, { toValue: 0, friction: 7, tension: 70, useNativeDriver: true }),
      ]),
      // 2. La cire coule
      Animated.timing(waxOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      // 3. La flamme s'allume + halo
      Animated.parallel([
        Animated.spring(flameIn, { toValue: 1, friction: 5, tension: 110, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 380, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
      Animated.delay(750),
      // 4. Fondu vers la page
      Animated.timing(overlayOpacity, { toValue: 0, duration: 450, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => onDone());
    flickerLoop.start();
    return () => flickerLoop.stop();
  }, [bOpacity, bShift, waxOpacity, flameIn, flicker, glow, overlayOpacity, onDone]);

  const layer = { position: "absolute" as const, width: 150, height: 232 };
  const flameFlickerY = flicker.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] });
  const flameFlickerScale = flicker.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const flameRise = flameIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const glowOpacity = Animated.multiply(
    glow,
    flicker.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.6] }),
  );
  const glowScale = flicker.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.08] });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { backgroundColor: bg, alignItems: "center", justifyContent: "center", zIndex: 10, opacity: overlayOpacity }]}
      pointerEvents="none"
    >
      <View style={{ width: 150, height: 232 }}>
        {/* Halo derrière la flamme (coin haut-gauche du canevas) */}
        <Animated.Image
          source={LOGO_GLOW}
          style={{
            position: "absolute",
            left: -44,
            top: -34,
            width: 140,
            height: 140,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          }}
          resizeMode="contain"
        />
        {/* Le B */}
        <Animated.Image
          source={LOGO_B}
          style={[layer, { opacity: bOpacity, transform: [{ translateY: bShift }] }]}
          resizeMode="contain"
        />
        {/* La cire */}
        <Animated.Image
          source={LOGO_WAX}
          style={[layer, { opacity: waxOpacity }]}
          resizeMode="contain"
        />
        {/* La flamme */}
        <Animated.Image
          source={LOGO_FLAME}
          style={[
            layer,
            {
              opacity: flameIn,
              transform: [
                { translateY: Animated.add(flameRise, flameFlickerY) },
                { scale: flameFlickerScale },
              ],
            },
          ]}
          resizeMode="contain"
        />
      </View>
    </Animated.View>
  );
}

// ─── Écran ──────────────────────────────────────────────────────────────────
export default function WelcomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { resolved, setMode } = useTheme();
  const { width } = useWindowDimensions();
  // Splash animé uniquement au lancement de l'app — pas quand on revient
  // sur l'accueil via le logo ou la navigation.
  const [splashDone, setSplashDone] = useState(() => hasSeenWelcome());
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [statsError, setStatsError] = useState(false);

  const mode: ThemeName = resolved;
  const t = THEMES[mode];
  const s = useMemo(() => makeStyles(t), [t]);
  const featureCardWidth = Math.min(250, width * 0.62);

  useEffect(() => {
    fetchPublicStats().then(setStats).catch(() => setStatsError(true));
  }, []);

  const go = (path: string) => {
    markWelcomeSeen();
    router.replace(path as never);
  };

  const Cta = user ? (
    <>
      <Text style={s.hello}>Bienvenue {user.name} 👋</Text>
      <Pressable onPress={() => go("/")} style={({ pressed }) => pressed && { opacity: 0.8 }}>
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtn}>
          <Text style={s.primaryText}>Commencer 🎉</Text>
        </LinearGradient>
      </Pressable>
    </>
  ) : (
    <>
      <Pressable onPress={() => go("/login")} style={({ pressed }) => pressed && { opacity: 0.8 }}>
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtn}>
          <Text style={s.primaryText}>Se connecter</Text>
        </LinearGradient>
      </Pressable>
      <Pressable style={({ pressed }) => [s.secondaryBtn, pressed && { opacity: 0.7 }]} onPress={() => go("/signup")}>
        <Text style={s.secondaryText}>Créer un compte gratuitement</Text>
      </Pressable>
    </>
  );

  return (
    <View style={s.flex}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <SafeAreaView style={s.flex} edges={["top", "bottom"]}>
        {/* Toggle thème */}
        <Pressable
          style={s.themeToggle}
          onPress={() => setMode(mode === "dark" ? "light" : "dark")}
          hitSlop={10}
        >
          <Text style={s.themeToggleIcon}>{mode === "dark" ? "☀️" : "🌙"}</Text>
        </Pressable>

        <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
          {/* ── Hero : logo + emojis flottants ── */}
          <View style={s.hero}>
            {FLOATERS.map((f) => (
              <FloatingEmoji key={f.emoji} {...f} />
            ))}
            <Image source={LOGO_MARK} style={s.heroLogo} resizeMode="contain" />
            <Text style={s.brand}>
              Birth<Text style={s.brandAccent}>Reminder</Text>
            </Text>
          </View>
          <Text style={s.tagline}>N'oubliez plus jamais un anniversaire</Text>
          <Text style={s.subTagline}>
            Rappels, agenda, événements et cadeaux — tout au même endroit, entre amis.
          </Text>

          {/* ── Stats : layout bento ── */}
          <Text style={s.sectionLabel}>🌍 SUR TOUTE LA COMMUNAUTÉ</Text>
          {statsError ? (
            <Text style={s.statsError}>Impossible de charger les stats pour le moment.</Text>
          ) : (
            <>
              <View style={s.bentoRow}>
                <LinearGradient
                  colors={GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.bentoBig}
                >
                  <Text style={s.bentoBigEmoji}>🎂</Text>
                  {stats === null ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.bentoBigValue}>{stats.today}</Text>
                  )}
                  <Text style={s.bentoBigLabel}>
                    anniversaire{stats && stats.today > 1 ? "s" : ""} aujourd'hui
                  </Text>
                </LinearGradient>

                <View style={s.bentoCol}>
                  <View style={s.bentoSmall}>
                    <Text style={s.bentoSmallEmoji}>📅</Text>
                    {stats === null ? (
                      <ActivityIndicator size="small" color="#8b5cf6" />
                    ) : (
                      <Text style={s.bentoSmallValue}>{stats.thisMonth}</Text>
                    )}
                    <Text style={s.bentoSmallLabel}>ce mois-ci</Text>
                  </View>
                  <View style={s.bentoSmall}>
                    <Text style={s.bentoSmallEmoji}>🗓️</Text>
                    {stats === null ? (
                      <ActivityIndicator size="small" color="#8b5cf6" />
                    ) : (
                      <Text style={s.bentoSmallValue}>{stats.thisYear}</Text>
                    )}
                    <Text style={s.bentoSmallLabel}>cette année</Text>
                  </View>
                </View>
              </View>

              <View style={s.bentoWide}>
                <Text style={s.bentoSmallEmoji}>👥</Text>
                <Text style={s.bentoWideText}>
                  {stats === null ? "…" : stats.totalUsers} membres inscrits — et la fête ne fait que commencer
                </Text>
              </View>
            </>
          )}

          {/* ── CTA sous les stats ── */}
          <View style={s.ctaBlock}>{Cta}</View>

          {/* ── Points forts : carrousel horizontal ── */}
          <Text style={s.sectionTitle}>Tout pour ne rien oublier</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={featureCardWidth + 12}
            decelerationRate="fast"
            contentContainerStyle={s.carousel}
            style={s.carouselWrap}
          >
            {FEATURES.map((f) => (
              <View key={f.title} style={[s.featureCard, { width: featureCardWidth }]}>
                <View style={s.featureIconBubble}>
                  <Text style={s.featureEmoji}>{f.emoji}</Text>
                </View>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureText}>{f.text}</Text>
              </View>
            ))}
          </ScrollView>

          {/* ── Comment ça marche : timeline verticale ── */}
          <Text style={s.sectionTitle}>Comment ça marche ?</Text>
          <View style={s.timeline}>
            {STEPS.map((step, i) => (
              <View key={step.num} style={s.timelineRow}>
                <View style={s.timelineLeft}>
                  <LinearGradient
                    colors={GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.timelineDot}
                  >
                    <Text style={s.timelineNum}>{step.num}</Text>
                  </LinearGradient>
                  {i < STEPS.length - 1 && <View style={s.timelineLine} />}
                </View>
                <View style={s.timelineContent}>
                  <Text style={s.stepTitle}>{step.title}</Text>
                  <Text style={s.stepText}>{step.text}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ── Bandeau événements ── */}
          <LinearGradient
            colors={["rgba(59,130,246,0.16)", "rgba(236,72,153,0.16)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.banner}
          >
            <Text style={s.bannerEmoji}>🥳</Text>
            <View style={s.flexOnly}>
              <Text style={s.bannerTitle}>Organisez le prochain anniversaire</Text>
              <Text style={s.bannerText}>
                Créez un événement, invitez vos amis (même sans compte) et décidez ensemble de la date, du lieu et du cadeau.
              </Text>
            </View>
          </LinearGradient>

          <Text style={s.footer}>birthreminder.com</Text>
        </ScrollView>
      </SafeAreaView>

      {!splashDone && <AnimatedSplash bg={t.bg} onDone={() => setSplashDone(true)} />}
    </View>
  );
}

// ─── Styles thémés ──────────────────────────────────────────────────────────
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: t.bg },
    flexOnly: { flex: 1 },
    container: { padding: 24, paddingTop: 8, paddingBottom: 48 },

    // Toggle
    themeToggle: {
      position: "absolute",
      top: 54,
      right: 20,
      zIndex: 5,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.toggleBg,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: "center",
      justifyContent: "center",
    },
    themeToggleIcon: { fontSize: 18 },

    // Hero
    hero: { alignItems: "center", paddingTop: 26, paddingBottom: 6 },
    heroLogo: { width: 110, height: 170 },
    brand: { fontSize: 30, fontWeight: "800", color: t.text, marginTop: 10 },
    brandAccent: { color: "#8b5cf6" },
    tagline: { fontSize: 21, fontWeight: "800", color: t.text, textAlign: "center", marginTop: 14 },
    subTagline: { fontSize: 14, color: t.sub, textAlign: "center", marginTop: 8, marginBottom: 30, lineHeight: 20 },

    // Stats bento
    sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: t.sub, textAlign: "center", marginBottom: 12 },
    statsError: { color: t.sub, textAlign: "center", marginBottom: 24, fontStyle: "italic" },
    bentoRow: { flexDirection: "row", gap: 12 },
    bentoBig: { flex: 1.15, borderRadius: 22, padding: 18, justifyContent: "center", alignItems: "center", gap: 4 },
    bentoBigEmoji: { fontSize: 30 },
    bentoBigValue: { fontSize: 46, fontWeight: "900", color: "#fff" },
    bentoBigLabel: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.9)", textAlign: "center" },
    bentoCol: { flex: 1, gap: 12 },
    bentoSmall: {
      flex: 1,
      backgroundColor: t.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      gap: 2,
    },
    bentoSmallEmoji: { fontSize: 18 },
    bentoSmallValue: { fontSize: 24, fontWeight: "800", color: t.statValue },
    bentoSmallLabel: { fontSize: 11, color: t.sub },
    bentoWide: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: t.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      marginTop: 12,
    },
    bentoWideText: { flex: 1, fontSize: 13, color: t.sub, fontWeight: "600" },

    // CTA
    ctaBlock: { marginTop: 20 },
    hello: { fontSize: 17, fontWeight: "600", color: t.text, textAlign: "center", marginBottom: 12 },
    primaryBtn: { borderRadius: 14, padding: 17, alignItems: "center" },
    primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: t.secondaryBorder,
      borderRadius: 14,
      padding: 15,
      alignItems: "center",
      marginTop: 10,
      backgroundColor: t.card,
    },
    secondaryText: { color: t.secondaryText, fontWeight: "600", fontSize: 15 },

    // Sections
    sectionTitle: { fontSize: 19, fontWeight: "800", color: t.text, textAlign: "center", marginTop: 40, marginBottom: 16 },

    // Carrousel features
    carouselWrap: { marginHorizontal: -24 },
    carousel: { paddingHorizontal: 24, gap: 12 },
    featureCard: {
      backgroundColor: t.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.border,
      padding: 18,
      gap: 8,
    },
    featureIconBubble: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: "rgba(139,92,246,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    featureEmoji: { fontSize: 22 },
    featureTitle: { fontSize: 15, fontWeight: "700", color: t.text },
    featureText: { fontSize: 12.5, color: t.sub, lineHeight: 18 },

    // Timeline
    timeline: { gap: 0 },
    timelineRow: { flexDirection: "row", gap: 14 },
    timelineLeft: { alignItems: "center", width: 34 },
    timelineDot: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    timelineNum: { color: "#fff", fontWeight: "800", fontSize: 15 },
    timelineLine: { flex: 1, width: 2, backgroundColor: t.border, marginVertical: 4, borderRadius: 1 },
    timelineContent: { flex: 1, paddingBottom: 22 },
    stepTitle: { fontSize: 15, fontWeight: "700", color: t.text, marginTop: 6 },
    stepText: { fontSize: 13, color: t.sub, marginTop: 3, lineHeight: 18 },

    // Bandeau
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(139,92,246,0.35)",
      padding: 18,
      marginTop: 32,
    },
    bannerEmoji: { fontSize: 32 },
    bannerTitle: { fontSize: 15, fontWeight: "700", color: t.text },
    bannerText: { fontSize: 12.5, color: t.sub, marginTop: 4, lineHeight: 18 },

    // Footer
    footer: { textAlign: "center", color: t.faint, fontSize: 12, marginTop: 36 },
  });
