import { useEffect, useState } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/muteBell.css";

/**
 * Cloche de mise en silencieux d'UNE conversation — privée ou discussion
 * d'événement.
 *
 * ⚠️ Ne coupe que les notifications push. La conversation reste dans la liste
 * avec ses messages non lus : couper les deux ferait disparaître les messages
 * sans laisser de trace, et on ne saurait plus qu'on a raté quelque chose.
 */
const CHOICES = [
  { value: "1h", label: "1 heure" },
  { value: "8h", label: "8 heures" },
  { value: "1w", label: "1 semaine" },
  { value: "forever", label: "Jusqu'à réactivation" },
];

function label(until) {
  if (!until) return "jusqu'à réactivation";
  const d = new Date(until);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? `jusqu'à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    : `jusqu'au ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
}

export default function MuteBell({ kind, targetId }) {
  const [mute, setMute] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!targetId) return;
    let alive = true;
    apiHandler
      .get("/mutes")
      .then((res) => {
        if (!alive) return;
        setMute(
          (res.data || []).find(
            (m) => m.kind === kind && m.targetId === String(targetId),
          ) || null,
        );
      })
      // Silencieux illisible : mieux vaut ne pas barrer la cloche à tort.
      .catch(() => alive && setMute(null));
    return () => {
      alive = false;
    };
  }, [kind, targetId]);

  if (!targetId) return null;

  const apply = async (duration) => {
    try {
      const res = await apiHandler.put("/mutes", {
        kind,
        targetId: String(targetId),
        duration,
      });
      setMute(res.data);
    } catch (err) {
      console.error("Error muting conversation", err);
    } finally {
      setOpen(false);
    }
  };

  const clear = async () => {
    try {
      await apiHandler.delete(`/mutes/${kind}/${encodeURIComponent(targetId)}`);
      setMute(null);
    } catch (err) {
      console.error("Error unmuting conversation", err);
    } finally {
      setOpen(false);
    }
  };

  return (
    <div className="mb-wrap">
      <button
        type="button"
        className={`mb-btn ${mute ? "mb-btn--on" : ""}`}
        title={
          mute
            ? `Notifications coupées ${label(mute.until)}`
            : "Couper les notifications"
        }
        aria-label={
          mute ? "Réactiver les notifications" : "Couper les notifications"
        }
        onClick={() => setOpen((v) => !v)}
      >
        <i className={`fa-solid ${mute ? "fa-bell-slash" : "fa-bell"}`}></i>
      </button>

      {open && (
        <>
          {/* Un clic à côté referme : c'est l'issue la moins risquée pour le
              geste le plus approximatif. */}
          <div className="mb-backdrop" onClick={() => setOpen(false)} />
          <div className="mb-menu" role="menu">
            <p className="mb-menu-head">
              {mute
                ? `Coupées ${label(mute.until)}`
                : "Couper les notifications"}
            </p>
            <p className="mb-menu-hint">
              La conversation reste visible, avec ses messages non lus.
            </p>
            {CHOICES.map((c) => (
              <button
                key={c.value}
                type="button"
                className="mb-item"
                onClick={() => apply(c.value)}
              >
                {c.label}
              </button>
            ))}
            {mute && (
              <button type="button" className="mb-item mb-item--on" onClick={clear}>
                🔔 Réactiver
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
