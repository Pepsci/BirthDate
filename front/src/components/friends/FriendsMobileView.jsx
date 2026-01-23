import { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import AddFriendModal from "./AddFriendModal";
import DeleteFriendModal from "./DeleteFriendModal";
import "./css/friend.css";

const FriendsMobileView = ({ currentUser }) => {
  const [friends, setFriends] = useState([]);
  const [pendingReceived, setPendingReceived] = useState([]);
  const [pendingSent, setPendingSent] = useState([]);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [friendToDelete, setFriendToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState("friends");

  useEffect(() => {
    if (currentUser?._id) {
      loadFriends();
      loadPendingRequests();
      loadSentRequests();
    }
  }, [currentUser]);

  const loadFriends = async () => {
    try {
      const response = await apiHandler.get(
        `/friends?userId=${currentUser._id}`,
      );
      setFriends(response.data);
    } catch (error) {
      console.error("Erreur chargement amis:", error);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const response = await apiHandler.get(
        `/friends/requests?userId=${currentUser._id}`,
      );
      setPendingReceived(response.data);
    } catch (error) {
      console.error("Erreur chargement demandes:", error);
    }
  };

  const loadSentRequests = async () => {
    try {
      const response = await apiHandler.get(
        `/friends/sent?userId=${currentUser._id}`,
      );
      setPendingSent(response.data);
    } catch (error) {
      console.error("Erreur chargement demandes envoyées:", error);
    }
  };

  const handleAcceptRequest = async (friendshipId) => {
    try {
      await apiHandler.patch(`/friends/${friendshipId}/accept`, {
        userId: currentUser._id,
      });
      loadFriends();
      loadPendingRequests();
    } catch (error) {
      console.error("Erreur acceptation:", error);
    }
  };

  const handleRejectRequest = async (friendshipId) => {
    try {
      await apiHandler.patch(`/friends/${friendshipId}/reject`, {
        userId: currentUser._id,
      });
      loadPendingRequests();
    } catch (error) {
      console.error("Erreur rejet:", error);
    }
  };

  const handleCancelRequest = async (friendshipId) => {
    try {
      await apiHandler.delete(`/friends/${friendshipId}`);
      loadSentRequests();
    } catch (error) {
      console.error("Erreur annulation:", error);
    }
  };

  const handleDeleteClick = (friendshipId, friendName) => {
    setFriendToDelete({ id: friendshipId, name: friendName });
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!friendToDelete) return;

    try {
      await apiHandler.delete(`/friends/${friendToDelete.id}`);
      setShowDeleteModal(false);
      setFriendToDelete(null);
      loadFriends();
    } catch (error) {
      console.error("Erreur suppression:", error);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setFriendToDelete(null);
  };

  const handleFriendAdded = () => {
    loadSentRequests();
  };

  return (
    <div className="friends-manager-mobile">
      <div className="friends-header">
        <h2>👥 Mes Amis</h2>
        <span className="friends-count">{friends.length} amis</span>
      </div>

      <div className="friends-tabs">
        <button
          className={`tab ${activeTab === "friends" ? "active" : ""}`}
          onClick={() => setActiveTab("friends")}
        >
          Amis ({friends.length})
        </button>
        <button
          className={`tab ${activeTab === "received" ? "active" : ""}`}
          onClick={() => setActiveTab("received")}
        >
          Reçues{" "}
          {pendingReceived.length > 0 && (
            <span className="badge">{pendingReceived.length}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === "sent" ? "active" : ""}`}
          onClick={() => setActiveTab("sent")}
        >
          Envoyées{" "}
          {pendingSent.length > 0 && (
            <span className="badge badge-sent">{pendingSent.length}</span>
          )}
        </button>
      </div>

      <div className="friends-content-mobile">
        {activeTab === "friends" && (
          <>
            {friends.length === 0 ? (
              <div className="empty-state">
                <p>👋 Aucun ami pour le moment</p>
              </div>
            ) : (
              <div className="friends-list">
                {friends.map((item) => {
                  if (!item || !item.friendship || !item.friendUser) {
                    return null;
                  }

                  const { friendship, friendUser } = item;

                  return (
                    <div key={friendship._id} className="friend-card">
                      <div className="friend-info">
                        <div className="friend-avatar">
                          {friendUser.avatar ? (
                            <img
                              src={friendUser.avatar}
                              alt={friendUser.name}
                            />
                          ) : (
                            <div className="avatar-placeholder">
                              {friendUser.name
                                ? friendUser.name[0].toUpperCase()
                                : "?"}
                            </div>
                          )}
                        </div>
                        <div className="friend-details">
                          <h4>{friendUser.name || "Utilisateur inconnu"}</h4>
                          <p className="friend-email">{friendUser.email}</p>
                        </div>
                      </div>
                      <button
                        className="delete-friend-btn"
                        onClick={() =>
                          handleDeleteClick(friendship._id, friendUser.name)
                        }
                      >
                        🗑️
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              className="add-friend-btn btn-carousel"
              onClick={() => setShowAddFriendModal(true)}
            >
              + Ajouter un ami
            </button>
          </>
        )}

        {activeTab === "received" && (
          <>
            {pendingReceived.length === 0 ? (
              <div className="empty-state">
                <p>📭 Aucune demande en attente</p>
              </div>
            ) : (
              <div className="pending-requests">
                {pendingReceived.map((request) => {
                  if (!request.user) return null;

                  return (
                    <div key={request._id} className="request-card">
                      <div className="request-info">
                        <div className="request-avatar">
                          {request.user.avatar ? (
                            <img
                              src={request.user.avatar}
                              alt={request.user.name}
                            />
                          ) : (
                            <div className="avatar-placeholder">
                              {request.user.name
                                ? request.user.name[0].toUpperCase()
                                : "?"}
                            </div>
                          )}
                        </div>
                        <div className="request-details">
                          <h4>{request.user.name || "Utilisateur inconnu"}</h4>
                          <p className="request-email">{request.user.email}</p>
                        </div>
                      </div>
                      <div className="request-actions">
                        <button
                          className="btn-accept"
                          onClick={() => handleAcceptRequest(request._id)}
                        >
                          ✓
                        </button>
                        <button
                          className="btn-reject"
                          onClick={() => handleRejectRequest(request._id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === "sent" && (
          <>
            {pendingSent.length === 0 ? (
              <div className="empty-state">
                <p>📤 Aucune demande envoyée</p>
              </div>
            ) : (
              <div className="sent-requests">
                {pendingSent.map((request) => {
                  if (!request.friend) return null;

                  return (
                    <div key={request._id} className="request-card">
                      <div className="request-info">
                        <div className="request-avatar">
                          {request.friend.avatar ? (
                            <img
                              src={request.friend.avatar}
                              alt={request.friend.name}
                            />
                          ) : (
                            <div className="avatar-placeholder">
                              {request.friend.name
                                ? request.friend.name[0].toUpperCase()
                                : "?"}
                            </div>
                          )}
                        </div>
                        <div className="request-details">
                          <h4>
                            {request.friend.name || "Utilisateur inconnu"}
                          </h4>
                          <p className="request-email">
                            {request.friend.email}
                          </p>
                        </div>
                      </div>
                      <div className="request-actions">
                        <button
                          className="btn-cancel-request"
                          onClick={() => handleCancelRequest(request._id)}
                        >
                          ✕ Annuler
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <AddFriendModal
        isOpen={showAddFriendModal}
        onClose={() => setShowAddFriendModal(false)}
        currentUserId={currentUser?._id}
        onFriendAdded={handleFriendAdded}
      />

      <DeleteFriendModal
        isOpen={showDeleteModal}
        friendName={friendToDelete?.name}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default FriendsMobileView;
