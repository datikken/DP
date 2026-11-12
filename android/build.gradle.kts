// Top-level build file. Plugin versions are declared once here and applied
// per-module in app/build.gradle.kts.
//
// Version notes:
//  - AGP 8.13 supports the JDK 25 bundled with recent Android Studio.
//  - Kotlin 2.x uses the Compose Compiler Gradle plugin (no more
//    kotlinCompilerExtensionVersion); that plugin is applied in app/.
plugins {
    id("com.android.application") version "8.13.0" apply false
    id("org.jetbrains.kotlin.android") version "2.1.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.0" apply false
    id("com.google.devtools.ksp") version "2.1.0-1.0.29" apply false
}

