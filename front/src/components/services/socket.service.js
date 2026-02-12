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

    // 👇 CORRECTION: Utilise la même logique que apiHandler
    const isLocal = window.location.hostname === "localhost";

    const apiUrl = isLocal
      ? "http://localhost:4000"
      : "https://birthreminder.com";

    console.log(
      "🔌 Connecting to:",
      apiUrl,
      "(hostname:",
      window.location.hostname,
      ")",
    );

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
