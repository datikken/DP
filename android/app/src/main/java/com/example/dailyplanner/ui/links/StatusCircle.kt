package com.example.dailyplanner.ui.links

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.dailyplanner.ui.theme.Brand

/**
 * Clickable status "circle". Clicking it (re)runs the HTTP check for that link;
 * a spinner shows while a check is in flight. Ported from makeStatusCircle().
 */
@Composable
fun StatusCircle(
    status: Int?,
    isChecking: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val ringColor = if (isChecking) Brand.copy(alpha = 0.5f) else statusRingColor(status)
    val fillColor = if (isChecking) Color.Transparent else ringColor

    Box(
        modifier = modifier
            .size(24.dp)
            .clip(CircleShape)
            .background(fillColor)
            .border(2.dp, ringColor, CircleShape)
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        when {
            isChecking -> CircularProgressIndicator(
                color = Brand,
                strokeWidth = 2.dp,
                modifier = Modifier.size(14.dp)
            )

            status != null -> Text(
                text = status.toString(),
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.9f)
            )
        }
    }
}
