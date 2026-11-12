package com.example.dailyplanner.ui.links

import androidx.compose.ui.graphics.Color
import com.example.dailyplanner.ui.theme.Base600
import com.example.dailyplanner.ui.theme.GreenSuccess
import com.example.dailyplanner.ui.theme.RedError
import com.example.dailyplanner.ui.theme.Slate300
import com.example.dailyplanner.ui.theme.YellowWarning

/**
 * Status helpers ported from links.ts: a status code drives a colour, and a
 * badge class is chosen from the same ranges.
 */

/** Ring / dot colour for the status circle. */
fun statusRingColor(status: Int?): Color = when {
    status == null -> Base600
    status == 0 -> RedError                 // request failed
    status in 200..299 -> GreenSuccess
    status in 300..399 -> YellowWarning
    status >= 400 -> RedError
    else -> Base600
}

/** Background + foreground colours for the status badge. */
fun statusBadgeColors(status: Int?): Pair<Color, Color> = when {
    status == null -> Base600 to Slate300
    status in 200..299 -> GreenSuccess.copy(alpha = 0.2f) to Color(0xFF4ADE80)
    status in 300..399 -> YellowWarning.copy(alpha = 0.2f) to Color(0xFFFACC15)
    status >= 400 -> RedError.copy(alpha = 0.2f) to Color(0xFFF87171)
    else -> Base600 to Slate300
}

/** "n/a" when never checked, otherwise the code. */
fun statusLabel(status: Int?): String = status?.toString() ?: "n/a"

/** Empty placeholder for missing timestamps in the detail panel. */
fun fmt(value: String?): String = value.orEmpty()

