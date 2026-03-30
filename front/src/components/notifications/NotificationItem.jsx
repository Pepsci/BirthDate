import { useNavigate } from "react-router-dom";
import useNotifications from "../../context/useNotifications";
import "./css/NotificationItem.css";

const TYPE_CONFIG = {
  birthday_soon: { icon: "🎂" },
  friend_request: { icon: "👋" },
  friend_accepted: { icon: "✅" },
  new_message: { icon: "💬" },
  gift_reserved: { icon: "🎁" },
  event_reminder: { icon: "📅" },
};

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days === 1) return "Hier";
  if (days < 30) return `Il y a ${days} jours`;
  return new Date(dateStr).toLocaleDateString("fr-FR");
};

const buildText = (type, data) => {
  switch (type) {
    case "birthday_soon":
      return (
        <>
          <strong>{data.name}</strong> fête son anniversaire dans{" "}
          {data.daysLeft} jour{data.daysLeft > 1 ? "s" : ""}
        </>
      );
    case "friend_request":
      return (
        <>
          <strong>{data.name}</strong> t'a envoyé une demande d'ami
        </>
      );
    case "friend_accepted":
      return (
        <>
          <strong>{data.name}</strong> a accepté ta demande d'ami
        </>
      );
    case "new_message":
      return (
        <>
          <strong>{data.senderName}</strong> : {data.preview}
        </>
      );
    case "gift_reserved":
      return (
        <>
          Un cadeau de ta wishlist (<strong>{data.giftName}</strong>) a été
          réservé
        </>
      );
    case "event_reminder":
      return (
        <>
          L'événement <strong>{data.eventName}</strong> est dans {data.daysLeft}{" "}
          jour{data.daysLeft > 1 ? "s" : ""}
        </>
      );
    default:
      return "Nouvelle notification";
  }
};

const NotificationItem = ({ notification, onClose }) => {
  const { markAppRead, deleteAppNotification } = useNotifications();
  const navigate = useNavigate();
  const config = TYPE_CONFIG[notification.type] || { icon: "🔔" };

  const handleClick = () => {
    // Marquer comme lu puis supprimer
    deleteAppNotification(notification._id);
    if (notification.link) {
      navigate(notification.link);
      onClose?.();
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    deleteAppNotification(notification._id);
  };

  return (
    <div
      className={`notif-item${notification.read ? "" : " notif-item--unread"}`}
      onClick={handleClick}
    >
      <div className={`notif-item-icon notif-item-icon--${notification.type}`}>
        {config.icon}
      </div>
      <div className="notif-item-body">
        <p className="notif-item-text">
          {buildText(notification.type, notification.data)}
        </p>
        <span className="notif-item-time">
          {timeAgo(notification.createdAt)}
        </span>
      </div>
      <div className="notif-item-right">
        {!notification.read && <span className="notif-item-dot" />}
        <button
          className="notif-item-delete"
          onClick={handleDelete}
          aria-label="Supprimer"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default NotificationItem;
