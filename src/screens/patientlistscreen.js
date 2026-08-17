// PatientListScreen – Trendy ERP Table + Sticky Header + Client Pagination (100% Working)

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
  ScrollView,
  StatusBar,
  Modal,
  Switch,
  Platform,
  PanResponder,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { getPatients, deletePatient } from "../services/api";
import { ThemeContext } from "../theme/ThemeContext";
import { AuthContext } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { useNavigation, useRoute } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

const HIDDEN_COLUMNS = ["id", "photo", "created_at", "updated_at"];

// ✅ WEB ONLY FLAG
const isWeb = Platform.OS === "web";

/* ---------- HELPERS ---------- */

const formatHeader = (key) =>
  key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const safeString = (val) => {
  if (val === null || val === undefined) return "";
  return String(val);
};

const getColumnWidth = (key, data) => {
  let maxLength = Math.max(10, key.length); // Bump minimum assumed length

  data.forEach((item) => {
    const value = safeString(item[key]);
    if (value.length > maxLength) maxLength = value.length;
  });

  const width = maxLength * 8 + 40; // More relaxed spacing
  return Math.min(Math.max(width, 140), 350); // Increased bounds
};

const getReferralColor = (text = "", mode = "light") => {
  const t = safeString(text).toLowerCase();
  const isDark = mode === "dark";

  if (t.includes("friend"))
    return isDark ? "rgba(34,197,94,0.18)" : "rgba(34,197,94,0.12)";
  if (t.includes("ad"))
    return isDark ? "rgba(59,130,246,0.20)" : "rgba(59,130,246,0.12)";
  if (t.includes("doctor") || t.includes("dr"))
    return isDark ? "rgba(168,85,247,0.20)" : "rgba(168,85,247,0.12)";

  return isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
};

/* ---------- RESIZABLE HEADER CELL ---------- */
const ResizableHeaderCell = ({ col, theme, isWeb, onResize, filters, setFilters, activeCol, setActiveCol, dataValues }) => {
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gestureState) => {
        onResize(col.key, gestureState.dx);
      },
      onPanResponderRelease: (e, gestureState) => {
        onResize(col.key, gestureState.dx, true); // true = commit
      },
    })
  ).current;

  const [localSearch, setLocalSearch] = useState("");
  const isActive = activeCol === col.key;
  const currentFilters = filters[col.key] || [];
  const hasFilter = currentFilters.length > 0;

  useEffect(() => {
    if (!isActive) setLocalSearch("");
  }, [isActive]);

  const displayedValues = useMemo(() => {
    if (!localSearch.trim()) return dataValues;
    return dataValues.filter(v => v.toLowerCase().includes(localSearch.toLowerCase()));
  }, [dataValues, localSearch]);

  const toggleValue = (val) => {
    let newFilters = [...currentFilters];
    if (newFilters.includes(val)) {
      newFilters = newFilters.filter(v => v !== val);
    } else {
      newFilters.push(val);
    }
    setFilters(prev => ({ ...prev, [col.key]: newFilters }));
  };

  return (
    <View style={{ width: col.width, position: 'relative', zIndex: isActive ? 1000 : 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 4,
        }}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.headerCell,
            isWeb && styles.headerCellWeb,
            { color: theme.subText, flex: 1 },
          ]}
        >
          {col.label}
        </Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={() => setActiveCol(isActive ? null : col.key)}
            style={{ padding: 4 }}
          >
            <Icon 
              name={hasFilter ? "filter" : "filter-outline"} 
              size={14} 
              color={hasFilter ? theme.primary : theme.subText} 
            />
          </TouchableOpacity>

          <View
            {...panResponder.panHandlers}
            style={{
              width: 15,
              height: 24,
              justifyContent: "center",
              alignItems: "center",
              cursor: "col-resize",
            }}
          >
            <View style={{ width: 1.5, height: 14, backgroundColor: theme.subText + "30" }} />
          </View>
        </View>
      </View>

      {/* 🟢 TRANSPARENT BACKDROP TO CLOSE ON CLICK OUTSIDE */}
      {isActive && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setActiveCol(null)}
          style={{
            position: isWeb ? 'fixed' : 'absolute',
            top: isWeb ? 0 : -1000,
            left: isWeb ? 0 : -1000,
            right: isWeb ? 0 : -1000,
            bottom: isWeb ? 0 : -1000,
            backgroundColor: 'transparent',
            zIndex: 998,
          }}
        />
      )}

      {/* MULTI-SELECT FILTER POPUP */}
      {isActive && (
        <View style={[styles.filterPop, { backgroundColor: theme.card, borderColor: theme.border, zIndex: 1000 }]}>
          {/* 🟢 EXTERNAL CLOSE BUTTON */}
          <TouchableOpacity 
            onPress={() => setActiveCol(null)}
            style={[styles.filterCloseBtn, { backgroundColor: theme.primary }]}
          >
            <Icon name="close" size={16} color="#fff" />
          </TouchableOpacity>

          <View style={[styles.filterSearchBox, { borderBottomColor: theme.border }]}>
            <Icon name="search-outline" size={14} color={theme.subText} />
            <TextInput
              placeholder="Find..."
              placeholderTextColor={theme.subText}
              value={localSearch}
              onChangeText={setLocalSearch}
              style={[styles.filterInput, { color: theme.text }]}
              autoFocus
            />
            {currentFilters.length > 0 && (
              <TouchableOpacity onPress={() => setFilters(prev => ({ ...prev, [col.key]: [] }))}>
                <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '700' }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView 
            style={{ maxHeight: 180 }} 
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
          >
            {displayedValues.length === 0 ? (
              <Text style={{ textAlign: 'center', padding: 10, color: theme.subText, fontSize: 11 }}>No data</Text>
            ) : (
              displayedValues.map((v, i) => {
                const isSelected = currentFilters.includes(v);
                return (
                  <TouchableOpacity 
                    key={i} 
                    onPress={() => toggleValue(v)}
                    style={[styles.filterValueItem, isSelected && { backgroundColor: theme.primary + "10" }]}
                  >
                    <Icon 
                      name={isSelected ? "checkbox" : "square-outline"} 
                      size={16} 
                      color={isSelected ? theme.primary : theme.subText} 
                    />
                    <Text numberOfLines={1} style={{ marginLeft: 10, color: theme.text, fontSize: 13, flex: 1 }}>{v}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity 
            onPress={() => setActiveCol(null)}
            style={[styles.filterDoneBtn, { backgroundColor: theme.primary }]}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Apply</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

/* ---------- COMPONENT ---------- */

const PatientListScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme, mode } = useContext(ThemeContext);
  const { permissions } = useContext(AuthContext);
  const canAddPatient = hasPermission(permissions, "patients", "add");
  const canEditPatient = hasPermission(permissions, "patients", "edit");
  const canDeletePatient = hasPermission(permissions, "patients", "delete");

  // 🔥 FULL DATA ALWAYS (from API)
  const [allPatients, setAllPatients] = useState([]);

  const [columns, setColumns] = useState([]);
  const [visibleCols, setVisibleCols] = useState([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // ✅ Client-side pagination
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [showCols, setShowCols] = useState(false);
  const [showPageSize, setShowPageSize] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [sortFieldSearch, setSortFieldSearch] = useState("");

  // ✅ Custom sort selection — ordered list of { key, dir } rules, applied in priority order.
  // Defaults to patient ID descending (newest-registered first).
  const [sortRules, setSortRules] = useState([{ key: "id", dir: "desc" }]);

  // ✅ Column Filters State
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterCol, setActiveFilterCol] = useState(null);

  /* ---------- LOAD DATA ---------- */
  const loadPatients = async () => {
    try {
      setLoading(true);

      // 🔥 We request limit, but backend returns all anyway
      const response = await getPatients({ page: 1, limit: 9999 });

      console.log("loadPatients -> response:", response);

      let data = [];

      if (response?.ok) {
        if (response?.data?.data) data = response.data.data;
        else if (Array.isArray(response?.data)) data = response.data;
      } else {
        const msg = response?.data?.detail || response?.data?.message || JSON.stringify(response?.data) || `Status ${response?.status}`;
        console.warn("Failed to load patient list:", msg);
        Alert.alert("Error loading patients", msg.toString());
      }

      setAllPatients(data);

      // Build columns once
      if (data.length > 0 && columns.length === 0) {
        const keys = Object.keys(data[0]).filter(
          (key) => !HIDDEN_COLUMNS.includes(key)
        );

        const cols = keys.map((key) => ({
          key,
          label: formatHeader(key),
          width: getColumnWidth(key, data),
        }));

        setColumns(cols);
        setVisibleCols(keys);
      }
    } catch (error) {
      Alert.alert("Network Error", "Unable to fetch patient list");
    } finally {
      setLoading(false);
    }
  };

  const goToTreatment = (item) => {
    navigation.navigate("Patient Treatment", {
      patient: {
        id: item?.id || item?.patient_id,
        name: item?.name || item?.patient_name,
        phone_number: item?.phone_number || item?.mobile,
      },
    });
  };

  const handleDeletePatient = (item) => {
    const patientId = item?.id || item?.patient_id;
    const doDelete = async () => {
      const res = await deletePatient(patientId);
      if (res.ok) {
        loadPatients();
      } else {
        Alert.alert("Error", res.data?.detail || res.data?.message || "Failed to delete patient.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Delete patient ${item?.name || patientId}? This also removes their appointments and treatment history.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        "Delete Patient",
        `Delete ${item?.name || patientId}? This also removes their appointments and treatment history.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  // reload on focus
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      const newPatient = route.params?.newPatient;

      if (newPatient) {
        navigation.setParams({ newPatient: undefined });
      }

      loadPatients();
    });

    return unsubscribe;
  }, [navigation, route.params?.newPatient]);

  /* ---------- SEARCH ---------- */
  const filteredPatients = useMemo(() => {
    let data = allPatients;

    // 1. Global Search - prioritize Name and ID
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((item) => {
        const name = safeString(item?.name || item?.patient_name).toLowerCase();
        const id = safeString(item?.id || item?.patient_id).toLowerCase();
        
        // Match name or ID
        if (name.includes(q) || id.includes(q)) return true;

        // Fallback: search all fields
        const combined = Object.values(item)
          .map((v) => safeString(v))
          .join(" ")
          .toLowerCase();
        return combined.includes(q);
      });
    }

    // 2. Column-Specific Multi-Select Filters
    Object.keys(columnFilters).forEach((colKey) => {
      const selectedValues = columnFilters[colKey];
      if (Array.isArray(selectedValues) && selectedValues.length > 0) {
        data = data.filter((item) => {
          const cellVal = safeString(item[colKey]);
          return selectedValues.includes(cellVal);
        });
      }
    });

    return data;
  }, [allPatients, search, columnFilters]);

  const distinctValuesMap = useMemo(() => {
    const map = {};
    columns.forEach(col => {
      const values = allPatients.map(p => safeString(p[col.key]));
      map[col.key] = Array.from(new Set(values.filter(v => v))).sort();
    });
    return map;
  }, [allPatients, columns]);

  /* ---------- CUSTOM SORT (multi-field, priority ordered) ---------- */
  const compareByRule = (a, b, rule) => {
    const av = a?.[rule.key];
    const bv = b?.[rule.key];
    const aStr = safeString(av).trim();
    const bStr = safeString(bv).trim();

    const aNum = parseFloat(aStr);
    const bNum = parseFloat(bStr);
    const bothNumeric = aStr !== "" && bStr !== "" && !isNaN(aNum) && !isNaN(bNum);

    let cmp;
    if (bothNumeric) {
      cmp = aNum - bNum;
    } else {
      cmp = aStr.toLowerCase().localeCompare(bStr.toLowerCase());
    }
    return rule.dir === "asc" ? cmp : -cmp;
  };

  const sortedPatients = useMemo(() => {
    if (sortRules.length === 0) return filteredPatients;

    const arr = [...filteredPatients];
    arr.sort((a, b) => {
      for (const rule of sortRules) {
        const cmp = compareByRule(a, b, rule);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
    return arr;
  }, [filteredPatients, sortRules]);

  // "id" is intentionally excluded from `columns` (HIDDEN_COLUMNS) since it's rendered
  // as a special badge rather than a toggleable table column — but it should still be sortable.
  const sortableColumns = useMemo(
    () => [{ key: "id", label: "ID" }, ...columns],
    [columns]
  );

  const filteredSortableColumns = useMemo(() => {
    if (!sortFieldSearch.trim()) return sortableColumns;
    const q = sortFieldSearch.toLowerCase();
    return sortableColumns.filter((c) => c.label.toLowerCase().includes(q));
  }, [sortableColumns, sortFieldSearch]);

  // Fields the user has actively chosen to sort by (in priority order) surface first in the list
  const orderedSortableColumns = useMemo(() => {
    const ruleKeys = sortRules.map((r) => r.key);
    const active = ruleKeys
      .map((k) => filteredSortableColumns.find((c) => c.key === k))
      .filter(Boolean);
    const inactive = filteredSortableColumns.filter((c) => !ruleKeys.includes(c.key));
    return [...active, ...inactive];
  }, [filteredSortableColumns, sortRules]);

  // Tapping a field: add it (lowest priority, ascending) if not already selected,
  // otherwise flip its direction.
  const handleSortSelect = (key) => {
    setSortRules((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx === -1) return [...prev, { key, dir: "asc" }];
      return prev.map((r, i) => (i === idx ? { ...r, dir: r.dir === "asc" ? "desc" : "asc" } : r));
    });
  };

  const removeSortRule = (key) => {
    setSortRules((prev) => prev.filter((r) => r.key !== key));
  };

  const moveSortRule = (key, direction) => {
    setSortRules((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  };

  const clearSort = () => {
    setSortRules([]);
  };

  /* ---------- PAGINATION (CLIENT SIDE) ---------- */
  const total = sortedPatients.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // If page becomes invalid after search/pageSize/sort change
  useEffect(() => {
    setPage(1);
  }, [pageSize, search, sortRules]);

  const paginatedPatients = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return sortedPatients.slice(start, end);
  }, [sortedPatients, page, pageSize]);

  // page buttons
  const pageButtons = useMemo(() => {
    const maxButtons = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);

    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }

    const arr = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [page, totalPages]);

  /* ---------- EXPORT ---------- */
  const exportToCSV = async () => {
    if (sortedPatients.length === 0) {
      Alert.alert("No Data", "No patients to export");
      return;
    }

    try {
      const activeCols = columns.filter((c) => visibleCols.includes(c.key));

      const headers = activeCols.map((c) => c.label).join(",");
      const rows = sortedPatients.map((item) =>
        activeCols
          .map((c) => `"${safeString(item[c.key]).replace(/"/g, '""')}"`)
          .join(",")
      );

      const csv = [headers, ...rows].join("\n");

      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "patients.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
        return;
      }

      const fileUri = FileSystem.documentDirectory + "patients.csv";

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Export Patients",
      });
    } catch (err) {
      Alert.alert("Error", "Failed to export file");
    }
  };

  /* ---------- COLUMN TOGGLE & RESIZE ---------- */
  const toggleColumn = (key) => {
    setVisibleCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleResize = (colKey, delta, commit = false) => {
    setColumns((prev) =>
      prev.map((c) => {
        if (c.key === colKey) {
          const newWidth = Math.max(60, (c.baseWidth || c.width) + delta);
          return commit
            ? { ...c, width: newWidth, baseWidth: newWidth }
            : { ...c, width: newWidth };
        }
        return c;
      })
    );
  };

  const activeColumns = columns.filter((c) => visibleCols.includes(c.key));

  const renderPatientRow = (item, index) => {
    if (!isWeb) {
      const isEven = index % 2 === 0;
      return (
        <TouchableOpacity
          key={`row-${item?.id ?? index}`}
          activeOpacity={0.9}
          disabled={!canEditPatient}
          onPress={
            canEditPatient
              ? () =>
                  navigation.navigate("Registration", {
                    patient: item,
                    mode: "edit",
                  })
              : undefined
          }
          style={[
            styles.mobileRow,
            {
              backgroundColor:
                mode === "light"
                  ? isEven
                    ? "rgba(99,102,241,0.04)"
                    : "rgba(255,255,255,0.92)"
                  : isEven
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(15,23,42,0.85)",
              borderColor: mode === "light" ? "#e5e7eb" : "#1f2937",
            },
          ]}
        >
          <View style={styles.mobileHeaderRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.mobileName, { color: theme.text }]}> 
                {safeString(item?.name || item?.patient_name || item?.id)}
              </Text>
              <Text style={[styles.mobileId, { color: theme.subText }]}>ID: {safeString(item?.id || item?.patient_id || "-")}</Text>
            </View>
            <Text style={[styles.mobileMeta, { color: theme.subText }]}> 
              {safeString(item?.phone_number || item?.mobile || "-")}
            </Text>
          </View>

          <View style={styles.mobileDetailRow}>
            <Text style={[styles.mobileMeta, { color: theme.text }]}>City: {safeString(item?.city)}</Text>
            <Text style={[styles.mobileMeta, { color: theme.text }]}>Age: {safeString(item?.age)}</Text>
          </View>

          {safeString(item?.mode_of_referral) ? (
            <View style={styles.mobileChip}>
              <Text style={[styles.mobileChipText, { color: theme.text }]}>Referral: {safeString(item.mode_of_referral)}</Text>
            </View>
          ) : null}

          <View style={styles.mobileActionsRow}>
            <TouchableOpacity
              onPress={() => goToTreatment(item)}
              style={[styles.mobileTreatmentBtn, { backgroundColor: theme.primary + "18" }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="medkit-outline" size={14} color={theme.primary} />
              <Text style={[styles.mobileTreatmentBtnText, { color: theme.primary }]}>Treatment</Text>
            </TouchableOpacity>

            {canDeletePatient && (
              <TouchableOpacity
                onPress={() => handleDeletePatient(item)}
                style={styles.mobileDeleteBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="trash-outline" size={16} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    const isEven = index % 2 === 0;

    return (
      <View
        key={`row-${item?.id ?? index}`}
        style={[
          styles.row,
          isWeb && styles.rowWeb,
          {
            backgroundColor:
              mode === "light"
                ? isEven
                  ? "rgba(99,102,241,0.035)"
                  : "transparent"
                : isEven
                ? "rgba(255,255,255,0.03)"
                : "transparent",
            borderBottomColor:
              mode === "light" ? "#eef2ff" : "#1f2937",
          },
        ]}
      >
        {activeColumns.map((col) => {
          const cellValue = item?.[col.key];

          if (col.key.toLowerCase().includes("patient")) {
            return (
              <View
                key={col.key}
                style={{
                  width: col.width,
                  paddingHorizontal: 10,
                }}
              >
                <View
                  style={[
                    styles.idBadge,
                    isWeb && styles.idBadgeWeb,
                    {
                      backgroundColor:
                        mode === "light"
                          ? "rgba(59,130,246,0.10)"
                          : "rgba(59,130,246,0.18)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.idText,
                      isWeb && styles.idTextWeb,
                      { color: theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {safeString(cellValue)}
                  </Text>
                </View>
              </View>
            );
          }

          if (col.key.toLowerCase().includes("referral")) {
            return (
              <View
                key={col.key}
                style={{
                  width: col.width,
                  paddingHorizontal: 10,
                }}
              >
                <View
                  style={[
                    styles.chip,
                    isWeb && styles.chipWeb,
                    {
                      backgroundColor: getReferralColor(cellValue, mode),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isWeb && styles.chipTextWeb,
                      { color: theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {safeString(cellValue)}
                  </Text>
                </View>
              </View>
            );
          }

          return (
            <Text
              key={col.key}
              style={[
                styles.cell,
                isWeb && styles.cellWeb,
                { width: col.width, color: theme.text },
              ]}
              numberOfLines={1}
            >
              {safeString(cellValue)}
            </Text>
          );
        })}

        <View style={{ flexDirection: "row", width: 120, justifyContent: "flex-end", gap: 6 }}>
          <TouchableOpacity style={styles.editBtn} onPress={() => goToTreatment(item)}>
            <View style={[styles.editIconWrap, { backgroundColor: "#22c55e22" }]}>
              <Icon name="medkit-outline" size={18} color="#22c55e" />
            </View>
          </TouchableOpacity>
          {canEditPatient && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() =>
                navigation.navigate("Registration", {
                  patient: item,
                  mode: "edit",
                })
              }
            >
              <View
                style={[
                  styles.editIconWrap,
                  { backgroundColor: theme.primary + "22" },
                ]}
              >
                <Icon name="create-outline" size={18} color={theme.primary} />
              </View>
            </TouchableOpacity>
          )}
          {canDeletePatient && (
            <TouchableOpacity style={styles.editBtn} onPress={() => handleDeletePatient(item)}>
              <View style={[styles.editIconWrap, { backgroundColor: "#ef444422" }]}>
                <Icon name="trash-outline" size={18} color="#ef4444" />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  /* ---------- UI ---------- */
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.text, marginTop: 10 }}>
          Loading patients...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* BACKGROUND */}
      <LinearGradient
        colors={
          mode === "light"
            ? ["#f8fafc", "#eef2ff", "#f1f5f9"]
            : ["#0b1220", "#0f172a", "#020617"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        pointerEvents="none"
        style={[
          styles.bgBlob,
          {
            backgroundColor:
              mode === "light"
                ? "rgba(59,130,246,0.14)"
                : "rgba(59,130,246,0.12)",
            top: -100,
            left: -90,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.bgBlob,
          {
            backgroundColor:
              mode === "light"
                ? "rgba(168,85,247,0.12)"
                : "rgba(168,85,247,0.10)",
            bottom: -120,
            right: -90,
          },
        ]}
      />

      {/* ✅ FIXED WEB SCROLL */}
      <SafeAreaView style={[{ flex: 1 }, isWeb && styles.safeWeb]}>
        {/* ✅ WEB CENTER WRAP */}
        <View style={[{ flex: 1, minHeight: 0 }, isWeb && styles.containerWeb]}>
          <StatusBar
            barStyle={mode === "dark" ? "light-content" : "dark-content"}
            backgroundColor="transparent"
          />

          {/* TOOLBAR */}
          <View style={[styles.toolbar, isWeb && styles.toolbarWeb]}>
            {/* Back + Search always keep full width so the input never gets squeezed out */}
            <View style={styles.toolbarSearchRow}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={[
                  styles.headerIconBtn,
                  {
                    backgroundColor:
                      mode === "light"
                        ? "rgba(0,0,0,0.04)"
                        : "rgba(255,255,255,0.06)",
                    marginRight: 6,
                  },
                ]}
              >
                <Icon name="arrow-back" size={20} color={theme.text} />
              </TouchableOpacity>

              <View
                style={[
                  styles.searchBox,
                  isWeb && styles.searchBoxWeb,
                  {
                    backgroundColor:
                      mode === "light"
                        ? "rgba(255,255,255,0.92)"
                        : "rgba(15,23,42,0.85)",
                    borderColor: mode === "light" ? "#e5e7eb" : "#1f2937",
                  },
                ]}
              >
                <Icon name="search-outline" size={18} color={theme.subText} />
                <TextInput
                  placeholder="Search patient name, city, or ID..."
                  placeholderTextColor={theme.subText}
                  value={search}
                  onChangeText={setSearch}
                  style={[
                    styles.searchInput,
                    { color: theme.text },
                  ]}
                />
              </View>
            </View>

            {/* Action buttons scroll horizontally instead of squeezing the search box */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.toolbarActionsRow}
              style={styles.toolbarActionsScroll}
            >
              {/* RESET */}
              {(Object.values(columnFilters).some(v => v) || sortRules.length > 0) && (
                <TouchableOpacity
                  onPress={() => { setColumnFilters({}); setSearch(""); clearSort(); }}
                  style={[
                    styles.clearAllBtn,
                    { backgroundColor: theme.primary + "15", borderColor: theme.primary + "30" }
                  ]}
                >
                  <Icon name="refresh-outline" size={16} color={theme.primary} />
                  <Text style={{ color: theme.primary, fontWeight: "800", marginLeft: 4, fontSize: 13 }}>Reset</Text>
                </TouchableOpacity>
              )}

              {/* SORT */}
              <TouchableOpacity
                onPress={() => { setSortFieldSearch(""); setShowSort(true); }}
                style={[
                  styles.iconBtn,
                  {
                    backgroundColor: sortRules.length > 0
                      ? theme.primary
                      : mode === "light"
                        ? "rgba(255,255,255,0.92)"
                        : "rgba(15,23,42,0.85)",
                    borderColor: sortRules.length > 0 ? theme.primary : mode === "light" ? "#e5e7eb" : "#1f2937",
                  },
                ]}
              >
                <Icon
                  name="swap-vertical-outline"
                  size={22}
                  color={sortRules.length > 0 ? "#fff" : theme.primary}
                />
                {sortRules.length > 1 && (
                  <View style={[styles.sortCountBadge, { backgroundColor: "#ef4444" }]}>
                    <Text style={styles.sortCountBadgeText}>{sortRules.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowCols(true)}
                style={[
                  styles.iconBtn,
                  {
                    backgroundColor:
                      mode === "light"
                        ? "rgba(255,255,255,0.92)"
                        : "rgba(15,23,42,0.85)",
                    borderColor: mode === "light" ? "#e5e7eb" : "#1f2937",
                  },
                ]}
              >
                <Icon name="grid-outline" size={22} color={theme.primary} />
              </TouchableOpacity>

              {/* EXPORT */}
              <TouchableOpacity
                onPress={exportToCSV}
                style={[
                  styles.iconBtn,
                  { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
              >
                <Icon name="download-outline" size={22} color="#fff" />
              </TouchableOpacity>

              {/* ADD BTN */}
              {canAddPatient && (
                <TouchableOpacity
                  style={[
                    styles.addBtn,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={() => navigation.navigate("Registration", { mode: "add" })}
                  activeOpacity={0.9}
                >
                  <Icon name="add" size={20} color="#fff" />
                  {isWeb && <Text style={styles.addBtnText}>Add Patient</Text>}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* TABLE */}
          <View
            style={[
              styles.tableCard,
              isWeb && styles.tableCardWeb,
              {
                backgroundColor:
                  mode === "light"
                    ? "rgba(255,255,255,0.92)"
                    : "rgba(15,23,42,0.85)",
                borderColor: mode === "light" ? "#e5e7eb" : "#1f2937",
                minHeight: 280,
              },
            ]}
          >
            {isWeb ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={true}
                style={{ flexGrow: 1, minHeight: 0, height: '100%' }}
                contentContainerStyle={{ flexGrow: 1, minHeight: 0 }}
              >
                <View style={{ flexGrow: 1, width: "100%", minHeight: 0, height: '100%' }}>
                  <FlatList
                    data={paginatedPatients}
                    extraData={[columns, visibleCols, paginatedPatients]}
                    keyExtractor={(item, index) => item?.id?.toString() ?? index.toString()}
                    stickyHeaderIndices={[0]}
                    showsVerticalScrollIndicator={true}
                    style={{ flexGrow: 1, minHeight: 0, height: '100%' }}
                    contentContainerStyle={{ flexGrow: 1, minHeight: 0 }}
                    nestedScrollEnabled={true}
                    removeClippedSubviews={false}
                    ListEmptyComponent={() => (
                      <View style={{ padding: 20 }}>
                        <Text style={{ color: theme.subText, textAlign: 'center' }}>
                          No patients to display.
                        </Text>
                      </View>
                    )}
                    ListHeaderComponent={() => (
                      <View
                        style={[
                          styles.tableHeader,
                          isWeb && styles.tableHeaderWeb,
                          {
                            borderBottomColor:
                              mode === "light" ? "#e5e7eb" : "#1f2937",
                            backgroundColor:
                              mode === "light"
                                ? "rgba(248,250,252,0.98)"
                                : "rgba(2,6,23,0.95)",
                          },
                        ]}
                      >
                        {activeColumns.map((col) => (
                          <ResizableHeaderCell
                            key={col.key}
                            col={col}
                            theme={theme}
                            isWeb={isWeb}
                            onResize={handleResize}
                            filters={columnFilters}
                            setFilters={setColumnFilters}
                            activeCol={activeFilterCol}
                            setActiveCol={setActiveFilterCol}
                            dataValues={distinctValuesMap[col.key] || []}
                          />
                        ))}
                        <Text
                          style={[
                            styles.headerCell,
                            isWeb && styles.headerCellWeb,
                            { width: 120, color: theme.subText },
                          ]}
                        >
                          Actions
                        </Text>
                      </View>
                    )}
                    renderItem={({ item, index }) => renderPatientRow(item, index)}
                  />
                </View>
              </ScrollView>
            ) : (
              <FlatList
                data={paginatedPatients}
                extraData={[paginatedPatients]}
                keyExtractor={(item, index) => item?.id?.toString() ?? index.toString()}
                showsVerticalScrollIndicator={true}
                style={{ flex: 1, minHeight: 0 }}
                contentContainerStyle={{ flexGrow: 1, minHeight: 0, padding: 12, paddingBottom: 20 }}
                ListEmptyComponent={() => (
                  <View style={{ padding: 20 }}>
                    <Text style={{ color: theme.subText, textAlign: 'center' }}>
                      No patients to display.
                    </Text>
                  </View>
                )}
                renderItem={({ item, index }) => renderPatientRow(item, index)}
              />
            )}
          </View>

          {/* PAGINATION + ROWS PER PAGE (BOTTOM - SINGLE LINE) */}
          <View
            style={[
              styles.paginationWrap,
            ]}
          >
            <Text
              style={{
                color: theme.subText,
                fontWeight: "700",
                fontSize: 13,
                flex: 1, // pushes next elements to right
              }}
            >
              Showing {Math.min(paginatedPatients.length, pageSize)} of {total} • Page {page} / {totalPages}
            </Text>
            {/* Rows per page selector */}
            <View style={styles.rowsPerPageRow}>
              <Text
                style={{
                  color: theme.subText,
                  fontWeight: "800",
                  fontSize: isWeb ? 15 : 13,
                }}
              >
                Rows:
              </Text>

              <TouchableOpacity
                onPress={() => setShowPageSize(true)}
                activeOpacity={0.9}
                style={[
                  styles.rowsSelectBtn,
                  {
                    backgroundColor:
                      mode === "light"
                        ? "rgba(255,255,255,0.92)"
                        : "rgba(15,23,42,0.85)",
                    borderColor: mode === "light" ? "#e5e7eb" : "#1f2937",
                  },
                ]}
              >
                <Text
                  style={{
                    color: theme.text,
                    fontWeight: "900",
                    fontSize: isWeb ? 15 : 13,
                  }}
                >
                  {pageSize}
                </Text>
                <Icon name="chevron-down" size={16} color={theme.subText} />
              </TouchableOpacity>
            </View>

            {/* Page buttons */}
            <View style={styles.paginationRow}>
              <TouchableOpacity
                disabled={page === 1}
                onPress={() => setPage(1)}
                style={[
                  styles.pageBtn,
                  { opacity: page === 1 ? 0.35 : 1 },
                ]}
              >
                <Icon name="play-back" size={18} color={theme.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                disabled={page === 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                style={[
                  styles.pageBtn,
                  { opacity: page === 1 ? 0.35 : 1 },
                ]}
              >
                <Icon name="chevron-back" size={20} color={theme.primary} />
              </TouchableOpacity>

              {pageButtons.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPage(p)}
                  style={[
                    styles.pageNumber,
                    {
                      backgroundColor:
                        p === page ? theme.primary : "transparent",
                      borderColor: mode === "light" ? "#e5e7eb" : "#1f2937",
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontWeight: "900",
                      color: p === page ? "#fff" : theme.text,
                      fontSize: isWeb ? 15 : 13,
                    }}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                disabled={page === totalPages}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={[
                  styles.pageBtn,
                  { opacity: page === totalPages ? 0.35 : 1 },
                ]}
              >
                <Icon name="chevron-forward" size={20} color={theme.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                disabled={page === totalPages}
                onPress={() => setPage(totalPages)}
                style={[
                  styles.pageBtn,
                  { opacity: page === totalPages ? 0.35 : 1 },
                ]}
              >
                <Icon name="play-forward" size={18} color={theme.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* SORT MODAL */}
          <Modal transparent visible={showSort} animationType="fade">
            <KeyboardAvoidingView
              style={styles.modalBg}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              <View
                style={[
                  styles.modalCard,
                  {
                    backgroundColor:
                      mode === "light"
                        ? "rgba(255,255,255,0.98)"
                        : "rgba(15,23,42,0.95)",
                    borderColor: mode === "light" ? "#e5e7eb" : "#1f2937",
                  },
                ]}
              >
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  Sort By
                </Text>
                <Text style={{ color: theme.subText, fontSize: 12, marginTop: 4 }}>
                  Tap fields to add them in priority order. Tap an added field again to flip
                  direction. Use ↑↓ to reorder priority, ✕ to remove.
                </Text>

                <View style={[styles.filterSearchBox, { borderBottomColor: mode === "light" ? "#eef2ff" : "#1f2937", marginTop: 12 }]}>
                  <Icon name="search-outline" size={14} color={theme.subText} />
                  <TextInput
                    placeholder="Find field..."
                    placeholderTextColor={theme.subText}
                    value={sortFieldSearch}
                    onChangeText={setSortFieldSearch}
                    style={[styles.filterInput, { color: theme.text }]}
                  />
                </View>

                <ScrollView style={{ maxHeight: 320 }}>
                  {orderedSortableColumns.length === 0 ? (
                    <Text style={{ textAlign: "center", padding: 14, color: theme.subText, fontSize: 12 }}>
                      No matching fields
                    </Text>
                  ) : (
                  orderedSortableColumns.map((col) => {
                    const ruleIndex = sortRules.findIndex((r) => r.key === col.key);
                    const isActive = ruleIndex !== -1;
                    const rule = isActive ? sortRules[ruleIndex] : null;

                    return (
                      <TouchableOpacity
                        key={col.key}
                        onPress={() => handleSortSelect(col.key)}
                        activeOpacity={0.7}
                        style={[
                          styles.colRow,
                          {
                            borderBottomColor:
                              mode === "light" ? "#eef2ff" : "#1f2937",
                            backgroundColor: isActive ? theme.primary + "15" : "transparent",
                          },
                        ]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                          {isActive && (
                            <View style={[styles.sortPriorityBadge, { backgroundColor: theme.primary }]}>
                              <Text style={styles.sortPriorityBadgeText}>{ruleIndex + 1}</Text>
                            </View>
                          )}
                          <Text
                            style={{
                              color: isActive ? theme.primary : theme.text,
                              fontWeight: "700",
                            }}
                          >
                            {col.label}
                          </Text>
                        </View>

                        {isActive && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                            {ruleIndex > 0 && (
                              <TouchableOpacity
                                onPress={() => moveSortRule(col.key, "up")}
                                style={styles.sortMiniBtn}
                              >
                                <Icon name="chevron-up-outline" size={16} color={theme.subText} />
                              </TouchableOpacity>
                            )}
                            {ruleIndex < sortRules.length - 1 && (
                              <TouchableOpacity
                                onPress={() => moveSortRule(col.key, "down")}
                                style={styles.sortMiniBtn}
                              >
                                <Icon name="chevron-down-outline" size={16} color={theme.subText} />
                              </TouchableOpacity>
                            )}
                            <Icon
                              name={rule.dir === "asc" ? "arrow-up-outline" : "arrow-down-outline"}
                              size={16}
                              color={theme.primary}
                              style={{ marginHorizontal: 4 }}
                            />
                            <TouchableOpacity
                              onPress={() => removeSortRule(col.key)}
                              style={styles.sortMiniBtn}
                            >
                              <Icon name="close-circle" size={18} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                  )}
                </ScrollView>

                <TouchableOpacity
                  onPress={clearSort}
                  style={[
                    styles.clearSortBtn,
                    { borderColor: mode === "light" ? "#e5e7eb" : "#1f2937" },
                  ]}
                >
                  <Icon name="close-outline" size={16} color={theme.subText} />
                  <Text style={{ color: theme.subText, fontWeight: "800", marginLeft: 4 }}>
                    Clear Sort
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.doneBtn, { backgroundColor: theme.primary }]}
                  onPress={() => setShowSort(false)}
                >
                  <Text style={{ color: "#fff", fontWeight: "900" }}>Done</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* PAGE SIZE MODAL */}
          <Modal transparent visible={showPageSize} animationType="fade">
            <View style={styles.modalBg}>
              <View
                style={[
                  styles.modalCard,
                  {
                    backgroundColor:
                      mode === "light"
                        ? "rgba(255,255,255,0.98)"
                        : "rgba(15,23,42,0.95)",
                    borderColor: mode === "light" ? "#e5e7eb" : "#1f2937",
                  },
                ]}
              >
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  Rows per page
                </Text>

                {[10, 20, 50, 100].map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => {
                      setPageSize(n);
                      setShowPageSize(false);
                    }}
                    style={[
                      styles.pageSizeOption,
                      {
                        backgroundColor:
                          n === pageSize ? theme.primary + "22" : "transparent",
                        borderBottomColor:
                          mode === "light" ? "#eef2ff" : "#1f2937",
                      },
                    ]}
                  >
                    <Text style={{ color: theme.text, fontWeight: "800" }}>
                      {n}
                    </Text>

                    {n === pageSize ? (
                      <Icon name="checkmark" size={18} color={theme.primary} />
                    ) : null}
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  onPress={() => setShowPageSize(false)}
                  style={[styles.doneBtn, { backgroundColor: theme.primary }]}
                >
                  <Text style={{ color: "#fff", fontWeight: "900" }}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* COLUMN MODAL */}
          <Modal transparent visible={showCols} animationType="fade">
            <View style={styles.modalBg}>
              <View
                style={[
                  styles.modalCard,
                  {
                    backgroundColor:
                      mode === "light"
                        ? "rgba(255,255,255,0.98)"
                        : "rgba(15,23,42,0.95)",
                    borderColor: mode === "light" ? "#e5e7eb" : "#1f2937",
                  },
                ]}
              >
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  Show / Hide Columns
                </Text>

                <ScrollView style={{ marginTop: 12 }}>
                  {columns.map((col) => (
                    <View
                      key={col.key}
                      style={[
                        styles.colRow,
                        {
                          borderBottomColor:
                            mode === "light" ? "#eef2ff" : "#1f2937",
                        },
                      ]}
                    >
                      <Text style={{ color: theme.text, fontWeight: "700" }}>
                        {col.label}
                      </Text>

                      <Switch
                        value={visibleCols.includes(col.key)}
                        onValueChange={() => toggleColumn(col.key)}
                      />
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.doneBtn, { backgroundColor: theme.primary }]}
                  onPress={() => setShowCols(false)}
                >
                  <Text style={{ color: "#fff", fontWeight: "900" }}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default PatientListScreen;

/* ========================= */
/* ===== STYLES ============ */
/* ========================= */

const styles = StyleSheet.create({
  bgBlob: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 320,
  },

  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  toolbar: {
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 10,
  },

  toolbarSearchRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  toolbarActionsScroll: {
    flexGrow: 0,
  },

  toolbarActionsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingRight: 4,
  },

  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    height: 46,
  },

  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    ...Platform.select({
      web: { outlineStyle: "none" }
    }),
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    position: "relative",
  },

  sortCountBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },

  sortCountBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },

  addBtn: {
    height: 44,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginLeft: 4,
  },

  addBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },

  tableCard: {
    flex: 1,
    flexGrow: 1,
    minHeight: 0,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden", // Ensures FlatList bounds restrict nicely
  },

  tableHeader: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingHorizontal: 6,
    zIndex: 99,
  },

  headerCell: {
    fontWeight: "900",
    fontSize: 11,
    paddingHorizontal: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  filterPop: {
    position: 'absolute',
    top: 45,
    left: 4,
    width: 220,
    borderRadius: 15,
    borderWidth: 1,
    padding: 8,
    zIndex: 1000,
    // Shadow for elevation
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },

  filterSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 6,
    marginBottom: 6,
    gap: 8,
  },

  filterInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    padding: 0,
    height: 30,
    ...Platform.select({
      web: { outlineStyle: "none" }
    }),
  },

  filterValueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },

  filterDoneBtn: {
    marginTop: 8,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterCloseBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },

  row: {
    flexDirection: "row",
    paddingVertical: 14,
    borderBottomWidth: 1,
    alignItems: "center",
    paddingHorizontal: 6,
  },

  cell: {
    fontSize: 13,
    paddingHorizontal: 10,
    fontWeight: "600",
  },

  idBadge: {
    height: 28,
    borderRadius: 10,
    paddingHorizontal: 10,
    justifyContent: "center",
  },

  idText: {
    fontWeight: "900",
    fontSize: 12,
  },

  chip: {
    height: 28,
    borderRadius: 999,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignSelf: "flex-start",
  },

  chipText: {
    fontWeight: "800",
    fontSize: 12,
  },

  editBtn: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  editIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  mobileRow: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },

  mobileHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },

  mobileDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },

  mobileName: {
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },

  mobileId: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },

  mobileMeta: {
    fontSize: 13,
    fontWeight: "600",
  },

  mobileChip: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignSelf: "flex-start",
    backgroundColor: "rgba(59,130,246,0.12)",
  },

  mobileChipText: {
    fontSize: 12,
    fontWeight: "700",
  },

  mobileActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },

  mobileTreatmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },

  mobileTreatmentBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },

  mobileDeleteBtn: {
    padding: 4,
  },

  paginationWrap: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },

  rowsPerPageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  rowsSelectBtn: {
    height: 40,
    minWidth: 90,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  paginationRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  },

  pageNumber: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  clearAllBtn: {
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  pageBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
  },

  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },

  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
  },

  pageSizeOption: {
    height: 48,
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  colRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },

  doneBtn: {
    marginTop: 14,
    height: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  clearSortBtn: {
    marginTop: 14,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  sortPriorityBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  sortPriorityBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },

  sortMiniBtn: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  /* ===================== */
  /* ===== WEB ONLY ====== */
  /* ===================== */

  safeWeb: {
    flex: 1,
    height: "100vh",
    overflow: "hidden", // Ensures browser body doesn't zoom out, relies on React Native inner scrolling
  },

  containerWeb: {
    flex: 1, // Fixes missing flex inside safe area, preventing unbounded growth
    maxWidth: 1550,
    width: "100%",
    alignSelf: "center",
  },

  tableCardWeb: {
    marginHorizontal: 18,
    marginTop: 16,
    borderRadius: 12,
    flex: 1,
  },

  paginationWrapWeb: {
    paddingVertical: 12,
  },

  /* Removed bloated web font overrides so table remains dense and fits 10 rows easily */
});
