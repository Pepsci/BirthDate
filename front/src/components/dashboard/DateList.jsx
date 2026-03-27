import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import CreateDate from "./CreateDate";
import Agenda from "./Agenda";
import DateFilter from "./DateFilter";
import BirthdayCard from "./BirthdayCard";
import ManualMergeModal from "./ManuelMergeModal";
import Chat from "../chat/Chat";
import ChatModal from "../chat/ChatModal";
import DirectChat from "../chat/DirectChat";
import EventsPanel from "../events/EventsPanel";
import FabMenu from "./FabMenu";
import useNotifications from "../../context/useNotifications";
import Footer from "../layout/Footer";
import "./css/dateList.css";
import "./css/birthcard.css";
import "../UI/css/badge-notification.css";

const ITEMS_PER_PAGE = 10;
const ITEMS_PER_PAGE_MOBILE = 8;

// ─── Panel animé avec bouton fermer intégré ──────────────
const CollapsiblePanel = ({ isVisible, onClose, closeLabel = "Fermer", children }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        className="collapsible-panel"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ overflow: "hidden" }}
      >
        <button
          className="panel-close-btn"
          onClick={onClose}
          aria-label={closeLabel}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

const DateList = ({
  onEditDate,
  onViewFriendProfile,
  onMerge,
  onResetChat,
  onResetDateList,
  initialPage = 1,
  agendaParams = null,
  initialFilter = null,
  initialEventsOpen = false,
  onEventsOpened = null,
}) => {
  const { currentUser } = useAuth();
  const [dates, setDates] = useState([]);
  const [allDates, setAllDates] = useState([]);
  const [friendIds, setFriendIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isEventsVisible, setIsEventsVisible] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(
    window.innerWidth <= 600 ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE,
  );
  const filterInputRef = useRef(null);
  const { unreadCount, loadUnreadCount, resetUnreadCount } = useNotifications();

  const [events, setEvents] = useState([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [cardToMerge, setCardToMerge] = useState(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [selectedFriendName, setSelectedFriendName] = useState("");
  const [viewMode, setViewMode] = useState(agendaParams ? "agenda" : "card");

  // ─── Expose le reset complet à Home via ref ──────────────
  useEffect(() => {
    if (!onResetDateList) return;
    onResetDateList(() => {
      setViewMode("card");
      setIsFilterVisible(false);
      setIsFormVisible(false);
      setIsChatVisible(false);
      setIsEventsVisible(false);
      setCurrentPage(1);
      setDates((prev) => prev);
    });
  }, []);

  useEffect(() => {
    if (!initialEventsOpen) return;
    setIsEventsVisible(true);
    setIsFormVisible(false);
    setIsFilterVisible(false);
    setIsChatVisible(false);
    if (onEventsOpened) onEventsOpened();
  }, [initialEventsOpen]);

  const sortDates = (datesArray) => {
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    return datesArray.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      const dayA = dateA.getDate(); const monthA = dateA.getMonth();
      const dayB = dateB.getDate(); const monthB = dateB.getMonth();
      const isTodayA = dayA === todayDay && monthA === todayMonth;
      const isTodayB = dayB === todayDay && monthB === todayMonth;
      if (isTodayA && !isTodayB) return -1;
      if (!isTodayA && isTodayB) return 1;
      if (isTodayA && isTodayB) return a.name.localeCompare(b.name);
      const nextA = new Date(todayYear, monthA, dayA);
      const nextB = new Date(todayYear, monthB, dayB);
      if (nextA < today) nextA.setFullYear(todayYear + 1);
      if (nextB < today) nextB.setFullYear(todayYear + 1);
      return nextA - nextB;
    });
  };

  const loadDates = () => {
    apiHandler.get(`/date?owner=${currentUser._id}`)
      .then(res => { const s = sortDates(res.data); setAllDates(s); setDates(s); })
      .catch(e => console.error(e));
  };

  useEffect(() => { loadDates(); }, [currentUser]);

  useEffect(() => {
    apiHandler.get("/events/mine")
      .then(res => {
        const all = [
          ...(res.data.organized || []),
          ...(res.data.invited || []),
        ];
        setEvents(all);
      })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const n = window.innerWidth <= 600 ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE;
      if (itemsPerPage !== n) setItemsPerPage(n);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [itemsPerPage]);

  useEffect(() => { loadUnreadCount(); }, []);

  useEffect(() => {
    if (onResetChat) {
      onResetChat(() => {
        setIsChatVisible(false); setIsChatModalOpen(false);
        setSelectedFriendId(null); setSelectedFriendName("");
      });
    }
  }, []);

  useEffect(() => {
    apiHandler.get("/friends")
      .then(res => setFriendIds(res.data.filter(f => f.friendUser?._id).map(f => f.friendUser._id.toString())))
      .catch(e => console.error(e));
  }, [currentUser]);

  useEffect(() => {
    if (!initialFilter || allDates.length === 0) return;
    const parts = initialFilter.trim().split(" ");
    const firstName = parts[0] || ""; const lastName = parts.slice(1).join(" ") || "";
    setDates(allDates.filter(d => {
      const mFirst = firstName ? d.name?.toLowerCase().includes(firstName.toLowerCase()) : true;
      const mLast = lastName ? d.surname?.toLowerCase().includes(lastName.toLowerCase()) : true;
      return mFirst && mLast;
    }));
    setCurrentPage(1); setIsFilterVisible(true);
  }, [initialFilter, allDates]);

  const toggleFormVisibility = () => {
    setIsFormVisible(v => !v);
    if (!isFormVisible) { setIsFilterVisible(false); setIsChatVisible(false); setIsEventsVisible(false); }
  };

  const toggleFilterVisibility = () => {
    const n = !isFilterVisible;
    setIsFilterVisible(n);
    if (!n) { setDates(allDates); setCurrentPage(1); }
    if (n) { setIsFormVisible(false); setIsChatVisible(false); setIsEventsVisible(false); setTimeout(() => filterInputRef.current?.focus(), 100); }
  };

  const toggleChatVisibility = () => {
    const n = !isChatVisible;
    setIsChatVisible(n);
    if (n) { setIsFormVisible(false); setIsFilterVisible(false); setIsEventsVisible(false); resetUnreadCount(); }
  };

  const toggleEventsVisibility = () => {
    const n = !isEventsVisible;
    setIsEventsVisible(n);
    if (n) { setIsFormVisible(false); setIsFilterVisible(false); setIsChatVisible(false); }
  };

  const closeFilter = () => { setIsFilterVisible(false); setDates(allDates); setCurrentPage(1); };
  const closeForm   = () => setIsFormVisible(false);

  const handleDateAdded = (newDate) => {
    const u = sortDates([...allDates, newDate]);
    setAllDates(u); setDates(u); setIsFormVisible(true);
  };

  const handleFilterChange = (newName, newSurname, familyFilter, friendFilter) => {
    let f = [...allDates];
    if (familyFilter) f = f.filter(d => d.family === true);
    if (friendFilter) f = f.filter(d => d.linkedUser && friendIds.includes(d.linkedUser._id.toString()));
    if (newName) f = f.filter(d => d.name.toLowerCase().startsWith(newName.toLowerCase()));
    if (newSurname) f = f.filter(d => d.surname.toLowerCase().startsWith(newSurname.toLowerCase()));
    setDates(f); setCurrentPage(1);
  };

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleViewMode = () => {
    setViewMode(v => v === "card" ? "agenda" : "card");
    setIsChatVisible(false); setIsEventsVisible(false);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = dates.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(dates.length / itemsPerPage);

  const activePanel = isChatVisible ? "chat" : isEventsVisible ? "events" : "dates";

  // Footer visible uniquement sur mobile, uniquement en vue cartes
  const showMobileFooter = activePanel === "dates" && viewMode === "card";

  return (
    <div className="dateList">
      <div className="dateListHeader">

        <div className="dateList-tiltle">
          <h1 className="titleFont">Vos BirthDates</h1>
          <div className="fab-mobile-only">
            <FabMenu
              onFilter={toggleFilterVisibility}
              onAgenda={toggleViewMode}
              onChat={toggleChatVisibility}
              onEvents={toggleEventsVisibility}
              onForm={toggleFormVisibility}
              isFilterVisible={isFilterVisible}
              viewMode={viewMode}
              isChatVisible={isChatVisible}
              isEventsVisible={isEventsVisible}
              isFormVisible={isFormVisible}
              unreadCount={unreadCount}
            />
          </div>
        </div>

        {/* Boutons desktop */}
        <div className="dateListHeader-btn desktop-only">
          {["filter", "agenda", "chat", "events", "form"].map((btn) => {
            const isActive = btn === "filter" ? isFilterVisible : btn === "chat" ? isChatVisible : btn === "events" ? isEventsVisible : btn === "form" ? isFormVisible : false;
            const label = {
              filter: isFilterVisible ? "Cacher le filtre" : "Filtre",
              agenda: viewMode === "card" ? "Agenda" : "Carte",
              chat: isChatVisible ? "Cacher le chat" : "💬 Chat",
              events: isEventsVisible ? "Cacher Événements" : "🎉 Événements",
              form: isFormVisible ? "Cacher le formulaire" : "Ajouter une date",
            }[btn];
            const onClick = { filter: toggleFilterVisibility, agenda: toggleViewMode, chat: toggleChatVisibility, events: toggleEventsVisibility, form: toggleFormVisibility }[btn];
            return (
              <motion.button
                key={btn}
                className={`btnSwitch ${isActive ? "active" : ""}`}
                onClick={onClick}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                {label}
                {btn === "chat" && !isChatVisible && unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Panels avec bouton × intégré */}
        <div className="forms-container">
          <CollapsiblePanel
            isVisible={isFilterVisible}
            onClose={closeFilter}
            closeLabel="Fermer le filtre"
          >
            <div className="form-section filter-section">
              <DateFilter onFilterChange={handleFilterChange} inputRef={filterInputRef} friendIds={friendIds} />
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel
            isVisible={isFormVisible}
            onClose={closeForm}
            closeLabel="Fermer le formulaire"
          >
            <div className="filter-section">
              <CreateDate onDateAdded={handleDateAdded} />
            </div>
          </CollapsiblePanel>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activePanel === "chat" && (
          <motion.div
            key="chat"
            className="chat-in-datelist"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <Chat />
          </motion.div>
        )}

        {activePanel === "events" && (
          <motion.div
            key="events"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <EventsPanel allDates={allDates} />
          </motion.div>
        )}

        {activePanel === "dates" && dates.length === 0 && (
          <motion.div
            key="empty"
            className="no-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            Aucun résultat trouvé pour cette recherche
          </motion.div>
        )}

        {activePanel === "dates" && dates.length > 0 && viewMode === "agenda" && (
          <motion.div
            key="agenda"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <Agenda dates={dates} events={events} initialMonth={agendaParams?.month} initialYear={agendaParams?.year} />
          </motion.div>
        )}

        {activePanel === "dates" && dates.length > 0 && viewMode === "card" && (
          <motion.div key={`cards-p${currentPage}`}>
            <motion.div
              className="birthDeck"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {currentItems.map((date, i) => (
                <motion.div
                  key={date._id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
                >
                  <BirthdayCard
                    date={date}
                    onEdit={(d) => onEditDate(d, currentPage)}
                    onViewProfile={(d, section) => onViewFriendProfile(d, section, currentPage)}
                    onOpenChat={(friendId, friendName) => { setSelectedFriendId(friendId); setSelectedFriendName(friendName); setIsChatModalOpen(true); }}
                  />
                </motion.div>
              ))}
            </motion.div>

            {totalPages > 1 && (
              <motion.div
                className="pagination"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.1 }}
              >
                <motion.button
                  onClick={() => paginate(Math.max(currentPage - 1, 1))}
                  disabled={currentPage === 1}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Précédent
                </motion.button>

                {(() => {
                  const maxShow = window.innerWidth <= 600 ? 3 : 5;
                  const pages = [];
                  let start = Math.max(1, currentPage - Math.floor(maxShow / 2));
                  let end = Math.min(totalPages, start + maxShow - 1);
                  if (end - start + 1 < maxShow) start = Math.max(1, end - maxShow + 1);

                  if (start > 1) {
                    pages.push(<motion.button key="p1" onClick={() => paginate(1)} className={currentPage === 1 ? "active" : ""} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>1</motion.button>);
                    if (start > 2) pages.push(<span key="e1" className="ellipsis">...</span>);
                  }
                  for (let i = start; i <= end; i++) {
                    pages.push(
                      <motion.button key={`p${i}`} onClick={() => paginate(i)} className={currentPage === i ? "active" : ""} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        {i}
                      </motion.button>
                    );
                  }
                  if (end < totalPages) {
                    if (end < totalPages - 1) pages.push(<span key="e2" className="ellipsis">...</span>);
                    pages.push(<motion.button key={`p${totalPages}`} onClick={() => paginate(totalPages)} className={currentPage === totalPages ? "active" : ""} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>{totalPages}</motion.button>);
                  }
                  return pages;
                })()}

                <motion.button
                  onClick={() => paginate(Math.min(currentPage + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Suivant
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showMergeModal && cardToMerge && (
        <ManualMergeModal
          sourceCard={cardToMerge}
          onClose={() => { setShowMergeModal(false); setCardToMerge(null); }}
          onMergeSuccess={loadDates}
        />
      )}

      {selectedFriendId && (
        <ChatModal
          isOpen={isChatModalOpen}
          onClose={() => { setIsChatModalOpen(false); setSelectedFriendId(null); setSelectedFriendName(""); }}
          title={selectedFriendName}
        >
          <DirectChat friendId={selectedFriendId} />
        </ChatModal>
      )}

      {/* Footer mobile uniquement, visible uniquement en vue cartes */}
      <div className={`footer-mobile-wrapper ${showMobileFooter ? "footer-mobile-visible" : ""}`}>
        <Footer />
      </div>
    </div>
  );
};

export default DateList;