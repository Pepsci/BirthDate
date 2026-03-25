import { Route, Routes } from "react-router-dom";
import "./App.css";
import AuthPage from "./components/connect/AuthPage";
import Home from "./components/Home";
import Profile from "./components/profil/Profile";
import PrivateRoute from "./protectedRoutes/PrivateRoute";
import ResetPassword from "./components/connect/ResetPassword";
import VerifyEmail from "./components/connect/VerifyEmail";
import UpdateDate from "./components/dashboard/UpdateDate";
import Unsubscribe from "./components/dashboard/Unsubscribe";
import UnsubscribeSuccess from "./components/dashboard/UnsubscribeSuccess";
import LandingPage from "./components/Accueil/LandingPage";
import BirthdayView from "./components/dashboard/BirthdayView";
import Friends from "./components/friends/Friends";
import MergeDuplicates from "./components/friends/MergeDuplicates";
import Chat from "./components/chat/Chat";
import CookieBanner from "./components/layout/CookieBanner";
import CookiesPolicy from "./components/pages/CookiesPolicy";
import MentionsLegales from "./components/pages/MentionsLegales";
import PrivacyPolicy from "./components/pages/PrivacyPolicy";
import CGU from "./components/pages/CGU";
import Footer from "./components/layout/Footer";
import GuidePage from "./components/pages/GuidePage";
import ScrollToTop from "./components/layout/ScrollToTop";
import EventsPanel from "./components/events/EventsPanel";
import EventPage from "./components/events/EventPage";
import EventForm from "./components/events/EventForm";

function App() {
  return (
    <div className="App">
      <div className="routeContent">
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/cookies" element={<CookiesPolicy />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/cgu" element={<CGU />} />
          <Route path="/guide" element={<GuidePage />} />

          {/* ── AUTH (login + signup + forgot-password fusionnés) ── */}
          <Route path="/auth" element={<AuthPage />} />

          {/* Redirections pour les anciens liens (emails, bookmarks) */}
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />
          <Route path="/forgot-password" element={<AuthPage />} />

          <Route
            path="/unsubscribe"
            element={
              <div className="contentCenter">
                <Unsubscribe />
              </div>
            }
          />
          <Route path="/unsubscribe-success" element={<UnsubscribeSuccess />} />
          <Route path="/auth/reset/:token" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Route publique — accessible sans compte (lecture seule pour non-invités) */}
          <Route path="/event/:shortId" element={<EventPage />} />

          <Route element={<PrivateRoute />}>
            <Route path="/home" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/birthday/:id" element={<BirthdayView />} />
            <Route path="/update-date/:id" element={<UpdateDate />} />
            <Route path="/merge-duplicates" element={<MergeDuplicates />} />
            <Route path="/events/mine" element={<EventsPanel />} />
            <Route path="/events/new" element={<EventForm onClose={(id) => id ? (window.location.href = `/event/${id}?created=true`) : (window.location.href = "/home")} />} />
          </Route>
        </Routes>
        <CookieBanner />
        <Footer />
      </div>
    </div>
  );
}

export default App;