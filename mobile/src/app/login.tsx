import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useKeyboardPadding } from "../lib/use-keyboard-padding";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";
import LoginPanel from "../components/auth/LoginPanel";
import SignupPanel from "../components/auth/SignupPanel";
import ForgotPanel from "../components/auth/ForgotPanel";
import { PANELS, PanelName } from "../components/auth/authStyles";

/**
 * Écran d'authentification unifié.
 *
 * Les trois anciennes routes (/login, /signup, /forgot-password) sont
 * regroupées ici en un pager horizontal de trois panneaux, piloté par un
 * segmented control et par le balayage du doigt.
 *
 * Animation « glissé parallaxe » : le panneau entrant se déplace à pleine
 * vitesse, le panneau sortant traîne à ~46 % de la vitesse et s'estompe.
 * Tout est interpolé depuis le contentOffset du ScrollView → 100 % natif
 * (useNativeDriver), donc fluide même pendant un swipe.
 *
 * /signup et /forgot-password redirigent vers /login?panel=signup|forgot
 * pour ne casser ni les deep links ni la garde d'auth du _layout.
 */

const LOGO_LIGHT = require("../../assets/images/logo-light.png");
const LOGO_DARK = require("../../assets/images/logo-dark.png");

// Part de la largeur d'écran réellement parcourue par le panneau sortant.
// 1 = pas de parallaxe, 0 = le panneau sortant reste sur place.
const OUT_SPEED = 0.46;

const TABS: { key: PanelName; label: string }[] = [
  { key: "login", label: "Connexion" },
  { key: "signup", label: "Inscription" },
  { key: "forgot", label: "Oubli" },
];

const TAB_HEIGHT = 34;
const SEG_PAD = 3;

export default function AuthScreen() {
  const { colors, resolved } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const keyboardPadding = useKeyboardPadding();
  const params = useLocalSearchParams<{ panel?: string }>();

  const initialIndex = useMemo<number>(() => {
    const p = params.panel as PanelName | undefined;
    return p && p in PANELS ? PANELS[p] : PANELS.login;
  }, []); // volontairement figé : les changements de param sont gérés plus bas

  const pagerRef = useRef<any>(null);
  const didInitialScroll = useRef(false);
  const scrollX = useRef(new Animated.Value(initialIndex * width)).current;
  const [index, setIndex] = useState(initialIndex);
  const [segWidth, setSegWidth] = useState(0);

  const pillWidth = segWidth > 0 ? (segWidth - SEG_PAD * 2) / TABS.length : 0;

  const goTo = useCallback(
    (panel: PanelName) => {
      const i = PANELS[panel];
      setIndex(i);
      pagerRef.current?.scrollTo({ x: i * width, y: 0, animated: true });
    },
    [width],
  );

  // Deep link /login?panel=signup alors que l'écran est déjà monté
  const lastParam = useRef<string | undefined>(params.panel);
  useEffect(() => {
    if (params.panel === lastParam.current) return;
    lastParam.current = params.panel;
    const p = params.panel as PanelName | undefined;
    if (p && p in PANELS) goTo(p);
  }, [params.panel, goTo]);

  // Rotation / changement de largeur : on réaligne le pager sans animation
  useEffect(() => {
    pagerRef.current?.scrollTo({ x: index * width, y: 0, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const onScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: true },
      ),
    [scrollX],
  );

  // Position du curseur du segmented control, dérivée du scroll horizontal
  const pillTranslate = scrollX.interpolate({
    inputRange: [0, (TABS.length - 1) * width],
    outputRange: [0, (TABS.length - 1) * pillWidth],
    extrapolate: "clamp",
  });

  const panels = [
    <LoginPanel key="login" onGoTo={goTo} />,
    <SignupPanel key="signup" onGoTo={goTo} />,
    <ForgotPanel key="forgot" onGoTo={goTo} />,
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingBottom: keyboardPadding }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <View style={styles.brand}>
          <Image
            source={resolved === "dark" ? LOGO_DARK : LOGO_LIGHT}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="BirthReminder"
          />
        </View>

        <View style={styles.segWrap}>
          <View
            style={styles.seg}
            onLayout={(e) => setSegWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.pill,
                {
                  width: pillWidth,
                  transform: [{ translateX: pillTranslate }],
                },
              ]}
            />
            {TABS.map((tab, i) => {
              const activeOpacity = scrollX.interpolate({
                inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                outputRange: [0, 1, 0],
                extrapolate: "clamp",
              });
              return (
                <Pressable
                  key={tab.key}
                  style={styles.tab}
                  onPress={() => goTo(tab.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: index === i }}
                  accessibilityLabel={tab.label}
                >
                  <Text style={[styles.tabLabel, { color: colors.sub }]}>
                    {tab.label}
                  </Text>
                  {/* Calque actif : crossfade piloté par le scroll (natif) */}
                  <Animated.Text
                    style={[
                      styles.tabLabel,
                      styles.tabLabelOverlay,
                      { color: colors.primary, opacity: activeOpacity },
                    ]}
                  >
                    {tab.label}
                  </Animated.Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Animated.ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={onScroll}
          contentOffset={{ x: initialIndex * width, y: 0 }}
          // Android ignore parfois contentOffset : on repositionne une fois
          // le contenu mesuré si on doit démarrer sur un autre panneau.
          onContentSizeChange={() => {
            if (didInitialScroll.current || initialIndex === 0) return;
            didInitialScroll.current = true;
            pagerRef.current?.scrollTo({
              x: initialIndex * width,
              y: 0,
              animated: false,
            });
          }}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          style={styles.flex}
        >
          {panels.map((panel, i) => {
            // Le panneau situé à gauche du scroll traîne de (1 - OUT_SPEED)
            // écran : c'est ce décalage qui crée la parallaxe. Il empiète donc
            // sur le viewport du panneau voisin — d'où le fond opaque ci-dessous.
            // L'ordre de rendu du ScrollView (i croissant = au-dessus) suffit
            // à masquer le panneau qui traîne dans les deux sens de navigation.
            const translateX = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0, 0, width * (1 - OUT_SPEED)],
              extrapolate: "clamp",
            });
            return (
              <Animated.View
                key={i}
                style={[styles.page, { width, transform: [{ translateX }] }]}
              >
                {panel}
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.bg },
    // Fond opaque obligatoire : la parallaxe fait chevaucher deux panneaux.
    page: { backgroundColor: c.bg },
    brand: { alignItems: "center", paddingTop: 18, paddingBottom: 14 },
    // Ratio du wordmark 560×180 ≈ 3.11
    logo: { height: 40, aspectRatio: 560 / 180 },
    segWrap: { paddingHorizontal: 24, paddingBottom: 6 },
    seg: {
      flexDirection: "row",
      position: "relative",
      backgroundColor: c.bgSecondary,
      borderRadius: 11,
      padding: SEG_PAD,
    },
    pill: {
      position: "absolute",
      left: SEG_PAD,
      top: SEG_PAD,
      height: TAB_HEIGHT,
      borderRadius: 9,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    tab: { flex: 1, height: TAB_HEIGHT },
    tabLabel: {
      height: TAB_HEIGHT,
      lineHeight: TAB_HEIGHT,
      textAlign: "center",
      fontSize: 13,
      fontWeight: "600",
    },
    tabLabelOverlay: { position: "absolute", left: 0, right: 0, top: 0 },
  });
