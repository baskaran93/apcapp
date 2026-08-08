import * as ImagePicker from "expo-image-picker";
import { ImageManipulator } from "expo-image-manipulator";
import TextRecognition from "@react-native-ml-kit/text-recognition";

// Printed labels on the paper intake form, matched against the start of a
// recognized line. Handwritten values normally follow the label on the same
// line (e.g. "Name : J. Prasath"); when ML Kit splits the label and the
// handwritten value into separate lines, parseRegistrationFields() falls
// back to the nearest unclaimed line to the label's right on the same row.
//
// The form has two columns of labels on the top two rows (Name/Date and
// Contact No/Age share a row each), so "Date" is matched and consumed here
// purely so it can't be mistaken for Name's or Contact No's value — its
// own value is discarded since patient registration doesn't need it.
const FIELD_PATTERNS = [
    { key: "name", regex: /^name\b\s*[:\-]?\s*/i },
    { key: "phone_number", regex: /^contact\s*no\.?\b\s*[:\-]?\s*/i },
    { key: "address", regex: /^address\b\s*[:\-]?\s*/i },
    { key: "pincode", regex: /^pin\s*code\b\s*[:\-]?\s*/i },
    { key: "age", regex: /^age\b\s*[:\-]?\s*/i },
    { key: null, regex: /^date\b\s*[:\-]?\s*/i },
];

export const captureFormPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
        throw new Error("Camera permission is required to scan a form.");
    }

    const result = await ImagePicker.launchCameraAsync({
        quality: 1,
        base64: false,
    });

    if (result.canceled || !result.assets?.length) return null;
    return result.assets[0].uri;
};

// Flattens every recognized line (with its bounding box) across all blocks.
// Order isn't meaningful on its own here — matching is done by geometry
// (see parseRegistrationFields), because this form has two label columns
// sharing the same rows (Name/Date, Contact No/Age), so a purely
// top-to-bottom reading order interleaves the two columns.
const flattenLines = (recognitionResult) => {
    const lines = [];
    for (const block of recognitionResult.blocks || []) {
        for (const line of block.lines || []) {
            const text = (line.text || "").trim();
            if (!text) continue;
            const frame = line.frame;
            lines.push({
                text,
                x: frame ? frame.left : 0,
                y: frame ? frame.top + frame.height / 2 : lines.length,
                h: frame ? frame.height : 24,
            });
        }
    }
    return lines;
};

export const parseRegistrationFields = (recognitionResult) => {
    const lines = flattenLines(recognitionResult);
    const fields = {};
    const consumed = new Set();
    const matchedLabels = []; // every recognized label's position, used as column boundaries
    const labelPositions = {}; // key -> {x, y, h}, kept for every matched label regardless of path
    const pending = []; // labels with no value on their own line, resolved below

    lines.forEach((line, idx) => {
        const matched = FIELD_PATTERNS.find((p) => p.regex.test(line.text));
        if (!matched) return;

        consumed.add(idx);
        matchedLabels.push({ x: line.x, y: line.y, h: line.h });
        if (!matched.key) return; // recognized but intentionally ignored (e.g. Date)

        labelPositions[matched.key] = { x: line.x, y: line.y, h: line.h };
        const value = line.text.replace(matched.regex, "").trim();
        if (value) {
            fields[matched.key] = value;
        } else {
            pending.push({ key: matched.key, x: line.x, y: line.y, h: line.h });
        }
    });

    // A same-row label to the right (e.g. "Age" next to "Contact No") caps
    // how far right/down we should look for a value, so its text doesn't
    // get swept into the wrong field.
    const rightBoundaryOnRow = (label) => {
        const yTolerance = Math.max(label.h * 1.2, 18);
        return matchedLabels
            .filter((m) => m.x > label.x + 1 && Math.abs(m.y - label.y) <= yTolerance)
            .reduce((min, m) => Math.min(min, m.x), Infinity);
    };

    for (const label of pending) {
        if (fields[label.key]) continue;

        const yTolerance = Math.max(label.h * 1.2, 18);
        const boundaryX = rightBoundaryOnRow(label);

        const candidates = lines
            .map((line, idx) => ({ line, idx }))
            .filter(
                ({ line, idx }) =>
                    !consumed.has(idx) &&
                    Math.abs(line.y - label.y) <= yTolerance &&
                    line.x >= label.x &&
                    line.x < boundaryX
            )
            .sort((a, b) => a.line.x - b.line.x);

        if (!candidates.length) continue;

        const value = candidates.map((c) => c.line.text).join(" ").trim();
        if (value) {
            fields[label.key] = value;
            candidates.forEach((c) => consumed.add(c.idx));
        }
    }

    // Handwritten values that wrap onto further ruled lines below the label
    // (address is the common case) get appended here: gather any remaining
    // unclaimed lines between this label's row and the next label's row,
    // within the same column, in reading order.
    const sortedLabelYs = Object.values(labelPositions)
        .map((p) => p.y)
        .sort((a, b) => a - b);

    for (const [key, label] of Object.entries(labelPositions)) {
        const boundaryX = rightBoundaryOnRow(label);
        const nextLabelY = sortedLabelYs.find((y) => y > label.y + label.h) ?? Infinity;

        const continuation = lines
            .map((line, idx) => ({ line, idx }))
            .filter(
                ({ line, idx }) =>
                    !consumed.has(idx) &&
                    line.y > label.y + label.h &&
                    line.y < nextLabelY &&
                    line.x >= label.x &&
                    line.x < boundaryX
            )
            .sort((a, b) => a.line.y - b.line.y || a.line.x - b.line.x);

        if (!continuation.length) continue;

        const extra = continuation.map((c) => c.line.text).join(", ").trim();
        if (extra) {
            fields[key] = fields[key] ? `${fields[key]}, ${extra}` : extra;
            continuation.forEach((c) => consumed.add(c.idx));
        }
    }

    if (fields.age) {
        const digits = fields.age.replace(/\D/g, "");
        fields.age = digits || fields.age;
    }

    return fields;
};

// This narrow strip-shaped form is naturally photographed sideways (rotated
// to fit more of the strip in frame), and ML Kit's text recognizer is tuned
// for upright text — a 90°-rotated photo commonly yields zero blocks. Rather
// than relying on the user to hold the phone a particular way, try every
// quarter-turn and keep whichever orientation actually reads the most text.
const ROTATIONS = [0, 90, 180, 270];

const rotateImage = async (uri, degrees) => {
    if (degrees === 0) return uri;
    const rendered = await ImageManipulator.manipulate(uri).rotate(degrees).renderAsync();
    const saved = await rendered.saveAsync({ compress: 1 });
    return saved.uri;
};

const recognizedLength = (result) => (result?.text || "").replace(/\s/g, "").length;

export const scanRegistrationForm = async () => {
    const uri = await captureFormPhoto();
    if (!uri) return null;

    let best = null;
    let bestScore = -1;
    let successCount = 0;
    let lastError = null;

    for (const degrees of ROTATIONS) {
        try {
            const rotatedUri = await rotateImage(uri, degrees);
            const result = await TextRecognition.recognize(rotatedUri);
            successCount += 1;
            const score = recognizedLength(result);
            console.log(`[scanForm] rotation ${degrees}deg -> ${score} chars`);
            if (score > bestScore) {
                bestScore = score;
                best = result;
            }
        } catch (e) {
            lastError = e;
            console.error(`[scanForm] OCR failed at rotation ${degrees}`, e);
        }
    }

    // Every rotation attempt threw (as opposed to running but finding no
    // text) — that's a wiring problem, not a "form is blank" problem. The
    // most common cause is a native module (ML Kit / image-manipulator)
    // that isn't in the currently-installed build yet.
    if (successCount === 0) {
        throw new Error(
            `Scan module unavailable — rebuild the app (npx expo run:android) after installing scan dependencies. (${lastError?.message || "unknown error"})`
        );
    }

    if (!best || bestScore === 0) return {};
    return parseRegistrationFields(best);
};
