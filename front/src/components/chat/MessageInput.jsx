import { useState, useEffect } from "react";
import "./css/messageInput.css";

function MessageInput({
  onSendMessage,
  onTyping,
  onFocus,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
}) {
  const [message, setMessage] = useState("");

  // Remplir l'input quand on commence à éditer
  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.content);
    }
  }, [editingMessage]);

  const handleChange = (e) => {
    setMessage(e.target.value);
    if (onTyping) {
      onTyping(e.target.value.length > 0);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!message.trim()) return;

    // Si on est en mode édition
    if (editingMessage) {
      onSaveEdit(message.trim());
    } else {
      // Mode envoi normal
      onSendMessage(message.trim());
    }

    setMessage("");
    if (onTyping) {
      onTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCancel = () => {
    setMessage("");
    onCancelEdit();
  };

  const handleFocus = () => {
    if (onFocus) onFocus();
  };

  return (
    <div className="message-input-form">
      {/* Indicateur d'édition */}
      {editingMessage && (
        <div className="editing-indicator">
          <span>✏️ Modification du message</span>
          <button onClick={handleCancel} className="cancel-edit-btn">
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="message-input-form">
        <textarea
          value={message}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          onFocus={handleFocus}
          placeholder={
            editingMessage
              ? "Modifier le message..."
              : "Écrivez votre message..."
          }
          rows="1"
          maxLength={2000}
          className={editingMessage ? "editing" : ""}
        />
        <button
          className="send-button"
          type="submit"
          disabled={!message.trim()}
        >
          {editingMessage ? "✓" : "📤"}
        </button>
      </form>
    </div>
  );
}

export default MessageInput;

//   return (
//     <form className="message-input" onSubmit={handleSubmit}>
//       <textarea
//         value={message}
//         onChange={handleChange}
//         onKeyPress={handleKeyPress}
//         onFocus={handleFocus}
//         placeholder="Écrivez votre message..."
//         rows="1"
//         maxLength="2000"
//       />
//       <button
//         type="submit"
//         disabled={message.trim().length === 0}
//         className="send-button"
//       >
//         📤
//       </button>
//     </form>
//   );
// }

// export default MessageInput;
