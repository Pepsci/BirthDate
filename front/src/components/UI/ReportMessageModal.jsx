import apiHandler from "../../api/apiHandler";
import "./css/reportMessageModal.css";

/**
 * Modale de signalement d'un message — conformité stores (Apple 1.2 /
 * Google Play UGC) : tout contenu produit par un utilisateur doit pouvoir être
 * signalé, partout où il s'affiche.
 *
 * ⚠️ Partagée entre la messagerie privée et le chat d'événement. Les deux
 * écrans envoient au même endpoint mais avec un `contentType` différent
 * ("message" vs "eventMessage") : c'est lui qui dit au back dans quelle
 * collection retrouver le contenu signalé.
 *
 * `preview` est déjà déchiffré par l'appelant : la modale ne connaît rien au
 * chiffrement E2E, et c'est très bien ainsi.
 */
const REASONS = [
  ["spam", "Spam"],
  ["harassment", "Harcèlement"],
  ["inappropriate", "Contenu inapproprié"],
  ["scam", "Arnaque / fraude"],
  ["other", "Autre"],
];

export default function ReportMessageModal({
  contentType,
  contentId,
  targetUserId,
  preview,
  onClose,
}) {
  const submit = async (reason) => {
    onClose();
    try {
      await apiHandler.reportContent({
        contentType,
        contentId,
        targetUserId,
        reason,
        contentPreview:
          typeof preview === "string" ? preview.slice(0, 500) : "",
      });
      alert("Merci, ton signalement a été envoyé. Il sera traité sous 24 h.");
    } catch (e) {
      alert(e?.message ?? "Signalement impossible.");
    }
  };

  return (
    <div className="report-modal-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        <h4>Signaler ce message</h4>
        <p>Pourquoi signales-tu ce contenu ?</p>
        {REASONS.map(([value, label]) => (
          <button key={value} type="button" onClick={() => submit(value)}>
            {label}
          </button>
        ))}
        <button type="button" className="report-cancel" onClick={onClose}>
          Annuler
        </button>
      </div>
    </div>
  );
}
