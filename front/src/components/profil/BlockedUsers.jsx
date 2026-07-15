// Liste des utilisateurs bloqués + déblocage (conformité stores : modération UGC)
import { useEffect, useState } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/blockedUsers.css";

function BlockedUsers() {
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiHandler
      .getBlockedUsers()
      .then(setBlocked)
      .catch((e) => setError(e?.message || "Erreur de chargement."))
      .finally(() => setLoading(false));
  }, []);

  const unblock = async (user) => {
    if (!window.confirm(`Débloquer ${user.name} ? Son contenu redeviendra visible.`))
      return;
    try {
      await apiHandler.unblockUser(user._id);
      setBlocked((prev) => prev.filter((b) => b._id !== user._id));
    } catch (e) {
      alert(e?.message || "Déblocage impossible.");
    }
  };

  if (loading) return null;

  return (
    <div className="blocked-users">
      <h3 className="blocked-users-title">🚫 Utilisateurs bloqués</h3>
      {error && <p className="blocked-users-error">{error}</p>}
      {blocked.length === 0 ? (
        <p className="blocked-users-empty">
          Aucun utilisateur bloqué. Tu peux bloquer quelqu'un depuis un chat
          (bouton 🚫) ou en signalant un message.
        </p>
      ) : (
        <ul className="blocked-users-list">
          {blocked.map((u) => (
            <li key={u._id} className="blocked-users-item">
              <img
                src={u.avatar}
                alt=""
                className="blocked-users-avatar"
              />
              <span className="blocked-users-name">
                {u.name} {u.surname || ""}
              </span>
              <button
                className="blocked-users-unblock"
                onClick={() => unblock(u)}
              >
                Débloquer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default BlockedUsers;
