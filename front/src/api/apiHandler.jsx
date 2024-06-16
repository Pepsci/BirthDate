import axios from "axios";

const service = axios.create({
  baseURL: import.meta.env.VITE_APP_BACKEND_URL,
  withCredentials: true,
});

service.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  config.headers.Authorization = token ? `Bearer ${token}` : "";
  return config;
});

function errorHandler(error) {
  if (error.response.data) {
    console.log(error.response && error.response.data);
    throw error;
  }
  throw error;
}

const apiHandler = {
  ...service,

  signup(userInfo) {
    return service
      .post("/signup", userInfo)
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
      .post("/login", userInfo)
      .then((res) => res.data)
      .catch(errorHandler);
  },
};

export default apiHandler;
