import axios from "axios";

const service = axios.create({
  baseURL: "https://birthreminder.com/api/", // Remplace cette URL si nécessaire
  withCredentials: true,
});

service.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  console.log("Token envoyé:", token);
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
      .post("/api/auth/signup", userInfo) // Ajout du préfixe /api/
      .then((res) => res.data)
      .catch(errorHandler);
  },

  isLoggedIn(token) {
    return service
      .get("/api/auth/verify", {
        // Ajout du préfixe /api/
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => res.data)
      .catch(errorHandler);
  },

  signin(userInfo) {
    return service
      .post("/api/auth/login", userInfo) // Ajout du préfixe /api/
      .then((res) => {
        console.log("Response data:", res.data);
        return res.data;
      })
      .catch(errorHandler);
  },

  requestPasswordReset(email) {
    return service
      .post("/api/auth/forgot-password", { email }) // Ajout du préfixe /api/
      .then((res) => res.data)
      .catch(errorHandler);
  },

  resetPassword(token, password) {
    return service
      .post(`/api/auth/reset/${token}`, { password }) // Ajout du préfixe /api/
      .then((res) => res.data)
      .catch(errorHandler);
  },
};
export default apiHandler;
