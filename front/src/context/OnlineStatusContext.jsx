// src/context/OnlineStatusContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import socketService from "../components/services/socket.service";

const OnlineStatusContext = createContext();

export const useOnlineStatus = () => {
  const context = useContext(OnlineStatusContext);
  if (!context) {
    throw new Error("useOnlineStatus must be used within OnlineStatusProvider");
  }
  return context;
};

export const OnlineStatusProvider = ({ children }) => {
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    // ⭐ Petit délai pour laisser le socket se connecter depuis AuthContext
    const timer = setTimeout(() => {
      const socket = socketService.getSocket();

      if (!socket) {
        console.warn("⚠️ Socket not connected in OnlineStatusProvider");
        return;
      }

      console.log("🔌 OnlineStatusProvider: Setting up listeners");

      // Écouter les événements en ligne/hors ligne
      const handleUserOnline = ({ userId }) => {
        console.log("👤 User online:", userId);
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.add(userId);
          return next;
        });
      };

      const handleUserOffline = ({ userId }) => {
        console.log("👤 User offline:", userId);
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      };

      const handleOnlineUsers = ({ userIds }) => {
        console.log("👥 Online users list received:", userIds);
        setOnlineUsers(new Set(userIds));
      };

      socket.on("user:online", handleUserOnline);
      socket.on("user:offline", handleUserOffline);
      socket.on("users:online", handleOnlineUsers);

      // ⭐ Demander la liste APRÈS avoir configuré les listeners
      console.log("📤 Requesting online users list...");
      socket.emit("users:getOnline");
    }, 500); // ⭐ Attendre 500ms que le socket soit prêt

    return () => clearTimeout(timer);
  }, []);

  const isUserOnline = (userId) => {
    return onlineUsers.has(userId);
  };

  return (
    <OnlineStatusContext.Provider value={{ onlineUsers, isUserOnline }}>
      {children}
    </OnlineStatusContext.Provider>
  );
};
