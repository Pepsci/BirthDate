import axios from "axios";

const service = axios.create({
  baseURL: "https://birthreminder.com/api/auth/", // Ne pas ajouter "/api/" dans les routes après
  withCredentials: true,
});

service.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  config.headers.Authorization = token ? `Bearer ${token}` : "";
  return config;
});

function errorHandler(error) {
  if (error.response) {
    console.log("Error response data:", error.response.data);
    throw error.response.data || { message: "Une erreur est survenue." };
  } else {
    console.log("Error:", error);
    throw { message: "Une erreur inattendue s'est produite." };
  }
}

const apiHandler = {
  ...service,

  signup(userInfo) {
    return service
      .post("/signup", userInfo) // Supprimer "/api/"
      .then((res) => res.data)
      .catch(errorHandler);
  },

  isLoggedIn(token) {
    return service
      .get("/verify", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => res.data)
      .catch(errorHandler);
  },

  signin(userInfo) {
    return service
      .post("/login", userInfo) // Supprimer "/api/"
      .then((res) => {
        console.log("Response data:", res.data);
        return res.data;
      })
      .catch(errorHandler);
  },

  requestPasswordReset(email) {
    return service
      .post("/forgot-password", { email }) // Supprimer "/api/"
      .then((res) => res.data)
      .catch(errorHandler);
  },

  resetPassword(token, password) {
    console.log("api token", token);
    console.log("api password", password);

    return service
      .post(`/auth/reset/${token}`, { password }) // Supprimer "/api/"
      .then((res) => res.data)
      .catch(errorHandler);
  },
};

export default apiHandler;
