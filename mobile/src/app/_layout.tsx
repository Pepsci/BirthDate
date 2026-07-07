import { useEffect } from "react";
import { Stack, Redirect, usePathname, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { webLinkToMobileRoute } from "../lib/push";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { UnreadProvider } from "../lib/unread-context";

function RootNavigator() {
  const { user, isLoading } = useAuth();
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
        router.push(route as never);
      },
    );
    // Notification qui a lancé l'app (cold start)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const url = response?.notification.request.content.data?.url as
        | string
        | undefined;
      if (url) router.push(webLinkToMobileRoute(url) as never);
    });
    return () => sub.remove();
  }, [router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Garde d'auth : non connecté → /login (sauf inscription / mdp oublié)
  const publicRoutes = ["/login", "/signup", "/forgot-password"];
  if (!user && !publicRoutes.includes(pathname))
    return <Redirect href="/login" />;
  if (user && publicRoutes.includes(pathname)) return <Redirect href="/" />;

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <UnreadProvider>
        <StatusBar style="auto" />
        <RootNavigator />
      </UnreadProvider>
    </AuthProvider>
  );
}
