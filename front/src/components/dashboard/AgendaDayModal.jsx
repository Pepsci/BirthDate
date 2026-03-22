import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./css/agendaDayModal.css";

const TYPE_LABELS = {
  birthday: "Anniversaire",
  party: "Soirée",
  dinner: "Dîner",
  other: "Autre",
};

const AgendaDayModal = ({ day, month, year, dates, namedays = [], events, onClose }) => {
  const navigate = useNavigate();

  const dateLabel = new Date(year, month, day).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const isEmpty = dates.length === 0 && namedays.length === 0 && events.length === 0;

  return (
    <div className="agm-overlay" onClick={onClose}>
      <div className="agm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="agm-header">
          <h3 className="agm-title">{dateLabel}</h3>
          <button className="agm-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="agm-body">
          {isEmpty && (
            <p className="agm-empty">Rien de prévu ce jour 🎈</p>
          )}

          {dates.length > 0 && (
            <section className="agm-section">
              <h4 className="agm-section-title">🎂 Anniversaires</h4>
              <ul className="agm-list">
                {dates.map((d) => (
                  <li
                    key={d._id}
                    className="agm-item"
                    onClick={() => {
                      navigate(`/home?tab=date&dateId=${d._id}`);
                      onClose();
                    }}
                  >
                    <span className="agm-item__name">
                      {d.name} {d.surname}
                    </span>
                    {d.linkedUser && (
                      <span className="agm-item__badge">AMI</span>
                    )}
                    {d.family && !d.linkedUser && (
                      <span className="agm-item__badge agm-item__badge--family">
                        FAMILLE
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {namedays.length > 0 && (
            <section className="agm-section">
              <h4 className="agm-section-title">🎉 Fêtes</h4>
              <ul className="agm-list">
                {namedays.map((d) => (
                  <li
                    key={d._id}
                    className="agm-item"
                    onClick={() => {
                      navigate(`/home?tab=date&dateId=${d._id}`);
                      onClose();
                    }}
                  >
                    <span className="agm-item__name">{d.name} {d.surname}</span>
                    <span className="agm-item__badge agm-item__badge--nameday">FÊTE</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {events.length > 0 && (
            <section className="agm-section">
              <h4 className="agm-section-title">🎉 Événements</h4>
              <ul className="agm-list">
                {events.map((ev) => (
                  <li
                    key={ev._id}
                    className="agm-item"
                    onClick={() => {
                      navigate(`/event/${ev.shortId}`);
                      onClose();
                    }}
                  >
                    <span className="agm-item__name">{ev.title}</span>
                    <span className="agm-item__type">
                      {TYPE_LABELS[ev.type] || ev.type}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgendaDayModal;
