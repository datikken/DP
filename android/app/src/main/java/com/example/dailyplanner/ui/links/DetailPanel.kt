package com.example.dailyplanner.ui.links

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Public
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.dailyplanner.data.Link
import com.example.dailyplanner.ui.AppUiState
import com.example.dailyplanner.ui.theme.Base600
import com.example.dailyplanner.ui.theme.Base700
import com.example.dailyplanner.ui.theme.Base800
import com.example.dailyplanner.ui.theme.Base900
import com.example.dailyplanner.ui.theme.BrandLight
import com.example.dailyplanner.ui.theme.RedError
import com.example.dailyplanner.ui.theme.RedLight
import com.example.dailyplanner.ui.theme.Slate100
import com.example.dailyplanner.ui.theme.Slate200
import com.example.dailyplanner.ui.theme.Slate400
import com.example.dailyplanner.ui.theme.Slate500

/**
 * The right-hand detail area: greeting header + logout, then either the empty
 * state or the selected link's details (name, URL, status, timestamps). Ported
 * from the links.html main column.
 */
@Composable
fun DetailPanel(
    state: AppUiState,
    modifier: Modifier = Modifier,
    onEdit: (Link) -> Unit,
    onDelete: (Link) -> Unit,
    onCheck: (Long) -> Unit,
    onOpenUrl: (Link) -> Unit,
    onLogout: () -> Unit
) {
    Column(modifier.background(Base900)) {
        HeaderBar(
            username = state.session?.username,
            onLogout = onLogout
        )

        val link = state.selectedLink
        if (link == null) {
            Box(
                Modifier.fillMaxSize().padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "Select a link from the sidebar",
                        fontSize = 16.sp,
                        color = Slate500,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        "or create a new one with “+ New”.",
                        fontSize = 14.sp,
                        color = Slate500,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp)
            ) {
                DetailHeader(
                    link = link,
                    onEdit = { onEdit(link) },
                    onDelete = { onDelete(link) },
                    onOpenUrl = { onOpenUrl(link) }
                )
                Spacer(Modifier.height(16.dp))
                DetailMeta(
                    link = link,
                    isChecking = state.checkingIds.contains(link.id),
                    onCheck = { onCheck(link.id) },
                    onOpenUrl = { onOpenUrl(link) }
                )
            }
        }
    }
}

@Composable
private fun HeaderBar(username: String?, onLogout: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Base800)
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = if (username != null) "Welcome, $username!" else "Welcome back!",
            fontSize = 14.sp,
            color = Slate400
        )
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(Base600)
                .clickable(onClick = onLogout)
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            Text("Log out", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Slate200)
        }
    }
}

@Composable
private fun DetailHeader(
    link: Link,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onOpenUrl: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
    ) {
        Column(modifier = Modifier.weight(1f)) {
            if (link.name != null) {
                Text(
                    text = link.name,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate100,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Text(
                text = link.url,
                fontSize = 14.sp,
                color = BrandLight,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .padding(top = 4.dp)
                    .clickable(onClick = onOpenUrl)
            )
        }

        Row {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(Base600)
                    .clickable(onClick = onEdit)
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Text("Edit", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Slate200)
            }
            Spacer(Modifier.width(8.dp))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(RedError.copy(alpha = 0.2f))
                    .clickable(onClick = onDelete)
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Text("Delete", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = RedLight)
            }
        }
    }
}

@Composable
private fun DetailMeta(
    link: Link,
    isChecking: Boolean,
    onCheck: () -> Unit,
    onOpenUrl: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Base800)
            .padding(20.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth()) {
            MetaCell("HTTP Status", Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    StatusCircle(
                        status = link.httpStatus,
                        isChecking = isChecking,
                        onClick = onCheck,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(Modifier.width(8.dp))
                    if (link.httpStatus == 0) {
                        Text("Request failed", fontSize = 13.sp, color = RedLight)
                    } else {
                        val (bg, fg) = statusBadgeColors(link.httpStatus)
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .background(bg)
                                .padding(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text(
                                statusLabel(link.httpStatus),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = fg
                            )
                        }
                    }
                }
            }
            MetaCell("Last Check", Modifier.weight(1f)) {
                Text(fmt(link.lastCheck), fontSize = 14.sp, color = Slate200)
            }
        }
        Spacer(Modifier.height(16.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            MetaCell("Created", Modifier.weight(1f)) {
                Text(fmt(link.createdAt), fontSize = 14.sp, color = Slate200)
            }
            MetaCell("Updated", Modifier.weight(1f)) {
                Text(fmt(link.updatedAt), fontSize = 14.sp, color = Slate200)
            }
        }

        Spacer(Modifier.height(16.dp))
        // Open-in-browser action: hands the link to the system browser.
        Button(
            onClick = onOpenUrl,
            colors = ButtonDefaults.buttonColors(containerColor = Base700)
        ) {
            Icon(
                imageVector = Icons.Filled.Public,
                contentDescription = null,
                tint = Slate200,
                modifier = Modifier.size(18.dp)
            )
            Spacer(Modifier.width(8.dp))
            Text("Open in browser", color = Slate200, fontSize = 14.sp)
        }
    }
}

@Composable
private fun MetaCell(label: String, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(modifier) {
        Text(
            text = label.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = Slate500
        )
        Spacer(Modifier.height(4.dp))
        content()
    }
}

/** Confirmation dialog for deleting a link (replaces window.confirm). */
@Composable
fun ConfirmDeleteDialog(link: Link, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    val label = if (link.name != null) "link \"${link.name}\"" else "link \"${link.url}\""
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Base800,
        title = { Text("Delete link", color = Slate100) },
        text = { Text("Delete $label? This cannot be undone.", color = Slate200) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text("Delete", color = RedLight)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = Slate400)
            }
        }
    )
}
