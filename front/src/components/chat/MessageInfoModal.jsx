import { useEffect, useRef } from "react";
import { getReceiptTimes, formatReceiptDate } from "./receipts";
import "./css/messageInfoModal.css";

/**
 * « Infos message », comme sur WhatsApp : quand un de mes messages a été
 * envoyé, distribué et lu. Uniquement sur mes propres messages — les
 * accusés des autres ne me regardent pas.
 */
export default function MessageInfoModal({ message, preview, myUserId, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!message) return;
    const opener = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [message, onClose]);

  if (!message) return null;

  const { sentAt, deliveredAt, readAt } = getReceiptTimes(message, myUserId);

  const rows = [
    { key: "read", ticks: "✓✓", label: "Lu", date: readAt },
    { key: "delivered", ticks: "✓✓", label: "Distribué", date: deliveredAt },
    { key: "sent", ticks: "✓", label: "Envoyé", date: sentAt },
  ];

  return (
    <div className="msg-info-overlay" onClick={() => onClose?.()}>
      <div
        className="msg-info-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="msg-info-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="msg-info-title" id="msg-info-title">
          Infos message
        </h3>

        {preview && <p className="msg-info-preview">{preview}</p>}

        <ul className="msg-info-list">
          {rows.map((row) => (
            <li key={row.key} className="msg-info-row">
              <span
                className={`msg-info-ticks ${row.key === "read" ? "read" : ""}`}
              >
                {row.ticks}
              </span>
              <span className="msg-info-label">{row.label}</span>
              <span className="msg-info-date">{formatReceiptDate(row.date)}</span>
            </li>
          ))}
        </ul>

        <div className="msg-info-actions">
          <button
            type="button"
            className="msg-info-close"
            ref={closeRef}
            onClick={() => onClose?.()}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
