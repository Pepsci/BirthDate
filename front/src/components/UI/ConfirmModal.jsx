import { useEffect, useRef } from "react";
import "./css/confirmModal.css";

/**
 * Fenêtre de confirmation maison.
 *
 * Remplace `window.confirm`, qui protégeait correctement mais avec une boîte
 * système au milieu d'une interface soignée — et sans possibilité de nommer
 * l'action, de la teinter, ni d'expliquer sa conséquence en deux phrases.
 *
 * Ce que le natif faisait gratuitement et qu'il faut donc refaire ici :
 *  - Échap ferme (retour au natif attendu par tout le monde) ;
 *  - le focus part sur le bouton d'action à l'ouverture, et revient à
 *    l'élément d'origine à la fermeture — sans quoi, au clavier, on se
 *    retrouve perdu en haut de page ;
 *  - le focus reste PIÉGÉ dans la fenêtre tant qu'elle est ouverte, sinon on
 *    tabule dans la page au-dessous, qu'on ne voit pas ;
 *  - la page dessous ne défile plus.
 *
 * @param {"danger"|"primary"} tone teinte du bouton d'action. `danger` pour
 *   tout ce qui retire, supprime ou libère : la couleur fait partie de
 *   l'avertissement.
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);
  const confirmRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement;
    confirmRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel?.();
        return;
      }
      if (e.key !== "Tab") return;
      // Piège à focus : on boucle sur les éléments focusables de la fenêtre.
      const focusables = dialogRef.current?.querySelectorAll(
        "button:not([disabled])",
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      // Le focus revient d'où il venait, si l'élément existe encore.
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="cfm-overlay"
      // Un clic à côté annule : c'est l'issue la moins risquée, donc celle
      // qu'on donne au geste le plus approximatif.
      onClick={() => !busy && onCancel?.()}
    >
      <div
        className="cfm-box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cfm-title"
        aria-describedby={message ? "cfm-message" : undefined}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="cfm-title" id="cfm-title">
          {title}
        </h3>
        {message && (
          <p className="cfm-message" id="cfm-message">
            {message}
          </p>
        )}
        <div className="cfm-actions">
          <button
            type="button"
            className="cfm-btn cfm-btn--ghost"
            disabled={busy}
            onClick={() => onCancel?.()}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`cfm-btn cfm-btn--${tone}`}
            disabled={busy}
            ref={confirmRef}
            onClick={() => onConfirm?.()}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
