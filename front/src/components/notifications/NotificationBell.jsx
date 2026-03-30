import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import useNotifications from "../../context/useNotifications";
import NotificationPanel from "./NotificationPanel";
import "./css/NotificationBell.css";

const NotificationBell = () => {
  const { appUnreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Ferme le panel si clic en dehors
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="notif-bell-wrapper" ref={wrapperRef}>
      <button
        className="notif-bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${appUnreadCount > 0 ? ` (${appUnreadCount} non lues)` : ""}`}
      >
        <Bell size={20} />
        {appUnreadCount > 0 && (
          <span className="notif-bell-badge">
            {appUnreadCount > 99 ? "99+" : appUnreadCount}
          </span>
        )}
      </button>

      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </div>
  );
};

export default NotificationBell;
