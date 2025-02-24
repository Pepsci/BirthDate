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

function App() {
  return (
    <div className="App">
      <div className="routeContent">
        <Routes>
          <Route
            path="/"
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
          <Route path="/unsubscribe" component={Unsubscribe} />
          <Route path="/auth/reset/:token" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route element={<PrivateRoute />}>
            <Route path="/home" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/update-date/:id" element={<UpdateDate />} />
          </Route>
        </Routes>
      </div>
    </div>
  );
}

export default App;
