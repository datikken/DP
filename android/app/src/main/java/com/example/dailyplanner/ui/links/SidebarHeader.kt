package com.example.dailyplanner.ui.links

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.dailyplanner.ui.theme.Base600
import com.example.dailyplanner.ui.theme.Base800
import com.example.dailyplanner.ui.theme.Brand
import com.example.dailyplanner.ui.theme.BrandLight
import com.example.dailyplanner.ui.theme.Slate300
import com.example.dailyplanner.ui.theme.Slate500

/** Header of the sidebar: title, "re-check all" spinner, and "New" button. */
@Composable
fun SidebarHeader(
    refreshingAll: Boolean,
    onCreate: () -> Unit,
    onRefreshAll: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Base800)
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = "DailyPlanner",
            fontSize = 20.sp,
            fontWeight = FontWeight.ExtraBold,
            color = BrandLight
        )

        Row(verticalAlignment = Alignment.CenterVertically) {
            // Re-check all
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Base600)
                    .clickable(enabled = !refreshingAll, onClick = onRefreshAll),
                contentAlignment = Alignment.Center
            ) {
                if (refreshingAll) {
                    CircularProgressIndicator(
                        color = Brand,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(16.dp)
                    )
                } else {
                    Icon(
                        imageVector = Icons.Filled.Refresh,
                        contentDescription = "Re-check all links",
                        tint = Slate300,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            // New link
            Box(
                modifier = Modifier
                    .padding(start = 8.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Brand)
                    .clickable(onClick = onCreate)
                    .padding(horizontal = 12.dp, vertical = 7.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Filled.Add,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = "New",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White
                    )
                }
            }
        }
    }
}
