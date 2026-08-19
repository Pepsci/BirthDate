import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "./css/publicSharedList.css";

const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:4000/api"
    : "https://birthreminder.com/api";

/**
 * Vue publique d'une liste d'idées commune — /liste/:slug, sans compte.
 *
 * En lecture seule : réserver reste réservé aux membres, depuis l'application.
 * Un visiteur de passage ne doit pas pouvoir bloquer un cadeau pour les
 * personnes qui organisent réellement.
 *
 * Différence assumée avec la wishlist publique : le PRÉNOM du réserveur est
 * affiché. Une liste commune existe pour que plusieurs offrants se coordonnent,
 * et « qui s'occupe de quoi » est justement l'information qu'on vient y
 * chercher. Le lien est donc à distribuer en connaissance de cause.
 */
export default function PublicSharedList() {
  const { publicSlug } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    axios
      .get(`${API_URL}/shared-gifts/public/${publicSlug}`)
      .then((res) => {
        if (alive) setData(res.data);
      })
      .catch((err) => {
        if (!alive) return;
        setError(
          err?.response?.status === 404
            ? "Cette liste n'existe pas ou n'est plus partagée."
            : "Impossible de charger cette liste pour le moment.",
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [publicSlug]);

  if (loading) {
    return <div className="psl-loading">Chargement de la liste…</div>;
  }

  if (error) {
    return (
      <div className="psl-error-page">
        <span className="psl-error-icon">🎁</span>
        <p>{error}</p>
      </div>
    );
  }

  const gifts = data?.gifts ?? [];

  return (
    <div className="psl-page">
      <header className="psl-header">
        <div className="psl-header-inner">
          <a href="https://birthreminder.com" className="psl-logo">
            🎂 BirthReminder
          </a>
          <p className="psl-tagline">
            {data?.label ? data.label : "Liste d'idées commune"}
          </p>
        </div>
      </header>

      <main className="psl-main">
        {gifts.length === 0 ? (
          <div className="psl-empty">
            <span>🎁</span>
            <p>Aucune idée dans cette liste pour l'instant.</p>
          </div>
        ) : (
          <>
            <p className="psl-count">
              {gifts.length} idée{gifts.length > 1 ? "s" : ""} ·{" "}
              {data.memberCount} participant
              {data.memberCount > 1 ? "s" : ""}
            </p>

            <div className="psl-grid">
              {gifts.map((g) => (
                <article
                  key={g._id}
                  className={`psl-card${g.isReserved ? " psl-card--reserved" : ""}`}
                >
                  <div className="psl-card-img-wrap">
                    {g.image ? (
                      <img
                        src={g.image}
                        alt={g.giftName}
                        className="psl-card-img"
                        loading="lazy"
                      />
                    ) : (
                      <div className="psl-card-img-placeholder">🎁</div>
                    )}
                  </div>

                  <div className="psl-card-body">
                    <h3 className="psl-card-title">{g.giftName}</h3>
                    {g.occasion && (
                      <p className="psl-card-meta">{g.occasion}</p>
                    )}

                    <div className="psl-card-footer">
                      {g.price != null && (
                        <span className="psl-card-price">{g.price} €</span>
                      )}
                      {g.isReserved && (
                        <span className="psl-badge psl-badge--reserved">
                          {g.reservedByName
                            ? `Réservé par ${g.reservedByName}`
                            : "Réservé"}
                        </span>
                      )}
                    </div>

                    {g.url && (
                      <a
                        href={g.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="psl-card-link"
                      >
                        Voir le cadeau
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        <p className="psl-notice">
          Cette liste est partagée en lecture seule. Pour réserver un cadeau,
          rejoins la liste dans l'application BirthReminder.
        </p>
      </main>
    </div>
  );
}
