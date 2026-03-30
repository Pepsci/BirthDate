import useNotifications from "../../context/useNotifications";
import NotificationItem from "./NotificationItem";
import "./css/NotificationsPage.css";

const NotificationsPage = () => {
  const {
    appNotifications,
    appLoading,
    appHasMore,
    appUnreadCount,
    markAllAppRead,
    loadMoreAppNotifications,
  } = useNotifications();

  return (
    <div className="notif-page">
      <div className="notif-page-header">
        <h1 className="notif-page-title">Notifications</h1>
        {appUnreadCount > 0 && (
          <button className="notif-page-markall" onClick={markAllAppRead}>
            Tout marquer lu
          </button>
        )}
      </div>

      <div className="notif-page-list">
        {appNotifications.length === 0 && !appLoading && (
          <p className="notif-page-empty">
            Aucune notification pour l'instant.
          </p>
        )}

        {appNotifications.map((n) => (
          <NotificationItem key={n._id} notification={n} />
        ))}

        {appLoading && <p className="notif-page-loading">Chargement…</p>}

        {appHasMore && !appLoading && (
          <button
            className="notif-page-loadmore"
            onClick={loadMoreAppNotifications}
          >
            Charger plus
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
