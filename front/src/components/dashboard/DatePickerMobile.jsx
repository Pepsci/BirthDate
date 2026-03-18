import React, { useState, useEffect, useRef } from "react";
import "./css/datePickerMobile.css";

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

const getDaysInMonth = (month, year) => {
  return new Date(year, month, 0).getDate();
};

const WheelColumn = ({ items, selectedIndex, onChange }) => {
  const listRef = useRef(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);
  const animating = useRef(false);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = selectedIndex * ITEM_HEIGHT;
    }
  }, [selectedIndex]);

  const snapToNearest = () => {
    if (!listRef.current) return;
    const scrollTop = listRef.current.scrollTop;
    const index = Math.round(scrollTop / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
    listRef.current.scrollTo({
      top: clampedIndex * ITEM_HEIGHT,
      behavior: "smooth",
    });
    onChange(clampedIndex);
  };

  const handleTouchStart = (e) => {
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startScrollTop.current = listRef.current.scrollTop;
    animating.current = false;
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    const delta = startY.current - e.touches[0].clientY;
    listRef.current.scrollTop = startScrollTop.current + delta;
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    snapToNearest();
  };

  const handleScroll = () => {
    if (isDragging.current) return;
    clearTimeout(listRef.current._scrollTimeout);
    listRef.current._scrollTimeout = setTimeout(() => {
      snapToNearest();
    }, 80);
  };

  return (
    <div className="dpm-wheel-wrapper">
      <div className="dpm-wheel-overlay dpm-wheel-overlay--top" />
      <div className="dpm-wheel-selector" />
      <div className="dpm-wheel-overlay dpm-wheel-overlay--bottom" />
      <div
        ref={listRef}
        className="dpm-wheel-list"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onScroll={handleScroll}
      >
        {/* Padding items */}
        {Array(Math.floor(VISIBLE_ITEMS / 2))
          .fill(null)
          .map((_, i) => (
            <div
              key={`pad-top-${i}`}
              className="dpm-wheel-item dpm-wheel-item--pad"
            />
          ))}
        {items.map((item, index) => (
          <div
            key={index}
            className={`dpm-wheel-item ${index === selectedIndex ? "dpm-wheel-item--selected" : ""}`}
            onClick={() => {
              listRef.current.scrollTo({
                top: index * ITEM_HEIGHT,
                behavior: "smooth",
              });
              onChange(index);
            }}
          >
            {item}
          </div>
        ))}
        {Array(Math.floor(VISIBLE_ITEMS / 2))
          .fill(null)
          .map((_, i) => (
            <div
              key={`pad-bot-${i}`}
              className="dpm-wheel-item dpm-wheel-item--pad"
            />
          ))}
      </div>
    </div>
  );
};

const DatePickerMobile = ({ value, onChange, max }) => {
  const today = new Date();
  const maxYear = max ? parseInt(max.split("-")[0]) : today.getFullYear();

  const parseValue = (val) => {
    if (!val)
      return {
        day: today.getDate(),
        month: today.getMonth() + 1,
        year: today.getFullYear(),
      };
    const [y, m, d] = val.split("-").map(Number);
    return { day: d, month: m, year: y };
  };

  const initial = parseValue(value);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);

  // Build arrays
  const years = [];
  for (let y = maxYear; y >= 1900; y--) years.push(y);

  const daysInMonth = getDaysInMonth(month, year);
  const days = Array.from({ length: daysInMonth }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );
  const months = MONTHS.map((m, i) => ({ label: m, value: i + 1 }));

  // Clamp day when month/year changes
  useEffect(() => {
    const maxDay = getDaysInMonth(month, year);
    const clampedDay = Math.min(day, maxDay);
    if (clampedDay !== day) setDay(clampedDay);
  }, [month, year]);

  // Emit onChange
  useEffect(() => {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const formatted = `${year}-${mm}-${dd}`;
    if (formatted !== value) onChange(formatted);
  }, [day, month, year]);

  const dayIndex = day - 1;
  const monthIndex = month - 1;
  const yearIndex = years.indexOf(year);

  return (
    <div className="dpm-container">
      <div className="dpm-wheels">
        <WheelColumn
          items={days}
          selectedIndex={Math.max(0, dayIndex)}
          onChange={(i) => setDay(i + 1)}
        />
        <WheelColumn
          items={months.map((m) => m.label)}
          selectedIndex={monthIndex}
          onChange={(i) => setMonth(i + 1)}
        />
        <WheelColumn
          items={years.map(String)}
          selectedIndex={Math.max(0, yearIndex)}
          onChange={(i) => setYear(years[i])}
        />
      </div>
    </div>
  );
};

export default DatePickerMobile;
