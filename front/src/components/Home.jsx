import React, { useContext, useState } from "react";
import { AuthContext } from "../context/auth.context";
import DateList from "./dashboard/DateList";
import "./dashboard/css/homePage.css";
import guirlande from "../components/dashboard/images/guirlande.png";

const Home = () => {
  const { logOut, isLoggedIn, currentUser } = useContext(AuthContext);
  const [date] = useState([]);

  return (
    <div className="homePageRoot">
      <div className="homeTest">
        <div className="headerApp homePageHeader">
          <h1 className="titleFont titleFontSize">BirthDate</h1>
          {isLoggedIn && (
            <div className="homePageUser">
              <div className="homePageCurrentUser">
                <img
                  src={`https://api.dicebear.com/8.x/bottts/svg?seed=${currentUser.surname}`}
                  alt="avatar"
                  className="avatar"
                />
                <div className="homePageCurrentUserName">
                  {currentUser && currentUser.name}
                </div>
              </div>
              <button className="bntLogout" onClick={logOut}>
                LogOut
              </button>
            </div>
          )}
        </div>
        {/* <div className="christmas-lights">
          {" "}
          <img
            src={guirlande}
            alt="Guirlande lumineuse de Noël"
            className="guirlandeDeNoel"
          />{" "}
        </div> */}
      </div>

      {isLoggedIn && <DateList date={date} />}
    </div>
  );
};

export default Home;
