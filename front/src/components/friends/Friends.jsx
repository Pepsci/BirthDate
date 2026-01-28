import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../context/useAuth";
import apiHandler from "../../api/apiHandler";
import PendingRequests from "./PendingRequests";
import SentRequests from "./SentRequests";
import "./css/friend.css";

const Friends = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("pending"); // "pending", "sent", "friends"

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    loadData();
  }, [currentUser, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger les demandes reçues (pending)
      const pendingResponse = await apiHandler.get(
        `/friends/requests?userId=${currentUser._id}`,
      );
      setPendingRequests(pendingResponse.data || []);

      // Charger les demandes envoyées (sent)
      const sentResponse = await apiHandler.get(
        `/friends/sent?userId=${currentUser._id}`,
      );
      setSentRequests(sentResponse.data || []);

      // Charger la liste d'amis acceptés
      const friendsResponse = await apiHandler.get(
        `/friends?userId=${currentUser._id}`,
      );
      setFriends(friendsResponse.data || []);
    } catch (err) {
      console.error("Erreur lors du chargement:", err);
      setError("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (friendshipId) => {
    try {
      await apiHandler.patch(`/friends/${friendshipId}/accept`, {
        userId: currentUser._id,
      });

      // Recharger les données
      await loadData();

      // Optionnel : afficher un message de succès
      alert("✅ Demande d'ami acceptée !");
    } catch (err) {
      console.error("Erreur lors de l'acceptation:", err);
      alert("❌ Erreur lors de l'acceptation");
    }
  };

  const handleReject = async (friendshipId) => {
    try {
      await apiHandler.patch(`/friends/${friendshipId}/reject`, {
        userId: currentUser._id,
      });

      // Recharger les données
      await loadData();

      alert("✅ Demande refusée");
    } catch (err) {
      console.error("Erreur lors du refus:", err);
      alert("❌ Erreur lors du refus");
    }
  };

  const handleCancel = async (friendshipId) => {
    if (!window.confirm("Voulez-vous vraiment annuler cette demande ?")) {
      return;
    }

    try {
      await apiHandler.delete(`/friends/${friendshipId}`);

      // Recharger les données
      await loadData();

      alert("✅ Demande annulée");
    } catch (err) {
      console.error("Erreur lors de l'annulation:", err);
      alert("❌ Erreur lors de l'annulation");
    }
  };

  const handleRemoveFriend = async (friendshipId) => {
    if (!window.confirm("Voulez-vous vraiment retirer cet ami ?")) {
      return;
    }

    try {
      await apiHandler.delete(`/friends/${friendshipId}`);

      // Recharger les données
      await loadData();

      alert("✅ Ami retiré");
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
      alert("❌ Erreur lors de la suppression");
    }
  };

  if (loading) {
    return (
      <div className="friends-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="friends-page">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={loadData} className="btn-retry">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const pendingCount = pendingRequests.length;
  const sentCount = sentRequests.length;
  const friendsCount = friends.length;

  return (
    <div className="friends-page">
      <div className="friends-header">
        <h1>👥 Mes Amis</h1>
        <button className="btn-back" onClick={() => navigate("/profile")}>
          ← Retour au profil
        </button>
      </div>

      {/* Onglets de navigation */}
      <div className="friends-tabs">
        <button
          className={`tab ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          📥 Demandes reçues
          {pendingCount > 0 && <span className="badge">{pendingCount}</span>}
        </button>
        <button
          className={`tab ${activeTab === "sent" ? "active" : ""}`}
          onClick={() => setActiveTab("sent")}
        >
          📤 Demandes envoyées
          {sentCount > 0 && <span className="badge">{sentCount}</span>}
        </button>
        <button
          className={`tab ${activeTab === "friends" ? "active" : ""}`}
          onClick={() => setActiveTab("friends")}
        >
          ✅ Mes amis ({friendsCount})
        </button>
      </div>

      {/* Contenu des onglets */}
      <div className="friends-content">
        {activeTab === "pending" && (
          <div className="tab-content">
            <h2>Demandes d'amitié reçues</h2>
            <PendingRequests
              requests={pendingRequests}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          </div>
        )}

        {activeTab === "sent" && (
          <div className="tab-content">
            <h2>Demandes envoyées</h2>
            <SentRequests requests={sentRequests} onCancel={handleCancel} />
          </div>
        )}

        {activeTab === "friends" && (
          <div className="tab-content">
            <h2>Mes amis</h2>
            {friends.length === 0 ? (
              <div className="empty-state">
                <p>👥 Vous n'avez pas encore d'amis</p>
                <p>Envoyez des demandes d'amitié pour commencer !</p>
              </div>
            ) : (
              <div className="friends-list">
                {friends.map((friendship) => {
                  // Déterminer qui est l'ami (celui qui n'est pas currentUser)
                  const friend =
                    friendship.user._id === currentUser._id
                      ? friendship.friend
                      : friendship.user;

                  return (
                    <div key={friendship._id} className="friend-card">
                      <div className="friend-info">
                        <div className="friend-avatar">
                          {friend.avatar ? (
                            <img src={friend.avatar} alt={friend.name} />
                          ) : (
                            <div className="avatar-placeholder">
                              {friend.name ? friend.name[0].toUpperCase() : "?"}
                            </div>
                          )}
                        </div>
                        <div className="friend-details">
                          <h4>{friend.name || "Utilisateur inconnu"}</h4>
                          <p className="friend-email">{friend.email}</p>
                          {friendship.acceptedAt && (
                            <p className="friend-since">
                              Amis depuis le{" "}
                              {new Date(
                                friendship.acceptedAt,
                              ).toLocaleDateString("fr-FR")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="friend-actions">
                        <button
                          className="btn-remove"
                          onClick={() => handleRemoveFriend(friendship._id)}
                          title="Retirer cet ami"
                        >
                          🗑️ Retirer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Friends;
