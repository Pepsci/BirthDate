import { useEffect } from "react";
import { Stack, Redirect, usePathname, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { webLinkToMobileRoute } from "../lib/push";
import {
  registerBackgroundNotifTask,
  subscribeForegroundDecrypt,
} from "../lib/notif-decrypt";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { UnreadProvider } from "../lib/unread-context";
import { ThemeProvider, useTheme } from "../lib/theme-context";
import { hasSeenWelcome, markWelcomeSeen } from "../lib/welcome-gate";

function RootNavigator() {
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  // Tap sur une notification → navigation vers l'élément concerné
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.url as
          | string
          | undefined;
        const route = webLinkToMobileRoute(url);
        markWelcomeSeen(); // deep link : ne pas détourner vers /welcome
        router.push(route as never);
      },
    );
    // Notification qui a lancé l'app (cold start)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const url = response?.notification.request.content.data?.url as
        | string
        | undefined;
      if (url) {
        markWelcomeSeen(); // deep link : ne pas détourner vers /welcome
        router.push(webLinkToMobileRoute(url) as never);
      }
    });
    return () => sub.remove();
  }, [router]);

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
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.bg },
        // iOS : sans ça, le bouton retour affiche le nom de la route
        // précédente — littéralement « (tabs) ». Chevron seul, c'est mieux.
        headerBackButtonDisplayMode: "minimal",
        headerBackTitle: "Retour",
      }}
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
