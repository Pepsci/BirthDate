import React, { useState, useEffect, useRef, useCallback } from "react";
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
const REPEAT = 20;

const getDaysInMonth = (month, year) => new Date(year, month, 0).getDate();

const WheelColumn = ({ items, selectedIndex, onChange }) => {
  const listRef = useRef(null);
  const touchStartY = useRef(0);
  const touchStartScroll = useRef(0);
  const velocityY = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const rafRef = useRef(null);
  const isSnapping = useRef(false);

  const infiniteItems = [];
  for (let r = 0; r < REPEAT; r++) {
    items.forEach((item) => infiniteItems.push(item));
  }

  const midOffset = Math.floor(REPEAT / 2) * items.length;
  const initialScroll = (midOffset + selectedIndex) * ITEM_HEIGHT;

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = initialScroll;
  }, []);

  const prevItemsLength = useRef(items.length);
  useEffect(() => {
    if (!listRef.current) return;
    if (prevItemsLength.current !== items.length) {
      prevItemsLength.current = items.length;
      const clampedIndex = Math.min(selectedIndex, items.length - 1);
      const mid = Math.floor(REPEAT / 2) * items.length;
      listRef.current.scrollTop = (mid + clampedIndex) * ITEM_HEIGHT;
    }
  }, [items.length, selectedIndex]);

  const getIndexFromScroll = useCallback(
    (scrollTop) => {
      const raw = Math.round(scrollTop / ITEM_HEIGHT);
      return ((raw % items.length) + items.length) % items.length;
    },
    [items.length],
  );

  const snapToNearest = useCallback(() => {
    if (!listRef.current || isSnapping.current) return;
    isSnapping.current = true;

    const scrollTop = listRef.current.scrollTop;
    const snapped = Math.round(scrollTop / ITEM_HEIGHT) * ITEM_HEIGHT;

    listRef.current.scrollTo({ top: snapped, behavior: "smooth" });

    setTimeout(() => {
      if (!listRef.current) return;
      const index = getIndexFromScroll(listRef.current.scrollTop);
      onChange(index);
      isSnapping.current = false;
    }, 200);
  }, [items.length, getIndexFromScroll, onChange]);

  const applyMomentum = useCallback(() => {
    if (!listRef.current) return;
    velocityY.current *= 0.92;

    if (Math.abs(velocityY.current) < 0.5) {
      snapToNearest();
      return;
    }

    listRef.current.scrollTop += velocityY.current;
    rafRef.current = requestAnimationFrame(applyMomentum);
  }, [snapToNearest]);

  const handleTouchStart = (e) => {
    cancelAnimationFrame(rafRef.current);
    isSnapping.current = false;
    touchStartY.current = e.touches[0].clientY;
    touchStartScroll.current = listRef.current.scrollTop;
    lastY.current = e.touches[0].clientY;
    lastTime.current = Date.now();
    velocityY.current = 0;
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const currentY = e.touches[0].clientY;
    const now = Date.now();
    const dt = now - lastTime.current || 1;
    const dy = lastY.current - currentY;

    velocityY.current = (dy / dt) * 16;
    lastY.current = currentY;
    lastTime.current = now;

    const delta = touchStartY.current - currentY;
    listRef.current.scrollTop = touchStartScroll.current + delta;
  };

  const handleTouchEnd = () => {
    rafRef.current = requestAnimationFrame(applyMomentum);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    cancelAnimationFrame(rafRef.current);
    listRef.current.scrollTop += e.deltaY;
    clearTimeout(listRef.current._wt);
    listRef.current._wt = setTimeout(snapToNearest, 100);
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
        onWheel={handleWheel}
      >
        {Array(Math.floor(VISIBLE_ITEMS / 2))
          .fill(null)
          .map((_, i) => (
            <div
              key={`pt-${i}`}
              className="dpm-wheel-item dpm-wheel-item--pad"
            />
          ))}

        {infiniteItems.map((item, index) => {
          const realIndex = index % items.length;
          return (
            <div
              key={`${item}-${index}`}
              className={`dpm-wheel-item ${realIndex === selectedIndex ? "dpm-wheel-item--selected" : ""}`}
            >
              {item}
            </div>
          );
        })}

        {Array(Math.floor(VISIBLE_ITEMS / 2))
          .fill(null)
          .map((_, i) => (
            <div
              key={`pb-${i}`}
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

  const years = [];
  for (let y = maxYear; y >= 1900; y--) years.push(y);

  const daysInMonth = getDaysInMonth(month, year);
  const days = Array.from({ length: daysInMonth }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );

  useEffect(() => {
    const maxDay = getDaysInMonth(month, year);
    if (day > maxDay) setDay(maxDay);
  }, [month, year]);

  useEffect(() => {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const formatted = `${year}-${mm}-${dd}`;
    if (formatted !== value) onChange(formatted);
  }, [day, month, year]);

  const yearIndex = years.indexOf(year);

  return (
    <div className="dpm-container">
      <div className="dpm-wheels">
        <WheelColumn
          items={days}
          selectedIndex={Math.max(0, day - 1)}
          onChange={(i) => setDay(i + 1)}
        />
        <WheelColumn
          items={MONTHS}
          selectedIndex={month - 1}
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
