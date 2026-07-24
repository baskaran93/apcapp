// src/services/api.js
import AsyncStorage from "@react-native-async-storage/async-storage";

// const BASE_URL = "https://apc-doublemanda-backend-up.azurewebsites.net";
// const BASE_URL = "http://localhost:8008"; // Local IIS API
// const BASE_URL = "http://192.168.29.25:8008";
const BASE_URL = "https://apc-clinic-backend-production.up.railway.app";
// const BASE_URL = "http://10.0.2.2:8000";
console.log("API BASE_URL:", BASE_URL);
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

    // If login returned an access_token, save it to AsyncStorage under the key `token`
    if (response.ok && result && result.access_token) {
      try {
        await AsyncStorage.setItem("token", result.access_token);
        console.log("Saved token to AsyncStorage");
      } catch (e) {
        console.warn("Failed to save token to AsyncStorage:", e);
      }
    }

    return {
      ok: response.ok,
      data: result,
    };
  } catch (error) {
    console.error("API Login Error FULL:", error);
    throw error;
  }
};

export const changePassword = async (oldPassword, newPassword) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/user/change-password/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    });

    let result = null;
    try {
      result = await response.json();
    } catch (e) {
      result = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      data: result,
    };
  } catch (error) {
    console.error("API Change Password Error FULL:", error);
    return { ok: false, status: 0, data: null, error: String(error) };
  }
};
export const getPatients = async (params = {}) => {
  try {
    // 🔑 Get token from storage
    const token = await AsyncStorage.getItem("token");
    console.log("TOKEN 👉", token);

    // build query string if params provided
    let url = `${BASE_URL}/patient/list/`;
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    if (qs) url += `?${qs}`;

    console.log("Calling API:", url);

    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    else console.warn("No token found in AsyncStorage; calling API without Authorization header");

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    console.log("Raw response 👉", response.status, response.type);

    let result = null;
    try {
      result = await response.json();
    } catch (e) {
      console.warn("Failed to parse JSON from patients response:", e);
      result = null;
    }

    console.log("Patients API result 👉", result);

    return {
      ok: response.ok,
      status: response.status,
      data: result,
    };
  } catch (error) {
    console.error("API Get Patients Error FULL 👉", error);
    return { ok: false, status: 0, data: null, error: String(error) };
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

    // Normalize incoming fields (support both mobile/phone_number and referral/mode_of_referral)
    const payload = {
      name: formData.name || "",
      phone_number: formData.phone_number || formData.mobile || "",
      age: Number(formData.age) || 0,
      address: formData.address || "",
      city: formData.city || "",
      pincode: formData.pincode || "",
      mode_of_referral: formData.mode_of_referral || formData.referral || "",
    };

    console.log("createPatient -> token:", token, "url:", `${BASE_URL}/patient/details/register/`);
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

    if (response.status === 401) {
      console.warn("Create Patient 401 Unauthorized:", result);
    }

    // Map SQL truncation message to a friendly client message (avoid showing raw SQL errors to users)
    let dataToReturn = result;
    if (result && result.detail && result.detail.toString().toLowerCase().includes("truncated")) {
      dataToReturn = {
        ...result,
        message: "Phone number too long for server. Please enter at most 10 digits.",
        detail: "Phone number too long",
      };
    }

    console.log("Create Patient Response:", dataToReturn);

    return {
      ok: response.ok,
      data: dataToReturn,
    };
  } catch (error) {
    console.error("API Create Patient Error:", error);
    throw error;
  }
};

// Update an existing patient (partial update). Uses PATCH to avoid requiring all fields.
export const updatePatient = async (id, formData) => {
  try {
    const token = await AsyncStorage.getItem("token");

    const payload = {
      name: formData.name || "",
      phone_number: formData.phone_number || formData.mobile || "",
      age: formData.age !== undefined ? Number(formData.age) : undefined,
      address: formData.address || "",
      city: formData.city || "",
      pincode: formData.pincode || "",
      mode_of_referral: formData.mode_of_referral || formData.referral || "",
    };

    console.log("updatePatient -> token:", token, "url:", `${BASE_URL}/patient/details/${id}/`);
    console.log("Updating patient with payload:", payload);

    const response = await fetch(`${BASE_URL}/patient/details/${id}/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    // Normalize server validation errors similarly to createPatient
    let dataToReturn = result;
    if (result && result.detail && result.detail.toString().toLowerCase().includes("truncated")) {
      dataToReturn = {
        ...result,
        message: "Phone number too long for server. Please enter at most 10 digits.",
        detail: "Phone number too long",
      };
    }

    console.log("Update Patient Response:", dataToReturn);

    return {
      ok: response.ok,
      data: dataToReturn,
    };
  } catch (error) {
    console.error("API Update Patient Error:", error);
    throw error;
  }
};

export const registerTreatment = async (payload) => {
  try {
    const token = await AsyncStorage.getItem("token");
    console.log("Registering treatment with structured payload:", payload);

    const response = await fetch(`${BASE_URL}/patient/treatement/details/register/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Register Treatment Error:", error);
    throw error;
  }
};

export const getTreatmentHistory = async (patientId) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/patient/treatement/history/${patientId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Get Treatment History Error:", error);
    throw error;
  }
};
export const getDistinctDiagnoses = async () => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/patient/treatement/diagnoses/distinct`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Get Distinct Diagnoses Error:", error);
    throw error;
  }
};

export const getDashboardSummary = async () => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/dashboard/summary/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Get Dashboard Summary Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

export const bookAppointment = async (payload) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/appointments/book/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Book Appointment Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

export const getAppointments = async (params = {}) => {
  try {
    const token = await AsyncStorage.getItem("token");

    let url = `${BASE_URL}/appointments/list/`;
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    if (qs) url += `?${qs}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Get Appointments Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

export const updateAppointment = async (id, payload) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/appointments/${id}/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Update Appointment Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

export const cancelAppointment = async (id) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/appointments/${id}/`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Cancel Appointment Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

export const getDistinctPhysiotherapists = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await fetch(`${BASE_URL}/patient/treatement/physiotherapists/distinct`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      return { ok: response.ok, data: result };
    } catch (error) {
      console.error("API Get Distinct Physiotherapists Error:", error);
      throw error;
    }
  };

// ===== Patient delete =====
export const deletePatient = async (id) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/patient/details/${id}/`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Delete Patient Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

// ===== Treatment charges: edit/delete =====
export const updateTreatmentCharge = async (id, data) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/masters/treatment_charges/${id}/`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Update Treatment Charge Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

export const deleteTreatmentCharge = async (id) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/masters/treatment_charges/${id}/`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Delete Treatment Charge Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

// ===== Patient treatment (session) edit/delete =====
export const updateTreatment = async (sessionId, payload) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/patient/treatement/details/${sessionId}/`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Update Treatment Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

export const deleteTreatment = async (sessionId) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/patient/treatement/details/${sessionId}/`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Delete Treatment Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

// ===== Role permissions (admin) & self-check =====
export const getMyPermissions = async () => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/permissions/me/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Get My Permissions Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

export const getPermissionsMatrix = async () => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/permissions/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Get Permissions Matrix Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

export const updatePermission = async (payload) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/permissions/`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Update Permission Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

// ===== User management (admin) =====
export const getUsers = async () => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/user/list/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Get Users Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

export const registerUser = async (username, password, role) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/user/register/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username, password_hash: password, role }),
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Register User Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};

export const updateUser = async (userId, { role, newPassword } = {}) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const payload = {};
    if (role !== undefined) payload.role = role;
    if (newPassword) payload.new_password = newPassword;

    const response = await fetch(`${BASE_URL}/user/${userId}/`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    return { ok: response.ok, data: result };
  } catch (error) {
    console.error("API Update User Error:", error);
    return { ok: false, data: null, error: String(error) };
  }
};
