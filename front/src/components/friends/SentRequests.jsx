const SentRequests = ({ requests, onCancel }) => {
  if (requests.length === 0) {
    return (
      <div className="empty-state">
        <p>📤 Aucune demande envoyée</p>
      </div>
    );
  }

  return (
    <div className="sent-requests">
      {requests.map((request) => {
        // Vérification de sécurité
        if (!request.friend) {
          console.error("Request sans friend:", request);
          return null;
        }

        return (
          <div key={request._id} className="request-card">
            <div className="request-info">
              <div className="request-avatar">
                {request.friend.avatar ? (
                  <img
                    src={request.friend.avatar}
                    alt={request.friend.name || "Ami"}
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
                <h4>{request.friend.name || "Utilisateur inconnu"}</h4>
                <p className="request-email">
                  {request.friend.email || "Email non disponible"}
                </p>
                {request.requestedAt && (
                  <p className="request-date">
                    Envoyée le{" "}
                    {new Date(request.requestedAt).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </div>
            </div>
            <div className="request-actions">
              <button
                className="btn-cancel-request"
                onClick={() => onCancel(request._id)}
                title="Annuler la demande"
              >
                ✕ Annuler
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SentRequests;
