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
        <h1>BirthDate</h1>
      </div>

      <Routes>
        <Route path="/" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route element={<PrivateRoute />}>
          <Route path="/home" element={<Home />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
