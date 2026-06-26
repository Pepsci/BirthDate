import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import apiHandler from "../../../api/apiHandler";
import ContributeModal from "./ContributeModal";
import { netEstimate, totalFees, euro as euroFee } from "./lib/stripeFees";
import socketService from "../../services/socket.service";
import "./css/giftPool.css";

const euro = (cents) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const GiftPoolWidget = ({ shortId, isOrganizer = false }) => {
  const [pool, setPool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchPool = async () => {
    try {
      const res = await apiHandler.get(`/events/${shortId}/pool`);
      setPool(res.data);
    } catch {
      setPool(null);
    } finally {
      setLoading(false);
    }
  };

  // Temps réel : refresh quand une contribution est confirmée par le webhook
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;
    const handlePoolUpdate = ({ shortId: sId }) => {
      if (sId === shortId) fetchPool();
    };
    socket.on("event:pool_update", handlePoolUpdate);
    return () => socket.off("event:pool_update", handlePoolUpdate);
  }, [shortId]);

  useEffect(() => {
    fetchPool();
  }, [shortId]);

  if (loading) return <p className="gp-muted">Chargement de la cagnotte…</p>;
  if (!pool?.active) return null;

  const pct =
    pool.mode === "goal" && pool.goal
      ? Math.min(100, Math.round((pool.totalCollected / pool.goal) * 100))
      : null;

  return (
    <div className="gp-widget">
      <div className="gp-widget-header">
        <i className="fa-solid fa-piggy-bank gp-widget-icon"></i>
        <h3>Cagnotte commune</h3>
      </div>

      <div className="gp-amount">
        <span className="gp-amount-current">{euro(pool.totalCollected)}</span>
        {pool.mode === "goal" && pool.goal && (
          <span className="gp-amount-goal"> / {euro(pool.goal)}</span>
        )}
      </div>

      {isOrganizer && pool.totalCollected > 0 && (
        <div className="gp-net-row">
          <span className="gp-net-label">
            <i className="fa-solid fa-building-columns"></i> Vous recevrez
            environ
          </span>
          <span className="gp-net-value">
            {euroFee(netEstimate(pool.contributions || []))}
          </span>
          <span className="gp-net-detail">
            après ~{euroFee(totalFees(pool.contributions || []))} de frais
            Stripe
          </span>
        </div>
      )}

      {pct !== null && (
        <div className="gp-progress">
          <motion.div
            className="gp-progress-bar"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
          <span className="gp-progress-label">{pct}%</span>
        </div>
      )}

      <p className="gp-contributors-count">
        {pool.contributionsCount} contribution
        {pool.contributionsCount > 1 ? "s" : ""}
      </p>

      <motion.button
        className="gp-btn gp-btn-primary gp-btn-full"
        onClick={() => setShowModal(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <i className="fa-solid fa-heart"></i> Participer
      </motion.button>

      {pool.contributions?.length > 0 && (
        <div className="gp-contrib-list">
          {pool.contributions.map((c) => (
            <div key={c.id} className="gp-contrib-row">
              <span className="gp-contrib-name">
                {c.contributor
                  ? `${c.contributor.name} ${c.contributor.surname || ""}`.trim()
                  : "Anonyme"}
              </span>
              <span className="gp-contrib-amount">{euro(c.amount)}</span>
              {c.message && (
                <span className="gp-contrib-msg">"{c.message}"</span>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ContributeModal
          shortId={shortId}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            // Laisse le temps au webhook de confirmer, puis refresh
            setTimeout(fetchPool, 1500);
          }}
        />
      )}
    </div>
  );
};

export default GiftPoolWidget;
