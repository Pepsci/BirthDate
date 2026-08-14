import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import "./css/myCagnottes.css";

const euro = (cents) =>
  ((cents || 0) / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });

const MyCagnottesStrip = () => {
  const navigate = useNavigate();
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiHandler
      .get("/events/mine/pools")
      .then((res) => {
        if (!cancelled) setPools(res.data.pools || []);
      })
      .catch((err) => {
        console.error("Failed to load my cagnottes", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || pools.length === 0) return null;

  return (
    <motion.div
      className="mc-strip"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <h2 className="mc-strip-title">
        <i className="fa-solid fa-piggy-bank"></i> Mes cagnottes
      </h2>
      <div className="mc-strip-cards">
        {pools.map((pool) => {
          const pct =
            pool.mode === "goal" && pool.goal
              ? Math.min(
                  100,
                  Math.round((pool.totalCollected / pool.goal) * 100),
                )
              : null;
          return (
            <motion.button
              key={pool.eventShortId}
              className="mc-card"
              onClick={() => navigate(`/event/${pool.eventShortId}`)}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="mc-card-header">
                <span className="mc-card-title">{pool.eventTitle}</span>
                {pool.isOrganizer && (
                  <span className="mc-card-badge">Organisateur</span>
                )}
              </div>

              <div className="mc-card-amount">
                <span className="mc-card-amount-current">
                  {euro(pool.totalCollected)}
                </span>
                {pool.mode === "goal" && pool.goal && (
                  <span className="mc-card-amount-goal">
                    {" "}
                    / {euro(pool.goal)}
                  </span>
                )}
              </div>

              {pct !== null && (
                <div className="mc-card-progress">
                  <motion.div
                    className="mc-card-progress-bar"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              )}

              <span className="mc-card-count">
                {pool.contributionsCount} contribution
                {pool.contributionsCount > 1 ? "s" : ""}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default MyCagnottesStrip;
