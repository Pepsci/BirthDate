// components/notifications/FriendRequestEmailPreference.jsx
// Composant optionnel à ajouter dans ta page Notifications

import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";

const FriendRequestEmailPreference = ({ currentUser, setCurrentUser }) => {
  const [updating, setUpdating] = useState(false);
  const [userReceivesFriendEmails, setUserReceivesFriendEmails] = useState(
    currentUser?.receiveFriendRequestEmails !== false,
  );

  const toggleFriendRequestEmails = async () => {
    setUpdating(true);
    const newValue = !userReceivesFriendEmails;

    try {
      await apiHandler.patch(`/users/${currentUser._id}`, {
        receiveFriendRequestEmails: newValue,
      });

      setUserReceivesFriendEmails(newValue);

      if (setCurrentUser) {
        setCurrentUser((prev) => ({
          ...prev,
          receiveFriendRequestEmails: newValue,
        }));
      }
    } catch (error) {
      console.error(
        "Erreur lors de la modification des emails de demandes d'ami:",
        error,
      );
      // Revenir à l'état précédent en cas d'erreur
      setUserReceivesFriendEmails(!newValue);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="user-email-preferences-simple">
      <div className="user-pref-toggle-simple">
        <div className="toggle-info">
          <span className="toggle-label">
            Recevoir les emails de demandes d'ami
          </span>
          <span className="toggle-sublabel">
            Soyez notifié quand quelqu'un vous envoie une demande d'ami
          </span>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={userReceivesFriendEmails}
            onChange={toggleFriendRequestEmails}
            disabled={updating}
          />
          <span className="slider round"></span>
        </label>
      </div>
    </div>
  );
};

export default FriendRequestEmailPreference;
