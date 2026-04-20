// ── BirthReminder Service Worker ─────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const type = data.type || "default"; // "chat" | "birthday" | "nameday" | "friend" | "gift"

  // ── Options selon le type de notification ──────────────────────────────────
  let icon = "/icon-192x192.png";
  let actions = [];

  if (type === "chat") {
    icon = "/icon-chat-96x96.png";
    actions = [
      { action: "open_chat", title: "✅ Voir le message" },
      { action: "mute_chat", title: "🔕 Couper les notifs" },
    ];
  } else if (type === "birthday") {
    icon = "/icon-birthday-96x96.png";
    actions = [{ action: "open_birthday", title: "🎂 Voir l'anniversaire" }];
  } else if (type === "nameday") {
    icon = "/icon-192x192.png";
    actions = [{ action: "open_nameday", title: "🌸 Voir la fête" }];
  } else if (type === "friend") {
    icon = "/icon-192x192.png";
    actions = [{ action: "open_friends", title: "👥 Voir les demandes" }];
  } else if (type === "gift") {
    icon = "/icon-192x192.png";
    actions = [{ action: "open_wishlist", title: "🎁 Voir la liste" }];
  } else if (type === "event") {
    icon = "/icon-192x192.png";
    actions = [{ action: "open_event", title: "🎉 Voir l'événement" }];
  }

  const options = {
    body: data.body || "",
    icon: data.icon || icon,
    badge: "/badge-72x72.png",
    tag: data.tag || "birthreminder",
    vibrate: [100, 50, 100],
    requireInteraction:
      type === "birthday" || type === "nameday" || type === "event",
    silent: false,
    actions,
    data: {
      url: data.url || "/home",
      type,
      friendId: data.friendId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ── Clic sur la notification ou sur un bouton ─────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const { url, type, friendId } = event.notification.data || {};
  const action = event.action;

  // Déterminer l'URL cible selon l'action cliquée
  let targetUrl = url || "/home";

  if (action === "open_chat" || type === "chat") targetUrl = "/home";
  if (action === "open_birthday" || type === "birthday") targetUrl = "/home";
  if (action === "open_nameday" || type === "nameday") targetUrl = "/home";
  if (action === "open_friends" || type === "friend")
    targetUrl = "/home?tab=friends";
  if (action === "open_wishlist" || type === "gift")
    targetUrl = "/home?tab=profile&section=wishlist";
  if (action === "open_event" || type === "event")
    targetUrl = "/home?tab=events";

  // Action "Couper les notifs chat" → appel API en arrière-plan
  if (action === "mute_chat" && friendId) {
    event.waitUntil(
      fetch("/api/users/me/chat-email-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId, enabled: false }),
        credentials: "include",
      }).catch(console.error),
    );
    return; // Pas de navigation
  }

  // Navigation vers la bonne page
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Si l'app est déjà ouverte → focus + navigation
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        // Sinon ouvre un nouvel onglet
        if (clients.openWindow) return clients.openWindow(targetUrl);
      }),
  );
});

// ── Fermeture de notification (analytics optionnel) ───────────────────────────
self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification fermée:", event.notification.tag);
});
