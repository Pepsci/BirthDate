import { io, Socket } from "socket.io-client";
import { AppState } from "react-native";
import { API_URL, getToken } from "./api";

// Service socket singleton — même pattern que le web (socket.service.js) :
// auth par token dans le handshake (auth: { token }), pas par cookie.
let socket: Socket | null = null;

// ── Arrière-plan : déconnexion immédiate ────────────────────────────────────
// Sans ça, le serveur nous croit "en ligne" pendant le timeout socket.io
// (~45 s) après la mise en arrière-plan et n'envoie AUCUNE push pendant ce
// temps (pushService ne pushe qu'aux utilisateurs hors de connectedUsers).
// Retour au premier plan → reconnexion (les écrans ré-joignent leurs rooms
// via leur handler "connect", pattern anti-stale-closure existant).
AppState.addEventListener("change", (state) => {
  if (!socket) return;
  if (state === "background") {
    socket.disconnect();
  } else if (state === "active" && !socket.connected) {
    socket.connect();
  }
});

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await getToken();

  if (!socket) {
    socket = io(API_URL, {
      auth: { token },
      // Polling d'abord puis upgrade websocket — le websocket direct
      // échoue dans certains environnements RN/réseau local
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  } else {
    // Rafraîchir le token avant reconnexion
    (socket.auth as { token?: string | null }).token = token;
    if (!socket.connected) socket.connect();
  }

  if (!socket.hasListeners("connect")) {
    socket.on("connect", () => {
      console.log(
        `🔌 Socket connecté (transport: ${socket?.io.engine.transport.name})`,
      );
      socket?.io.engine.on("upgrade", (t: { name: string }) =>
        console.log(`🔌 Socket upgrade → ${t.name}`),
      );
    });
    socket.on("disconnect", (reason) =>
      console.log(`🔌 Socket déconnecté: ${reason}`),
    );
    socket.on("connect_error", (err) =>
      console.log(`🔌 Socket connect_error: ${err.message}`),
    );
  }

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
