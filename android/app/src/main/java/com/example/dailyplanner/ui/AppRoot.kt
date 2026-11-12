package com.example.dailyplanner.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.dailyplanner.ui.auth.AuthScreen
import com.example.dailyplanner.ui.links.LinksScreen
import com.example.dailyplanner.ui.theme.Base900

/**
 * Root of the app. Routes between the sign-in screen and the links screen based
 * on the remembered session, mirroring the original "landing page" logic.
 */
@Composable
fun AppRoot(viewModel: AppViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    // The activity draws edge-to-edge, so content would otherwise run under the
    // status bar (top) and navigation bar / on-screen keyboard (bottom). Pad the
    // whole tree by the safe-drawing insets once, here at the root, so every
    // screen keeps its text clear of the system bars without each one repeating
    // the inset handling. `consumeWindowInsets` stops children from re-applying
    // the same padding.
    Box(
        Modifier
            .fillMaxSize()
            .background(Base900)
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .consumeWindowInsets(WindowInsets.safeDrawing)
    ) {
        when {
            !state.sessionLoaded -> Unit // brief splash while the session loads

            state.session == null -> AuthScreen(
                mode = state.authMode,
                busy = state.authBusy,
                message = state.authMessage,
                messageIsError = state.authMessageIsError,
                onModeChange = viewModel::setAuthMode,
                onSubmit = viewModel::submitAuth
            )

            else -> LinksScreen(
                state = state,
                onSelect = viewModel::selectLink,
                onCreate = viewModel::openCreate,
                onEdit = viewModel::openEdit,
                onDelete = viewModel::deleteLink,
                onCheck = viewModel::checkLink,
                onRefreshAll = viewModel::refreshAll,
                onTogglePin = viewModel::togglePin,
                onReorder = viewModel::persistOrder,
                onSearchQueryChange = viewModel::setSearchQuery,
                onLogout = viewModel::logout,
                onDismissMessage = viewModel::dismissMessage,
                onOpenExternal = viewModel::openExternal,
                onUpdateEditor = viewModel::updateEditor,
                onSubmitEditor = viewModel::submitEditor,
                onCloseEditor = viewModel::closeEditor
            )
        }
    }
}

