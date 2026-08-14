import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import Avatar from "../UI/Avatar";
import "./css/personPreviewCard.css";

/**
 * Carte qui glisse depuis le haut au clic sur le nom d'une personne dans le
 * chat : âge, anniversaire, nombre de cadeaux dans sa liste, et la liste de
 * cadeaux commune si elle existe (rien sinon).
 */
function PersonPreviewCard({ userId, open, onClose }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    apiHandler
      .get(`/friends/${userId}/card-summary`)
      .then((res) => {
        if (!cancelled) setSummary(res.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const formatAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    if (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() &&
        today.getDate() < birth.getDate())
    )
      age--;
    return age;
  };

  const formatNextBirthday = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    if (next < today) next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
    return next.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  };

  const goToProfile = () => {
    if (!summary?.dateId) return;
    onClose();
    navigate(`/home?tab=date&dateId=${summary.dateId}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="person-preview-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="person-preview-card"
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
          >
            {loading && (
              <div className="person-preview-loading">Chargement...</div>
            )}

            {!loading && error && (
              <div className="person-preview-loading">
                Impossible de charger ce profil.
              </div>
            )}

            {!loading && !error && summary && (
              <>
                <div className="person-preview-header">
                  <Avatar
                    src={summary.avatar}
                    name={summary.name}
                    surname={summary.surname}
                    size="lg"
                  />
                  <div className="person-preview-identity">
                    <span className="person-preview-name">
                      {summary.name} {summary.surname}
                    </span>
                    {summary.birthDate && (
                      <span className="person-preview-age">
                        {formatAge(summary.birthDate)} ans
                      </span>
                    )}
                  </div>
                  <button
                    className="person-preview-close"
                    onClick={onClose}
                    aria-label="Fermer"
                  >
                    ✕
                  </button>
                </div>

                <div className="person-preview-body">
                  {summary.birthDate && (
                    <div className="person-preview-row">
                      <span className="person-preview-icon">🎂</span>
                      <span>
                        Anniversaire le {formatNextBirthday(summary.birthDate)}
                      </span>
                    </div>
                  )}

                  <div className="person-preview-row">
                    <span className="person-preview-icon">🎁</span>
                    <span>
                      {summary.wishlistCount > 0
                        ? `${summary.wishlistCount} idée${summary.wishlistCount > 1 ? "s" : ""} dans sa liste`
                        : "Aucune idée cadeau partagée"}
                    </span>
                  </div>

                  {summary.sharedGiftList && (
                    <div className="person-preview-row person-preview-shared">
                      <span className="person-preview-icon">🤝</span>
                      <span>
                        Liste commune —{" "}
                        {summary.sharedGiftList.giftCount} cadeau
                        {summary.sharedGiftList.giftCount > 1 ? "x" : ""}
                      </span>
                    </div>
                  )}

                  {summary.dateId && (
                    <button
                      type="button"
                      className="person-preview-profile-btn"
                      onClick={goToProfile}
                    >
                      Voir le profil
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default PersonPreviewCard;
