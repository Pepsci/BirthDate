// src/services/socket.service.js
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

    // Détection automatique de l'environnement
    const isDev =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    // Construction de l'URL API selon l'environnement
    const apiUrl = isDev
      ? "http://localhost:4000"
      : "https://birthreminder.com";

    console.log("🔌 Connecting to:", apiUrl);

    this.socket = io(apiUrl, {
      auth: {
        token: token,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
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

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log("🔌 Socket.io disconnected manually");
    }
  }

  getSocket() {
    return this.socket;
  }

  // Émettre un événement
  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    } else {
      console.error("Socket not connected");
    }
  }

  // Écouter un événement
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Arrêter d'écouter un événement
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

// Instance unique (singleton)
const socketService = new SocketService();
export default socketService;
