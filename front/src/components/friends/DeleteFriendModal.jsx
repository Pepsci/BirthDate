import "./css/friend.css";

const DeleteFriendModal = ({ isOpen, friendName, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content delete-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>⚠️ Supprimer cet ami ?</h2>
        </div>

        <div className="modal-body">
          <p className="delete-warning">
            Voulez-vous vraiment supprimer{" "}
            <strong>{friendName || "cet ami"}</strong> de votre liste d'amis ?
          </p>
          <p className="delete-info">
            Cette action est irréversible. Vous devrez renvoyer une demande
            d'amitié pour le rajouter.
          </p>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn-modal btn-cancel"
            onClick={onCancel}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn-modal btn-delete"
            onClick={onConfirm}
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteFriendModal;
