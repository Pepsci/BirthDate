import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import apiHandler from "../../api/apiHandler";
import "./css/InviteModal.css";

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const modalVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.96,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

const InviteModal = ({ shortId, onClose }) => {
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [externalEmails, setExternalEmails] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiHandler
      .get("/friends")
      .then((res) => setFriends(res.data))
      .catch((err) => console.error("Error fetching friends", err));
  }, []);

  const toggleFriend = (id) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  const handleInvite = async () => {
    setLoading(true);
    try {
      const emails = externalEmails
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e !== "");
      await apiHandler.post(`/events/${shortId}/invite`, {
        userIds: selectedFriends,
        externalEmails: emails,
      });
      onClose(true);
    } catch (err) {
      console.error("Error sending invites", err);
      setLoading(false);
    }
  };

  const isSubmitDisabled =
    loading || (selectedFriends.length === 0 && !externalEmails.trim());

  return (
    <motion.div
      className="invite-overlay"
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={() => onClose(false)}
    >
      <motion.div
        className="invite-modal"
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="titleFont">Inviter des proches</h2>

        <motion.div
          className="invite-modal-body"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.25 }}
        >
          {/* Amis BirthReminder */}
          <div>
            <label>Vos amis BirthReminder</label>
            <div className="invite-friends-list">
              {friends
                .filter((f) => f.friendUser)
                .map((f, i) => (
                  <motion.label
                    key={f.friendUser._id}
                    className="invite-friend-row"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFriends.includes(f.friendUser._id)}
                      onChange={() => toggleFriend(f.friendUser._id)}
                    />
                    <span>
                      {f.friendUser.name} {f.friendUser.surname}
                    </span>
                  </motion.label>
                ))}
            </div>
          </div>

          {/* Emails externes */}
          <div>
            <label>Email d'invités externes (séparés par une virgule)</label>
            <textarea
              placeholder="exemple@email.com, ami@email.com"
              value={externalEmails}
              onChange={(e) => setExternalEmails(e.target.value)}
            />
          </div>
        </motion.div>

        <div className="invite-modal-footer">
          <motion.button
            className="invite-btn-cancel"
            onClick={() => onClose(false)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            Annuler
          </motion.button>
          <motion.button
            className="invite-btn-submit"
            onClick={handleInvite}
            disabled={isSubmitDisabled}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            animate={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Envoi…" : "Envoyer les invitations 📨"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default InviteModal;
