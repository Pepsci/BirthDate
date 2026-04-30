import { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import FriendsList from "./FriendsList";
import PendingRequests from "./PendingRequests";
import SentRequests from "./SentRequests";
import AddFriendModal from "./AddFriendModal";
import DeleteFriendModal from "./DeleteFriendModal";
import "./css/friend.css";

const FriendsSection = ({ currentUser }) => {
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
    <div className="friends-manager">
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

      {/* ── Bouton Ajouter un ami, toujours visible sous les tabs ── */}
      <button
        className="add-friend-btn"
        onClick={() => setShowAddFriendModal(true)}
      >
        + Ajouter un ami
      </button>

      <div className="friends-content">
        {activeTab === "friends" && (
          <FriendsList friends={friends} onDelete={handleDeleteClick} />
        )}

        {activeTab === "received" && (
          <PendingRequests
            requests={pendingReceived}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
          />
        )}

        {activeTab === "sent" && (
          <SentRequests requests={pendingSent} onCancel={handleCancelRequest} />
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

export default FriendsSection;
