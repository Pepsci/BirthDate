import React, { useEffect, useState } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import "./css/createDate.css";
import "../UI/css/modals.css";

const CreateDate = ({ onDateAdded }) => {
  const { currentUser } = useAuth();
  const currentUserID = currentUser ? currentUser._id : null;

  const [dates, setDates] = useState([]);
  const [filteredDates, setFilteredDates] = useState([]);
  const [addedDate, setAddedDate] = useState(false);

  // États pour la modal d'erreur
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
    owner: currentUserID || "",
  });

  // Mise à jour de l'owner une fois que currentUser est chargé
  useEffect(() => {
    if (currentUser) {
      setDate((prevDate) => ({
        ...prevDate,
        owner: currentUser._id,
      }));
    }
  }, [currentUser]);

  // Récupérer les dates depuis l'API
  useEffect(() => {
    apiHandler
      .get("/date")
      .then((dbResponse) => {
        setDates(dbResponse.data);
      })
      .catch((e) => console.error(e));
  }, [addedDate]);

  // Filtrer les dates de l'utilisateur connecté
  useEffect(() => {
    if (!currentUserID) return;
    setFilteredDates(
      dates.filter((c) => c.owner && c.owner._id === currentUserID)
    );
  }, [addedDate, dates, currentUserID]);

  const handleClick = async (e) => {
    e.preventDefault();

    if (!currentUserID) {
      console.error("User not authenticated");
      return;
    }

    // Validation : vérifier que le nom est rempli
    if (!date.name || date.name.trim() === "") {
      setErrorMessage("Veuillez entrer un nom avant d'ajouter une date.");
      setShowErrorMessage(true);
      return;
    }

    try {
      const newDate = await apiHandler.post("/date", date);
      setDates((prevDates) => [...prevDates, newDate.data]);
      setFilteredDates((prevDates) => [...prevDates, newDate.data]);

      // Réinitialiser le formulaire après l'ajout
      setDate({
        date: getTodayDate(),
        name: "",
        surname: "",
        family: false,
        comment: "",
        owner: currentUserID,
      });

      if (onDateAdded) {
        onDateAdded(newDate.data);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Une erreur est survenue lors de l'ajout de la date.");
      setShowErrorMessage(true);
    }
  };

  return (
    <div>
      {/* Modal d'erreur */}
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

      <div className="formAddDAte">
        <h3 className="title-filter">Ajouter une date d'anniversaires</h3>
        <form className="form-date" onSubmit={handleClick}>
          <div className="form-date-input1">
            <input
              type="text"
              name="name"
              className="form-date-input formAddInput"
              placeholder="Enter a name"
              value={date.name}
              onChange={(e) => setDate({ ...date, name: e.target.value })}
              required // Validation HTML5
            />

            <input
              type="text"
              name="surname"
              className="form-date-input formAddInput"
              placeholder="Enter a surname"
              value={date.surname}
              onChange={(e) => setDate({ ...date, surname: e.target.value })}
            />
            <div className="form-date-input2">
              <input
                className="form-date-input addDate-inputDate formAddInput"
                type="date"
                name="date"
                value={date.date}
                onChange={(e) => setDate({ ...date, date: e.target.value })}
              />
              <label className="form-date-labelDate" htmlFor="family">
                Family
              </label>
              <input
                className="form-date-input formAddInput"
                type="checkbox"
                id="family"
                checked={date.family}
                onChange={(e) => setDate({ ...date, family: e.target.checked })}
              />
            </div>
          </div>

          <button className="btnSwitch" type="submit">
            Ajouter
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateDate;
