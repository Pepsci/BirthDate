import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socketService from "../services/socket.service";
import { useContext } from "react";
import { AuthContext } from "../../context/auth.context";
import "./css/NotificationToast.css";

const TYPE_CONFIG = {
  birthday_soon: { icon: "🎂" },
  friend_request: { icon: "👋" },
  friend_accepted: { icon: "✅" },
  new_message: { icon: "💬" },
  gift_reserved: { icon: "🎁" },
  event_reminder: { icon: "📅" },
};

const buildToastText = (type, data) => {
  switch (type) {
    case "birthday_soon":
      return `${data.name} — anniversaire dans ${data.daysLeft}j`;
    case "friend_request":
      return `${data.name} t'a envoyé une demande d'ami`;
    case "friend_accepted":
      return `${data.name} a accepté ta demande`;
    case "new_message":
      return `${data.senderName} : ${data.preview}`;
    case "gift_reserved":
      return `Cadeau réservé : ${data.giftName}`;
    case "event_reminder":
      return `${data.eventName} dans ${data.daysLeft}j`;
    default:
      return "Nouvelle notification";
  }
};

const NotificationToast = () => {
  const [toasts, setToasts] = useState([]);
  const navigate = useNavigate();
  const { isLoggedIn } = useContext(AuthContext);

  useEffect(() => {
    if (!isLoggedIn) return;

    // On récupère le socket déjà connecté (pas de reconnexion)
    const socket = socketService.getSocket();
    if (!socket) return;

    const handler = (notif) => {
      const toastId = notif._id || Date.now();
      setToasts((prev) => [...prev, { ...notif, toastId }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
      }, 4500);
    };

    socket.on("new_notification", handler);
    return () => socket.off("new_notification", handler);
  }, [isLoggedIn]);

  const dismiss = (toastId) =>
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.toastId}
          className="toast"
          onClick={() => {
            if (t.link) navigate(t.link);
            dismiss(t.toastId);
          }}
        >
          <span className="toast-icon">
            {TYPE_CONFIG[t.type]?.icon || "🔔"}
          </span>
          <span className="toast-text">{buildToastText(t.type, t.data)}</span>
          <button
            className="toast-close"
            onClick={(e) => {
              e.stopPropagation();
              dismiss(t.toastId);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;
