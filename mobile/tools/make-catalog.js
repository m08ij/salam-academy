// Builds the offline values catalog bundled in the APK for the "Value of the day" widget.
// Source: backend/app/seed/salam_payload.json  →  android/app/src/main/assets/catalog.json
// Run after the payload changes:  npm run catalog
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "../../backend/app/seed/salam_payload.json");
const OUT = path.join(__dirname, "../android/app/src/main/assets/catalog.json");

const D = JSON.parse(fs.readFileSync(SRC, "utf8"));
const pair = (p) => (Array.isArray(p) ? [p[0] || "", p[1] || ""] : ["", ""]);

// Behaviors grouped by value id: beh rows are [id, value_id, name_id, group_id, text_ar, text_en, unofficial_en].
const byValue = new Map();
for (const b of D.beh) {
  const list = byValue.get(b[1]) || [];
  // Prefer behaviors whose English translation is official.
  if (list.length < 4 && b[4]) list.push([b[4], b[6] ? "" : b[5] || ""]);
  byValue.set(b[1], list);
}

const values = D.values
  .filter((v) => (v.b && (v.b[0] || v.b[1])))
  .map((v) => ({ t: pair(v.t), r: v.r, b: pair(v.b), x: pair(v.x), l: pair(v.l), beh: byValue.get(v.id) || [] }));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ v: 1, values }));
console.log(`catalog.json: ${values.length} values, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
