import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AgendaDayModal from "./AgendaDayModal";
import "./css/agenda.css";

const DAY_HEADERS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];
const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const WEEK_VIEW_MAX_ITEMS = 3;

const getMonday = (date) => {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const Agenda = ({ dates, events = [], initialMonth, initialYear }) => {
  const navigate = useNavigate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMode, setViewMode] = useState(
    window.innerWidth <= 768 ? "week" : "month"
  );
  const [currentMonth, setCurrentMonth] = useState(
    new Date(
      initialYear !== undefined ? initialYear : today.getFullYear(),
      initialMonth !== undefined ? initialMonth : today.getMonth(),
      1,
    ),
  );
  const [weekStart, setWeekStart] = useState(getMonday(today));
  const [modalDate, setModalDate] = useState(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Normalize events to a resolved date
  const normalizedEvents = (events || [])
    .map((ev) => {
      let evDate = null;
      if (ev.dateMode === "fixed" && ev.fixedDate) evDate = new Date(ev.fixedDate);
      else if (ev.dateMode === "vote" && ev.selectedDate) evDate = new Date(ev.selectedDate);
      if (!evDate) return null;
      evDate.setHours(0, 0, 0, 0);
      return { ...ev, resolvedDate: evDate };
    })
    .filter(Boolean);

  // ── Helpers ───────────────────────────────────────────
  const isToday = (d) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  // Birthdays: compare month+day only (annual)
  const getBdaysForDate = (targetDate) =>
    dates.filter((d) => {
      const dd = new Date(d.date);
      return dd.getDate() === targetDate.getDate() && dd.getMonth() === targetDate.getMonth();
    });

  // Namedays: format "MM-DD", compare month+day only (annual)
  const getNamedaysForDate = (targetDate) =>
    dates.filter((d) => {
      const nd = d.nameday || d.linkedUser?.nameday;
      if (!nd) return false;
      const [ndMonth, ndDay] = nd.split("-").map(Number);
      return ndDay === targetDate.getDate() && ndMonth - 1 === targetDate.getMonth();
    });

  // Events: compare full date (year+month+day)
  const getEventsForDate = (targetDate) =>
    normalizedEvents.filter((ev) => {
      const d = ev.resolvedDate;
      return (
        d.getDate() === targetDate.getDate() &&
        d.getMonth() === targetDate.getMonth() &&
        d.getFullYear() === targetDate.getFullYear()
      );
    });

  // ── Month view: index by day ──────────────────────────
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalCells = offset + daysInMonth;

  const birthdaysByDay = {};
  dates.forEach((d) => {
    const dd = new Date(d.date);
    if (dd.getMonth() === month) {
      const day = dd.getDate();
      if (!birthdaysByDay[day]) birthdaysByDay[day] = [];
      birthdaysByDay[day].push(d);
    }
  });

  const namedaysByDay = {};
  dates.forEach((d) => {
    const nd = d.nameday || d.linkedUser?.nameday;
    if (!nd) return;
    const [ndMonth, ndDay] = nd.split("-").map(Number);
    if (ndMonth - 1 === month) {
      if (!namedaysByDay[ndDay]) namedaysByDay[ndDay] = [];
      namedaysByDay[ndDay].push(d);
    }
  });

  const eventsByDay = {};
  normalizedEvents.forEach((ev) => {
    const d = ev.resolvedDate;
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(ev);
    }
  });

  // ── Week view data ────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekTitle = `${weekStart.getDate()} – ${weekEnd.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;

  // ── Navigation ────────────────────────────────────────
  const handlePreviousMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  const handlePreviousWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const handleNextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const switchToWeek = () => {
    setWeekStart(getMonday(today));
    setViewMode("week");
  };

  // ── Modal data ────────────────────────────────────────
  const modalBdays = modalDate ? getBdaysForDate(modalDate) : [];
  const modalNamedays = modalDate ? getNamedaysForDate(modalDate) : [];
  const modalEvents = modalDate ? getEventsForDate(modalDate) : [];

  return (
    <div className="agenda-container">

      {/* ── Toggle Mois / Semaine ─────────────────────── */}
      <div className="agenda-view-toggle">
        <button
          className={`agenda-toggle-btn${viewMode === "month" ? " agenda-toggle-btn--active" : ""}`}
          onClick={() => setViewMode("month")}
        >
          Mois
        </button>
        <button
          className={`agenda-toggle-btn${viewMode === "week" ? " agenda-toggle-btn--active" : ""}`}
          onClick={switchToWeek}
        >
          Semaine
        </button>
      </div>

      {/* ── Navigation ───────────────────────────────── */}
      <div className="agenda-navigation">
        <button
          className="agenda-nav-btn"
          onClick={viewMode === "month" ? handlePreviousMonth : handlePreviousWeek}
        >
          ‹
        </button>
        <h2 className="agenda-month-title">
          {viewMode === "month"
            ? currentMonth.toLocaleString("fr-FR", { month: "long", year: "numeric" })
            : weekTitle}
        </h2>
        <button
          className="agenda-nav-btn"
          onClick={viewMode === "month" ? handleNextMonth : handleNextWeek}
        >
          ›
        </button>
      </div>

      {/* ═══════════════════════════════════════════════
          VUE MOIS — grille CSS 7 colonnes
          ═══════════════════════════════════════════════ */}
      {viewMode === "month" && (
        <div className="agenda-month-grid">
          {/* En-têtes jours */}
          {DAY_HEADERS.map((d) => (
            <div key={d} className="agenda-day-header">{d}</div>
          ))}

          {/* Cellules */}
          {Array.from({ length: totalCells }).map((_, i) => {
            const day = i < offset ? null : i - offset + 1;
            if (day === null) {
              return <div key={`empty-${i}`} className="agenda-cell agenda-cell--empty" />;
            }
            const cellDate = new Date(year, month, day);
            const todayCell = isToday(cellDate);
            const hasBirthdays = !!(birthdaysByDay[day]?.length);
            const hasNamedays = !!(namedaysByDay[day]?.length);
            const hasEvents = !!(eventsByDay[day]?.length);

            return (
              <div
                key={`day-${day}`}
                className={`agenda-cell${todayCell ? " agenda-cell--today" : ""}`}
                onClick={() => setModalDate(cellDate)}
              >
                <div className="agenda-cell__top">
                  <span className="agenda-cell__number">{day}</span>
                </div>
                <div className="agenda-cell__bottom">
                  <div className="agenda-cell__dots">
                    {hasBirthdays && <span className="agenda-dot agenda-dot--birthday" />}
                    {hasNamedays && <span className="agenda-dot agenda-dot--nameday" />}
                    {hasEvents && <span className="agenda-dot agenda-dot--event" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          VUE SEMAINE — layout vertical 7 lignes
          ═══════════════════════════════════════════════ */}
      {viewMode === "week" && (
        <div className="agenda-week-grid">
          {weekDays.map((dayDate, i) => {
            const todayRow = isToday(dayDate);
            const bdays = getBdaysForDate(dayDate);
            const ndays = getNamedaysForDate(dayDate);
            const evts = getEventsForDate(dayDate);
            const hasItems = bdays.length > 0 || ndays.length > 0 || evts.length > 0;

            const allItems = [
              ...bdays.map((d) => ({ type: "birthday", label: `${d.name} ${d.surname}`, id: d._id })),
              ...ndays.map((d) => ({ type: "nameday", label: `${d.name} ${d.surname}`, id: d._id })),
              ...evts.map((ev) => ({ type: "event", label: ev.title, shortId: ev.shortId })),
            ];
            const visible = allItems.slice(0, WEEK_VIEW_MAX_ITEMS);
            const overflow = allItems.length - visible.length;

            return (
              <div
                key={`week-row-${i}`}
                className={[
                  "agenda-week-row",
                  todayRow ? "agenda-week-row--today" : "",
                  hasItems ? "agenda-week-row--has-items" : "",
                ].filter(Boolean).join(" ")}
              >
                {/* Colonne gauche : jour */}
                <div className="agenda-week-row__left">
                  <span className="agenda-week-row__dayname">{DAY_NAMES[i]}</span>
                  <span className={`agenda-week-row__daynum${todayRow ? " agenda-week-row__daynum--today" : ""}`}>
                    {dayDate.getDate()}
                  </span>
                </div>

                {/* Colonne droite : items cliquables */}
                <div className="agenda-week-row__right">
                  {visible.map((item, j) => (
                    <button
                      key={j}
                      className={`agenda-week-item agenda-week-item--${item.type}`}
                      onClick={() =>
                        item.type === "event"
                          ? navigate(`/event/${item.shortId}`)
                          : navigate(`/home?tab=date&dateId=${item.id}`)
                      }
                    >
                      <span className={`agenda-dot agenda-dot--${item.type}`} />
                      {item.label}
                    </button>
                  ))}
                  {overflow > 0 && (
                    <button
                      className="agenda-week-overflow"
                      onClick={() => setModalDate(dayDate)}
                    >
                      +{overflow} autre{overflow > 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Légende ──────────────────────────────────── */}
      <div className="agenda-legend">
        <span className="agenda-legend__item">
          <span className="agenda-dot agenda-dot--birthday" /> Anniversaire
        </span>
        <span className="agenda-legend__item">
          <span className="agenda-dot agenda-dot--nameday" /> Fête
        </span>
        <span className="agenda-legend__item">
          <span className="agenda-dot agenda-dot--event" /> Événement
        </span>
      </div>

      {/* ── Modal jour ───────────────────────────────── */}
      {modalDate !== null && (
        <AgendaDayModal
          day={modalDate.getDate()}
          month={modalDate.getMonth()}
          year={modalDate.getFullYear()}
          dates={modalBdays}
          namedays={modalNamedays}
          events={modalEvents}
          onClose={() => setModalDate(null)}
        />
      )}
    </div>
  );
};

export default Agenda;
