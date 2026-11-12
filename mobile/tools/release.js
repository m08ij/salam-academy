// Publishes a new app version so installed apps offer it as an update.
//
//   1. Bump versionCode (+1) and versionName in android/app/build.gradle
//   2. Build:  android\gradlew.bat -p android assembleRelease   (see README)
//   3. node tools/release.js "ملاحظة ١|ملاحظة ٢" --en "Note 1|Note 2"          (add --dry to only prepare dist/)
//
// It copies the signed APK to dist/SalamAcademy.apk, writes dist/version.json (with the APK's SHA-256, which the app
// verifies before installing), and creates GitHub release v<versionName> with both files. The Pages workflow then
// publishes them under https://m08ij.github.io/salam-academy/apk/ where the app looks for updates.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SITE = "https://m08ij.github.io/salam-academy/";
const gradle = fs.readFileSync(path.join(ROOT, "android/app/build.gradle"), "utf8");
const versionCode = Number((gradle.match(/versionCode\s+(\d+)/) || [])[1]);
const versionName = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1];
if (!versionCode || !versionName) throw new Error("versionCode/versionName not found in build.gradle");

const apk = path.join(ROOT, "android/app/build/outputs/apk/release/app-release.apk");
if (!fs.existsSync(apk)) throw new Error("Build the release APK first (assembleRelease).");

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const enIdx = args.indexOf("--en");
const split = (s) => (s || "").split("|").map((x) => x.trim()).filter(Boolean);
const notesAr = split(args.find((a, i) => !a.startsWith("--") && i !== enIdx + 1));
const notesEn = enIdx >= 0 ? split(args[enIdx + 1]) : [];

const buf = fs.readFileSync(apk);
const dist = path.join(ROOT, "dist");
fs.mkdirSync(dist, { recursive: true });
fs.copyFileSync(apk, path.join(dist, "SalamAcademy.apk"));
const meta = {
  versionCode, versionName,
  url: SITE + "apk/SalamAcademy.apk",
  sha256: crypto.createHash("sha256").update(buf).digest("hex"),
  size: buf.length,
  notes: { ar: notesAr, en: notesEn },
  at: new Date().toISOString(),
};
fs.writeFileSync(path.join(dist, "version.json"), JSON.stringify(meta, null, 2));
console.log(`Prepared v${versionName} (${versionCode}) · ${(buf.length / 1048576).toFixed(1)} MB · sha256 ${meta.sha256.slice(0, 12)}…`);
if (dry) process.exit(0);

const body = [...notesAr.map((n) => `- ${n}`), ...(notesEn.length ? ["", ...notesEn.map((n) => `- ${n}`)] : [])].join("\n") || `Salam Academy ${versionName}`;
execFileSync("gh", ["release", "create", `v${versionName}`, path.join(dist, "SalamAcademy.apk"), path.join(dist, "version.json"),
  "--title", `أكاديمية سلام ${versionName}`, "--notes", body], { stdio: "inherit", cwd: ROOT });
console.log("Release created. The Pages workflow will publish it under /apk/ in a few minutes.");
