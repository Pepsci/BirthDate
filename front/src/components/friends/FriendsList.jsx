import { Link } from "react-router-dom";

const FriendsList = ({ friends, onDelete, onAddClick }) => {
  if (friends.length === 0) {
    return (
      <>
        <div className="empty-state">
          <p>👋 Aucun ami pour le moment</p>
          <p className="empty-subtitle">Ajoutez vos premiers amis !</p>
        </div>
        <button className="add-friend-btn" onClick={onAddClick}>
          + Ajouter un ami
        </button>
      </>
    );
  }

  return (
    <>
      <div className="friends-list">
        {friends.map((item) => {
          // Vérifications de sécurité
          if (!item || !item.friendship || !item.friendUser) {
            console.error("Données ami invalides:", item);
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
                      alt={friendUser.name || "Ami"}
                    />
                  ) : (
                    <div className="avatar-placeholder">
                      {friendUser.name ? friendUser.name[0].toUpperCase() : "?"}
                    </div>
                  )}
                </div>
                <div className="friend-details">
                  <h4>{friendUser.name || "Utilisateur inconnu"}</h4>
                  <p className="friend-email">
                    {friendUser.email || "Email non disponible"}
                  </p>
                  {friendUser.birthDate && (
                    <p className="friend-birth">
                      🎂{" "}
                      {new Date(friendUser.birthDate).toLocaleDateString(
                        "fr-FR",
                      )}
                    </p>
                  )}
                </div>
              </div>
              <button
                className="delete-friend-btn"
                onClick={() => onDelete(friendship._id, friendUser.name)}
                title="Supprimer cet ami"
              >
                🗑️
              </button>
            </div>
          );
        })}
      </div>
      <button className="add-friend-btn" onClick={onAddClick}>
        + Ajouter un ami
      </button>
    </>
  );
};

export default FriendsList;
