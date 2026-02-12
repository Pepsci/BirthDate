import { Route, Routes } from "react-router-dom";
import "./App.css";
import Login from "./components/connect/Login";
import Signup from "./components/connect/Signup";
import Home from "./components/Home";
import Profile from "./components/profil/Profile";
import PrivateRoute from "./protectedRoutes/PrivateRoute";
import ForgotPassword from "./components/connect/ForgotPassword";
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

function App() {
  return (
    <div className="App">
      <div className="routeContent">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/cookies" element={<CookiesPolicy />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/cgu" element={<CGU />} />

          <Route
            path="/signup"
            element={
              <div className="contentCenter">
                <Signup />
              </div>
            }
          />
          <Route
            path="/login"
            element={
              <div className="contentCenter">
                <Login />
              </div>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <div className="contentCenter">
                <ForgotPassword />
              </div>
            }
          />
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
          <Route element={<PrivateRoute />}>
            <Route path="/home" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/birthday/:id" element={<BirthdayView />} />
            <Route path="/update-date/:id" element={<UpdateDate />} />
            <Route path="/merge-duplicates" element={<MergeDuplicates />} />
          </Route>
        </Routes>
        <CookieBanner />
        <Footer />
      </div>
    </div>
  );
}

export default App;
