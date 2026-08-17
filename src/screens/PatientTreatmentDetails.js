import React, { useEffect, useState, useContext, useMemo } from "react";
import {
    View,
    Text,
    FlatList,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    StatusBar,
    Modal,
    Pressable,
    Platform,
    ScrollView,
    Dimensions,
    KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPatients, getTreatmentCharges, registerTreatment, updateTreatment, getTreatmentHistory, getDistinctDiagnoses, getUsers, deleteTreatment, getAssessmentFile } from "../services/api";
import { ThemeContext } from "../theme/ThemeContext";
import { AuthContext } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons as Icon } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { Asset } from 'expo-asset';
import logoBase64 from "../constants/logo_base64";

const { width } = Dimensions.get("window");

const PatientTreatmentDetails = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { theme, mode: themeMode } = useContext(ThemeContext);
    const { permissions } = useContext(AuthContext);
    const canAddTreatment = hasPermission(permissions, "patient_treatment", "add");
    const canEditTreatment = hasPermission(permissions, "patient_treatment", "edit");
    const canDeleteTreatment = hasPermission(permissions, "patient_treatment", "delete");
    const isDark = themeMode === "dark";
    const isWeb = Platform.OS === "web";

    const initialPatient = route.params?.patient || null;

    const [patients, setPatients] = useState([]);
    const [treatmentMaster, setTreatmentMaster] = useState([]);
    const [treatmentHistory, setTreatmentHistory] = useState([]);
    const [globalDiagnoses, setGlobalDiagnoses] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedPatient, setSelectedPatient] = useState(initialPatient);
    const [patientSearch, setPatientSearch] = useState("");
    const [diagnosis, setDiagnosis] = useState("");
    const [doctorName, setDoctorName] = useState("");
    const [notes, setNotes] = useState("");
    const [selectedTreatments, setSelectedTreatments] = useState([]);
    const [showTreatmentModal, setShowTreatmentModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [assessmentFile, setAssessmentFile] = useState(null);
    const [editingSessionId, setEditingSessionId] = useState(null);
    const [existingAssessmentFileName, setExistingAssessmentFileName] = useState(null);
    const [viewingFileId, setViewingFileId] = useState(null);

    // New Master Treatment States
    const [showAddMasterModal, setShowAddMasterModal] = useState(false);
    const [newMasterName, setNewMasterName] = useState("");
    const [newMasterCost, setNewMasterCost] = useState("");
    const [savingMaster, setSavingMaster] = useState(false);

    // Physiotherapist selection — sourced from Manage Users, restricted to
    // accounts whose designation is "Doctor" (not the login role, which is
    // separate: role gates app access, designation is the job title).
    const [showDoctorPicker, setShowDoctorPicker] = useState(false);
    const [doctorUsers, setDoctorUsers] = useState([]);

    // Diagnosis Suggestions State
    const [showDiagnosisSuggestions, setShowDiagnosisSuggestions] = useState(false);
    const diagnosisSuggestions = useMemo(() => {
        if (!diagnosis.trim()) return [];
        const lower = diagnosis.toLowerCase();
        
        // Combine history from this patient and global diagnoses
        const historyList = Array.isArray(treatmentHistory) ? treatmentHistory.map(h => h.diagnosis) : [];
        const allSuggestions = Array.from(new Set([...historyList, ...globalDiagnoses]));
        
        return allSuggestions.filter(s => s && s.toLowerCase().includes(lower) && s.toLowerCase() !== lower).slice(0, 5);
    }, [diagnosis, treatmentHistory, globalDiagnoses]);

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (selectedPatient) {
            loadHistory(selectedPatient.id);
        } else {
            setTreatmentHistory([]);
        }
    }, [selectedPatient]);

    // Reload history when returning from the NewTreatment screen (or if a patient is passed via params)
    useEffect(() => {
        if (route.params?.newTreatment && selectedPatient) {
            loadHistory(selectedPatient.id);
            navigation.setParams({ newTreatment: undefined });
        }

        // Allow opening this screen with a patient param and auto-selecting them
        if (route.params?.patient) {
            setSelectedPatient(route.params.patient);
            // clear the param so it doesn't re-trigger unnecessarily
            navigation.setParams({ patient: undefined });
        }

        // Opened from Treatment History's Edit action: pre-fill the form
        // from the existing session instead of starting a blank one.
        if (route.params?.editingSession) {
            const session = route.params.editingSession;
            setEditingSessionId(session.id);
            setDiagnosis(session.diagnosis || "");
            setDoctorName(session.doctor_name || "");
            setNotes(session.notes || "");
            setSelectedTreatments(
                (session.items || []).map((it, idx) => ({
                    id: `existing-${idx}`,
                    treatment_name: it.treatment_name,
                    cost: it.cost,
                }))
            );
            setExistingAssessmentFileName(session.has_assessment_file ? session.assessment_file_name : null);
            navigation.setParams({ editingSession: undefined });
        }
    }, [route.params?.newTreatment, route.params?.patient, route.params?.editingSession]);

    // Also refresh on focus to be robust in case params were sent to drawer-level navigator
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            const newTreatment = route.params?.newTreatment;
            if (newTreatment && selectedPatient) {
                loadHistory(selectedPatient.id);
                navigation.setParams({ newTreatment: undefined });
            }
        });
        return unsubscribe;
    }, [navigation, selectedPatient, route.params?.newTreatment]);

    const handleViewAssessmentFile = async (sessionId) => {
        if (!sessionId) return;
        try {
            setViewingFileId(sessionId);
            const res = await getAssessmentFile(sessionId);
            if (!res.ok) {
                const msg = res.data?.detail || res.data?.message || "Failed to load assessment form.";
                Alert.alert("Error", typeof msg === "string" ? msg : JSON.stringify(msg));
                return;
            }
            const { filename, content_type, content_base64 } = res.data?.data || {};
            if (!content_base64) {
                Alert.alert("Error", "No assessment form found for this record.");
                return;
            }

            if (Platform.OS === "web") {
                const byteChars = atob(content_base64);
                const byteNumbers = new Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
                const blob = new Blob([new Uint8Array(byteNumbers)], { type: content_type || "application/octet-stream" });
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            } else {
                const uri = FileSystem.cacheDirectory + (filename || `assessment_${sessionId}`);
                await FileSystem.writeAsStringAsync(uri, content_base64, { encoding: FileSystem.EncodingType.Base64 });
                await Sharing.shareAsync(uri, { mimeType: content_type || "application/octet-stream", dialogTitle: filename || "Assessment Form" });
            }
        } catch (error) {
            console.error("VIEW ASSESSMENT FILE ERROR", error);
            Alert.alert("Error", "Failed to open the assessment form.");
        } finally {
            setViewingFileId(null);
        }
    };

    const handleFileUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
            });

            if (result.assets && result.assets.length > 0) {
                setAssessmentFile(result.assets[0]);
            }
        } catch (err) {
            Alert.alert("Error", "Failed to pick document");
        }
    };

    // Guards against a slow-loading patient's history landing after a
    // faster-loading, more-recently-selected patient's, which would
    // otherwise overwrite the currently displayed patient's history.
    const historyRequestId = React.useRef(0);

    const loadHistory = async (patientId) => {
        const requestId = ++historyRequestId.current;
        try {
            const response = await getTreatmentHistory(patientId);
            if (requestId !== historyRequestId.current) return;
            if (response.ok) {
                // Ensure we extract array from possible response formats
                let data = [];
                if (Array.isArray(response.data)) data = response.data;
                else if (response.data?.results) data = response.data.results;
                else if (response.data?.data) data = response.data.data;

                setTreatmentHistory(data);
            } else {
                setTreatmentHistory([]);
            }
        } catch (error) {
            if (requestId !== historyRequestId.current) return;
            console.error("HISTORY LOAD ERROR", error);
            setTreatmentHistory([]);
        }
    };

    const handleDeleteTreatment = (session) => {
        const doDelete = async () => {
            const res = await deleteTreatment(session.id);
            if (res.ok) {
                if (selectedPatient) loadHistory(selectedPatient.id);
            } else {
                Alert.alert("Error", res.data?.detail || "Failed to delete treatment record.");
            }
        };

        if (Platform.OS === "web") {
            if (window.confirm(`Delete this treatment record from ${new Date(session.treatment_date).toLocaleDateString()}?`)) doDelete();
        } else {
            Alert.alert(
                "Delete Treatment",
                `Delete this treatment record from ${new Date(session.treatment_date).toLocaleDateString()}?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: doDelete },
                ]
            );
        }
    };

    const loadGlobalDiagnoses = async () => {
        try {
            const res = await getDistinctDiagnoses();
            if (res.ok) setGlobalDiagnoses(res.data?.data || []);
        } catch (e) {
            console.error("Failed to load global diagnoses", e);
        }
    };

    const loadDoctorUsers = async () => {
        try {
            const res = await getUsers();
            if (res.ok) {
                const users = res.data?.data || [];
                setDoctorUsers(users.filter(u => (u.designation_name || "").toLowerCase().includes("doctor")));
            }
        } catch (e) {
            console.error("Failed to load doctor users", e);
        }
    };

    const loadLogoBase64 = async () => {
        try {
            const asset = Asset.fromModule(require("../assets/logo.png"));
            await asset.downloadAsync();
            const base64 = await FileSystem.readAsStringAsync(asset.localUri, { encoding: FileSystem.EncodingType.Base64 });
            return `data:image/png;base64,${base64}`;
        } catch (e) {
            console.error("Failed to load logo", e);
            return null;
        }
    };

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [patientsRes, chargesRes] = await Promise.all([
                getPatients(),
                getTreatmentCharges()
            ]);

            if (patientsRes.ok) {
                let data = [];
                if (Array.isArray(patientsRes.data)) data = patientsRes.data;
                else if (patientsRes.data.results) data = patientsRes.data.results;
                else if (patientsRes.data.patients) data = patientsRes.data.patients;
                else if (patientsRes.data.data) data = patientsRes.data.data;

                setPatients(data);
            }

            if (chargesRes.ok) {
                setTreatmentMaster(chargesRes.data || []);
            }
            
            await Promise.all([
                loadGlobalDiagnoses(),
                loadDoctorUsers()
            ]);
        } catch (error) {
            console.error("DATA LOAD ERROR", error);
            Alert.alert("Error", "Failed to load master data");
        } finally {
            setLoading(false);
        }
    };



    const escapeHtml = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const buildBillHtml = (treatmentSession, format, logoData) => {
        const isA5 = format.toLowerCase() === "a5";
        const patientName = escapeHtml(selectedPatient?.name || selectedPatient?.patient_name || "N/A");
        const itemsList = Array.isArray(treatmentSession.items) ? treatmentSession.items : [];
        const total = itemsList.reduce((sum, item) => sum + Number(item.cost || 0), 0);
        const rows = itemsList.map(item => `
            <tr>
                <td>${escapeHtml(item.treatment_name || "N/A")}</td>
                <td class="amount">${Number(item.cost || 0).toFixed(2)}</td>
            </tr>
        `).join("");

        return `
        <html>
        <head>
            <meta charset="utf-8" />
            <style>
                @page { size: ${isA5 ? "A5" : "A4"}; margin: 14mm; }
                body { font-family: Helvetica, Arial, sans-serif; color: #111; font-size: ${isA5 ? "10px" : "12px"}; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-bottom: 12px; }
                .logo { width: ${isA5 ? "60px" : "80px"}; height: ${isA5 ? "60px" : "80px"}; object-fit: contain; }
                .address { text-align: right; font-size: ${isA5 ? "9px" : "10px"}; line-height: 1.4; }
                .titles { display: flex; justify-content: space-between; font-weight: bold; font-size: ${isA5 ? "11px" : "13px"}; margin-bottom: 6px; }
                .info { display: flex; justify-content: space-between; margin-bottom: 2px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { padding: 4px 0; text-align: left; }
                th.amount, td.amount { text-align: right; }
                thead th { border-bottom: 1px solid #333; font-weight: bold; }
                tfoot td { border-top: 1px solid #333; font-weight: bold; padding-top: 6px; }
                .notes { margin-top: 10px; font-size: ${isA5 ? "8px" : "9px"}; }
                .footer { text-align: center; color: #999; font-size: 8px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                ${logoData ? `<img class="logo" src="${logoData}" />` : "<div></div>"}
                <div class="address">
                    <div>Siva Subramani Nagar, Kalapatti Main Rd</div>
                    <div>Civil Aerodrome Post, Nehru Nagar West</div>
                    <div>Coimbatore - 641010, Tamil Nadu</div>
                    <div>Ph: +91 9791 348 748 / +91 8248 137 887</div>
                </div>
            </div>
            <div class="titles">
                <span>Patient</span>
                <span>Invoice</span>
            </div>
            <div class="info">
                <span>Name: ${patientName}</span>
                <span>Date: ${new Date(treatmentSession.treatment_date).toLocaleDateString()}</span>
            </div>
            <div class="info">
                <span>Phone: ${escapeHtml(selectedPatient?.phone_number || "N/A")}</span>
                <span>Doctor: ${escapeHtml(treatmentSession.doctor_name || "N/A")}</span>
            </div>
            <div class="info">
                <span>Age/DOB: ${escapeHtml(selectedPatient?.age || "N/A")}</span>
                <span>Inv No: ${escapeHtml(treatmentSession.id || "")}</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Treatment Description</th>
                        <th class="amount">Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
                <tfoot>
                    <tr>
                        <td>Total</td>
                        <td class="amount">${total.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
            ${treatmentSession.notes ? `<div class="notes">Notes: ${escapeHtml(treatmentSession.notes)}</div>` : ""}
            <div class="footer">Computer Generated Invoice</div>
        </body>
        </html>
        `;
    };

    const generateBillPDF = async (treatmentSession, format = "a4") => {
        try {
            const logoData = logoBase64 || await loadLogoBase64();
            const filename = `Bill_${format.toUpperCase()}.pdf`;

            // jsPDF relies on browser-only APIs (Buffer/TextEncoder with latin1
            // support) that Hermes/React Native doesn't provide, so it's only
            // safe to use when actually running in a web browser.
            if (Platform.OS === "web") {
                const { jsPDF } = require("jspdf");
                const isA5 = format.toLowerCase() === "a5";
                const pdf = new jsPDF({
                    unit: "mm",
                    format: isA5 ? "a5" : "a4",
                    orientation: "portrait"
                });

                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();

                // Scaling factors for A5 (A5 is roughly 70% of A4 in dimensions)
                const scale = isA5 ? 0.75 : 1.0;
                const M = 14 * scale; // margin
                let y = M;

                if (logoData) {
                    try {
                        const logoW = 40 * scale;
                        const logoH = 40 * scale;
                        pdf.addImage(logoData, 'PNG', M, y - (4 * scale), logoW, logoH);
                    } catch (e1) {
                        console.error('Failed to add logo image to PDF', e1);
                    }
                }

                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(10 * scale);
                const addrX = pageWidth - M - (isA5 ? 70 : 120);
                pdf.text("Siva Subramani Nagar, Kalapatti Main Rd", addrX, y + (8 * scale));
                pdf.text("Civil Aerodrome Post, Nehru Nagar West", addrX, y + (14 * scale));
                pdf.text("Coimbatore - 641010, Tamil Nadu", addrX, y + (20 * scale));
                pdf.text("Ph: +91 9791 348 748 / +91 8248 137 887", addrX, y + (26 * scale));
                y += (isA5 ? 30 : 40);

                pdf.setDrawColor(200);
                pdf.setLineWidth(0.6 * scale);
                pdf.line(M, y, pageWidth - M, y);
                y += (8 * scale);

                pdf.setFontSize(11 * scale);
                pdf.setFont("helvetica", "bold");
                pdf.text("Patient", M, y);
                pdf.text("Invoice", pageWidth - M - (isA5 ? 25 : 40), y);
                y += (6 * scale);

                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(10 * scale);
                const patientName = selectedPatient?.name || selectedPatient?.patient_name || "N/A";
                pdf.text(`Name: ${patientName}`, M, y);
                pdf.text(`Date: ${new Date(treatmentSession.treatment_date).toLocaleDateString()}`, pageWidth - M - (isA5 ? 25 : 40), y);
                y += (6 * scale);
                pdf.text(`Phone: ${selectedPatient?.phone_number || "N/A"}`, M, y);
                pdf.text(`Doctor: ${treatmentSession.doctor_name || "N/A"}`, pageWidth - M - (isA5 ? 25 : 40), y);
                y += (6 * scale);
                pdf.text(`Age/DOB: ${selectedPatient?.age || "N/A"}`, M, y);
                pdf.text(`Inv No: ${treatmentSession.id || ""}`, pageWidth - M - (isA5 ? 25 : 40), y);
                y += (10 * scale);

                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(11 * scale);
                const col1X = M;
                pdf.text("Treatment Description", col1X, y);
                pdf.text("Amount (₹)", pageWidth - M, y, { align: "right" });
                y += (6 * scale);
                pdf.setLineWidth(0.4 * scale);
                pdf.line(M, y, pageWidth - M, y);
                y += (6 * scale);

                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(10 * scale);
                let total = 0;
                const itemsList = Array.isArray(treatmentSession.items) ? treatmentSession.items : [];
                for (let i = 0; i < itemsList.length; i++) {
                    const item = itemsList[i];
                    if (y > pageHeight - (20 * scale)) {
                        pdf.addPage();
                        y = M;
                    }
                    pdf.text(item.treatment_name || "N/A", col1X, y);
                    pdf.text(Number(item.cost || 0).toFixed(2), pageWidth - M, y, { align: "right" });
                    y += (6 * scale);
                    total += Number(item.cost || 0);
                }

                y += (6 * scale);
                pdf.setLineWidth(0.5 * scale);
                pdf.line(M, y, pageWidth - M, y);
                y += (6 * scale);

                pdf.setFont("helvetica", "bold");
                pdf.text("Total", col1X, y);
                pdf.text(total.toFixed(2), pageWidth - M, y, { align: "right" });
                y += (12 * scale);

                if (treatmentSession.notes) {
                    pdf.setFont("helvetica", "normal");
                    pdf.setFontSize(9 * scale);
                    pdf.text(`Notes: ${treatmentSession.notes}`, M, y);
                    y += (10 * scale);
                }

                pdf.setFontSize(8 * scale);
                pdf.setTextColor(150);
                pdf.text("Computer Generated Invoice", pageWidth / 2, pageHeight - M + (5 * scale), { align: "center" });

                pdf.save(filename);
                return;
            }

            // Native (iOS/Android): render HTML to PDF via expo-print, which
            // uses the platform's native renderer instead of jsPDF's
            // browser-only encoding logic.
            const html = buildBillHtml(treatmentSession, format, logoData);
            const { uri } = await Print.printToFileAsync({ html, base64: false });
            await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: filename, UTI: "com.adobe.pdf" });
        } catch (error) {
            console.error("PDF ERROR:", error);
            Alert.alert("Error", "Failed to generate PDF");
        }
    };

    const addTreatment = (item) => {
        if (!selectedTreatments.find(t => t.id === item.id)) {
            setSelectedTreatments([...selectedTreatments, item]);
        }
        setShowTreatmentModal(false);
    };

    const removeTreatment = (id) => {
        setSelectedTreatments(selectedTreatments.filter(t => t.id !== id));
    };

    const updateTreatmentPrice = (id, newCost) => {
        // Only allow numeric input
        const numericValue = newCost.replace(/[^0-9]/g, '');
        setSelectedTreatments(prev => prev.map(t => 
            t.id === id ? { ...t, cost: Number(numericValue) } : t
        ));
    };

    const handleSaveNewMaster = async () => {
        if (!newMasterName.trim()) {
            Alert.alert("Validation", "Please enter treatment name.");
            return;
        }
        if (!newMasterCost.trim()) {
            Alert.alert("Validation", "Please enter cost.");
            return;
        }

        try {
            setSavingMaster(true);
            const { addTreatmentCharge } = require("../services/api");
            const res = await addTreatmentCharge({
                treatment_name: newMasterName.trim(),
                cost: Number(newMasterCost)
            });

            if (res.ok) {
                // Refresh master list
                const chargesRes = await getTreatmentCharges();
                if (chargesRes.ok) setTreatmentMaster(chargesRes.data || []);
                
                // Automatically add to current visit
                const newItem = res.data;
                if (newItem && !selectedTreatments.find(t => t.id === newItem.id)) {
                    setSelectedTreatments(prev => [...prev, newItem]);
                }

                // Reset and close
                setNewMasterName("");
                setNewMasterCost("");
                setShowAddMasterModal(false);
                setShowTreatmentModal(false);
            } else {
                Alert.alert("Error", "Failed to save treatment master.");
            }
        } catch (e) {
            console.error("SAVE MASTER ERROR", e);
            Alert.alert("Error", "An unexpected error occurred.");
        } finally {
            setSavingMaster(false);
        }
    };

    const patientSearchResults = useMemo(() => {
        if (!patientSearch.trim()) return [];
        const searchLower = patientSearch.toLowerCase();
        return patients.filter(p => {
            const nameMatch = (p.name || p.patient_name) ? (p.name || p.patient_name).toLowerCase().includes(searchLower) : false;
            const idMatch = p.id ? p.id.toString().toLowerCase().includes(searchLower) : false;
            const phoneMatch = p.phone_number ? p.phone_number.includes(searchLower) : false;
            return nameMatch || idMatch || phoneMatch;
        }).slice(0, 5);
    }, [patientSearch, patients]);


    const MAX_ASSESSMENT_FILE_BYTES = 5 * 1024 * 1024; // 5MB

    const readFileAsBase64 = async (file) => {
        if (!file?.uri) return null;
        try {
            if (Platform.OS === "web") {
                const response = await fetch(file.uri);
                const blob = await response.blob();
                return await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const dataUrl = String(reader.result || "");
                        resolve(dataUrl.split(",")[1] || null);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            }
            return await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        } catch (e) {
            console.error("Failed to read assessment file", e);
            return null;
        }
    };

    const handleSave = async () => {
        if (!selectedPatient) {
            Alert.alert("Validation", "Please select a patient.");
            return;
        }
        if (!diagnosis.trim()) {
            Alert.alert("Validation", "Please enter diagnosis.");
            return;
        }
        if (selectedTreatments.length === 0) {
            Alert.alert("Validation", "Please add at least one treatment.");
            return;
        }
        if (assessmentFile && assessmentFile.size && assessmentFile.size > MAX_ASSESSMENT_FILE_BYTES) {
            Alert.alert("File too large", "Assessment form must be under 5MB.");
            return;
        }

        try {
            setSubmitting(true);

            // Format treatment items for child table
            // Ensure cost is a number and names are present
            const items = selectedTreatments.map(t => ({
                treatment_name: t.treatment_name || t.name || "Unknown",
                cost: Number(t.cost || 0)
            }));

            // IMPORTANT: Backend expects patient_id pointing to patient_details.id (e.g. "APC0001")
            // Ensure we use the correct field from the patient object
            const patientId = selectedPatient.id || selectedPatient.pk;

            if (!patientId) {
                Alert.alert("Error", "Selected patient has no valid ID.");
                return;
            }

            let assessmentFileBase64 = null;
            if (assessmentFile) {
                assessmentFileBase64 = await readFileAsBase64(assessmentFile);
                if (!assessmentFileBase64) {
                    Alert.alert("Warning", "Could not read the assessment file; saving treatment without it.");
                }
            }

            const payload = {
                patient_id: patientId,
                diagnosis: diagnosis.trim(),
                treatment_plan: "Modern UI Visit",
                doctor_name: doctorName.trim() || "Consultant",
                notes: notes.trim(),
                items: items,
                assessment_file_name: assessmentFileBase64 ? (assessmentFile?.name || null) : null,
                assessment_file_base64: assessmentFileBase64,
            };

            const response = editingSessionId
                ? await updateTreatment(editingSessionId, payload)
                : await registerTreatment(payload);

            if (response.ok) {
                if (editingSessionId) {
                    Alert.alert("Success", "Treatment updated successfully.");
                    setEditingSessionId(null);
                    setDiagnosis("");
                    setSelectedTreatments([]);
                    setNotes("");
                    setAssessmentFile(null);
                    setExistingAssessmentFileName(null);
                    navigation.goBack();
                    return;
                }

                Alert.alert("Success", "Treatment details registered successfully.", [
                    {
                        text: "Download Bill (A5)",
                        onPress: () => generateBillPDF({ ...payload, treatment_date: new Date().toISOString() }, "a5")
                    },
                    { text: "OK" }
                ]);

                // Reset fields
                setDiagnosis("");
                setSelectedTreatments([]);
                setNotes("");
                setAssessmentFile(null);

                // Refresh history
                loadHistory(patientId);
                loadGlobalDiagnoses(); // Refresh global list too
            } else {
                console.error("SAVE FAILED:", response.data);
                const errorMsg = response.data?.detail || response.data?.message || response.data?.error || "Failed to save treatment.";
                Alert.alert("Error", typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
            }
        } catch (error) {
            console.error("SAVE ERROR:", error);
            Alert.alert("Error", "An unexpected error occurred while saving.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            
            <LinearGradient
                colors={isDark ? ["#020617", "#0b1220", "#111827"] : ["#f8fafc", "#eef2ff", "#f1f5f9"]}
                style={StyleSheet.absoluteFill}
            />

            {/* ✨ Decorative Blobs */}
            <View pointerEvents="none" style={[styles.blob, { backgroundColor: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)", top: -100, left: -100 }]} />
            <View pointerEvents="none" style={[styles.blob, { backgroundColor: isDark ? "rgba(168,85,247,0.1)" : "rgba(168,85,247,0.06)", bottom: -120, right: -120 }]} />

            <SafeAreaView style={{ flex: 1 }}>
                {/* Header Actions */}
                <View style={styles.topHeader}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circleBtn}>
                        <Icon name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>{editingSessionId ? "Edit Treatment" : "Patient Treatment"}</Text>
                    {(editingSessionId ? canEditTreatment : canAddTreatment) ? (
                        <TouchableOpacity onPress={handleSave} disabled={submitting} style={styles.circleBtn}>
                            {submitting ? <ActivityIndicator size="small" color={theme.primary} /> : <Icon name="checkmark" size={24} color={theme.primary} />}
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.circleBtn} />
                    )}
                </View>

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
                >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={[
                        styles.scrollContent,
                        isWeb && styles.webContainer,
                        { paddingBottom: 150 } // Added padding so dropdowns at the bottom are scrollable
                    ]}
                >
                    
                    {/* Patient Card */}
                    <View style={[styles.glassCard, { backgroundColor: isDark ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.85)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0", zIndex: 3000, overflow: 'visible' }]}>
                        <Text style={[styles.sectionTitle, { color: isDark ? "#94a3b8" : "#64748b" }]}>PATIENT DETAILS</Text>
                        
                        {selectedPatient ? (
                            <View style={styles.patientSelected}>
                                <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                                    <Text style={styles.avatarText}>{(selectedPatient.name || selectedPatient.patient_name || "?").charAt(0).toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.patientName, { color: theme.text }]}>{selectedPatient.name}</Text>
                                    <Text style={[styles.patientInfo, { color: theme.subText }]}>ID: {selectedPatient.id} • {selectedPatient.phone_number}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedPatient(null)} style={styles.changeBtn}>
                                    <Text style={styles.changeBtnText}>Change</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={[styles.inputWrap, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" }]}>
                                <Icon name="search-outline" size={20} color="#94a3b8" />
                                <TextInput
                                    placeholder="Search Patient Name, ID, or Phone..."
                                    placeholderTextColor="#94a3b8"
                                    style={[styles.textInput, { color: theme.text }]}
                                    value={patientSearch}
                                    onChangeText={setPatientSearch}
                                />
                            </View>
                        )}

                        {!selectedPatient && patientSearch.length > 0 && (
                            <View style={styles.patientResults}>
                                {patientSearchResults.map(p => (
                                    <TouchableOpacity key={p.id} onPress={() => { setSelectedPatient(p); setPatientSearch(""); }} style={styles.resultItem}>
                                        <Text style={{ color: theme.text, fontWeight: '600' }}>{p.name || p.patient_name}</Text>
                                        <Text style={{ color: theme.subText, fontSize: 12 }}>{p.id} • {p.phone_number}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Diagnosis & Form */}
                    <View style={[styles.glassCard, { backgroundColor: isDark ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.85)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0", marginTop: 20, zIndex: 2000, overflow: 'visible' }]}>
                        <Text style={[styles.sectionTitle, { color: isDark ? "#94a3b8" : "#64748b" }]}>VISIT INFORMATION</Text>
                        
                        {/* Diagnosis with Suggestions */}
                        <View style={[styles.fieldGroup, { zIndex: 1000, elevation: 1000 }]}>
                            <Text style={[styles.fieldLabel, { color: isDark ? "#cbd5e1" : "#475569" }]}>Diagnosis *</Text>
                            <View style={[styles.inputWrap, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" }]}>
                                <Icon name="pulse-outline" size={20} color="#94a3b8" />
                                <TextInput
                                    placeholder="Enter diagnosis..."
                                    placeholderTextColor="#94a3b8"
                                    style={[styles.textInput, { color: theme.text }]}
                                    value={diagnosis}
                                    onChangeText={(text) => {
                                        setDiagnosis(text);
                                        setShowDiagnosisSuggestions(true);
                                    }}
                                    onBlur={() => setTimeout(() => setShowDiagnosisSuggestions(false), 200)}
                                    onFocus={() => setShowDiagnosisSuggestions(true)}
                                />
                            </View>
                            {showDiagnosisSuggestions && diagnosisSuggestions.length > 0 && (
                                <View style={[styles.suggestionList, { backgroundColor: theme.card, borderColor: theme.border, zIndex: 9999, elevation: 9999 }]}>
                                    {diagnosisSuggestions.map((s, idx) => (
                                        <TouchableOpacity key={idx} onPress={() => { setDiagnosis(s); setShowDiagnosisSuggestions(false); }} style={styles.suggestionItem}>
                                            <Icon name="time-outline" size={14} color="#94a3b8" />
                                            <Text style={{ color: theme.text, marginLeft: 8 }}>{s}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* File Upload - lowered zIndex so suggestions from above float over */}
                        <View style={[styles.fieldGroup, { zIndex: 1, overflow: 'visible' }]}>
                            <Text style={[styles.fieldLabel, { color: isDark ? "#cbd5e1" : "#475569" }]}>Assessment Form</Text>
                            <TouchableOpacity onPress={handleFileUpload} style={[styles.uploadBox, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc", borderStyle: (assessmentFile || existingAssessmentFileName) ? 'solid' : 'dashed' }]}>
                                <Icon name={(assessmentFile || existingAssessmentFileName) ? "document-text" : "cloud-upload-outline"} size={24} color={(assessmentFile || existingAssessmentFileName) ? theme.primary : "#94a3b8"} />
                                <Text style={[styles.uploadText, { color: (assessmentFile || existingAssessmentFileName) ? theme.text : "#94a3b8" }]}>
                                    {assessmentFile
                                        ? assessmentFile.name
                                        : existingAssessmentFileName
                                            ? `${existingAssessmentFileName} (tap to replace)`
                                            : "Upload Assessment Form"}
                                </Text>
                                {assessmentFile && (
                                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); setAssessmentFile(null); }}>
                                        <Icon name="close-circle" size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                            </TouchableOpacity>

                            {existingAssessmentFileName && !assessmentFile && (
                                <TouchableOpacity
                                    onPress={() => handleViewAssessmentFile(editingSessionId)}
                                    disabled={viewingFileId === editingSessionId}
                                    style={styles.viewFileLink}
                                >
                                    {viewingFileId === editingSessionId ? (
                                        <ActivityIndicator size="small" color={theme.primary} />
                                    ) : (
                                        <>
                                            <Icon name="eye-outline" size={14} color={theme.primary} />
                                            <Text style={[styles.viewFileLinkText, { color: theme.primary }]}>View uploaded form</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}

                            <Text style={styles.hintText}>Required for the first time we need to upload filled assessment form</Text>
                        </View>

                        {/* Treatments */}
                        <View style={styles.fieldGroup}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text style={[styles.fieldLabel, { marginBottom: 0, color: isDark ? "#cbd5e1" : "#475569" }]}>Treatments</Text>
                                <TouchableOpacity onPress={() => setShowTreatmentModal(true)} style={styles.addTreatmentBtn}>
                                    <Icon name="add-circle" size={18} color={theme.primary} />
                                    <Text style={{ color: theme.primary, fontWeight: '700', marginLeft: 4 }}>Add</Text>
                                </TouchableOpacity>
                            </View>
                            
                            {selectedTreatments.length === 0 ? (
                                <View style={[styles.emptyBox, { borderColor: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9" }]}>
                                    <Text style={{ color: "#94a3b8", fontSize: 13 }}>No treatments added yet</Text>
                                </View>
                            ) : (
                                selectedTreatments.map(t => (
                                    <View key={t.id} style={styles.treatmentTag}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: theme.text, fontWeight: '600' }}>{t.treatment_name}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700' }}>₹</Text>
                                                <TextInput
                                                    value={String(t.cost || 0)}
                                                    onChangeText={(val) => updateTreatmentPrice(t.id, val)}
                                                    keyboardType="numeric"
                                                    style={[styles.priceInput, { color: theme.primary, borderBottomColor: theme.primary + "33" }]}
                                                />
                                            </View>
                                        </View>
                                        <TouchableOpacity onPress={() => removeTreatment(t.id)} style={styles.trashBtn}>
                                            <Icon name="trash-outline" size={18} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* Doctor & Notes */}
                        <View style={[styles.fieldRow, { zIndex: 2000, elevation: 2000 }]}>
                            <View style={{ flex: 1, marginRight: 10, zIndex: 2000, elevation: 2000 }}>
                                <Text style={[styles.fieldLabel, { color: isDark ? "#cbd5e1" : "#475569" }]}>Physiotherapist Name</Text>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setShowDoctorPicker(true)}
                                    style={[styles.inputWrap, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" }]}
                                >
                                    <Icon name="person-outline" size={18} color="#94a3b8" />
                                    <Text
                                        numberOfLines={1}
                                        style={[styles.textInput, { color: doctorName ? theme.text : "#94a3b8" }]}
                                    >
                                        {doctorName || "Select physiotherapist"}
                                    </Text>
                                    <Icon name="chevron-down-outline" size={16} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.fieldLabel, { color: isDark ? "#cbd5e1" : "#475569" }]}>Notes</Text>
                                <View style={[styles.inputWrap, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" }]}>
                                    <TextInput
                                        placeholder="Add notes..."
                                        placeholderTextColor="#94a3b8"
                                        style={[styles.textInput, { color: theme.text }]}
                                        value={notes}
                                        onChangeText={setNotes}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* History */}
                    {selectedPatient && treatmentHistory?.length > 0 && (
                        <View style={[styles.glassCard, { backgroundColor: isDark ? "rgba(15,23,42,0.4)" : "rgba(255,255,255,0.6)", borderColor: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9", marginTop: 20, marginBottom: 40, zIndex: 1000 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                                <Icon name="time-outline" size={18} color={theme.primary} />
                                <Text style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 8, color: theme.primary }]}>RECENT HISTORY</Text>
                            </View>
                            
                            {treatmentHistory?.map((h, i) => (
                                <View key={i} style={[styles.historyItem, { borderBottomWidth: i === (treatmentHistory?.length || 0) - 1 ? 0 : 1, borderBottomColor: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9" }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: theme.text, fontWeight: '700' }}>{new Date(h.treatment_date).toLocaleDateString()}</Text>
                                        <Text style={{ color: theme.subText, fontSize: 13 }}>{h.diagnosis}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ color: theme.primary, fontWeight: '800' }}>₹{h.items?.reduce((s, it) => s + (it.cost || 0), 0) || 0}</Text>
                                        <View style={{ flexDirection: 'row', marginTop: 8, gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                            {h.has_assessment_file && (
                                                <TouchableOpacity
                                                    onPress={() => handleViewAssessmentFile(h.id)}
                                                    disabled={viewingFileId === h.id}
                                                    style={[styles.miniBtn, { backgroundColor: "#22c55e18" }]}
                                                >
                                                    {viewingFileId === h.id ? (
                                                        <ActivityIndicator size="small" color="#22c55e" />
                                                    ) : (
                                                        <>
                                                            <Icon name="eye-outline" size={14} color="#22c55e" />
                                                            <Text style={{ color: "#22c55e", fontSize: 11, fontWeight: '700', marginLeft: 4 }}>Form</Text>
                                                        </>
                                                    )}
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity onPress={() => generateBillPDF(h, "a5")} style={[styles.miniBtn, { backgroundColor: theme.primary + "15" }]}>
                                                <Icon name="download-outline" size={14} color={theme.primary} />
                                                <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '700', marginLeft: 4 }}>A5</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => generateBillPDF(h, "a4")} style={[styles.miniBtn, { backgroundColor: "rgba(148, 163, 184, 0.1)" }]}>
                                                <Icon name="print-outline" size={14} color="#64748b" />
                                                <Text style={{ color: "#64748b", fontSize: 11, fontWeight: '700', marginLeft: 4 }}>A4</Text>
                                            </TouchableOpacity>
                                            {canDeleteTreatment && (
                                                <TouchableOpacity onPress={() => handleDeleteTreatment(h)} style={[styles.miniBtn, { backgroundColor: "#ef444418" }]}>
                                                    <Icon name="trash-outline" size={14} color="#ef4444" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* Treatment Picker Modal */}
            <Modal visible={showTreatmentModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={[styles.modalTitle, { color: theme.text }]}>Select Treatment</Text>
                                <TouchableOpacity 
                                    onPress={() => setShowAddMasterModal(true)}
                                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
                                >
                                    <Icon name="add-circle" size={14} color={theme.primary} />
                                    <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700', marginLeft: 4 }}>Create New</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={() => setShowTreatmentModal(false)}>
                                <Icon name="close-circle" size={28} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={treatmentMaster}
                            keyExtractor={item => String(item.id || Math.random())}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={[styles.listItem, { borderBottomColor: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9" }]} onPress={() => addTreatment(item)}>
                                    <View>
                                        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>{item.treatment_name}</Text>
                                        <Text style={{ color: theme.primary, marginTop: 2 }}>₹{item.cost}</Text>
                                    </View>
                                    <Icon name="add-circle" size={24} color={theme.primary} />
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>

            {/* Add New Master Treatment Modal */}
            <Modal visible={showAddMasterModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.glassCard, { backgroundColor: theme.card, width: width * 0.85, padding: 24, borderRadius: 25 }]}>
                        <Text style={[styles.sectionTitle, { color: theme.primary }]}>NEW TREATMENT MASTER</Text>
                        
                        <View style={styles.fieldGroup}>
                            <Text style={[styles.fieldLabel, { color: theme.text }]}>Treatment Name</Text>
                            <View style={[styles.inputWrap, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" }]}>
                                <TextInput
                                    placeholder="e.g. Laser Therapy"
                                    placeholderTextColor="#94a3b8"
                                    style={[styles.textInput, { color: theme.text }]}
                                    value={newMasterName}
                                    onChangeText={setNewMasterName}
                                    autoFocus
                                />
                            </View>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={[styles.fieldLabel, { color: theme.text }]}>Default Cost (₹)</Text>
                            <View style={[styles.inputWrap, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" }]}>
                                <TextInput
                                    placeholder="0.00"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="numeric"
                                    style={[styles.textInput, { color: theme.text }]}
                                    value={newMasterCost}
                                    onChangeText={setNewMasterCost}
                                />
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                            <TouchableOpacity 
                                onPress={() => setShowAddMasterModal(false)}
                                style={[styles.actionBtn, { flex: 1, backgroundColor: "rgba(148,163,184,0.1)" }]}
                            >
                                <Text style={{ color: "#64748b", fontWeight: '700' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={handleSaveNewMaster}
                                disabled={savingMaster}
                                style={[styles.actionBtn, { flex: 2, backgroundColor: theme.primary }]}
                            >
                                {savingMaster ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={{ color: "#fff", fontWeight: '700' }}>Save & Add</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Physiotherapist Picker */}
            <Modal
                visible={showDoctorPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowDoctorPicker(false)}
            >
                <Pressable style={styles.pickerOverlay} onPress={() => setShowDoctorPicker(false)}>
                    <Pressable
                        style={[styles.pickerSheet, { backgroundColor: isDark ? "#0f172a" : "#ffffff" }]}
                        onPress={() => {}}
                    >
                        <View style={styles.pickerHeader}>
                            <Text style={[styles.pickerTitle, { color: theme.text }]}>Physiotherapist</Text>
                            <TouchableOpacity onPress={() => setShowDoctorPicker(false)}>
                                <Icon name="close" size={22} color={theme.subText} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                            {doctorUsers.length === 0 ? (
                                <Text style={[styles.pickerEmptyText, { color: theme.subText }]}>
                                    No users with the "Doctor" designation yet. Add one from Settings → Manage Users.
                                </Text>
                            ) : (
                                doctorUsers.map((u) => {
                                    const selected = doctorName === u.username;
                                    return (
                                        <TouchableOpacity
                                            key={u.id}
                                            style={styles.pickerOptionRow}
                                            onPress={() => {
                                                setDoctorName(u.username);
                                                setShowDoctorPicker(false);
                                            }}
                                        >
                                            <Text style={{ color: theme.text, fontWeight: selected ? "800" : "600" }}>
                                                {u.username}
                                            </Text>
                                            {selected && (
                                                <Icon name="checkmark" size={18} color={isDark ? "#3b82f6" : "#2563eb"} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    blob: {
        position: "absolute",
        width: 350,
        height: 350,
        borderRadius: 200,
        opacity: 0.8,
    },
    topHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    circleBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(148, 163, 184, 0.15)",
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "900",
        letterSpacing: -0.5,
    },
    scrollContent: {
        padding: 20,
    },
    webContainer: {
        maxWidth: 800,
        alignSelf: "center",
        width: "100%",
    },
    glassCard: {
        padding: 24,
        borderRadius: 30,
        borderWidth: 1,
        ...Platform.select({
            ios: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
            android: { elevation: 8 },
            web: { boxShadow: "0px 15px 40px rgba(0,0,0,0.08)" },
        }),
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: "900",
        letterSpacing: 1.5,
        marginBottom: 15,
        textTransform: "uppercase",
    },
    patientSelected: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "900",
    },
    patientName: {
        fontSize: 18,
        fontWeight: "800",
    },
    patientInfo: {
        fontSize: 12,
        marginTop: 2,
    },
    changeBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: "rgba(239, 68, 68, 0.1)",
    },
    changeBtnText: {
        color: "#ef4444",
        fontSize: 12,
        fontWeight: "700",
    },
    inputWrap: {
        height: 52,
        borderRadius: 15,
        paddingHorizontal: 15,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.1)",
    },
    textInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        fontWeight: "600",
        ...Platform.select({
            web: { outlineStyle: "none" }
        }),
    },
    fieldGroup: {
        marginBottom: 20,
        position: 'relative',
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: "700",
        marginBottom: 8,
        marginLeft: 2,
    },
    suggestionList: {
        position: "absolute",
        top: 80,
        left: 0,
        right: 0,
        borderRadius: 15,
        borderWidth: 1.5, // Thicker border
        zIndex: 99999,
        padding: 5,
        maxHeight: 250,
        // Added shadow for better visibility over background elements
        ...Platform.select({
            web: { boxShadow: "0px 8px 24px rgba(0,0,0,0.15)" },
            ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
            android: { elevation: 15 }
        })
    },
    patientResults: {
        marginTop: 10,
        borderRadius: 15,
        backgroundColor: "rgba(148, 163, 184, 0.05)",
        overflow: "hidden",
    },
    /* Physiotherapist picker */
    pickerOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    pickerSheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 32,
    },
    pickerHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    pickerTitle: { fontSize: 17, fontWeight: "900" },
    pickerOptionRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(148,163,184,0.25)",
    },
    pickerEmptyText: {
        fontSize: 13,
        textAlign: "center",
        paddingVertical: 24,
        lineHeight: 18,
    },
    resultItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(148, 163, 184, 0.05)",
    },
    suggestionItem: {
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "rgba(148, 163, 184, 0.05)",
    },
    miniBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    uploadBox: {
        height: 80,
        borderRadius: 15,
        borderWidth: 2,
        borderStyle: "dashed",
        borderColor: "rgba(148, 163, 184, 0.2)",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 15,
    },
    uploadText: {
        fontSize: 14,
        fontWeight: "600",
    },
    hintText: {
        fontSize: 11,
        color: "#94a3b8",
        marginTop: 6,
        marginLeft: 2,
    },
    viewFileLink: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        marginTop: 10,
        gap: 5,
    },
    viewFileLinkText: {
        fontSize: 12,
        fontWeight: "700",
    },
    addTreatmentBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 10,
    },
    emptyBox: {
        height: 60,
        borderRadius: 15,
        borderWidth: 1,
        borderStyle: "dashed",
        alignItems: "center",
        justifyContent: "center",
    },
    treatmentTag: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        backgroundColor: "rgba(148, 163, 184, 0.05)",
        borderRadius: 15,
        marginBottom: 8,
    },
    priceInput: {
        fontSize: 16,
        fontWeight: "800",
        padding: 0,
        marginLeft: 4,
        borderBottomWidth: 1,
        minWidth: 60,
        ...Platform.select({
            web: { outlineStyle: "none" }
        }),
    },
    trashBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    actionBtn: {
        height: 50,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fieldRow: {
        flexDirection: "row",
        gap: 15,
    },
    historyItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 15,
        gap: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "flex-end",
    },
    modalContent: {
        borderTopLeftRadius: 35,
        borderTopRightRadius: 35,
        padding: 24,
        maxHeight: "90%",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: "900",
    },
    listItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 18,
        borderBottomWidth:1,
    }
});

export default PatientTreatmentDetails;
