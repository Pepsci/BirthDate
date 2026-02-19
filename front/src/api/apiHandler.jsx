import axios from "axios";

const isLocal = window.location.hostname === "localhost";

const service = axios.create({
  baseURL: isLocal
    ? "http://localhost:4000/api" // En local
    : "https://birthreminder.com/api", // En production
  withCredentials: true,
});

service.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  config.headers.Authorization = token ? `Bearer ${token}` : "";
  return config;
});

function errorHandler(error) {
  if (error.response && error.response.data) {
    console.log("Error response data:", error.response.data);
    throw error.response.data;
  } else {
    console.log("Error:", error);
    throw error;
  }
}

const apiHandler = {
  ...service,

  signup(userInfo) {
    return service
      .post("/auth/signup", userInfo)
      .then((res) => res.data)
      .catch(errorHandler);
  },

  isLoggedIn(token) {
    return service
      .get("/auth/verify", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => res.data)
      .catch(errorHandler);
  },

  signin(userInfo) {
    return service
      .post("/auth/login", userInfo)
      .then((res) => res.data)
      .catch(errorHandler);
  },

  verifyEmail(token) {
    return service
      .post("/verify-email", { token })
      .then((res) => res.data)
      .catch(errorHandler);
  },

  // Pour activer/désactiver les notifications pour une date spécifique
  toggleDateNotifications(dateId, receiveNotifications) {
    return service
      .put(`/date/${dateId}/notifications`, { receiveNotifications })
      .then((res) => res.data)
      .catch(errorHandler);
  },

  // Pour mettre à jour les préférences de timing des notifications pour une date spécifique
  updateDateNotificationPreferences(dateId, preferences) {
    return service
      .put(`/date/${dateId}/notification-preferences`, preferences)
      .then((res) => res.data)
      .catch(errorHandler);
  },

  unsubscribe(data) {
    return service
      .post("/unsubscribe", data)
      .then((res) => res.data)
      .catch(errorHandler);
  },

  requestPasswordReset(email) {
    return service
      .post("/auth/forgot-password", { email })
      .then((res) => res.data)
      .catch(errorHandler);
  },

  resetPassword(token, password) {
    console.log("api token", token);
    console.log("api password", password);

    return service
      .post(`/auth/reset/${token}`, { password })
      .then((res) => res.data)
      .catch(errorHandler);
  },

  // ========================================
  // 👇 FRIENDS API - NOUVEAU
  // ========================================

  // Obtenir tous les amis d'un utilisateur
  getFriends(userId) {
    return service
      .get(`/friends?userId=${userId}`)
      .then((res) => res.data)
      .catch(errorHandler);
  },

  // Obtenir les demandes d'amitié en attente
  getFriendRequests(userId) {
    return service
      .get(`/friends/requests?userId=${userId}`)
      .then((res) => res.data)
      .catch(errorHandler);
  },

  // Envoyer une demande d'amitié
  sendFriendRequest(userId, friendEmail) {
    return service
      .post("/friends", { email: friendEmail }) // ✅ route et body corrects
      .then((res) => res.data)
      .catch(errorHandler);
  },

  // Accepter une demande d'amitié
  acceptFriendRequest(friendshipId, userId) {
    return service
      .patch(`/friends/${friendshipId}/accept`, { userId })
      .then((res) => res.data)
      .catch(errorHandler);
  },

  // Refuser une demande d'amitié
  rejectFriendRequest(friendshipId, userId) {
    return service
      .patch(`/friends/${friendshipId}/reject`, { userId })
      .then((res) => res.data)
      .catch(errorHandler);
  },

  // Lier un ami à une date
  linkFriendToDate(friendshipId, dateId) {
    return service
      .patch(`/friends/${friendshipId}/link-date`, { dateId })
      .then((res) => res.data)
      .catch(errorHandler);
  },

  // Supprimer un ami
  deleteFriend(friendshipId) {
    return service
      .delete(`/friends/${friendshipId}`)
      .then((res) => res.data)
      .catch(errorHandler);
  },
};

export default apiHandler;
