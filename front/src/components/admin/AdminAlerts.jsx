import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import "./css/admin.css";

const euros = (cents) =>
  ((cents || 0) / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });

const RULE_LABELS = {
  big_contribution: "💰 Grosse contribution unique",
  big_total: "📈 Total collecté élevé",
  velocity: "⚡ Afflux rapide de contributions",
  refund_ratio: "↩️ Taux de remboursement anormal",
};

const ACTION_LABELS = {
  frozen: "Cagnotte gelée",
  refunded: "Contributions remboursées",
  organizer_contacted: "Organisateur contacté",
  account_suspended: "Compte suspendu",
  other: "Autre",
};

/*
 * Formulaire de décision sur une alerte.
 *
 * ⚠️ Le motif est obligatoire, et ce n'est pas une coquetterie d'interface :
 * c'est tout ce qui distingue un registre de diligence d'une case cochée. Le
 * serveur le refuse aussi, mais l'interface doit dire POURQUOI on le demande —
 * sinon l'administrateur tape « ok » et le registre ne vaut plus rien.
 */
const ReviewForm = ({ alert, onDone }) => {
  const [status, setStatus] = useState("dismissed");
  const [reason, setReason] = useState("");
  const [actionTaken, setActionTaken] = useState("organizer_contacted");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (reason.trim().length < 10) {
      setErr("Le motif doit faire au moins 10 caractères.");
      return;
    }
    setSaving(true);
    try {
      await apiHandler.post("/admin/pools/alerts/review", {
        eventId: alert.event._id,
        alertType: alert.type,
        status,
        reason: reason.trim(),
        actionTaken: status === "actioned" ? actionTaken : undefined,
      });
      onDone();
    } catch (e) {
      setErr(e.response?.data?.message || "Erreur lors de l'enregistrement.");
      setSaving(false);
    }
  };

  return (
    <div className="admin-review-form">
      <div className="admin-review-row">
        <label className="admin-review-choice">
          <input
            type="radio"
            checked={status === "dismissed"}
            onChange={() => setStatus("dismissed")}
          />
          Écarter — pas de suite à donner
        </label>
        <label className="admin-review-choice">
          <input
            type="radio"
            checked={status === "actioned"}
            onChange={() => setStatus("actioned")}
          />
          Action prise
        </label>
      </div>

      {status === "actioned" && (
        <select
          className="admin-review-select"
          value={actionTaken}
          onChange={(e) => setActionTaken(e.target.value)}
        >
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      )}

      <textarea
        className="admin-review-textarea"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Motif de la décision — ce texte est ce qui la justifiera si elle est contestée. Ex. : organisateur vérifié, cagnotte de mariage, montants cohérents avec le nombre d'invités."
      />

      {err && <p className="admin-error">{err}</p>}

      <div className="admin-alert-actions">
        <button onClick={submit} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer la décision"}
        </button>
      </div>
    </div>
  );
};

const AdminAlerts = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [openReview, setOpenReview] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    apiHandler
      .get("/admin/pools/alerts")
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || "Erreur"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="admin-error">{error}</p>;
  if (!data) return <p className="admin-loading">Analyse des cagnottes…</p>;

  const { alerts, thresholds, pendingCount } = data;

  return (
    <div className="admin-page">
      <h1>
        Alertes cagnottes ({alerts.length})
        {pendingCount > 0 && (
          <span className="admin-tag admin-tag-danger admin-title-tag">
            {pendingCount} à traiter
          </span>
        )}
      </h1>

      <p className="admin-muted">
        Seuils actuels : contribution ≥ {thresholds.bigContribution / 100} € ·
        total ≥ {thresholds.bigTotal / 100} € · ≥ {thresholds.velocityCount}{" "}
        contributions / {thresholds.velocityWindowMinutes} min · remboursements
        ≥ {Math.round(thresholds.refundRatio * 100)} %
      </p>

      {/* Le registre n'a de sens que si on sait à quoi il sert. */}
      <p className="admin-muted admin-review-intro">
        Chaque alerte doit être tranchée, y compris pour être écartée. Une
        alerte détectée puis laissée sans décision se lit, en cas de litige,
        comme une plateforme qui savait et n'a pas bougé. Les décisions sont
        horodatées, signées et conservées sans limite de durée.
      </p>

      {alerts.length === 0 ? (
        <div className="admin-card admin-alert-empty">
          <span className="admin-card-value">✅</span>
          <span className="admin-card-label">
            Aucune cagnotte suspecte détectée
          </span>
        </div>
      ) : (
        <div className="admin-alerts-list">
          {alerts.map((a) => {
            const key = `${a.event._id}|${a.type}`;
            return (
              <div
                key={key}
                className={`admin-alert-card ${
                  a.needsReview
                    ? a.severity === "high"
                      ? "admin-alert-high"
                      : "admin-alert-medium"
                    : "admin-alert-reviewed"
                }`}
              >
                <div className="admin-alert-header">
                  <strong>{RULE_LABELS[a.type] || a.type}</strong>
                  <span
                    className={`admin-tag ${
                      a.needsReview
                        ? a.severity === "high"
                          ? "admin-tag-danger"
                          : "admin-tag-warning"
                        : "admin-tag-success"
                    }`}
                  >
                    {a.needsReview
                      ? a.severity === "high"
                        ? "priorité haute"
                        : "à surveiller"
                      : a.review?.status === "actioned"
                        ? "action prise"
                        : "écartée"}
                  </span>
                </div>

                <p className="admin-alert-details">{a.details}</p>
                <p className="admin-muted">
                  Événement : <strong>{a.event.title}</strong> (
                  {a.event.shortId})
                  {a.event.organizer && (
                    <>
                      {" "}
                      · Organisateur : {a.event.organizer.name}{" "}
                      {a.event.organizer.surname || ""} (
                      {a.event.organizer.email})
                    </>
                  )}{" "}
                  · Collecté : {euros(a.totals.collected)} (
                  {a.totals.contributions} contribution(s), {a.totals.refunded}{" "}
                  remboursée(s))
                </p>

                {a.review && (
                  <div className="admin-review-past">
                    <p>
                      <strong>
                        {a.review.status === "actioned"
                          ? ACTION_LABELS[a.review.actionTaken] ||
                            "Action prise"
                          : "Écartée"}
                      </strong>{" "}
                      le{" "}
                      {new Date(a.review.reviewedAt).toLocaleDateString(
                        "fr-FR",
                        { day: "numeric", month: "long", year: "numeric" },
                      )}
                      {a.review.reviewedBy ? ` par ${a.review.reviewedBy}` : ""}
                    </p>
                    <p className="admin-review-reason">« {a.review.reason} »</p>
                    {a.review.stale && (
                      <p className="admin-review-stale">
                        ⚠️ La situation a évolué depuis cette décision — à
                        réexaminer.
                      </p>
                    )}
                  </div>
                )}

                <div className="admin-alert-actions">
                  <button
                    onClick={() =>
                      setOpenReview(openReview === key ? null : key)
                    }
                  >
                    {openReview === key
                      ? "Annuler"
                      : a.review
                        ? "Revoir la décision"
                        : "Trancher cette alerte"}
                  </button>
                  <button onClick={() => navigate("/admin/pools")}>
                    Voir les cagnottes
                  </button>
                  <button
                    onClick={() =>
                      window.open(`/event/${a.event.shortId}`, "_blank")
                    }
                  >
                    Ouvrir l'événement
                  </button>
                </div>

                {openReview === key && (
                  <ReviewForm
                    alert={a}
                    onDone={() => {
                      setOpenReview(null);
                      load();
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminAlerts;
