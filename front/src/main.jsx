import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { AuthProviderWrapper } from "./context/auth.context";
import { NotificationProvider } from "./context/notification.context";
import { OnlineStatusProvider } from "./context/OnlineStatusContext";
import { ThemeProvider } from "./context/theme.context";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProviderWrapper>
          <NotificationProvider>
            <OnlineStatusProvider>
              <App />
            </OnlineStatusProvider>
          </NotificationProvider>
        </AuthProviderWrapper>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
