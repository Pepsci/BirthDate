import { Tabs, useRouter } from "expo-router";
import { useUnread } from "../../lib/unread-context";
import { Text, Pressable, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LogoBanner from "../../components/LogoBanner";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../../lib/theme-context";

/**
 * Header personnalisé : bannière logo tout en haut, puis la ligne
 * titre + actions (cloche, +) en dessous.
 */
function AppHeader({ options, route }: any) {
  const insets = useSafeAreaInsets();
  const headerStyles = useThemedStyles(makeHeaderStyles);
  const title = options.title ?? route.name;
  return (
    <View style={[headerStyles.wrap, { paddingTop: insets.top }]}>
      <LogoBanner />
      <View style={headerStyles.row}>
        <View style={headerStyles.side}>{options.headerLeft?.({})}</View>
        <Text style={headerStyles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={[headerStyles.side, headerStyles.sideRight]}>
          {options.headerRight?.({})}
        </View>
      </View>
    </View>
  );
}

const makeHeaderStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: c.headerBg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      height: 44,
    },
    side: { minWidth: 60, justifyContent: "center" },
    sideRight: { alignItems: "flex-end" },
    title: {
      flex: 1,
      fontSize: 17,
      fontWeight: "700",
      color: c.text,
      textAlign: "center",
    },
  });

function HeaderBell() {
  const router = useRouter();
  const { notifCount } = useUnread();
  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      hitSlop={10}
      style={bellStyles.wrap}
    >
      <Text style={{ fontSize: 20 }}>🔔</Text>
      {notifCount > 0 && (
        <View style={bellStyles.badge}>
          <Text style={bellStyles.badgeText}>
            {notifCount > 99 ? "99+" : notifCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const bellStyles = StyleSheet.create({
  wrap: { flexDirection: "row", marginRight: 4 },
  badge: {
    backgroundColor: "#ef4444",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    marginLeft: -8,
    marginTop: -6,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const { total } = useUnread();
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.bg },
        header: (props) => <AppHeader {...props} />,
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={{
          tabPress: () => {
            // Sur une carte (ou tout écran empilé) → revenir à la liste
            if (router.canDismiss()) router.dismissAll();
          },
        }}
        options={{
          title: "Anniversaires",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎂" focused={focused} />,
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginRight: 16 }}>
              <HeaderBell />
              <Pressable onPress={() => router.push("/date/new")} hitSlop={10}>
                <Text style={{ fontSize: 24, color: colors.primary }}>＋</Text>
              </Pressable>
            </View>
          ),
          headerLeft: () => (
            <Pressable
              onPress={() => router.push("/agenda")}
              hitSlop={10}
              style={{ marginLeft: 16 }}
            >
              <Text style={{ fontSize: 20 }}>📅</Text>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Événements",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎉" focused={focused} />,
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginRight: 16 }}>
              <HeaderBell />
              <Pressable onPress={() => router.push("/event/new")} hitSlop={10}>
                <Text style={{ fontSize: 24, color: colors.primary }}>＋</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />,
          tabBarBadge: total > 0 ? total : undefined,
          headerRight: () => (
            <View style={{ marginRight: 16 }}>
              <HeaderBell />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
          headerRight: () => (
            <View style={{ marginRight: 16 }}>
              <HeaderBell />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
