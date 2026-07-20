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
import { StatusBar } from "expo-status-bar";
import HeaderBackButton from "../components/HeaderBackButton";
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

  // Navigation différée : exécutée seulement quand tout est monté
  useEffect(() => {
    if (!pendingNotifRoute || !navigationReady || isLoading) return;
    setPendingNotifRoute(null);
    // setTimeout : laisse le Stack terminer son premier rendu au cold start
    const t = setTimeout(() => {
      try {
        router.push(pendingNotifRoute as never);
      } catch (e) {
        console.warn("[notif] navigation impossible", e);
      }
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
  const publicRoutes = ["/welcome", "/login", "/signup", "/forgot-password"];
  const authRoutes = ["/login", "/signup", "/forgot-password"];
  if (!user && !publicRoutes.includes(pathname))
    return <Redirect href="/login" />;
  if (user && authRoutes.includes(pathname)) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
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
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}

function ThemedStatusBar() {
  const { resolved } = useTheme();
  return <StatusBar style={resolved === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UnreadProvider>
          <ThemedStatusBar />
          <RootNavigator />
        </UnreadProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
