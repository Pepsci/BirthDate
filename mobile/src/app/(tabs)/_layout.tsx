import { Tabs, useRouter } from "expo-router";
import { useUnread } from "../../lib/unread-context";
import { Text, Pressable, View, StyleSheet } from "react-native";

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
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Anniversaires",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎂" focused={focused} />,
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginRight: 16 }}>
              <HeaderBell />
              <Pressable onPress={() => router.push("/date/new")} hitSlop={10}>
                <Text style={{ fontSize: 24, color: "#3b82f6" }}>＋</Text>
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
                <Text style={{ fontSize: 24, color: "#3b82f6" }}>＋</Text>
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
