import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import LoginScreen from './src/screens/login';
import DashboardScreen from './src/screens/DashboardScreen';
import PatientProfileScreen from './src/screens/registration';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// ✅ Make DrawerNavigator a component instead of a function returning JSX
function DrawerNavigatorComponent() {
  return (
    <Drawer.Navigator screenOptions={{ headerShown: false }}>
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      <Drawer.Screen name="Patient Profile" component={PatientProfileScreen} />
    </Drawer.Navigator>
  );
}

function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      {/* ✅ Pass DrawerNavigatorComponent as a component, not JSX */}
      <Stack.Screen name="Home" component={DrawerNavigatorComponent} />
    </Stack.Navigator>
  );
}

export default AuthNavigator;
