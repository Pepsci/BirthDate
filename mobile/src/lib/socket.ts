import { io, Socket } from "socket.io-client";
import { AppState } from "react-native";
import { API_URL, getToken } from "./api";

// Service socket singleton — même pattern que le web (socket.service.js) :
// auth par token dans le handshake (auth: { token }), pas par cookie.
let socket: Socket | null = null;

// Création en cours, partagée par tous les appels simultanés.
// ⚠️ Sans elle, deux écrans qui appellent getSocket() au même moment (très
// fréquent au lancement, et systématique en dev où tout se monte deux fois)
// passaient tous deux le test `!socket` pendant l'`await getToken()` et
// créaient DEUX sockets. Le premier, écrasé dans la variable, restait
// connecté sans que personne ne puisse plus le couper : en arrière-plan, le
// serveur voyait toujours un appareil « app » au premier plan et n'envoyait
// plus aucune push. Invisible sur iOS (l'OS suspend l'app et tue le socket),
// bloquant sur Android (le processus reste vivant plusieurs minutes).
let creating: Promise<Socket> | null = null;

// Jeton push de CET appareil, transmis au serveur pour qu'il ne saute que
// lui quand l'app est ouverte (server/utils/presence.js). Sans ce jeton, le
// serveur ne coupe aucune push — un appareil ouvert ne fait plus taire les
// autres téléphones du compte.
let presencePushToken: string | null = null;

/** Appelé par push.ts dès que le jeton Expo est connu (ou retiré). */
export function setPresencePushToken(token: string | null): void {
  presencePushToken = token;
  if (socket?.connected) {
    socket.emit("presence:pushToken", { pushToken: token });
  }
}

/** L'app est-elle en arrière-plan ? ("unknown" au démarrage = on autorise). */
const isBackground = () => AppState.currentState === "background";

// ── Arrière-plan : déconnexion immédiate ────────────────────────────────────
// Sans ça, le serveur nous croit au premier plan pendant le timeout socket.io
// (~45 s) et n'envoie AUCUNE push Expo pendant ce temps (voir
// server/utils/presence.js : un socket "app" coupe les push mobiles).
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

function attachLogs(s: Socket) {
  s.on("connect", () => {
    console.log(`🔌 Socket connecté (transport: ${s.io.engine.transport.name})`);
    s.io.engine.on("upgrade", (t: { name: string }) =>
      console.log(`🔌 Socket upgrade → ${t.name}`),
    );
  });
  s.on("disconnect", (reason) =>
    console.log(`🔌 Socket déconnecté: ${reason}`),
  );
  s.on("connect_error", (err) =>
    console.log(`🔌 Socket connect_error: ${err.message}`),
  );
}

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  // Socket déjà créé mais déconnecté : on ne reconnecte QUE si l'app est au
  // premier plan. En arrière-plan, on rend le socket tel quel : les écrans
  // peuvent y poser leurs listeners, la connexion partira au retour au
  // premier plan (listener AppState ci-dessus). Le token d'auth et le jeton
  // push sont relus à chaque connexion (voir `auth` ci-dessous).
  if (socket) {
    if (!socket.connected && !isBackground()) socket.connect();
    return socket;
  }

  if (!creating) {
    creating = (async () => {
      const s = io(API_URL, {
        // Fonction plutôt qu'objet : relue à CHAQUE (re)connexion, donc
        // toujours le token d'auth courant et le jeton push à jour.
        auth: (cb) => {
          getToken()
            .then((token) => cb({ token, pushToken: presencePushToken }))
            .catch(() => cb({ token: null, pushToken: presencePushToken }));
        },
        // Polling d'abord puis upgrade websocket — le websocket direct
        // échoue dans certains environnements RN/réseau local
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        // Connexion manuelle : on ne se connecte pas si l'app a été lancée
        // en arrière-plan (tâche de notification Android, par exemple).
        autoConnect: false,
      });
      attachLogs(s);
      socket = s;
      if (!isBackground()) s.connect();
      return s;
    })().finally(() => {
      creating = null;
    });
  }
  return creating;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
