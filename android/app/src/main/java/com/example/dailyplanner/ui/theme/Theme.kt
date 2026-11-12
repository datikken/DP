package com.example.dailyplanner.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Colour palette ported from the original tailwind.config.js.
val Base900 = Color(0xFF1E1E2F)
val Base800 = Color(0xFF25253A)
val Base700 = Color(0xFF2D2D44)
val Base600 = Color(0xFF3A3A55)

val Brand = Color(0xFF6C5CE7)
val BrandDark = Color(0xFF5A4BD4)
val BrandLight = Color(0xFFA29BFE)

val Slate100 = Color(0xFFF1F5F9)
val Slate200 = Color(0xFFE2E8F0)
val Slate300 = Color(0xFFCBD5E1)
val Slate400 = Color(0xFF94A3B8)
val Slate500 = Color(0xFF64748B)

val GreenSuccess = Color(0xFF22C55E)
val GreenLight = Color(0xFF4ADE80)
val YellowWarning = Color(0xFFFACC15)
val RedError = Color(0xFFEF4444)
val RedLight = Color(0xFFF87171)

private val DailyPlannerColorScheme = darkColorScheme(
    primary = Brand,
    onPrimary = Color.White,
    primaryContainer = BrandDark,
    onPrimaryContainer = Color.White,
    secondary = BrandLight,
    background = Base900,
    onBackground = Slate200,
    surface = Base800,
    onSurface = Slate200,
    surfaceVariant = Base700,
    onSurfaceVariant = Slate400,
    outline = Base600,
    error = RedError,
    onError = Color.White
)

@Composable
fun DailyPlannerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DailyPlannerColorScheme,
        content = content
    )
}
