import React, { createContext, useState, useEffect } from "react";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // États possibles : 'light', 'dark', 'auto'
  const [theme, setTheme] = useState(() => {
    // Récupérer depuis localStorage ou 'auto' par défaut
    return localStorage.getItem("theme") || "auto";
  });

  // Calculer le thème effectif (si auto, on regarde le système)
  const getEffectiveTheme = () => {
    if (theme === "auto") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return theme;
  };

  const [effectiveTheme, setEffectiveTheme] = useState(getEffectiveTheme());

  // Appliquer le thème au HTML
  useEffect(() => {
    const root = document.documentElement;
    const newEffectiveTheme = getEffectiveTheme();

    setEffectiveTheme(newEffectiveTheme);

    // Ajouter/retirer la classe 'dark'
    if (newEffectiveTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Sauvegarder dans localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Écouter les changements de préférence système (pour mode auto)
  useEffect(() => {
    if (theme !== "auto") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const newEffectiveTheme = mediaQuery.matches ? "dark" : "light";
      setEffectiveTheme(newEffectiveTheme);

      if (newEffectiveTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => {
      if (current === "light") return "dark";
      if (current === "dark") return "auto";
      return "light";
    });
  };

  const setSpecificTheme = (newTheme) => {
    if (["light", "dark", "auto"].includes(newTheme)) {
      setTheme(newTheme);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme, // 'light', 'dark', ou 'auto'
        effectiveTheme, // le thème réellement appliqué
        toggleTheme,
        setSpecificTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

// Hook personnalisé pour faciliter l'utilisation
export const useTheme = () => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
