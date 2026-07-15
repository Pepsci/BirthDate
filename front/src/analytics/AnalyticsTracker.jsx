import { useEffect, useContext } from "react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "../context/auth.context";
import {
  initAnalytics,
  trackPageview,
  identifyUser,
  resetAnalytics,
} from "./analytics";

// Composant invisible monté dans App : init + pageviews SPA + identify.
const AnalyticsTracker = () => {
  const location = useLocation();
  const { currentUser, isLoggedIn } = useContext(AuthContext);

  // Init au montage si le consentement a déjà été donné lors d'une visite précédente
  useEffect(() => {
    initAnalytics();
  }, []);

  // Pageview à chaque changement de route
  useEffect(() => {
    trackPageview(location.pathname);
  }, [location.pathname]);

  // Identify / reset selon l'état de connexion
  useEffect(() => {
    if (isLoggedIn && currentUser?._id) identifyUser(currentUser._id);
    if (!isLoggedIn) resetAnalytics();
  }, [isLoggedIn, currentUser?._id]);

  return null;
};

export default AnalyticsTracker;
