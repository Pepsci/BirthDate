// updateDate.js
import apiHandler from "../../api/apiHandler";

export const handleEditDate = async (
  dateToUpdate,
  dates,
  setDates,
  setEditingId
) => {
  const updatedDate = {
    name: dateToUpdate.name,
    surname: dateToUpdate.surname,
    date: dateToUpdate.date,
  };

  try {
    console.log("dateToUpdate", updatedDate);
    const dbResponse = await apiHandler.patch(
      `/date/${dateToUpdate._id}`,
      updatedDate
    );

    // Mettre à jour la liste des dates avec la date mise à jour
    const updatedDates = dates.map((date) => {
      if (date._id === dbResponse.data._id) {
        return dbResponse.data;
      } else {
        return date;
      }
    });

    setDates(updatedDates);
    setEditingId(null);
  } catch (error) {
    console.error(error);
  }
};
