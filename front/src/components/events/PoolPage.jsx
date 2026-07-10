import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import GiftPoolWidget from "./stripe/GiftPoolWidget";
import "./css/poolPage.css";

/**
 * Page publique autonome d'une cagnotte : /pool/:shortId
 * Réutilise GiftPoolWidget (fetch + contribution + liste + temps réel).
 * Accessible sans compte.
 */
export default function PoolPage() {
  const { shortId } = useParams();
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiHandler
      .get(`/events/${shortId}/pool`)
      .then((res) => mounted && setMeta(res.data))
      .catch(() => mounted && setMeta(null))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [shortId]);

  return (
    <div className="pool-page">
      <div className="pool-page-inner">
        <div className="pool-page-header">
          <span className="pool-page-emoji">💝</span>
          <h1 className="pool-page-title">
            {meta?.eventTitle
              ? `Cagnotte — ${meta.eventTitle}`
              : "Cagnotte"}
          </h1>
          <p className="pool-page-sub">
            Participe à la cagnotte, avec ou sans compte.
          </p>
        </div>

        {loading ? (
          <p className="pool-page-muted">Chargement…</p>
        ) : !meta ? (
          <p className="pool-page-muted">Cagnotte introuvable.</p>
        ) : !meta.active ? (
          <p className="pool-page-muted">
            La cagnotte n'est pas active pour cet événement.
          </p>
        ) : (
          <GiftPoolWidget shortId={shortId} isOrganizer={!!meta.isOrganizer} />
        )}

        <div className="pool-page-footer">
          {meta?.eventShortId && (
            <Link to={`/event/${meta.eventShortId}`} className="pool-page-link">
              Voir l'événement
            </Link>
          )}
          <span className="pool-page-brand">Propulsé par BirthReminder</span>
        </div>
      </div>
    </div>
  );
}
