package com.example.dailyplanner.ui.links

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.dailyplanner.data.Link
import com.example.dailyplanner.ui.AppUiState
import com.example.dailyplanner.ui.LinkEditorState
import com.example.dailyplanner.ui.theme.Base700
import com.example.dailyplanner.ui.theme.Base800
import com.example.dailyplanner.ui.theme.Base900
import com.example.dailyplanner.ui.theme.Brand
import com.example.dailyplanner.ui.theme.RedLight
import com.example.dailyplanner.ui.theme.Slate200
import com.example.dailyplanner.ui.theme.Slate500

/**
 * The main links screen: a sidebar list and a detail panel. On wide screens
 * they sit side by side (as in the original 880x600 window); on phones the
 * detail panel is on top and the sidebar below.
 */
@Composable
fun LinksScreen(
    state: AppUiState,
    onSelect: (Long) -> Unit,
    onCreate: () -> Unit,
    onEdit: (Link) -> Unit,
    onDelete: (Link) -> Unit,
    onCheck: (Long) -> Unit,
    onRefreshAll: () -> Unit,
    onTogglePin: (Link) -> Unit,
    onReorder: (List<Long>) -> Unit,
    onSearchQueryChange: (String) -> Unit,
    onLogout: () -> Unit,
    onDismissMessage: () -> Unit,
    onOpenExternal: (Context, String) -> Unit,
    onUpdateEditor: ((LinkEditorState) -> LinkEditorState) -> Unit,
    onSubmitEditor: () -> Unit,
    onCloseEditor: () -> Unit
) {
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    // Surface transient messages as a snackbar (colour reflects error state).
    val currentMessage = state.message
    LaunchedEffect(currentMessage) {
        if (currentMessage == null) return@LaunchedEffect
        snackbarHostState.showSnackbar(currentMessage.text)
        onDismissMessage()
    }

    var pendingDelete by remember { mutableStateOf<Link?>(null) }

    val isWide = LocalConfiguration.current.screenWidthDp >= 720

    Box(Modifier.fillMaxSize().background(Base900)) {
        if (isWide) {
            Row(Modifier.fillMaxSize()) {
                Sidebar(
                    state = state,
                    modifier = Modifier.width(320.dp).fillMaxHeight(),
                    onSelect = onSelect,
                    onCreate = onCreate,
                    onCheck = onCheck,
                    onRefreshAll = onRefreshAll,
                    onTogglePin = onTogglePin,
                    onReorder = onReorder,
                    onSearchQueryChange = onSearchQueryChange
                )
                VerticalDivider(color = Base700)

                DetailPanel(
                    state = state,
                    modifier = Modifier.weight(1f),
                    onEdit = onEdit,
                    onDelete = { pendingDelete = it },
                    onCheck = onCheck,
                    onOpenUrl = { onOpenExternal(context, it.url) },
                    onLogout = onLogout
                )
            }
        } else {
            Column(Modifier.fillMaxSize()) {
                DetailPanel(
                    state = state,
                    modifier = Modifier.weight(3f),
                    onEdit = onEdit,
                    onDelete = { pendingDelete = it },
                    onCheck = onCheck,
                    onOpenUrl = { onOpenExternal(context, it.url) },
                    onLogout = onLogout
                )
                HorizontalDivider(color = Base700)
                Sidebar(
                    state = state,
                    modifier = Modifier.fillMaxWidth().weight(2f),
                    onSelect = onSelect,
                    onCreate = onCreate,
                    onCheck = onCheck,
                    onRefreshAll = onRefreshAll,
                    onTogglePin = onTogglePin,
                    onReorder = onReorder,
                    onSearchQueryChange = onSearchQueryChange
                )
            }
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(16.dp)
        ) { data ->
            Snackbar(
                snackbarData = data,
                containerColor = if (currentMessage?.isError == true) {
                    RedLight.copy(alpha = 0.15f)
                } else {
                    Base700
                }
            )
        }

        pendingDelete?.let { link ->
            ConfirmDeleteDialog(
                link = link,
                onConfirm = {
                    onDelete(link)
                    pendingDelete = null
                },
                onDismiss = { pendingDelete = null }
            )
        }

        state.editor?.let { editor ->
            LinkEditorDialog(
                editor = editor,
                onUpdate = onUpdateEditor,
                onSubmit = onSubmitEditor,
                onDismiss = onCloseEditor
            )
        }
    }
}

@Composable
private fun Sidebar(
    state: AppUiState,
    modifier: Modifier = Modifier,
    onSelect: (Long) -> Unit,
    onCreate: () -> Unit,
    onCheck: (Long) -> Unit,
    onRefreshAll: () -> Unit,
    onTogglePin: (Link) -> Unit,
    onReorder: (List<Long>) -> Unit,
    onSearchQueryChange: (String) -> Unit
) {
    Column(modifier.background(Base800)) {
        SidebarHeader(
            refreshingAll = state.refreshingAll,
            onCreate = onCreate,
            onRefreshAll = onRefreshAll
        )
        HorizontalDivider(color = Base700)

        if (state.links.isNotEmpty()) {
            // Search box: filters the list by link name or URL.
            SearchField(
                query = state.searchQuery,
                onQueryChange = onSearchQueryChange
            )
            HorizontalDivider(color = Base700)
        }

        if (state.links.isEmpty()) {
            Box(
                Modifier.fillMaxWidth().weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    "No links yet.",
                    fontSize = 14.sp,
                    color = Slate500,
                    modifier = Modifier.padding(32.dp),
                    textAlign = TextAlign.Center
                )
            }
        } else {
            SidebarList(
                state = state,
                modifier = Modifier.weight(1f),
                onSelect = onSelect,
                onCheck = onCheck,
                onTogglePin = onTogglePin,
                onReorder = onReorder
            )
        }

        HorizontalDivider(color = Base700)
        Text(
            text = "${state.links.size} link(s)",
            fontSize = 12.sp,
            color = Slate500,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
        )
    }
}

/** Search input with a leading magnifier icon and a clear button. */
@Composable
private fun SearchField(
    query: String,
    onQueryChange: (String) -> Unit
) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        singleLine = true,
        placeholder = { Text("Search links…", fontSize = 14.sp, color = Slate500) },
        leadingIcon = {
            Icon(
                imageVector = Icons.Filled.Search,
                contentDescription = null,
                tint = Slate500,
                modifier = Modifier.size(18.dp)
            )
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                Icon(
                    imageVector = Icons.Filled.Close,
                    contentDescription = "Clear search",
                    tint = Slate500,
                    modifier = Modifier
                        .size(18.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .clickable { onQueryChange("") }
                )
            }
        },
        textStyle = LocalTextStyle.current.copy(fontSize = 14.sp, color = Slate200),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Brand,
            unfocusedBorderColor = Base700,
            focusedContainerColor = Base800,
            unfocusedContainerColor = Base800,
            cursorColor = Brand
        ),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search)
    )
}
