import axios from "axios";

const service = axios.create({
  baseURL: "https://birthreminder.com/api/", // Assurez-vous que cette URL est correcte
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
      .post("/api/auth/signup", userInfo) // Ajout de "/api/"
      .then((res) => res.data)
      .catch(errorHandler);
  },

  isLoggedIn(token) {
    return service
      .get("/api/auth/verify", {
        headers: { Authorization: `Bearer ${token}` }, // Correction de la syntaxe
      })
      .then((res) => res.data)
      .catch(errorHandler);
  },

  signin(userInfo) {
    return service
      .post("/api/auth/login", userInfo) // Ajout de "/api/"
      .then((res) => {
        console.log("Response data:", res.data);
        return res.data;
      })
      .catch(errorHandler);
  },

  requestPasswordReset(email) {
    return service
      .post("/api/auth/forgot-password", { email }) // Ajout de "/api/"
      .then((res) => res.data)
      .catch(errorHandler);
  },

  resetPassword(token, password) {
    console.log("api token", token);
    console.log("api password", password);

    return service
      .post(`/api/auth/reset/${token}`, { password }) // Correction des backticks
      .then((res) => res.data)
      .catch(errorHandler);
  },
};

export default apiHandler;
