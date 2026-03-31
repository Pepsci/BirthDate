import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import "./css/fabMenu.css";

const ALL_FAB_ITEMS = [
  {
    id: "filter",
    label: "Filtre",
    color: "#6366f1",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M2 4h12M4 8h8M6 12h4"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "agenda",
    label: "Agenda",
    color: "#0ea5e9",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect
          x="1.5"
          y="2.5"
          width="13"
          height="11"
          rx="1.5"
          stroke="white"
          strokeWidth="1.4"
        />
        <line
          x1="1.5"
          y1="6.5"
          x2="14.5"
          y2="6.5"
          stroke="white"
          strokeWidth="1.4"
        />
        <line
          x1="5"
          y1="1"
          x2="5"
          y2="4"
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <line
          x1="11"
          y1="1"
          x2="11"
          y2="4"
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "chat",
    label: "Chat",
    color: "#10b981",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M2 3h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5.5l-3.5 2V4a1 1 0 0 1 1-1z"
          stroke="white"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "events",
    label: "Événements",
    color: "#f59e0b",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z"
          stroke="white"
          strokeWidth="1.4"
        />
        <path
          d="M8 5v3.5l2.5 1.5"
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "form",
    label: "Ajouter une date",
    color: "#ec4899",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <line
          x1="8"
          y1="2"
          x2="8"
          y2="14"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <line
          x1="2"
          y1="8"
          x2="14"
          y2="8"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

const OFFSET_X = -120;

const POSITIONS = [
  { x: -14 + OFFSET_X, y: 70 },
  { x: -30 + OFFSET_X, y: 140 },
  { x: -44 + OFFSET_X, y: 210 },
  { x: -30 + OFFSET_X, y: 280 },
  { x: -14 + OFFSET_X, y: 350 },
];

export default function FabMenu({
  onFilter,
  onAgenda,
  onChat,
  onEvents,
  onForm,
  isFilterVisible,
  viewMode,
  isChatVisible,
  isEventsVisible,
  isFormVisible,
  unreadCount = 0,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const isCardView = viewMode === "card" && !isChatVisible && !isEventsVisible;

  const fabItems = ALL_FAB_ITEMS.filter((item) => {
    if (item.id === "filter") return isCardView;
    return true;
  });

  const handlers = {
    filter: onFilter,
    agenda: onAgenda,
    chat: onChat,
    events: onEvents,
    form: onForm,
  };

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isCardView && isFilterVisible) onFilter?.();
  }, [isCardView]);

  const handleItemClick = (id) => {
    setIsOpen(false);
    handlers[id]?.();
  };

  const hasActive =
    isFilterVisible ||
    isChatVisible ||
    isEventsVisible ||
    isFormVisible ||
    viewMode === "agenda";

  return (
    <div className="fab-menu" ref={containerRef}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fab-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen &&
          fabItems.map((item, i) => {
            const pos = POSITIONS[i] ?? { x: 0, y: (i + 1) * 56 };
            const label =
              item.id === "agenda"
                ? viewMode === "card"
                  ? "Agenda"
                  : "Carte"
                : item.label;

            return (
              <motion.div
                key={item.id}
                className="fab-item-wrapper"
                initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
                animate={{ x: pos.x, y: pos.y, scale: 1, opacity: 1 }}
                exit={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 22,
                  delay: i * 0.05,
                }}
              >
                <span className="fab-item-label">{label}</span>
                <button
                  className="fab-item-btn"
                  style={{ background: item.color }}
                  onClick={() => handleItemClick(item.id)}
                  aria-label={label}
                >
                  {item.icon}
                  {item.id === "chat" && !isChatVisible && unreadCount > 0 && (
                    <span className="fab-item-badge">{unreadCount}</span>
                  )}
                </button>
              </motion.div>
            );
          })}
      </AnimatePresence>

      <motion.button
        className={`fab-main-btn${hasActive ? " has-active" : ""}`}
        onClick={() => setIsOpen((v) => !v)}
        animate={{
          rotate: isOpen ? 45 : 0,
          backgroundColor: isOpen ? "#ef4444" : "#3b82f6",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <line
            x1="8"
            y1="2"
            x2="8"
            y2="14"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <line
            x1="2"
            y1="8"
            x2="14"
            y2="8"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
        {hasActive && !isOpen && <span className="fab-active-dot" />}
      </motion.button>
    </div>
  );
}
