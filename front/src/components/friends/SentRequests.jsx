const SentRequests = ({ requests, invitations = [], onCancel }) => {
  const hasRequests = requests.length > 0;
  const hasInvitations = invitations.length > 0;

  if (!hasRequests && !hasInvitations) {
    return (
      <div className="empty-state">
        <p>📤 Aucune demande envoyée</p>
      </div>
    );
  }

  return (
    <div className="sent-requests">
      {/* ── DEMANDES VERS UTILISATEURS INSCRITS ── */}
      {hasRequests && (
        <div className="sent-section">
          {hasInvitations && (
            <p className="sent-section-label">Demandes en attente</p>
          )}
          {requests.map((request) => {
            if (!request.friend) return null;

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
                        {new Date(request.requestedAt).toLocaleDateString(
                          "fr-FR",
                        )}
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
      )}

      {/* ── INVITATIONS EXTERNES (non inscrits) ── */}
      {hasInvitations && (
        <div className="sent-section">
          {hasRequests && (
            <p className="sent-section-label">Invitations par email</p>
          )}
          {invitations.map((invitation) => (
            <div
              key={invitation._id}
              className="request-card request-card--invitation"
            >
              <div className="request-info">
                <div className="avatar-placeholder avatar-placeholder--email">
                  ✉
                </div>
                <div className="request-details">
                  <h4>{invitation.email}</h4>
                  <p className="request-date">
                    Invité le{" "}
                    {new Date(invitation.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
              <div className="request-actions">
                <span className="invitation-badge">
                  En attente d'inscription
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SentRequests;
