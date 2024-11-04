import React, { useEffect, useState } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import "./css/createDate.css";

const CreateDate = ({ onDateAdded }) => {
  const { currentUser } = useAuth();

  const currentUserID = currentUser._id;

  const [dates, setDates] = useState([]);

  const [date, setDate] = useState({
    date: "",
    name: "",
    surname: "",
    family: false,
    comment: "",
    owner: currentUserID,
  });

  const [addedDate, setAddedDate] = useState(false);
  const [filterdDate, setFilteredDates] = useState([]);

  useEffect(() => {
    apiHandler
      .get("date")
      .then((dbResponse) => {
        console.log("response db", dbResponse.date);
        setDates(dbResponse.data);
      })
      .catch((e) => {
        console.error(e);
      });
  }, [addedDate]);

  useEffect(() => {
    setFilteredDates(
      dates.filter((c) => {
        return c.owner._id === currentUserID;
      })
    );
  }, [addedDate, dates, date]);

  const handleClick = async (e) => {
    e.preventDefault();
    try {
      const newDate = await apiHandler.post("/date", date);
      setAddedDate(true);
      setDates([...dates, newDate.data]);
      setDate({
        ...date,
        date: "",
        name: "",
        surname: "",
        family: false,
        comment: "",
        owner: currentUserID,
      });
      setAddedDate(false);
      if (onDateAdded) {
        onDateAdded(newDate.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <div className="formAddDAte">
        <form className="form-date" onSubmit={handleClick}>
          {/* <label htmlFor="name" className="form-date-label">
          Name
        </label> */}
          <input
            type="text"
            name="name"
            id="name"
            className="formAddInput"
            placeholder="Enter a name"
            value={date.name}
            onChange={(e) => setDate({ ...date, name: e.target.value })}
          />

          {/* <label htmlFor="surname" className="form-date-label">
          Surname
        </label> */}
          <input
            type="text"
            name="surname"
            id="surname"
            className="formAddInput"
            placeholder="Enter a surname"
            value={date.surname}
            onChange={(e) => setDate({ ...date, surname: e.target.value })}
          />

          {/* <label htmlFor="date">Date</label> */}
          <input
            className="formAddInput"
            type="date"
            name="date"
            value={date.date}
            onChange={(e) => setDate({ ...date, date: e.target.value })}
          />

          <label htmlFor="family">Family</label>
          <input
            type="checkbox"
            id="family"
            checked={date.family}
            onChange={(e) => setDate({ ...date, family: e.target.checked })}
          />

          <button>Add</button>
        </form>
      </div>
    </div>
  );
};

export default CreateDate;
