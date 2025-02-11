import axios from "axios";

const service = axios.create({
  baseURL: "https://birthreminder.com/api/",
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
      .post("/auth/signup", userInfo) // ✅ Correction ici
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
      .post("/auth/login", userInfo) // ✅ Correction ici
      .then((res) => {
        console.log("Response data:", res.data);
        return res.data;
      })
      .catch(errorHandler);
  },

  requestPasswordReset(email) {
    return service
      .post("/auth/forgot-password", { email }) // ✅ Correction ici
      .then((res) => res.data)
      .catch(errorHandler);
  },

  resetPassword(token, password) {
    console.log("api token", token);
    console.log("api password", password);

    return service
      .post(`/auth/reset/${token}`, { password }) // ✅ Correction ici
      .then((res) => res.data)
      .catch(errorHandler);
  },
};

export default apiHandler;
