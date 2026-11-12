package com.example.dailyplanner.ui.links

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.example.dailyplanner.data.Link
import com.example.dailyplanner.ui.AppUiState
import com.example.dailyplanner.ui.theme.Base700
import com.example.dailyplanner.ui.theme.Brand
import com.example.dailyplanner.ui.theme.BrandLight
import com.example.dailyplanner.ui.theme.Slate200
import com.example.dailyplanner.ui.theme.Slate500

/**
 * The scrollable sidebar list. Pinned links form a group above the unpinned
 * ones; reordering is confined to a link's own group, matching the original
 * rule that "pinning stays an explicit action".
 *
 * Reordering uses a long-press drag: the dragged row floats via a graphics
 * translation, and on release the new order for its group is computed and handed
 * to [onReorder] (with the other group's ids appended unchanged).
 */
@Composable
fun SidebarList(
    state: AppUiState,
    modifier: Modifier = Modifier,
    onSelect: (Long) -> Unit,
    onCheck: (Long) -> Unit,
    onTogglePin: (Link) -> Unit,
    onReorder: (List<Long>) -> Unit
) {
    // Group the *visible* (search-filtered) links for display.
    val visible = state.visibleLinks
    val pinned = visible.filter { it.pinned }
    val unpinned = visible.filterNot { it.pinned }
    val listState = rememberLazyListState()
    val density = LocalDensity.current

    var draggingId by remember { mutableStateOf<Long?>(null) }
    var dragOffset by remember { mutableStateOf(0f) }

    fun commitDrop() {
        val id = draggingId
        draggingId = null
        dragOffset = 0f
        if (id == null) return

        // Reordering works on the FULL lists (not the search-filtered view), so
        // row indices map to real positions regardless of the active query.
        val fullPinned = state.links.filter { it.pinned }
        val fullUnpinned = state.links.filterNot { it.pinned }
        val group = if (state.links.firstOrNull { it.id == id }?.pinned == true) fullPinned else fullUnpinned
        val fromIndex = group.indexOfFirst { it.id == id }
        if (fromIndex < 0) return

        // Map the accumulated vertical offset to a number of row slots.
        val rowHeightPx = with(density) { 56.dp.toPx() }
        val shift = (dragOffset / rowHeightPx).toInt()
        val toIndex = (fromIndex + shift).coerceIn(0, group.size - 1)
        if (toIndex == fromIndex) return

        val newGroup = group.toMutableList()
        val moved = newGroup.removeAt(fromIndex)
        newGroup.add(toIndex, moved)

        val pinnedIds = fullPinned.map { it.id }
        val unpinnedIds = fullUnpinned.map { it.id }
        if (moved.pinned) {
            onReorder(newGroup.map { it.id } + unpinnedIds)
        } else {
            onReorder(pinnedIds + newGroup.map { it.id })
        }
    }

    LazyColumn(modifier = modifier, state = listState) {
        if (visible.isEmpty() && state.searchQuery.isNotBlank()) {
            item {
                Text(
                    text = "No links match your search.",
                    fontSize = 14.sp,
                    color = Slate500,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 32.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            }
        }
        if (pinned.isNotEmpty()) {
            item { GroupHeader("Pinned", pinned.size) }
            groupRows(
                group = pinned,
                state = state,
                draggingId = draggingId,
                dragOffset = dragOffset,
                onStartDrag = { draggingId = it; dragOffset = 0f },
                onDrag = { dragOffset += it },
                onEndDrag = { commitDrop() },
                onSelect = onSelect,
                onCheck = onCheck,
                onTogglePin = onTogglePin
            )
            item { Spacer(Modifier.padding(bottom = 8.dp)) }
        }
        if (unpinned.isNotEmpty()) {
            if (pinned.isNotEmpty()) {
                item { GroupHeader("All links", unpinned.size) }
            }
            groupRows(
                group = unpinned,
                state = state,
                draggingId = draggingId,
                dragOffset = dragOffset,
                onStartDrag = { draggingId = it; dragOffset = 0f },
                onDrag = { dragOffset += it },
                onEndDrag = { commitDrop() },
                onSelect = onSelect,
                onCheck = onCheck,
                onTogglePin = onTogglePin
            )
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.groupRows(
    group: List<Link>,
    state: AppUiState,
    draggingId: Long?,
    dragOffset: Float,
    onStartDrag: (Long) -> Unit,
    onDrag: (Float) -> Unit,
    onEndDrag: () -> Unit,
    onSelect: (Long) -> Unit,
    onCheck: (Long) -> Unit,
    onTogglePin: (Link) -> Unit
) {
    itemsIndexed(group, key = { _, link -> link.id }) { _, link ->
        SidebarRow(
            link = link,
            selected = link.id == state.selectedId,
            isChecking = state.checkingIds.contains(link.id),
            isDragging = link.id == draggingId,
            dragOffsetY = if (link.id == draggingId) dragOffset else 0f,
            onSelect = { onSelect(link.id) },
            onCheck = { onCheck(link.id) },
            onTogglePin = { onTogglePin(link) },
            onStartDrag = { onStartDrag(link.id) },
            onDrag = onDrag,
            onEndDrag = onEndDrag
        )
    }
}

@Composable
private fun GroupHeader(label: String, count: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = Slate500
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = count.toString(),
            fontSize = 10.sp,
            color = Slate500,
            modifier = Modifier
                .clip(RoundedCornerShape(4.dp))
                .background(Base700)
                .padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

@Composable
private fun SidebarRow(
    link: Link,
    selected: Boolean,
    isChecking: Boolean,
    isDragging: Boolean,
    dragOffsetY: Float,
    onSelect: () -> Unit,
    onCheck: () -> Unit,
    onTogglePin: () -> Unit,
    onStartDrag: () -> Unit,
    onDrag: (Float) -> Unit,
    onEndDrag: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .zIndex(if (isDragging) 1f else 0f)
            .graphicsLayer { translationY = dragOffsetY }
            .padding(horizontal = 8.dp, vertical = 2.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(
                when {
                    isDragging -> Brand.copy(alpha = 0.3f)
                    selected -> Brand.copy(alpha = 0.2f)
                    else -> Color.Transparent
                }
            )
            .pointerInput(link.id) {
                detectDragGesturesAfterLongPress(
                    onDragStart = { onStartDrag() },
                    onDrag = { change, dragAmount ->
                        change.consume()
                        onDrag(dragAmount.y)
                    },
                    onDragEnd = { onEndDrag() },
                    onDragCancel = { onEndDrag() }
                )
            }
            .clickable(onClick = onSelect)
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        StatusCircle(
            status = link.httpStatus,
            isChecking = isChecking,
            onClick = onCheck
        )
        Spacer(Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = link.name ?: link.url,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (selected) Color.White else Slate200,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = if (link.name != null) link.url else "unnamed",
                fontSize = 12.sp,
                color = Slate500,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        Icon(
            imageVector = Icons.Filled.PushPin,
            contentDescription = if (link.pinned) "Unpin" else "Pin to top",
            tint = if (link.pinned) BrandLight else Slate500,
            modifier = Modifier
                .size(20.dp)
                .clip(RoundedCornerShape(4.dp))
                .clickable(onClick = onTogglePin)
                .padding(2.dp)
        )
    }
}
