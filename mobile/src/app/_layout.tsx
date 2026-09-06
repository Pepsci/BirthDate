import { useEffect, useRef, useState } from "react";
import {
  Stack,
  Redirect,
  usePathname,
  useRouter,
  useRootNavigationState,
} from "expo-router";
import * as Notifications from "expo-notifications";
import { webLinkToMobileRoute } from "../lib/push";
import {
  registerBackgroundNotifTask,
  subscribeForegroundDecrypt,
} from "../lib/notif-decrypt";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import HeaderBackButton from "../components/HeaderBackButton";
import AppStackHeader from "../components/AppStackHeader";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { UnreadProvider } from "../lib/unread-context";
import { ThemeProvider, useTheme } from "../lib/theme-context";
import { hasSeenWelcome, markWelcomeSeen } from "../lib/welcome-gate";

function RootNavigator() {
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  // ⚠️ Au cold start (app lancée par un tap sur une notification), le listener
  // se déclenche AVANT que le <Stack> soit monté : router.push lève alors une
  // exception (« Attempted to navigate before mounting the Root Layout ») qui
  // fige l'app sur le splash (écran bleu). On mémorise donc la route cible et
  // on ne navigue que lorsque le navigateur est prêt ET l'auth chargée.
  const navigationReady = !!useRootNavigationState()?.key;
  const [pendingNotifRoute, setPendingNotifRoute] = useState<string | null>(
    null,
  );
  const handledNotifIds = useRef<Set<string>>(new Set());

  // Tap sur une notification → on note la destination (navigation différée)
  useEffect(() => {
    const handleResponse = (
      response: Notifications.NotificationResponse | null,
    ) => {
      if (!response) return;
      // iOS déclenche le listener AU cold start en plus de
      // getLastNotificationResponseAsync → dédoublonnage par identifiant.
      const id = response.notification.request.identifier;
      if (handledNotifIds.current.has(id)) return;
      handledNotifIds.current.add(id);

      const url = response.notification.request.content.data?.url as
        | string
        | undefined;
      markWelcomeSeen(); // deep link : ne pas détourner vers /welcome
      setPendingNotifRoute(webLinkToMobileRoute(url));
    };

    const sub =
      Notifications.addNotificationResponseReceivedListener(handleResponse);
    // Notification qui a lancé l'app (cold start)
    Notifications.getLastNotificationResponseAsync().then(handleResponse);
    return () => sub.remove();
  }, []);

  // Navigation différée : exécutée seulement quand tout est monté.
  //
  // ⚠️ L'ordre des deux instructions est le bug qui empêchait TOUT tap sur une
  // notification système d'ouvrir la bonne page. La version précédente faisait
  // `setPendingNotifRoute(null)` AVANT de programmer le `setTimeout` : ce
  // setState re-rend le composant, les dépendances de l'effet changent
  // (pendingNotifRoute : route → null), React exécute donc le nettoyage de
  // l'effet précédent — c'est-à-dire `clearTimeout(t)` — avant que le timer de
  // 0 ms, qui est une macrotâche, ait eu la moindre chance de se déclencher.
  // La navigation était annulée à chaque fois. Le centre de notifications
  // in-app, lui, appelle router.push() directement : c'est pour ça qu'il
  // fonctionnait alors que les notifications du téléphone ne menaient nulle
  // part.
  //
  // On capture donc la route dans une constante locale, et on ne vide l'état
  // qu'à l'intérieur du timer, une fois la navigation faite.
  useEffect(() => {
    if (!pendingNotifRoute || !navigationReady || isLoading) return;
    const route = pendingNotifRoute;
    // setTimeout : laisse le Stack terminer son premier rendu au cold start
    const t = setTimeout(() => {
      try {
        router.push(route as never);
      } catch (e) {
        console.warn("[notif] navigation impossible", e);
      }
      setPendingNotifRoute(null);
    }, 0);
    return () => clearTimeout(t);
  }, [pendingNotifRoute, navigationReady, isLoading, router]);

  // Notifs de message chiffrées → déchiffrement sur l'appareil (façon WhatsApp).
  // Tâche de fond (app tuée/arrière-plan) + listener premier plan.
  useEffect(() => {
    registerBackgroundNotifTask();
    const unsubscribe = subscribeForegroundDecrypt();
    return unsubscribe;
  }, []);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Écran de bienvenue : affiché à chaque lancement (flag en mémoire),
  // sauf si l'app est ouverte via une notification (deep link).
  if (!hasSeenWelcome() && pathname !== "/welcome")
    return <Redirect href="/welcome" />;

  // Garde d'auth : non connecté → /login (sauf welcome / inscription / mdp oublié)
  // /auth/reset/:token est public (lien de reset reçu par email).
  const publicRoutes = ["/welcome", "/login", "/signup", "/forgot-password"];
  const authRoutes = ["/login", "/signup", "/forgot-password"];
  const isPublic =
    publicRoutes.includes(pathname) || pathname.startsWith("/auth/reset");
  if (!user && !isPublic) return <Redirect href="/login" />;
  if (user && authRoutes.includes(pathname)) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={({ navigation }) => ({
        // En-tête rendu en JS, comme celui des onglets (AppHeader). L'en-tête
        // natif d'iOS enveloppe chaque bouton dans un UIBarButtonItem et dessine
        // derrière lui une capsule qu'il ne centre pas exactement sur notre vue
        // — décalage impossible à corriger depuis le JS. Voir AppStackHeader.
        header: (props) => <AppStackHeader {...props} />,
        contentStyle: { backgroundColor: colors.bg },
        // Bouton retour custom (piloté en JS) : le bouton natif iOS devient
        // parfois inopérant sur les écrans empilés (cartes, profil…). On ne
        // l'affiche que s'il y a un écran précédent.
        headerLeft: navigation.canGoBack()
          ? () => <HeaderBackButton />
          : undefined,
      })}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      {/* Écran d'auth unifié : connexion / inscription / mot de passe oublié
          sont trois panneaux d'un même pager. Les deux routes ci-dessous ne
          sont plus que des redirections vers /login?panel=… → pas de header. */}
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
    </Stack>
  );
}

function ThemedStatusBar() {
  const { resolved } = useTheme();
  return <StatusBar style={resolved === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  return (
    // ⚠️ Requis par react-native-gesture-handler (swipe-back natif du Stack,
    // BottomSheet, PanResponder…) : sans ce wrapper racine, les gestes entrent
    // en conflit avec les ScrollView/FlatList une fois arrivés en bas du
    // contenu — le scroll reste alors bloqué et impossible à remonter.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <UnreadProvider>
            <ThemedStatusBar />
            <RootNavigator />
          </UnreadProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
