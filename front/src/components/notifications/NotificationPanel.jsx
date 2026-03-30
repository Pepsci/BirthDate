import useNotifications from "../../context/useNotifications";
import NotificationItem from "./NotificationItem";
import "./css/NotificationPanel.css";

const NotificationPanel = ({ onClose }) => {
  const {
    appNotifications,
    appUnreadCount,
    markAllAppRead,
    deleteAllAppNotifications,
  } = useNotifications();

  const recent = appNotifications.slice(0, 8);

  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <span className="notif-panel-title">Notifications</span>
        <div className="notif-panel-actions">
          {appUnreadCount > 0 && (
            <button className="notif-panel-btn" onClick={markAllAppRead}>
              Tout marquer lu
            </button>
          )}
          {appNotifications.length > 0 && (
            <button
              className="notif-panel-btn notif-panel-btn--delete"
              onClick={deleteAllAppNotifications}
            >
              Tout effacer
            </button>
          )}
        </div>
      </div>

      <div className="notif-panel-list">
        {recent.length === 0 ? (
          <p className="notif-panel-empty">Aucune notification</p>
        ) : (
          recent.map((n) => (
            <NotificationItem key={n._id} notification={n} onClose={onClose} />
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
