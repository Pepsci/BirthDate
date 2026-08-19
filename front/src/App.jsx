import { Route, Routes, useLocation } from "react-router-dom";
import React, { useState, useEffect } from "react";
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
import ContactPage from "./components/pages/ContactPage";
import SharedInvites from "./components/profil/SharedInvites";
import ScrollToTop from "./components/layout/ScrollToTop";
import EventsPanel from "./components/events/EventsPanel";
import EventPage from "./components/events/EventPage";
import EventForm from "./components/events/EventForm";
import NotificationToast from "./components/notifications/NotificationToast";
import PublicWishlist from "./components/wishlist/PublicWishlist";
import PublicSharedList from "./components/sharedGifts/PublicSharedList";
import PoolPage from "./components/events/PoolPage";
import AdminRoute from "./protectedRoutes/AdminRoute";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./components/admin/AdminDashboard";
import AdminUsers from "./components/admin/AdminUsers";
import AdminPools from "./components/admin/AdminPools";
import AdminEvents from "./components/admin/AdminEvents";
import AdminLogs from "./components/admin/AdminLogs";
import AdminAlerts from "./components/admin/AdminAlerts";
import AdminReports from "./components/admin/AdminReports";
import AnalyticsTracker from "./analytics/AnalyticsTracker";

// Pages sans footer
const NO_FOOTER_ROUTES = ["/wishlist"];

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const location = useLocation();

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const showFooter =
    !isMobile &&
    !NO_FOOTER_ROUTES.some((path) => location.pathname.startsWith(path));

  return (
    <div className="App">
      <div className="routeContent">
        <ScrollToTop />
        <AnalyticsTracker />
        <NotificationToast />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/cookies" element={<CookiesPolicy />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/cgu" element={<CGU />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/contact" element={<ContactPage />} />

          {/* ── AUTH ── */}
          <Route path="/auth" element={<AuthPage />} />
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

          {/* ── Routes publiques ── */}
          <Route path="/event/:shortId" element={<EventPage />} />
          <Route path="/wishlist/:publicSlug" element={<PublicWishlist />} />
          {/* Liste d'idées commune partagée par lien — publique, lecture seule */}
          <Route path="/liste/:publicSlug" element={<PublicSharedList />} />
          <Route path="/pool/:shortId" element={<PoolPage />} />

          <Route element={<PrivateRoute />}>
            <Route path="/home" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/shared-invites" element={<SharedInvites />} />
            <Route path="/birthday/:id" element={<BirthdayView />} />
            <Route path="/update-date/:id" element={<UpdateDate />} />
            <Route path="/merge-duplicates" element={<MergeDuplicates />} />
            <Route path="/events/mine" element={<EventsPanel />} />
            <Route
              path="/events/new"
              element={
                <EventForm
                  onClose={(id) =>
                    id
                      ? (window.location.href = `/event/${id}?created=true`)
                      : (window.location.href = "/home")
                  }
                />
              }
            />
          </Route>

          {/* ── ADMIN ── */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="pools" element={<AdminPools />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="alerts" element={<AdminAlerts />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="logs" element={<AdminLogs />} />
            </Route>
          </Route>
        </Routes>
        <CookieBanner />
        {showFooter && <Footer />}
      </div>
    </div>
  );
}

export default App;
