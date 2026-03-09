import { io } from "socket.io-client";

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    if (this.socket?.connected) {
      console.log("✅ Socket already connected");
      return this.socket;
    }

    const isLocal = window.location.hostname === "localhost";

    // Suit automatiquement le domaine courant — pas de hardcode
    const apiUrl = isLocal
      ? "http://localhost:4000"
      : `${window.location.protocol}//${window.location.hostname}`;

    console.log("🔌 Connecting to:", apiUrl);

    this.socket = io(apiUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10, // ← augmenté pour réseau mobile instable
    });

    this.socket.on("connect", () => {
      console.log("✅ Socket.io connected:", this.socket.id);
    });

    this.socket.on("connect_error", (error) => {
      console.error("❌ Socket.io connection error:", error.message);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("👋 Socket.io disconnected:", reason);
    });

    // Écoute les erreurs d'envoi de message renvoyées par le serveur
    this.socket.on("message:error", ({ tempId, error }) => {
      console.error("❌ Message send failed (tempId:", tempId, "):", error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      console.log("🔌 Disconnecting socket (user logged out)");
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    } else {
      console.error("❌ Socket not connected, cannot emit:", event);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

const socketService = new SocketService();
export default socketService;
