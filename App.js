import React, { useState, createContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";

import "react-native-gesture-handler"; // Ensure this is at the top
import { gestureHandlerRootHOC } from "react-native-gesture-handler";

export const AuthContext = createContext();

function MainApp() {
  const [userToken, setUserToken] = useState("token123"); // ✅ Simulating logged-in user

  return (
    <AuthContext.Provider value={{ userToken, setUserToken }}>
      <NavigationContainer>
        {userToken ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

export default gestureHandlerRootHOC(MainApp); // ✅ Wrap App with gestureHandlerRootHOC
