import React, { useEffect, useState } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import NamedayInput from "./Namedayinput";
import "./css/namedayInput.css";
import "./css/createDate.css";
import "../UI/css/modals.css";

const CreateDate = ({ onDateAdded }) => {
  const { currentUser } = useAuth();
  const currentUserID = currentUser ? currentUser._id : null;

  const [dates, setDates] = useState([]);
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const [date, setDate] = useState({
    date: getTodayDate(),
    name: "",
    surname: "",
    family: false,
    comment: "",
    nameday: "",
    owner: currentUserID || "",
  });

  useEffect(() => {
    if (currentUser) {
      setDate((prev) => ({
        ...prev,
        owner: currentUser._id,
      }));
    }
  }, [currentUser]);

  const handleClick = async (e) => {
    e.preventDefault();

    if (!date.name.trim()) {
      setErrorMessage("Veuillez entrer un prénom.");
      setShowErrorMessage(true);
      return;
    }

    try {
      const newDate = await apiHandler.post("/date", date);
      setDates((prev) => [...prev, newDate.data]);

      setDate({
        date: getTodayDate(),
        name: "",
        surname: "",
        family: false,
        comment: "",
        nameday: "",
        owner: currentUserID,
      });

      if (onDateAdded) {
        onDateAdded(newDate.data);
      }
    } catch (error) {
      setErrorMessage("Erreur lors de l'ajout.");
      setShowErrorMessage(true);
    }
  };

  return (
    <div>
      {showErrorMessage && (
        <div
          className="error-message-overlay"
          onClick={() => setShowErrorMessage(false)}
        >
          <div className="error-message" onClick={(e) => e.stopPropagation()}>
            <div className="error-icon">✕</div>
            <h2>Erreur</h2>
            <p>{errorMessage}</p>
            <button
              className="error-message-button"
              onClick={() => setShowErrorMessage(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div className="formAddDate">
        <h3 className="title-filter">Ajouter une date</h3>

        <form className="form-date" onSubmit={handleClick}>
          <div className="filter-inputs">
            <input
              type="text"
              className="filter-input"
              placeholder="Prénom"
              value={date.name}
              onChange={(e) => setDate({ ...date, name: e.target.value })}
              required
            />

            <input
              type="text"
              className="filter-input"
              placeholder="Nom"
              value={date.surname}
              onChange={(e) => setDate({ ...date, surname: e.target.value })}
            />

            <input
              type="date"
              className="filter-input"
              value={date.date}
              onChange={(e) => setDate({ ...date, date: e.target.value })}
            />

            <NamedayInput
              value={date.nameday}
              onChange={(mmdd) => setDate({ ...date, nameday: mmdd })}
              placeholder="Fête (optionnel)"
            />

            <div className="form-date-checkbox">
              <label htmlFor="family">Family</label>
              <input
                type="checkbox"
                id="family"
                checked={date.family}
                onChange={(e) => setDate({ ...date, family: e.target.checked })}
              />
            </div>
          </div>

          <div className="filter-buttons">
            <button className="filter-btn" type="submit">
              Ajouter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDate;
