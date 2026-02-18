// src/components/Chat/ChatModal.jsx
import { useEffect } from "react";
import "./css/chatModal.css";

function ChatModal({ isOpen, onClose, children, title = "Messages" }) {
  // Bloquer le scroll du body quand la modal est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div
        className="chat-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chat-modal-header">
          <h2 className="chat-modal-title">{title}</h2>
          <button
            className="chat-modal-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="chat-modal-content">{children}</div>
      </div>
    </div>
  );
}

export default ChatModal;
