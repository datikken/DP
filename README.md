# DailyPlanner

A personal link manager (URL list with HTTP status checks, pinning, reorder, local accounts) that ships as **two apps from one repo**:

- **Desktop** — Electron + TypeScript + SQLite (`node-sqlite3-wasm`), packaged with `electron-builder`.
- **Android** — native Kotlin + Jetpack Compose + Room, built with Gradle.

All data is stored **locally**; there is no server or cloud sync.

---

## Table of contents

1. [Quick start (copy‑paste)](#1-quick-start-copy-paste)
2. [Technology versions](#2-technology-versions)
3. [Desktop app — build for Windows / macOS / Linux](#3-desktop-app--build-for-windows--macos--linux)
4. [Android app — build](#4-android-app--build)
5. [Common commands](#5-common-commands)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Quick start (copy‑paste)

Run these **first**, in the repo root, on a fresh machine.

```bash
# 1. Install Node dependencies (desktop app)
npm install

# 2. Run the desktop app in development (build + launch)
npm run dev

# 3. Produce the Windows installer into ./release
npm run dist:win
```

For Android, from the `android/` folder:

```bash
cd android

# macOS / Linux
./gradlew assembleDebug          # -> app/build/outputs/apk/debug/app-debug.apk

# Windows
gradlew.bat assembleDebug        # -> app/build/outputs/apk/debug/app-debug.apk
```

| You want… | Do this | Output |
|---|---|---|
| Run desktop app locally | `npm run dev` | app window opens |
| Windows `.exe` installer | `npm run dist:win` | `release/DailyPlanner-Setup-<ver>-x64.exe` |
| Unpacked desktop build (fast) | `npm run pack:win` | `release/win-unpacked/` |
| Android debug APK | `gradlew.bat assembleDebug` | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Android release APK | `gradlew.bat assembleRelease` | `android/app/build/outputs/apk/release/app-release.apk` |

---

## 2. Technology versions

### Desktop (Electron)

| Component | Version | Where declared |
|---|---|---|
| Node.js | 18 LTS+ (tested on 26) | your machine — install separately |
| npm | 9+ (tested on 11) | bundled with Node |
| Electron | `^34.0.0` (installed 34.5.8) | `package.json` → `devDependencies` |
| electron-builder | `^25.1.8` | `package.json` → `devDependencies` |
| esbuild | `^0.23.0` | `package.json` → `devDependencies` |
| TypeScript | `^5.5.0` | `package.json` → `devDependencies` |
| Tailwind CSS | `^3.4.0` | `package.json` → `devDependencies` |
| bcryptjs | `^2.4.3` | `package.json` → `dependencies` |
| node-sqlite3-wasm | `^0.8.61` | `package.json` → `dependencies` |
| App version | `1.0.1` | `package.json` → `version` |

> The desktop app has **no native modules** — SQLite runs as WebAssembly (`node-sqlite3-wasm`), so no compiler / node-gyp / Python is needed for `npm install`.

### Android

| Component | Version | Where declared |
|---|---|---|
| Android Gradle Plugin (AGP) | `8.13.0` | `android/build.gradle.kts` |
| Gradle | `8.14` (via wrapper) | `android/gradle/wrapper/gradle-wrapper.properties` |
| Kotlin | `2.1.0` | `android/build.gradle.kts` |
| Compose Compiler plugin | `2.1.0` | `android/build.gradle.kts` |
| KSP | `2.1.0-1.0.29` | `android/build.gradle.kts` |
| Compose BOM | `2024.12.01` | `android/app/build.gradle.kts` |
| Material 3 | via Compose BOM | `android/app/build.gradle.kts` |
| Room | `2.6.1` | `android/app/build.gradle.kts` |
| OkHttp | `4.12.0` | `android/app/build.gradle.kts` |
| Coroutines | `1.9.0` | `android/app/build.gradle.kts` |
| DataStore (Preferences) | `1.1.1` | `android/app/build.gradle.kts` |
| BCrypt (`at.favre.lib`) | `0.10.2` | `android/app/build.gradle.kts` |
| Min Android (`minSdk`) | **API 24 — Android 7.0** | `android/app/build.gradle.kts` |
| Compile / Target SDK | **35 (Android 15)** | `android/app/build.gradle.kts` |
| JDK | **17+** (bundled with Android Studio) | `android/app/build.gradle.kts` → `compileOptions` |
| App version | `1.0.1` (`versionCode 2`) | `android/app/build.gradle.kts` |

### Prerequisites you must install manually

| For | Install | Notes |
|---|---|---|
| Desktop build/run | **Node.js 18+** and **npm** | <https://nodejs.org> |
| Android build | **Android Studio** (latest) + **JDK 17+** | Studio bundles the SDK & JDK; set `android/local.properties` → `sdk.dir=...` |
| APK install on phone | **adb** (part of Android SDK `platform-tools`) | optional, only for USB install |

---

## 3. Desktop app — build for Windows / macOS / Linux

The app is built in two stages: **`npm run build`** (bundles TS → `dist/` with esbuild + CSS with Tailwind) and **`electron-builder`** (wraps `dist/` into an installer).

### 3.1 First-time setup

```bash
npm install
```

### 3.2 Development / run

```bash
npm run dev        # = npm run build && electron .
```

### 3.3 Build per platform

| Target | Command | Output | Notes |
|---|---|---|---|
| **Windows** (NSIS installer, x64) | `npm run dist:win` | `release/DailyPlanner-Setup-<ver>-x64.exe` | Uses `electron-builder.config.js` (`win` + `nsis` are defined). Per-user install, no admin needed. |
| **Windows** (unpacked, fast) | `npm run pack:win` | `release/win-unpacked/` | Same config, `--dir` only (no installer). |
| **macOS** | `npx electron-builder --mac --config electron-builder.config.js` | `release/DailyPlanner-<ver>.dmg` | **Must run on macOS.** Config has no `mac` block yet — see below. |
| **Linux** | `npx electron-builder --linux --config electron-builder.config.js` | `release/DailyPlanner-<ver>.AppImage` | **Must run on Linux** (or a Linux CI/Docker). Config has no `linux` block yet — see below. |

> **Important:** `electron-builder.config.js` currently defines **only a Windows target**. There are **no** `dist:mac` / `dist:linux` npm scripts. Use the `npx` commands above, and add `mac`/`linux` blocks (and scripts) to the config if you want first-class support. Minimal additions:

```js
// electron-builder.config.js — add alongside the existing `win` block
mac: {
  target: ['dmg'],
  category: 'public.app-category.productivity',
  icon: 'build/icon.icns',   // provide a mac icon
},
linux: {
  target: ['AppImage'],
  category: 'Utility',
  icon: 'build/icon.png',
},
```

Matching npm scripts (optional):

```jsonc
"dist:mac":   "npm run icon && npm run build && electron-builder --mac --config electron-builder.config.js",
"dist:linux": "npm run icon && npm run build && electron-builder --linux --config electron-builder.config.js"
```

### 3.4 Platform build matrix (what runs where)

| Host \ Target | Windows | macOS | Linux |
|---|---|---|---|
| **Windows** | ✅ native | ⚠️ not supported | ⚠️ via Docker |
| **macOS** | ⚠️ needs Wine | ✅ native | ✅ native |
| **Linux** | ⚠️ needs Wine | ❌ (signing limited) | ✅ native |

**Rule of thumb:** build each platform on its own OS, or use CI (GitHub Actions with a matrix of `windows-latest` / `macos-latest` / `ubuntu-latest`). Codesigning (notarization on macOS, EV cert on Windows) is out of scope for local builds.

### 3.5 Build stages (what `npm run build` does)

| Script | Tool | Output |
|---|---|---|
| `build:main` | esbuild | `dist/main.js`, `dist/preload.js` (Node/CJS; `electron` + `node-sqlite3-wasm` external) |
| `build:renderer` | esbuild | `dist/renderer/*.js` (browser/IIFE) |
| `build:css` | Tailwind | `dist/renderer/styles.css` (minified) |
| `copy:html` | node | copies `src/renderer/*.html` → `dist/renderer/` |

The `icon` script (`node scripts/make-icon.js`) generates `build/icon.ico` + `build/icon.png` in code — no binary assets are committed.

---

## 4. Android app — build

An Android app is built with **Gradle** (via the bundled wrapper — no separate Gradle install). You can build from **Android Studio** or the **command line**.

### 4.1 First-time setup

```bash
# Open the android/ folder in Android Studio once, OR create local.properties:
#   android/local.properties
#   sdk.dir=C\:\\Users\\<You>\\AppData\\Local\\Android\\Sdk     (Windows)
#   sdk.dir=/Users/<You>/Library/Android/sdk                    (macOS)
#   sdk.dir=/home/<You>/Android/Sdk                            (Linux)
```

JDK **17+** is required. Android Studio's bundled JDK works; for CLI builds point `JAVA_HOME` at a JDK 17+.

### 4.2 Build & install

Run inside the **`android/`** folder. On Windows use `gradlew.bat`; on macOS/Linux use `./gradlew`.

| Goal | Command | Output |
|---|---|---|
| Debug APK | `gradlew.bat assembleDebug` | `app/build/outputs/apk/debug/app-debug.apk` |
| Release APK | `gradlew.bat assembleRelease` | `app/build/outputs/apk/release/app-release.apk` |
| Release AAB (Play Store) | `gradlew.bat bundleRelease` | `app/build/outputs/bundle/release/app-release.aab` |
| Install on connected phone | `gradlew.bat installDebug` | installs debug build via adb |
| Unit tests | `gradlew.bat test` | JUnit report under `app/build/` |
| Clean | `gradlew.bat clean` | removes `app/build/` |

List connected devices (if `adb` is on PATH): `adb devices`.

### 4.3 Signed release build

`android/app/build.gradle.kts` already supports signing **when a `keystore.properties` file exists**; without it, the release APK is left unsigned (still builds).

One-time keystore:

```bash
keytool -genkeypair -v -keystore dailyplanner-release.jks \
  -alias dailyplanner -keyalg RSA -keysize 2048 -validity 10000
```

Then create `android/keystore.properties`:

```properties
storeFile=dailyplanner-release.jks
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=dailyplanner
keyPassword=YOUR_KEY_PASSWORD
```

Now `gradlew.bat assembleRelease` produces a **signed** APK. Keep the `.jks` and passwords out of git.

### 4.4 Install the APK on a phone

```bash
adb install -r "app/build/outputs/apk/release/app-release.apk"
adb uninstall com.example.dailyplanner   # to remove
```

Or copy the APK to the phone and open it (enable "Install unknown apps" for the file manager).

### 4.5 Regenerate launcher icons

```bash
# from the repo root
node scripts/make-android-icons.js
```

Writes `mipmap-*` raster icons (needed for Android 7.x on `minSdk 24`) into `android/app/src/main/res/`.

> Full walkthrough (emulator, real device, debugger, Logcat, troubleshooting) is in [`android/README.md`](android/README.md).

---

## 5. Common commands

### Desktop (repo root)

| Command | Meaning |
|---|---|
| `npm install` | Install dependencies |
| `npm run build` | Build `dist/` (main + renderer + CSS + HTML) |
| `npm run dev` / `npm start` | Build then launch Electron |
| `npm run dist:win` | Windows NSIS installer → `release/` |
| `npm run pack:win` | Windows unpacked dir → `release/win-unpacked/` |
| `npm run icon` | Regenerate desktop icons (`build/icon.ico`, `icon.png`) |
| `npm run icon:android` | Regenerate Android mipmap icons |
| `npx tsc --noEmit` | Type-check without emitting |

### Android (inside `android/`)

| Command | Meaning |
|---|---|
| `gradlew.bat tasks` | List available Gradle tasks |
| `gradlew.bat assembleDebug` | Build debug APK |
| `gradlew.bat assembleRelease` | Build (signed, if configured) release APK |
| `gradlew.bat installDebug` | Build + install on connected device |
| `gradlew.bat test` | Unit tests |
| `gradlew.bat clean` | Clean build outputs |

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `npm install` fails on `node-sqlite3-wasm` | Ensure Node 18+; this package is prebuilt WASM — no compiler needed. Delete `node_modules` + `package-lock.json` and retry. |
| Desktop app window is blank | Run `npm run build` first (or `npm run dev`, which builds automatically). |
| macOS/Linux build fails | `electron-builder.config.js` has no `mac`/`linux` block yet — see [§3.3](#33-build-per-platform); build on the matching OS. |
| `SDK location not found` (Android) | Create `android/local.properties` with `sdk.dir=...` or set `ANDROID_HOME`. |
| Android `Unsupported class file major version` | Use JDK **17+** (Android Studio → Gradle JDK setting). |
| `INSTALL_FAILED_OLDER_SDK` | Phone is below Android 7.0 (API 24) — the minimum supported. |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Different signing key installed; `adb uninstall com.example.dailyplanner` then reinstall. |
| Gradle download times out | First run downloads Gradle 8.14; check network/proxy to `services.gradle.org`, `*.google.com`, `repo.maven.apache.org`. |

---

## Project layout (short)

```
DailyPlanner/
├── src/                     Electron/TypeScript sources (main, renderer, database, legacy import)
├── scripts/                 Icon generators, HTML copy helper, dev test helpers
├── dist/                    esbuild output (generated by `npm run build`)
├── release/                 electron-builder artifacts (generated)
├── electron-builder.config.js
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── android/                 Native Android app (Kotlin + Compose + Room)
    ├── app/                 App module (build.gradle.kts, sources, res)
    ├── gradle/wrapper/      Pinned Gradle 8.14
    ├── gradlew / gradlew.bat
    ├── settings.gradle.kts
    ├── build.gradle.kts     Plugin versions (AGP 8.13, Kotlin 2.1, KSP)
    └── README.md            Detailed Android guide
```
