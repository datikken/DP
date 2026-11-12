# DailyPlanner — Android App

This folder contains a **native Android** version of the **DailyPlanner** app (the original desktop version lives in the repository root and is built with Electron).

It is written in **Kotlin** using **Jetpack Compose** for the user interface, **Room** (a SQLite wrapper) for local storage, **OkHttp** for the HTTP status checks, and **BCrypt** for password hashing.

If you have never built an Android app before, this document walks you through **everything** from installing the tools to getting a working `.apk` file onto a real phone.

---

## Table of Contents

1. [What you are looking at](#1-what-you-are-looking-at)
2. [Minimum Android version supported](#2-minimum-android-version-supported)
3. [Prerequisites (install these once)](#3-prerequisites-install-these-once)
4. [Opening the project in Android Studio](#4-opening-the-project-in-android-studio)
5. [Running and debugging on an emulator (virtual phone)](#5-running-and-debugging-on-an-emulator-virtual-phone)
6. [Running and debugging on a real Android phone](#6-running-and-debugging-on-a-real-android-phone)
7. [Using the debugger (breakpoints, Logcat)](#7-using-the-debugger-breakpoints-logcat)
8. [Building an APK to install on a phone](#8-building-an-apk-to-install-on-a-phone)
9. [Where the files end up](#9-where-the-files-end-up)
10. [Troubleshooting](#10-troubleshooting)
11. [Project structure (for orientation)](#11-project-structure-for-orientation)

---

## 1. What you are looking at

```
android/
├── app/                      The Android application module
│   ├── build.gradle.kts      App config: dependencies, versions, SDK level
│   └── src/main/
│       ├── AndroidManifest.xml   Declares the entry activity + permissions
│       ├── java/com/example/dailyplanner/  All the Kotlin source code
│       └── res/                  Icons, strings, themes (XML resources)
├── build.gradle.kts          Top-level build config + plugin versions
├── settings.gradle.kts       Tells Gradle this is a single-module project
├── gradle.properties         Gradle tuning flags
├── gradle/wrapper/           Pins the Gradle version (8.14) - do not edit by hand
├── gradlew / gradlew.bat     Command-line build launchers (Linux/macOS / Windows)
└── README.md                 This file
```

Key facts:

| Property | Value |
|---|---|
| Application ID (package) | `com.example.dailyplanner` |
| App display name | **DailyPlanner** |
| Language | Kotlin |
| UI framework | Jetpack Compose (Material 3) |
| Database | Room (SQLite) |
| **Minimum Android version (`minSdk`)** | **24 — Android 7.0 "Nougat"** |
| `compileSdk` / `targetSdk` | 35 (Android 15) |
| Build tool | Gradle 8.14 via Gradle Wrapper |
| Android Gradle Plugin | 8.13.0 |
| Kotlin | 2.1.0 |
| Java / JDK required | **JDK 17 or newer** |

> You do **not** need to install Gradle separately — the wrapper (`gradlew`) downloads the correct version automatically.

---

## 2. Minimum Android version supported

- **Minimum: Android 7.0 (API level 24).**
- This is set by `minSdk = 24` in `android/app/build.gradle.kts`.
- The app will install and run on **every Android phone from 7.0 upward**, including 8, 9, 10, 11, 12, 13, 14, 15.
- It will **not** install on Android 6.0 or older.

If you ever need to support older devices you would lower `minSdk`, but be aware some libraries (Compose, DataStore) may require a higher minimum. As configured, **Android 7.0+ is the supported range.**

---

## 3. Prerequisites (install these once)

You need **two** things on your computer:

### 3.1 Android Studio

Android Studio is Google's official IDE for Android and bundles almost everything you need (the Android SDK, an emulator, and a matching JDK).

1. Download the latest stable version from <https://developer.android.com/studio>.
2. Run the installer and accept the defaults.
3. Launch Android Studio once. On first run it will walk you through the **Setup Wizard**:
   - Choose **Standard** installation.
   - Let it download the **Android SDK**, **SDK Platform**, **Build-Tools**, and the **emulator** when asked. This can be a few gigabytes and may take a while.

> Android Studio on recent versions bundles a JDK. **You do not normally need to install Java separately.** If you prefer a stand-alone JDK, install **JDK 17** or newer (Temurin/Adoptium is a good choice).

### 3.2 (Optional) For real devices only

- The USB cable that came with your phone.
- The phone must allow "developer options" (covered in [section 6](#6-running-and-debugging-on-a-real-android-phone)).

### 3.3 Verify the SDK location

Android Studio normally creates a `local.properties` file in the project root automatically when you open the project. It contains the path to your Android SDK, for example:

```properties
# android/local.properties  (created by Android Studio; not committed to git)
sdk.dir=C\:\\Users\\YourName\\AppData\\Local\\Android\\Sdk
```

If you build from the **command line** and Gradle complains the SDK is not found, create this file yourself with your SDK path, or set the `ANDROID_HOME` / `ANDROID_SDK_ROOT` environment variable.

---

## 4. Opening the project in Android Studio

1. Open **Android Studio**.
2. On the welcome screen click **Open** (or **File > Open...** if a project is already open).
3. Navigate to **this `android/` folder** (the folder containing `settings.gradle.kts` and `gradlew`) and select it. **Do not** open the repository root — open the `android` subfolder.
4. Click **OK**. Android Studio will:
   - Detect it is a Gradle project.
   - Ask whether to **Trust** the project — click **Trust Project**.
   - Start **Gradle sync** (a progress bar at the bottom). The first sync downloads all dependencies and can take several minutes.
5. Wait until the status bar says **"Gradle sync finished"** and the "Sync" progress bar disappears.
6. If it asks to **install a missing SDK platform / build-tools**, click the link it offers and let it install.

When sync is done you'll see the project tree on the left with **app** as the module and the Kotlin files under `app > java > com.example.dailyplanner`.

> **Switching to the "Project" view:** By default the project pane shows an "Android" view that groups things nicely. If you want the raw folder view (matching the tree in [section 11](#11-project-structure-for-orientation)), change the dropdown at the top of the project pane from **Android** to **Project**.

---

## 5. Running and debugging on an emulator (virtual phone)

An emulator is a virtual Android phone that runs on your computer — no physical device needed.

### 5.1 Create an emulator (virtual device) — once

1. In Android Studio open **Device Manager**: menu **View > Tool Windows > Device Manager** (or the phone icon in the toolbar).
2. Click **Create Device** (a `+` sign).
3. Pick a hardware profile, e.g. **Pixel 7** > **Next**.
4. Pick a system image. Choose a recent one such as **API 35** (or API 34). If it shows a download arrow, click **Download** and accept the license. > **Next**.
5. Give it a name, click **Finish**.
6. Back in Device Manager, click the **Play** button next to your new device to boot it. First boot can take a minute or two.

### 5.2 Run the app on the emulator

1. In the toolbar at the top you'll see a dropdown of run targets. Make sure it shows your emulator (e.g. `Pixel 7 API 35`).
2. Make sure the run configuration next to it is **app**.
3. Click the green **Run** button (or press **Shift + F10**).

Android Studio will:

- Compile the Kotlin code and build a debug APK,
- Install it on the emulator,
- Launch it.

You should see the **Welcome** sign-in screen of DailyPlanner. Create an account (username of 3+ characters, password of 4+ characters), then start adding links.

### 5.3 Debug on the emulator

- Click the **Debug** button (or **Shift + F9**) instead of Run to launch under the debugger. See [section 7](#7-using-the-debugger-breakpoints-logcat).

---

## 6. Running and debugging on a real Android phone

This is the most useful way to test, because it uses real hardware, real networking and real performance.

### 6.1 Enable Developer Options on the phone

1. Open the phone **Settings > About phone**.
2. Find **Build number** (on some phones it's under *About phone > Software information > Build number*).
3. **Tap "Build number" 7 times.** You'll see "You are now a developer!".
4. Go back to the main **Settings** screen; you'll now see **Developer options** (often under **Settings > System > Developer options**).

### 6.2 Enable USB debugging

1. Open **Developer options**.
2. Turn on **USB debugging**.
3. (Recommended) Also turn on **Stay awake** so the screen doesn't lock while connected.

### 6.3 Connect and authorise

1. Plug the phone into the computer with a **data** USB cable (some cables are charge-only and won't work).
2. On the phone, a dialog appears: **"Allow USB debugging?"** — tap **Allow** (tick "Always allow from this computer" for convenience).
   - If no dialog appears, try unplugging/replugging, or tap "Revoke USB debugging authorizations" then replug.
3. When connected, the phone should appear in Android Studio's device dropdown in the toolbar.

> **USB mode:** On some phones you must change the USB connection mode to **"File transfer / MTP"** (pull down the notification shade, tap the USB notification) before the computer can talk to it.

### 6.4 Run on the phone

1. Select your **physical device** from the device dropdown in the toolbar.
2. Select the **app** run configuration.
3. Click **Run** (or **Shift + F10**).

Android Studio builds the debug APK, installs it on the phone, and launches it. The app icon **DailyPlanner** will also appear in the phone's app drawer.

### 6.5 Debug on the phone

Click the **Debug** button (or **Shift + F9**). Execution stops at any breakpoints you set. See the next section.

---

## 7. Using the debugger (breakpoints, Logcat)

### 7.1 Breakpoints

1. Open a Kotlin file, e.g. `app/src/main/java/com/example/dailyplanner/ui/AppViewModel.kt`.
2. Click in the **gutter** (the grey strip left of the line numbers) next to a line — a **red dot** appears (a breakpoint).
3. Launch with the **Debug** button (**Shift + F9**) on either the emulator or your phone.
4. When execution reaches the breakpoint, the app pauses and you can:
   - Inspect variables in the **Variables** pane,
   - Step over/into/out using the buttons (**F8** step over, **F7** step into, **Shift + F8** step out),
   - Evaluate expressions in the **Evaluate** window,
   - Continue with **F9**.

Common places to set breakpoints while exploring:

- `AppViewModel.submitAuth(...)` — the login/registration flow.
- `AppViewModel.checkLink(...)` / `refreshAll()` — HTTP status check.
- `LinkRepository.createLink(...)` / `reorderLinks(...)` — database writes.

### 7.2 Logcat (application logs and crashes)

Open **Logcat** via **View > Tool Windows > Logcat** (bottom of the IDE).

- Filter by the app's package: type `com.example.dailyplanner` in the Logcat search box, or select your device + app in the process dropdown.
- Crash stack traces appear here in red. This is the first place to look if the app closes unexpectedly.
- You can also filter by level (Verbose/Debug/Info/Warn/Error).

### 7.3 Device Explorer (app files and database)

**View > Tool Windows > Device Explorer** lets you browse the app's private storage on a **debuggable** device/emulator, including the Room database (usually under `/data/data/com.example.dailyplanner/databases/`). This is handy to confirm data was saved.

---

## 8. Building an APK to install on a phone

An **APK** is the installable app package. You can build two kinds:

- **Debug APK** — quick, for your own testing; signed with a standard debug key. Cannot be published to the Play Store.
- **Release APK** — optimised; must be **signed** with your own key; required for distribution.

### 8.1 Build a Debug APK

**From Android Studio:**

- Menu **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
- When it finishes, a notification appears with a **locate** link. The file is:

  ```
  android/app/build/outputs/apk/debug/app-debug.apk
  ```

**From the command line** (inside the `android/` folder):

```bash
# macOS / Linux
./gradlew assembleDebug

# Windows (PowerShell / cmd)
gradlew.bat assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

### 8.2 Build a Release APK (properly signed)

A release build must be signed with a **keystore** (a file holding your signing key). Keep this key safe — you need the same key for every future update.

**Step 1 — create a keystore (one time).** In a terminal, from the `android/` folder:

```bash
keytool -genkeypair -v \
  -keystore dailyplanner-release.jks \
  -alias dailyplanner \
  -keyalg RSA -keysize 2048 -validity 10000
```

On Windows PowerShell the same command works if `keytool` is on your PATH (it comes with the JDK bundled in Android Studio). If not, use the full path, e.g.:

```
"C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore dailyplanner-release.jks -alias dailyplanner -keyalg RSA -keysize 2048 -validity 10000
```

You will be asked for:
- A **keystore password** (remember it),
- Your name/organisation details (any values are fine for a personal app),
- A **key password** (can be the same as the keystore password).

This creates `dailyplanner-release.jks`. **Do not commit this file or its passwords to git.**

**Step 2 — tell Gradle how to sign.** Create a file `android/keystore.properties` (also not committed):

```properties
storeFile=dailyplanner-release.jks
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=dailyplanner
keyPassword=YOUR_KEY_PASSWORD
```

Then add a signing config to `android/app/build.gradle.kts`. Insert this **inside the `android { ... }` block, before `buildTypes`**:

```kotlin
import java.util.Properties

// ... near the top of the file, after the plugins block:
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) {
        keystorePropsFile.inputStream().use { load(it) }
    }
}

android {
    // ... existing config ...

    signingConfigs {
        create("release") {
            if (keystorePropsFile.exists()) {
                storeFile = rootProject.file(keystoreProps["storeFile"] as String)
                storePassword = keystoreProps["storePassword"] as String
                keyAlias = keystoreProps["keyAlias"] as String
                keyPassword = keystoreProps["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Use the release signing config when keystore.properties was found.
            if (keystorePropsFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

> The `if (keystorePropsFile.exists())` guards let the project still build for anyone who hasn't set up a keystore (it just won't sign the release build).

**Step 3 — build the release APK.**

From Android Studio: **Build > Generate Signed Bundle / APK...** > choose **APK** > follow the wizard (select your `.jks`, enter passwords) > **release** > **Finish**.

Or from the command line:

```bash
# macOS / Linux
./gradlew assembleRelease

# Windows
gradlew.bat assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`.

### 8.3 Install the APK on a phone

**Option A — copy the file to the phone**

1. Transfer `app-debug.apk` or `app-release.apk` to the phone (USB, email, cloud drive, etc.).
2. On the phone, open the file with the **Files** app.
3. Android will warn about installing from unknown sources. Tap **Settings** in the prompt and allow the app you're installing from (Files / Chrome / Drive) to **install unknown apps**.
4. Tap **Install**. The **DailyPlanner** icon appears in the app drawer.

**Option B — install over USB with `adb` (Android Debug Bridge)**

With the phone connected and USB debugging enabled:

```bash
# If adb is not on your PATH, it lives in your SDK:
#   <SDK>/platform-tools/adb   (Windows: adb.exe)

adb install -r "app/build/outputs/apk/release/app-release.apk"
```

- `-r` means "reinstall, keeping existing app data" (handy for updates).
- To uninstall: `adb uninstall com.example.dailyplanner`.

> **Debug vs Release on a real phone:** A debug APK installs fine but is signed with a generic debug key. If you have Play Protect enabled, the phone may show a caution for sideloaded apps; that's expected. Use a properly signed **release** APK for anything beyond personal testing.

---

## 9. Where the files end up

| Build | Task | Output path (relative to `android/`) |
|---|---|---|
| Debug APK | `assembleDebug` | `app/build/outputs/apk/debug/app-debug.apk` |
| Release APK | `assembleRelease` | `app/build/outputs/apk/release/app-release.apk` |
| Signed AAB (Play Store) | `bundleRelease` | `app/build/outputs/bundle/release/app-release.aab` |

The `build/` directory is generated and safe to delete (Android Studio / Gradle recreates it).

### Handy command-line reference (run inside `android/`)

```bash
# Build debug APK
./gradlew assembleDebug

# Build release APK (after signing setup)
./gradlew assembleRelease

# Install debug build on the connected device
./gradlew installDebug

# Run unit tests
./gradlew test

# Clean all build output
./gradlew clean

# List connected devices
adb devices
```

On Windows use `gradlew.bat` instead of `./gradlew`.

---

## 10. Troubleshooting

**"Gradle sync failed" / dependencies won't download**

- Check your internet connection.
- **File > Sync Project with Gradle Files** to retry.
- Ensure you accepted any SDK/licence prompts.
- Corporate proxy/VPN/firewall can block Google Maven — allow `*.google.com`, `repo.maven.apache.org`, `plugins.gradle.org`.

**"SDK location not found"**

- Open the project via Android Studio (it writes `local.properties`), or create `android/local.properties` manually with `sdk.dir=/path/to/Android/Sdk`.
- On Windows, escape backslashes: `sdk.dir=C\:\\Users\\You\\AppData\\Local\\Android\\Sdk`.

**"Unsupported class file major version" / JDK errors**

- The project needs **JDK 17+**. In Android Studio: **Settings > Build, Execution, Deployment > Build Tools > Gradle > Gradle JDK** > choose the bundled **jbr-17** (or any 17+ JDK), then sync again.

**Device not showing up**

- Try another USB cable (must be a data cable).
- Enable **USB debugging**, and set USB mode to **File transfer / MTP**.
- Run `adb kill-server` then `adb devices` to restart the bridge.
- Accept the "Allow USB debugging" prompt on the phone.

**App installs but crashes immediately**

- Open **Logcat**, filter by `com.example.dailyplanner`, and read the first red stack trace. It usually names the exact class/line.

**`INSTALL_FAILED_UPDATE_INCOMPATIBLE`**

- A different signing key is already installed. Uninstall the old copy first:
  `adb uninstall com.example.dailyplanner`, then install again.

**`INSTALL_FAILED_OLDER_SDK`**

- The phone is older than **Android 7.0 (API 24)** — the minimum supported version.

**Compose compile error referencing the compiler version**

- Kotlin 2.x uses the **Compose Compiler Gradle plugin** (already configured). Don't add a `composeOptions { kotlinCompilerExtensionVersion = ... }` block — it's obsolete with Kotlin 2.x.

---

## 11. Project structure (for orientation)

All source is under `app/src/main/java/com/example/dailyplanner/`:

```
MainActivity.kt          Entry point; sets the Compose theme and content.
ui/
  AppRoot.kt             Decides: sign-in screen vs. links screen.
  AppViewModel.kt        All screen state and actions (the "brain").
  auth/AuthScreen.kt     Sign-in / register UI.
  links/
    LinksScreen.kt       Main screen layout (sidebar + detail).
    SidebarList.kt       The scrollable, drag-reorderable link list.
    SidebarHeader.kt     "DailyPlanner" header with New / re-check-all buttons.
    DetailPanel.kt       Right-hand detail + delete confirmation.
    LinkEditorDialog.kt  Create/edit dialog.
    StatusCircle.kt      The coloured HTTP status dot.
    StatusHelpers.kt     Status to colour/label helpers.
  theme/Theme.kt         Colour palette + Material 3 theme.
data/
  Models.kt              Domain models (Link, results, inputs).
  LinkRepository.kt      Auth + link CRUD logic (the "database layer").
  LinkChecker.kt         Performs HTTP GET and reads the status code.
  SessionStore.kt        Remembers the last logged-in user.
  db/
    AppDatabase.kt       Room database + migration history.
    Entities.kt          Table definitions + row-to-domain mapping.
    LinkDao.kt           Link queries.
    UserDao.kt           User queries.
util/
  UrlValidation.kt       URL validation/normalisation.
```

### What the app does (quick tour)

1. **Sign in or register** (username of 3+ characters, password of 4+ characters; passwords are BCrypt-hashed; stored locally in SQLite).
2. **Add links** with a URL and optional name.
3. **Check a link's HTTP status** by tapping its status circle — a coloured dot shows 2xx/3xx/4xx/5xx.
4. **Pin** important links to the top, and **drag to reorder** links within their group.
5. **Re-check all** links with the refresh button in the sidebar.
6. **Open** a link in the phone's browser.
7. The last logged-in account is remembered, so reopening the app skips sign-in until you log out.

All data is stored **locally on the device** — there is no server or cloud sync.

---

## Minimum requirements at a glance

| Requirement | Value |
|---|---|
| **Minimum Android OS on the phone** | **Android 7.0 (API 24)** |
| Android Studio | Latest stable |
| JDK | **17 or newer** (bundled with Android Studio is fine) |
| Gradle | 8.14 (auto-downloaded by the wrapper) |
| Internet | Required for first build (dependency download) and for HTTP status checks |
| Disk | A few GB for the SDK, emulator, and build cache |
