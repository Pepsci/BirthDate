import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";

const CreateDate = ({ onDateAdded }) => {
  const { currentUser } = useAuth();

  const currentUserID = currentUser._id;

  const [dates, setDates] = useState([]);

  const [date, setDate] = useState({
    date: "",
    name: "",
    surname: "",
    comment: "",
    owner: currentUserID,
  });

  const [addedDate, setAddedDate] = useState(false);

  const handleClick = async (e) => {
    e.preventDefault();
    try {
      const newDate = await apiHandler.post("/date", date);
      setAddedDate(true);
      setDates([...dates, newDate.data]); // Ajoute la nouvelle date à la liste des dates
      setDate({
        ...date,
        date: "",
        name: "",
        surname: "",
        comment: "",
        owner: currentUserID,
      });
      setAddedDate(false);
      // Appelle la fonction de rappel
      if (onDateAdded) {
        onDateAdded(newDate.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="date">
      <form className="form-date" onSubmit={handleClick}>
        <label htmlFor="name" className="form-date-label">
          Name
        </label>
        <input
          type="text"
          name="name"
          id="name"
          className="form-date-input"
          placeholder="Enter a name"
          value={date.name}
          onChange={(e) => setDate({ ...date, name: e.target.value })}
        />

        <label htmlFor="surname" className="form-date-label">
          Surname
        </label>
        <input
          type="text"
          name="surname"
          id="surname"
          className="form-date-input"
          placeholder="Enter a surname"
          value={date.surname}
          onChange={(e) => setDate({ ...date, surname: e.target.value })}
        />

        <label htmlFor="date">Date</label>
        <input
          type="date"
          name="date"
          value={date.date}
          onChange={(e) => setDate({ ...date, date: e.target.value })}
        />

        <button>Add</button>
      </form>
    </div>
  );
};

export default CreateDate;
