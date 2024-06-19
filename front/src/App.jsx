import { Route, Routes } from "react-router-dom";
import "./App.css";
import Login from "./components/connect/Login";
import Signup from "./components/connect/Signup";
import Home from "./components/Home";
import PrivateRoute from "./protectedRoutes/PrivateRoute";

function App() {
  return (
    <div className="App">
      <div className="headerApp">
        <h1 className="title-font title-font-size">BirthDate</h1>
      </div>

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
          <Route element={<PrivateRoute />}>
            <Route path="/home" element={<Home />} />
          </Route>
        </Routes>
      </div>
    </div>
  );
}

export default App;
