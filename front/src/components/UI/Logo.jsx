import React from "react";
import { useTheme } from "../../context/theme.context";
import logoLight from "../../assets/logo-light.svg";
import logoDark from "../../assets/logo-dark.svg";
import "./css/logo.css";

const Logo = ({ className = "" }) => {
  const { effectiveTheme } = useTheme();

  return (
    <img
      src={effectiveTheme === "dark" ? logoDark : logoLight}
      alt="BirthReminder"
      className={`logo ${className}`}
    />
  );
};

export default Logo;
