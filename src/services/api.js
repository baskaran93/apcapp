// src/services/api.js
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "https://apc-doublemanda-backend-up.azurewebsites.net";
// const BASE_URL = "http://127.0.0.1:8000";
export const loginUser = async (username, password) => {
  try {
    console.log("Calling API:", `${BASE_URL}/user/login/`);

    const response = await fetch(`${BASE_URL}/user/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: username,
        password_hash: password,
      }),
    });

    console.log("Raw response:", response);

    const result = await response.json();
    console.log("API result:", result);

    return {
      ok: response.ok,
      data: result,
    };
  } catch (error) {
    console.error("API Login Error FULL:", error);
    throw error;
  }
};
export const getPatients = async () => {
  try {
    // 🔑 Get token from storage
    const token = await AsyncStorage.getItem("token");
    console.log("TOKEN 👉", token);

    console.log("Calling API:", `${BASE_URL}/patient/list/`);

    const response = await fetch(`${BASE_URL}/patient/list/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,   // 🔥 THIS LINE FIXES 403
      },
    });

    console.log("Raw response 👉", response);

    const result = await response.json();
    console.log("Patients API result 👉", result);

    return {
      ok: response.ok,
      data: result,
    };
  } catch (error) {
    console.error("API Get Patients Error FULL 👉", error);
    throw error;
  }
};

export const getTreatmentCharges = async () => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/masters/treatment_charges/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Get Treatment Charges Error:", error);
    throw error;
  }
};

export const addTreatmentCharge = async (data) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/masters/treatment_charges/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Add Treatment Charge Error:", error);
    throw error;
  }
};

export const createPatient = async (formData) => {
  try {
    const token = await AsyncStorage.getItem("token");

    // Map form fields to backend expectations
    const payload = {
      name: formData.name,
      phone_number: formData.mobile,
      age: parseInt(formData.age) || 0,
      address: formData.address || "",
      city: formData.city || "",
      pincode: formData.pincode || "",
      mode_of_referral: formData.referral || ""
    };

    console.log("Creating patient with payload:", payload);

    const response = await fetch(`${BASE_URL}/patient/details/register/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("Create Patient Response:", result);

    return {
      ok: response.ok,
      data: result,
    };
  } catch (error) {
    console.error("API Create Patient Error:", error);
    throw error;
  }
};
