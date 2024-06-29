import { Route, Routes } from "react-router-dom";
import "./App.css";
import Login from "./components/connect/Login";
import Signup from "./components/connect/Signup";
import Home from "./components/Home";
import PrivateRoute from "./protectedRoutes/PrivateRoute";
import ForgotPassword from "./components/connect/ForgotPassword";
import ResetPassword from "./components/connect/ResetPassword";

function App() {
  return (
    <div className="App">
      <div className="routeContent">
        <Routes>
          <Route
            path="/"
            element={
              <div className="contentCenter">
                {" "}
                <Signup />
              </div>
            }
          />
          <Route
            path="/login"
            element={
              <div className="contentCenter">
                {" "}
                <Login />{" "}
              </div>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <div className="contentCenter">
                {" "}
                <ForgotPassword />{" "}
              </div>
            }
          />
          <Route path="/auth/reset/:token" element={<ResetPassword />} />
          <Route element={<PrivateRoute />}>
            <Route path="/home" element={<Home />} />
          </Route>
        </Routes>
      </div>
    </div>
  );
}

export default App;
