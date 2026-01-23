const PendingRequests = ({ requests, onAccept, onReject }) => {
  if (requests.length === 0) {
    return (
      <div className="empty-state">
        <p>📭 Aucune demande en attente</p>
      </div>
    );
  }

  return (
    <div className="pending-requests">
      {requests.map((request) => {
        // 👇 VÉRIFICATION DE SÉCURITÉ
        if (!request.user) {
          console.error("Request sans user:", request);
          return null;
        }

        return (
          <div key={request._id} className="request-card">
            <div className="request-info">
              <div className="request-avatar">
                {request.user.avatar ? (
                  <img
                    src={request.user.avatar}
                    alt={request.user.name || "Ami"}
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {request.user.name ? request.user.name[0] : "?"}
                  </div>
                )}
              </div>
              <div className="request-details">
                <h4>{request.user.name || "Utilisateur inconnu"}</h4>
                <p className="request-email">
                  {request.user.email || "Email non disponible"}
                </p>
                {request.requestedAt && (
                  <p className="request-date">
                    {new Date(request.requestedAt).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </div>
            </div>
            <div className="request-actions">
              <button
                className="btn-accept"
                onClick={() => onAccept(request._id)}
                title="Accepter la demande"
              >
                ✓ Accepter
              </button>
              <button
                className="btn-reject"
                onClick={() => onReject(request._id)}
                title="Refuser la demande"
              >
                ✕ Refuser
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PendingRequests;
