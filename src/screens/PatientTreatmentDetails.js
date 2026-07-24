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
    SafeAreaView,
    StatusBar,
    Modal,
    Platform,
    ScrollView,
    Dimensions,
    KeyboardAvoidingView,
} from "react-native";
import { getPatients, getTreatmentCharges, registerTreatment, getTreatmentHistory, getDistinctDiagnoses, getDistinctPhysiotherapists } from "../services/api";
import { ThemeContext } from "../theme/ThemeContext";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons as Icon } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Asset } from 'expo-asset';
import logoBase64 from "../constants/logo_base64";

const { width } = Dimensions.get("window");

const PatientTreatmentDetails = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { theme, mode: themeMode } = useContext(ThemeContext);
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
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [diagnosis, setDiagnosis] = useState("");
    const [doctorName, setDoctorName] = useState("");
    const [notes, setNotes] = useState("");
    const [selectedTreatments, setSelectedTreatments] = useState([]);
    const [showTreatmentModal, setShowTreatmentModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [assessmentFile, setAssessmentFile] = useState(null);

    // New Master Treatment States
    const [showAddMasterModal, setShowAddMasterModal] = useState(false);
    const [newMasterName, setNewMasterName] = useState("");
    const [newMasterCost, setNewMasterCost] = useState("");
    const [savingMaster, setSavingMaster] = useState(false);

    // Physiotherapist Suggestions State
    const [showPhysioSuggestions, setShowPhysioSuggestions] = useState(false);
    const [physioMasters, setPhysioMasters] = useState([]);
    const physioSuggestions = useMemo(() => {
        if (!doctorName) return [];
        return physioMasters.filter(p => 
            p.toLowerCase().includes(doctorName.toLowerCase()) && 
            p.toLowerCase() !== doctorName.toLowerCase()
        );
    }, [doctorName, physioMasters]);

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
    }, [route.params?.newTreatment, route.params?.patient]);

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
    const loadHistory = async (patientId) => {
        try {
            const response = await getTreatmentHistory(patientId);
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
            console.error("HISTORY LOAD ERROR", error);
            setTreatmentHistory([]);
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

    const loadPhysiotherapists = async () => {
        try {
            const res = await getDistinctPhysiotherapists();
            if (res.ok) setPhysioMasters(res.data?.data || []);
        } catch (e) {
            console.error("Failed to load physiotherapists", e);
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
                setFilteredPatients(data);
            }

            if (chargesRes.ok) {
                setTreatmentMaster(chargesRes.data || []);
            }
            
            await Promise.all([
                loadGlobalDiagnoses(),
                loadPhysiotherapists()
            ]);
        } catch (error) {
            console.error("DATA LOAD ERROR", error);
            Alert.alert("Error", "Failed to load master data");
        } finally {
            setLoading(false);
        }
    };



    const generateBillPDF = async (treatmentSession, format = "a4") => {
        try {
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

            const logoData = logoBase64 || await loadLogoBase64();
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

            const filename = `Bill_${format.toUpperCase()}.pdf`;
            if (Platform.OS === "web") {
                pdf.save(filename);
            } else {
                const dataUri = pdf.output("datauristring");
                const base64 = dataUri.split(",")[1];
                const fileUri = FileSystem.documentDirectory + filename;
                await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
                await Sharing.shareAsync(fileUri, { mimeType: "application/pdf" });
            }
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

    useEffect(() => {
        console.log("Filtering patients for search:", patientSearch);
        if (patientSearch.trim() === "") {
            setFilteredPatients(patients);
        } else {
            const searchLower = patientSearch.toLowerCase();
            const filtered = patients.filter(p => {
                const nameMatch = p.name ? p.name.toLowerCase().includes(searchLower) : false;
                const idMatch = p.id ? p.id.toString().includes(searchLower) : false;
                const phoneMatch = p.phone_number ? p.phone_number.includes(searchLower) : false;
                return nameMatch || idMatch || phoneMatch;
            });
            console.log("Filtered matches count:", filtered.length);
            setFilteredPatients(filtered);
        }
    }, [patientSearch, patients]);


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

            const payload = {
                patient_id: patientId,
                diagnosis: diagnosis.trim(),
                treatment_plan: "Modern UI Visit", 
                doctor_name: doctorName.trim() || "Consultant",
                notes: notes.trim(),
                items: items
            };

            console.log("Submitting Treatment Payload:", JSON.stringify(payload, null, 2));

            const response = await registerTreatment(payload);
            
            if (response.ok) {
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
                loadPhysiotherapists(); // Refresh physiotherapists too
            } else {
                console.error("SAVE FAILED:", response.data);
                const errorMsg = response.data?.detail || response.data?.message || response.data?.error || "Failed to register treatment.";
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
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Patient Treatment</Text>
                    <TouchableOpacity onPress={handleSave} disabled={submitting} style={styles.circleBtn}>
                        {submitting ? <ActivityIndicator size="small" color={theme.primary} /> : <Icon name="checkmark" size={24} color={theme.primary} />}
                    </TouchableOpacity>
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
                                    <Text style={styles.avatarText}>{selectedPatient.name.charAt(0).toUpperCase()}</Text>
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
                                    placeholder="Search Patient Name..."
                                    placeholderTextColor="#94a3b8"
                                    style={[styles.textInput, { color: theme.text }]}
                                    value={patientSearch}
                                    onChangeText={setPatientSearch}
                                />
                            </View>
                        )}

                        {!selectedPatient && patientSearch.length > 0 && (
                            <View style={styles.patientResults}>
                                {patients.filter(p => (p.name || p.patient_name || "").toLowerCase().includes(patientSearch.toLowerCase())).slice(0, 5).map(p => (
                                    <TouchableOpacity key={p.id} onPress={() => { setSelectedPatient(p); setPatientSearch(""); }} style={styles.resultItem}>
                                        <Text style={{ color: theme.text, fontWeight: '600' }}>{p.name || p.patient_name}</Text>
                                        <Text style={{ color: theme.subText, fontSize: 12 }}>{p.phone_number}</Text>
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
                            <TouchableOpacity onPress={handleFileUpload} style={[styles.uploadBox, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc", borderStyle: assessmentFile ? 'solid' : 'dashed' }]}>
                                <Icon name={assessmentFile ? "document-text" : "cloud-upload-outline"} size={24} color={assessmentFile ? theme.primary : "#94a3b8"} />
                                <Text style={[styles.uploadText, { color: assessmentFile ? theme.text : "#94a3b8" }]}>
                                    {assessmentFile ? assessmentFile.name : "Upload Assessment Form"}
                                </Text>
                                {assessmentFile && (
                                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); setAssessmentFile(null); }}>
                                        <Icon name="close-circle" size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                            </TouchableOpacity>
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
                                <View style={[styles.inputWrap, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" }]}>
                                    <TextInput
                                        placeholder="Enter name..."
                                        placeholderTextColor="#94a3b8"
                                        style={[styles.textInput, { color: theme.text }]}
                                        value={doctorName}
                                        onChangeText={(text) => {
                                            setDoctorName(text);
                                            setShowPhysioSuggestions(true);
                                        }}
                                        onBlur={() => setTimeout(() => setShowPhysioSuggestions(false), 200)}
                                        onFocus={() => setShowPhysioSuggestions(true)}
                                    />
                                </View>
                                {showPhysioSuggestions && physioSuggestions.length > 0 && (
                                    <View style={[styles.suggestionList, { backgroundColor: theme.card, borderColor: theme.border, zIndex: 9999, elevation: 9999 }]}>
                                        {physioSuggestions.map((s, idx) => (
                                            <TouchableOpacity key={idx} onPress={() => { setDoctorName(s); setShowPhysioSuggestions(false); }} style={styles.suggestionItem}>
                                                <Icon name="person-outline" size={14} color="#94a3b8" />
                                                <Text style={{ color: theme.text, marginLeft: 8 }}>{s}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
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
                                        <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                                            <TouchableOpacity onPress={() => generateBillPDF(h, "a5")} style={[styles.miniBtn, { backgroundColor: theme.primary + "15" }]}>
                                                <Icon name="download-outline" size={14} color={theme.primary} />
                                                <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '700', marginLeft: 4 }}>A5</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => generateBillPDF(h, "a4")} style={[styles.miniBtn, { backgroundColor: "rgba(148, 163, 184, 0.1)" }]}>
                                                <Icon name="print-outline" size={14} color="#64748b" />
                                                <Text style={{ color: "#64748b", fontSize: 11, fontWeight: '700', marginLeft: 4 }}>A4</Text>
                                            </TouchableOpacity>
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
