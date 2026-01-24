// src/theme/ThemeContext.js

import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const ThemeContext = createContext();

/* 🔹 LIGHT & DARK THEMES */
const lightTheme = {
  mode: "light",
  background: "#f4f6f9",
  card: "#ffffff",
  text: "#222222",
  subText: "#666666",
  primary: "#4A90E2",
  border: "#dddddd",
};

const darkTheme = {
  mode: "dark",
  background: "#121212",
  card: "#1e1e1e",
  text: "#ffffff",
  subText: "#aaaaaa",
  primary: "#4A90E2",
  border: "#333333",
};

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState("light");
  const [theme, setTheme] = useState(lightTheme);

  /* 🔹 LOAD SAVED THEME ON APP START */
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedMode = await AsyncStorage.getItem("appTheme");
      if (savedMode === "dark") {
        setMode("dark");
        setTheme(darkTheme);
      } else {
        setMode("light");
        setTheme(lightTheme);
      }
    } catch (e) {
      console.log("Theme load error", e);
    }
  };

  /* 🔹 TOGGLE THEME */
  const toggleTheme = async () => {
    try {
      if (mode === "light") {
        setMode("dark");
        setTheme(darkTheme);
        await AsyncStorage.setItem("appTheme", "dark");
      } else {
        setMode("light");
        setTheme(lightTheme);
        await AsyncStorage.setItem("appTheme", "light");
      }
    } catch (e) {
      console.log("Theme save error", e);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
