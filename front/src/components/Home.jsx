import React, { useContext, useState } from "react";
import { AuthContext } from "../context/auth.context";
import DateList from "./dashboard/DateList";
import "./dashboard/css/homePage.css";

const Home = () => {
  const { logOut, isLoggedIn, currentUser } = useContext(AuthContext);
  const [date] = useState([]);

  return (
    <div>
      <div className="homePage-title">
        <h1>Home page \o/</h1>
      </div>
      {isLoggedIn && (
        <>
          <h1>Je suis connecté avec {currentUser && currentUser.name}</h1>
          <img
            src={`https://api.dicebear.com/8.x/bottts/svg?seed=${currentUser.surname}`}
            alt=""
          />
          <img src={`${currentUser.avatar}`} alt="" />
          <button onClick={logOut}>LogOut</button>
          <DateList date={date} />
        </>
      )}
    </div>
  );
};

export default Home;
