import React, { useState, useContext } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StatusBar,
    Platform,
    ScrollView,
    KeyboardAvoidingView,
} from "react-native";
import { getPatients, getTreatmentHistory } from "../services/api";
import { ThemeContext } from "../theme/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { Ionicons as Icon } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { Asset } from "expo-asset";
import logoBase64 from "../constants/logo_base64";

const pad = (n) => String(n).padStart(2, "0");
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

const BillingScreen = () => {
    const navigation = useNavigation();
    const { theme, mode } = useContext(ThemeContext);
    const isDark = mode === "dark";

    const [patients, setPatients] = useState([]);
    const [patientSearch, setPatientSearch] = useState("");
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [searching, setSearching] = useState(false);

    const [visits, setVisits] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [loadingVisits, setLoadingVisits] = useState(false);

    const [billDate, setBillDate] = useState(toDateStr(new Date()));
    const [generating, setGenerating] = useState(false);

    const searchPatients = async (text) => {
        setPatientSearch(text);
        if (!text.trim()) {
            setPatients([]);
            return;
        }
        try {
            setSearching(true);
            const res = await getPatients();
            if (res.ok) {
                let data = [];
                if (Array.isArray(res.data)) data = res.data;
                else if (res.data?.results) data = res.data.results;
                else if (res.data?.patients) data = res.data.patients;
                else if (res.data?.data) data = res.data.data;

                const q = text.toLowerCase();
                setPatients(
                    data.filter((p) =>
                        (p.name || "").toLowerCase().includes(q) ||
                        (p.phone_number || "").includes(q) ||
                        (p.id || "").toLowerCase().includes(q)
                    ).slice(0, 20)
                );
            }
        } catch (e) {
            console.error("PATIENT SEARCH ERROR", e);
        } finally {
            setSearching(false);
        }
    };

    const loadVisits = async (patient) => {
        try {
            setLoadingVisits(true);
            const res = await getTreatmentHistory(patient.id);
            if (res.ok) {
                let data = [];
                if (Array.isArray(res.data)) data = res.data;
                else if (res.data?.results) data = res.data.results;
                else if (res.data?.data) data = res.data.data;

                setVisits(data);
                setSelectedIds(new Set(data.map((v) => v.id)));
            } else {
                setVisits([]);
                setSelectedIds(new Set());
            }
        } catch (e) {
            console.error("LOAD VISITS ERROR", e);
            setVisits([]);
        } finally {
            setLoadingVisits(false);
        }
    };

    const selectPatient = (patient) => {
        setSelectedPatient(patient);
        setPatientSearch("");
        setPatients([]);
        loadVisits(patient);
    };

    const changePatient = () => {
        setSelectedPatient(null);
        setVisits([]);
        setSelectedIds(new Set());
    };

    const toggleVisit = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const visitAmount = (v) => (v.items || []).reduce((s, it) => s + Number(it.cost || 0), 0);
    const visitTreatmentNames = (v) => (v.items || []).map((it) => it.treatment_name).filter(Boolean).join(", ") || "-";

    const selectedVisits = visits.filter((v) => selectedIds.has(v.id));
    const totalAmount = selectedVisits.reduce((s, v) => s + visitAmount(v), 0);

    const buildBillHtml = (logoData, billNo, billDateStr) => {
        const patientName = selectedPatient?.name || "N/A";
        const age = selectedPatient?.age ? `${selectedPatient.age} Years` : "N/A";
        const addressLines = [selectedPatient?.address, selectedPatient?.city, selectedPatient?.pincode]
            .filter((l) => l && String(l).trim())
            .map((l) => escapeHtml(l))
            .join(", ");

        const rows = [...selectedVisits]
            .sort((a, b) => new Date(a.treatment_date) - new Date(b.treatment_date))
            .map((v, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${new Date(v.treatment_date).toLocaleDateString()}</td>
                    <td>${escapeHtml(v.diagnosis || "-")}</td>
                    <td>${escapeHtml(visitTreatmentNames(v))}</td>
                    <td class="amount">${visitAmount(v).toFixed(2)}</td>
                </tr>
            `).join("");

        return `
        <html>
        <head>
            <meta charset="utf-8" />
            <style>
                @page { size: A4; margin: 14mm; }
                body { font-family: Helvetica, Arial, sans-serif; color: #111; font-size: 12px; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-bottom: 12px; }
                .logo { width: 80px; height: 80px; object-fit: contain; }
                .address { text-align: right; font-size: 10px; line-height: 1.4; }
                .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
                table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                th, td { padding: 6px 4px; text-align: left; font-size: 11px; }
                th.amount, td.amount { text-align: right; }
                thead th { border-bottom: 1px solid #333; font-weight: bold; }
                tfoot td { border-top: 1px solid #333; font-weight: bold; padding-top: 8px; }
                .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; }
                .quote { font-style: italic; color: #666; font-size: 10px; max-width: 60%; }
                .signature { text-align: center; font-size: 11px; }
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

            <div class="row">
                <span>OP ID : ${escapeHtml(selectedPatient?.id || "")}</span>
                <span>Bill No : ${escapeHtml(billNo)}</span>
                <span>Bill Date : ${escapeHtml(billDateStr)}</span>
            </div>
            <div class="row">
                <span>Name : ${escapeHtml(patientName)}</span>
                <span>Age : ${escapeHtml(age)}</span>
            </div>
            <div class="row">
                <span>Address : ${addressLines || "N/A"}</span>
                <span>Contact No : ${escapeHtml(selectedPatient?.phone_number || "N/A")}</span>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Sl.No</th>
                        <th>Date</th>
                        <th>Diagnosis</th>
                        <th>Treatment</th>
                        <th class="amount">Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="4">Total Amount</td>
                        <td class="amount">${totalAmount.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>

            <div class="footer">
                <div class="quote">"Health is the greatest gift, contentment the greatest wealth, faithfulness the best relationship." — Buddha</div>
                <div class="signature">
                    <div style="margin-bottom: 24px;">Physiotherapist</div>
                    <div>Aarush Physiotherapy Clinic</div>
                </div>
            </div>
        </body>
        </html>
        `;
    };

    const handleGenerateBill = async (format = "a4") => {
        if (!selectedPatient) {
            Alert.alert("Validation", "Please select a patient.");
            return;
        }
        if (selectedVisits.length === 0) {
            Alert.alert("Validation", "Select at least one visit to include in the bill.");
            return;
        }

        try {
            setGenerating(true);
            const logoData = logoBase64 || await loadLogoBase64();
            const billDateObj = new Date(billDate);
            const billDateValid = !isNaN(billDateObj.getTime());
            const billDateForNo = billDateValid ? billDateObj : new Date();
            const billNo = `${selectedPatient.id}${pad(billDateForNo.getDate())}${pad(billDateForNo.getMonth() + 1)}_TO`;
            const billDateStr = billDateValid ? billDateObj.toLocaleDateString() : billDate;
            const filename = `Bill_${selectedPatient.id}_${format.toUpperCase()}.pdf`;

            if (Platform.OS === "web") {
                const { jsPDF } = require("jspdf");
                const isA5 = format.toLowerCase() === "a5";
                const pdf = new jsPDF({ unit: "mm", format: isA5 ? "a5" : "a4", orientation: "portrait" });
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const scale = isA5 ? 0.75 : 1.0;
                const M = 14 * scale;
                let y = M;

                if (logoData) {
                    try {
                        pdf.addImage(logoData, "PNG", M, y - (4 * scale), 40 * scale, 40 * scale);
                    } catch (e1) {
                        console.error("Failed to add logo image to PDF", e1);
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

                pdf.setFontSize(9 * scale);
                pdf.setFont("helvetica", "normal");
                pdf.text(`OP ID : ${selectedPatient.id}`, M, y);
                pdf.text(`Bill No : ${billNo}`, pageWidth / 2 - 20 * scale, y);
                pdf.text(`Bill Date : ${billDateStr}`, pageWidth - M - (isA5 ? 40 : 55), y);
                y += (6 * scale);
                pdf.text(`Name : ${selectedPatient.name || "N/A"}`, M, y);
                pdf.text(`Age : ${selectedPatient.age ? selectedPatient.age + " Years" : "N/A"}`, pageWidth - M - (isA5 ? 40 : 55), y);
                y += (6 * scale);
                const addressLine = [selectedPatient.address, selectedPatient.city, selectedPatient.pincode]
                    .filter((l) => l && String(l).trim()).join(", ") || "N/A";
                pdf.text(`Address : ${addressLine}`, M, y, { maxWidth: pageWidth - M * 2 - (isA5 ? 45 : 60) });
                pdf.text(`Contact : ${selectedPatient.phone_number || "N/A"}`, pageWidth - M - (isA5 ? 45 : 60), y);
                y += (10 * scale);

                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(10 * scale);
                const colSl = M;
                const colDate = M + 12 * scale;
                const colDiag = M + 35 * scale;
                const colTreat = M + (isA5 ? 70 : 95) * scale;
                pdf.text("Sl", colSl, y);
                pdf.text("Date", colDate, y);
                pdf.text("Diagnosis", colDiag, y);
                pdf.text("Treatment", colTreat, y);
                pdf.text("Amount", pageWidth - M, y, { align: "right" });
                y += (5 * scale);
                pdf.setLineWidth(0.4 * scale);
                pdf.line(M, y, pageWidth - M, y);
                y += (6 * scale);

                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(9 * scale);
                const sorted = [...selectedVisits].sort((a, b) => new Date(a.treatment_date) - new Date(b.treatment_date));
                sorted.forEach((v, idx) => {
                    if (y > pageHeight - (30 * scale)) {
                        pdf.addPage();
                        y = M;
                    }
                    pdf.text(String(idx + 1), colSl, y);
                    pdf.text(new Date(v.treatment_date).toLocaleDateString(), colDate, y);
                    pdf.text(v.diagnosis || "-", colDiag, y, { maxWidth: (isA5 ? 32 : 55) * scale });
                    pdf.text(visitTreatmentNames(v), colTreat, y, { maxWidth: (isA5 ? 45 : 60) * scale });
                    pdf.text(visitAmount(v).toFixed(2), pageWidth - M, y, { align: "right" });
                    y += (7 * scale);
                });

                y += (4 * scale);
                pdf.setLineWidth(0.5 * scale);
                pdf.line(M, y, pageWidth - M, y);
                y += (7 * scale);
                pdf.setFont("helvetica", "bold");
                pdf.text("Total Amount", colTreat, y);
                pdf.text(totalAmount.toFixed(2), pageWidth - M, y, { align: "right" });

                pdf.setFont("helvetica", "italic");
                pdf.setFontSize(8 * scale);
                pdf.setTextColor(120);
                pdf.text(
                    '"Health is the greatest gift, contentment the greatest wealth,',
                    M, pageHeight - M - (14 * scale)
                );
                pdf.text('faithfulness the best relationship." - Buddha', M, pageHeight - M - (9 * scale));
                pdf.setTextColor(0);
                pdf.setFont("helvetica", "normal");
                pdf.text("Physiotherapist", pageWidth - M - (30 * scale), pageHeight - M - (14 * scale));
                pdf.text("Aarush Physiotherapy Clinic", pageWidth - M - (45 * scale), pageHeight - M - (5 * scale));

                pdf.save(filename);
                return;
            }

            const html = buildBillHtml(logoData, billNo, billDateStr);
            const { uri } = await Print.printToFileAsync({ html, base64: false });
            await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: filename, UTI: "com.adobe.pdf" });
        } catch (error) {
            console.error("BILL GENERATION ERROR:", error);
            Alert.alert("Error", "Failed to generate bill");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <LinearGradient
                colors={isDark ? ["#020617", "#0b1220", "#111827"] : ["#f8fafc", "#eef2ff", "#f1f5f9"]}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.topHeader}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circleBtn}>
                        <Icon name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Billing / Payments</Text>
                    <View style={styles.circleBtn} />
                </View>

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
                >
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ padding: 20, paddingBottom: 150 }}
                    >
                        {/* Patient Card */}
                        <View style={[styles.glassCard, { backgroundColor: isDark ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.85)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0" }]}>
                            <Text style={[styles.sectionTitle, { color: isDark ? "#94a3b8" : "#64748b" }]}>PATIENT</Text>

                            {selectedPatient ? (
                                <View style={styles.patientRow}>
                                    <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                                        <Text style={styles.avatarText}>{(selectedPatient.name || "?").charAt(0).toUpperCase()}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.patientName, { color: theme.text }]}>{selectedPatient.name}</Text>
                                        <Text style={[styles.patientInfo, { color: theme.subText }]}>
                                            {selectedPatient.id} • {selectedPatient.phone_number}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={changePatient} style={styles.changeBtn}>
                                        <Text style={styles.changeBtnText}>Change</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <View style={[styles.inputWrap, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" }]}>
                                        <Icon name="search-outline" size={20} color="#94a3b8" />
                                        <TextInput
                                            placeholder="Search patient by name / phone / ID"
                                            placeholderTextColor="#94a3b8"
                                            style={[styles.textInput, { color: theme.text }]}
                                            value={patientSearch}
                                            onChangeText={searchPatients}
                                        />
                                        {searching && <ActivityIndicator size="small" color={theme.primary} />}
                                    </View>
                                    {patients.length > 0 && (
                                        <View style={styles.searchResults}>
                                            {patients.map((p) => (
                                                <TouchableOpacity key={p.id} onPress={() => selectPatient(p)} style={styles.resultItem}>
                                                    <Text style={{ color: theme.text, fontWeight: "600" }}>{p.name}</Text>
                                                    <Text style={{ color: theme.subText, fontSize: 12 }}>{p.id} • {p.phone_number}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </>
                            )}
                        </View>

                        {selectedPatient && (
                            <>
                                {/* Bill Date */}
                                <View style={[styles.glassCard, { backgroundColor: isDark ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.85)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0", marginTop: 16 }]}>
                                    <Text style={[styles.sectionTitle, { color: isDark ? "#94a3b8" : "#64748b" }]}>BILL DATE</Text>
                                    <View style={[styles.inputWrap, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" }]}>
                                        <Icon name="calendar-outline" size={20} color="#94a3b8" />
                                        <TextInput
                                            placeholder="YYYY-MM-DD"
                                            placeholderTextColor="#94a3b8"
                                            style={[styles.textInput, { color: theme.text }]}
                                            value={billDate}
                                            onChangeText={setBillDate}
                                        />
                                    </View>
                                </View>

                                {/* Visits */}
                                <View style={[styles.glassCard, { backgroundColor: isDark ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.85)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0", marginTop: 16 }]}>
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                        <Text style={[styles.sectionTitle, { color: isDark ? "#94a3b8" : "#64748b", marginBottom: 0 }]}>VISITS TO BILL</Text>
                                        {loadingVisits && <ActivityIndicator size="small" color={theme.primary} />}
                                    </View>

                                    {!loadingVisits && visits.length === 0 && (
                                        <Text style={{ color: theme.subText, textAlign: "center", paddingVertical: 20 }}>
                                            No treatment history found for this patient.
                                        </Text>
                                    )}

                                    {visits.map((v) => {
                                        const checked = selectedIds.has(v.id);
                                        return (
                                            <TouchableOpacity
                                                key={v.id}
                                                onPress={() => toggleVisit(v.id)}
                                                style={[styles.visitRow, { borderColor: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9" }]}
                                            >
                                                <Icon
                                                    name={checked ? "checkbox" : "square-outline"}
                                                    size={22}
                                                    color={checked ? theme.primary : "#94a3b8"}
                                                    style={{ marginRight: 12 }}
                                                />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: theme.text, fontWeight: "700" }}>
                                                        {new Date(v.treatment_date).toLocaleDateString()} — {v.diagnosis || "-"}
                                                    </Text>
                                                    <Text style={{ color: theme.subText, fontSize: 12, marginTop: 2 }}>
                                                        {visitTreatmentNames(v)}
                                                    </Text>
                                                </View>
                                                <Text style={{ color: theme.primary, fontWeight: "800" }}>₹{visitAmount(v)}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* Total + Generate */}
                                {visits.length > 0 && (
                                    <View style={[styles.glassCard, { backgroundColor: isDark ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.85)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0", marginTop: 16 }]}>
                                        <View style={styles.totalRow}>
                                            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 16 }}>Total Amount</Text>
                                            <Text style={{ color: theme.primary, fontWeight: "900", fontSize: 20 }}>₹{totalAmount.toFixed(2)}</Text>
                                        </View>

                                        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                                            <TouchableOpacity
                                                disabled={generating}
                                                onPress={() => handleGenerateBill("a5")}
                                                style={[styles.genBtn, { backgroundColor: theme.primary + "15", flex: 1 }]}
                                            >
                                                {generating ? <ActivityIndicator color={theme.primary} /> : (
                                                    <>
                                                        <Icon name="download-outline" size={18} color={theme.primary} />
                                                        <Text style={{ color: theme.primary, fontWeight: "700", marginLeft: 6 }}>Bill (A5)</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                disabled={generating}
                                                onPress={() => handleGenerateBill("a4")}
                                                style={[styles.genBtn, { backgroundColor: theme.primary, flex: 1 }]}
                                            >
                                                {generating ? <ActivityIndicator color="#fff" /> : (
                                                    <>
                                                        <Icon name="print-outline" size={18} color="#fff" />
                                                        <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>Bill (A4)</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
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
    headerTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
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
    inputWrap: {
        height: 52,
        borderRadius: 15,
        paddingHorizontal: 15,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.1)",
    },
    textInput: { flex: 1, fontSize: 15, fontWeight: "600", ...Platform.select({ web: { outlineStyle: "none" } }) },
    searchResults: { marginTop: 10, borderRadius: 15, backgroundColor: "rgba(148, 163, 184, 0.05)", overflow: "hidden" },
    resultItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: "rgba(148, 163, 184, 0.08)" },
    patientRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
    avatarText: { color: "#fff", fontSize: 22, fontWeight: "900" },
    patientName: { fontSize: 18, fontWeight: "800" },
    patientInfo: { fontSize: 12, marginTop: 2 },
    changeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: "rgba(239, 68, 68, 0.1)" },
    changeBtnText: { color: "#ef4444", fontSize: 12, fontWeight: "700" },
    visitRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    genBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 50,
        borderRadius: 15,
    },
});

export default BillingScreen;
