import React, { useState } from "react";
import agenda from "./css/agenda.css";

const Agenda = ({ dates }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.setMonth(currentMonth.getMonth() + 1))
    );
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.setMonth(currentMonth.getMonth() - 1))
    );
  };

  const datesInCurrentMonth = dates.filter((date) => {
    const dateObject = new Date(date.date);
    return dateObject.getMonth() === currentMonth.getMonth();
  });

  // Créer un tableau pour les jours du mois
  const daysInMonth = new Array(
    new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    ).getDate()
  )
    .fill(null)
    .map(() => []);

  // Remplir le tableau avec les dates d'anniversaire
  datesInCurrentMonth.forEach((date) => {
    const dateObject = new Date(date.date);
    daysInMonth[dateObject.getDate() - 1].push(date);
  });

  // Créer un tableau pour les semaines du mois
  const weeksInMonth = [];
  for (let i = 0; i < daysInMonth.length; i += 7) {
    weeksInMonth.push(daysInMonth.slice(i, i + 7));
  }

  return (
    <div>
      <div className="month-navigation">
        <button className="btnAgenda" onClick={handlePreviousMonth}>
          Mois précédent
        </button>
        <h2>
          {currentMonth.toLocaleString("fr-FR", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <button className="btnAgenda" onClick={handleNextMonth}>
          Mois suivant
        </button>
      </div>
      <table>
        <tbody>
          {weeksInMonth.map((week, weekIndex) => (
            <tr key={weekIndex}>
              {week.map((dates, dayIndex) => {
                const dayOfMonth = weekIndex * 7 + dayIndex + 1;
                const dateObject = new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth(),
                  dayOfMonth
                );
                const dayOfWeek = dateObject.toLocaleDateString("fr-FR", {
                  weekday: "long",
                });
                return (
                  <td key={dayIndex}>
                    <div className="square">
                      <div className="square-content">
                        <div className="day-number">
                          <strong>{dayOfMonth}</strong> {dayOfWeek}
                        </div>
                        <div className="names">
                          {dates.length > 0
                            ? dates.map((date) => (
                                <div key={date._id}>
                                  <span>
                                    <b>
                                      {date.name} {date.surname}
                                    </b>
                                  </span>
                                </div>
                              ))
                            : "Pas d'anniversaire"}
                        </div>
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Agenda;
