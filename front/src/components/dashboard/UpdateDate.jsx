import apiHandler from "../../api/apiHandler";
import { useState, useEffect } from "react";

const UpdateDate = () => {
  const [date, setDate] = useState(dateToUpdate);

  useEffect(() => {
    setDate(dateToUpdate);
  }, [dateToUpdate]);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [dateToUpdate, setDateToUpdate] = useState(null);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    let month = "" + (date.getMonth() + 1);
    let day = "" + date.getDate();
    const year = date.getFullYear();

    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;

    return [year, month, day].join("-");
  };

  const handleEditMode = (id) => {
    apiHandler
      .get(`/date/${id}`)
      .then((dbResponse) => {
        setDate(dbResponse.data);
        console.log(dbResponse.data);
      })
      .catch((err) => {
        console.log(err);
      });
    setIsEditing(true);
    setEditingId(id);
  };

  const handleEditDate = async (e) => {
    e.preventDefault();

    const fd = new FormData();
    fd.append("date", dateToUpdate.date);
    fd.append("name", dateToUpdate.name);
    fd.append("surname", dateToUpdate.surname);
    try {
      const dbResponse = await apiHandler.patch(
        `/date/${dateToUpdate._id}`,
        fd
      );
      setDateToUpdate(dbResponse.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCancelEditDate = (e) => {
    e.preventDefault();
    setIsEditing(false);
  };

  return (
    <div className="forEditDate">
      <form className="form-date" onSubmit={handleEditDate}>
        {/* <label htmlFor="name">Name</label> */}
        <input
          type="text"
          className="formEditDate"
          value={date.name}
          onChange={(e) => setDate({ ...date, name: e.target.value })}
        />
        {/* <label htmlFor="surname">Surname</label> */}
        <input
          type="text"
          className="formEditDate"
          value={date.surname}
          onChange={(e) => setDate({ ...date, surname: e.target.value })}
        />
        {/* <label htmlFor="date">Date</label> */}
        <input
          type="date"
          value={formatDate(date.date)}
          onChange={(e) => setDate({ ...date, date: e.target.value })}
        />
        <button>Update</button>
        <button onClick={handleCancelEditDate}>Cancel</button>
      </form>
    </div>
  );
};

export default UpdateDate;
