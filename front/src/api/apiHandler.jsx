import axios from "axios";

const service = axios.create({
  baseURL: "https://birthreminder.com/", // Remplace cette URL si nécessaire
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
      .post("/api/auth/signup", userInfo)
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
      .post("/api/auth/login", userInfo)
      .then((res) => {
        console.log("Response data:", res.data);
        return res.data;
      })
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
};

export default apiHandler;
