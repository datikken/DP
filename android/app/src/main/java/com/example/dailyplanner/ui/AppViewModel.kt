package com.example.dailyplanner.ui

import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.dailyplanner.data.AuthResult
import com.example.dailyplanner.data.Link
import com.example.dailyplanner.data.LinkCreateInput
import com.example.dailyplanner.data.LinkDeleteResult
import com.example.dailyplanner.data.LinkListResult
import com.example.dailyplanner.data.LinkRepository
import com.example.dailyplanner.data.LinkResult
import com.example.dailyplanner.data.LinkUpdateInput
import com.example.dailyplanner.data.SessionStore
import com.example.dailyplanner.data.StoredSession
import com.example.dailyplanner.data.db.AppDatabase
import com.example.dailyplanner.util.UrlValidation
import com.example.dailyplanner.util.validateUrl
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/** A transient feedback message shown in the UI. */
data class UiMessage(val text: String, val isError: Boolean = false)

/**
 * The single screen-level state, replacing the DOM-mutating renderer scripts.
 */
data class AppUiState(
    // Session
    val session: StoredSession? = null,
    val sessionLoaded: Boolean = false,

    // Auth form
    val authMode: AuthMode = AuthMode.LOGIN,
    val authBusy: Boolean = false,
    val authMessage: String? = null,
    val authMessageIsError: Boolean = false,

    // Links
    val links: List<Link> = emptyList(),
    val selectedId: Long? = null,
    val checkingIds: Set<Long> = emptySet(),
    val refreshingAll: Boolean = false,
    val message: UiMessage? = null,

    // Sidebar search (filters links by name or URL)
    val searchQuery: String = "",

    // Editor dialog
    val editor: LinkEditorState? = null
) {
    /** The currently selected link, or null when nothing is selected. */
    val selectedLink: Link?
        get() = links.firstOrNull { it.id == selectedId }

    /**
     * Links matching the current [searchQuery] by name or URL (case-insensitive
     * substring). With an empty query, all links are returned.
     */
    val visibleLinks: List<Link>
        get() {
            val q = searchQuery.trim()
            if (q.isEmpty()) return links
            return links.filter { link ->
                (link.name?.contains(q, ignoreCase = true) == true) ||
                    link.url.contains(q, ignoreCase = true)
            }
        }
}

enum class AuthMode { LOGIN, REGISTER }

/**
 * State of the create/edit dialog. Mirrors the modal fields in links.ts,
 * including the automatically-derived status fields (kept for editing).
 */
data class LinkEditorState(
    val editingId: Long? = null,
    val url: String = "",
    val name: String = "",
    val httpStatus: String = "",
    val lastCheck: String = "",
    val error: String? = null,
    val saving: Boolean = false
) {
    val isEditing: Boolean get() = editingId != null
}

/** How many links are checked at the same time within one batch. */
private const val REFRESH_BATCH_SIZE = 100

class AppViewModel(app: Application) : AndroidViewModel(app) {

    private val sessionStore = SessionStore(app)
    private val repository = LinkRepository(AppDatabase.get(app))

    private val _state = MutableStateFlow(AppUiState())
    val state: StateFlow<AppUiState> = _state.asStateFlow()

    init {
        restoreSession()
    }

    // ---- Session ----

    /** Restores the remembered session so a returning user skips the sign-in. */
    private fun restoreSession() {
        viewModelScope.launch {
            val saved = sessionStore.load()
            _state.update { it.copy(session = saved, sessionLoaded = true) }
            if (saved != null) loadLinks()
        }
    }

    private fun finishAuth(result: AuthResult) {
        when (result) {
            is AuthResult.Success -> {
                viewModelScope.launch {
                    val stored = StoredSession(result.user.id, result.user.username)
                    sessionStore.save(stored)
                    _state.update {
                        it.copy(session = stored, authBusy = false, authMessage = null)
                    }
                    loadLinks()
                }
            }
            is AuthResult.Failure -> {
                _state.update {
                    it.copy(
                        authBusy = false,
                        authMessage = result.error,
                        authMessageIsError = true
                    )
                }
            }
        }
    }

    fun setAuthMode(mode: AuthMode) {
        _state.update {
            it.copy(authMode = mode, authMessage = null, authMessageIsError = false)
        }
    }

    /** Submits the sign-in / registration form (mirrors the original submit). */
    fun submitAuth(username: String, password: String) {
        if (username.isBlank() || password.isEmpty()) {
            _state.update {
                it.copy(authMessage = "Please fill in both fields.", authMessageIsError = true)
            }
            return
        }

        _state.update { it.copy(authBusy = true, authMessage = null) }
        val mode = _state.value.authMode
        viewModelScope.launch {
            val result = try {
                if (mode == AuthMode.LOGIN) {
                    repository.login(username, password)
                } else {
                    repository.register(username, password)
                }
            } catch (err: Exception) {
                AuthResult.Failure(
                    "Could not access the database. Close any other copy of the app and try again."
                )
            }
            finishAuth(result)
        }
    }

    fun logout() {
        viewModelScope.launch {
            sessionStore.clear()
            _state.update {
                it.copy(
                    session = null,
                    links = emptyList(),
                    selectedId = null,
                    editor = null,
                    message = null
                )
            }
        }
    }

    // ---- Links ----

    private fun loadLinks() {
        val session = _state.value.session ?: return
        viewModelScope.launch {
            when (val res = repository.listLinks(session.userId)) {
                is LinkListResult.Success -> {
                    _state.update { current ->
                        val stillSelected = current.selectedId
                            ?.takeIf { id -> res.links.any { it.id == id } }
                        val selected = stillSelected ?: res.links.firstOrNull()?.id
                        current.copy(links = res.links, selectedId = selected)
                    }
                }
                is LinkListResult.Failure ->
                    _state.update { it.copy(message = UiMessage(res.error, isError = true)) }
            }
        }
    }

    fun selectLink(id: Long) {
        _state.update { it.copy(selectedId = id) }
    }

    /** Updates the sidebar search query (filters by name or URL). */
    fun setSearchQuery(query: String) {
        _state.update { it.copy(searchQuery = query) }
    }

    fun dismissMessage() {
        _state.update { it.copy(message = null) }
    }

    // ---- Editor ----

    fun openCreate() {
        _state.update { it.copy(editor = LinkEditorState()) }
    }

    fun openEdit(link: Link) {
        _state.update {
            it.copy(
                editor = LinkEditorState(
                    editingId = link.id,
                    url = link.url,
                    name = link.name ?: "",
                    httpStatus = link.httpStatus?.toString() ?: "",
                    lastCheck = link.lastCheck ?: ""
                )
            )
        }
    }

    fun closeEditor() {
        _state.update { it.copy(editor = null) }
    }

    fun updateEditor(transform: (LinkEditorState) -> LinkEditorState) {
        _state.update { current ->
            val editor = current.editor ?: return@update current
            current.copy(editor = transform(editor))
        }
    }

    /** Saves the editor (create or update), validating the URL first. */
    fun submitEditor() {
        val session = _state.value.session ?: return
        val editor = _state.value.editor ?: return

        val validation = validateUrl(editor.url)
        if (validation !is UrlValidation.Valid) {
            updateEditor { it.copy(error = (validation as UrlValidation.Invalid).error) }
            return
        }
        val url = validation.url
        val name = editor.name.trim().ifEmpty { null }

        updateEditor { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            val result: LinkResult = try {
                if (editor.editingId != null) {
                    repository.updateLink(
                        session.userId,
                        editor.editingId,
                        LinkUpdateInput(
                            url = url,
                            name = name,
                            httpStatus = editor.httpStatus.trim().toIntOrNull(),
                            lastCheck = editor.lastCheck.trim().ifEmpty { null }
                        )
                    )
                } else {
                    repository.createLink(
                        session.userId,
                        LinkCreateInput(url = url, name = name)
                    )
                }
            } catch (err: Exception) {
                LinkResult.Failure("Something went wrong. Please try again.")
            }

            when (result) {
                is LinkResult.Success -> {
                    _state.update {
                        it.copy(
                            editor = null,
                            selectedId = result.link.id,
                            message = UiMessage(
                                if (editor.editingId != null) "Link updated." else "Link created."
                            )
                        )
                    }
                    loadLinks()
                }
                is LinkResult.Failure ->
                    updateEditor { it.copy(saving = false, error = result.error) }
            }
        }
    }

    // ---- Actions ----

    fun deleteLink(link: Link) {
        val session = _state.value.session ?: return
        viewModelScope.launch {
            when (val res = repository.deleteLink(session.userId, link.id)) {
                is LinkDeleteResult.Success -> {
                    _state.update { current ->
                        current.copy(
                            links = current.links.filterNot { it.id == link.id },
                            selectedId = if (current.selectedId == link.id) {
                                current.links.firstOrNull { it.id != link.id }?.id
                            } else {
                                current.selectedId
                            },
                            message = UiMessage("Link deleted.")
                        )
                    }
                }
                is LinkDeleteResult.Failure ->
                    _state.update { it.copy(message = UiMessage(res.error, isError = true)) }
            }
        }
    }

    /** Re-checks a single link (shows a spinner while in flight). */
    fun checkLink(id: Long) {
        val session = _state.value.session ?: return
        if (_state.value.checkingIds.contains(id)) return

        _state.update { it.copy(checkingIds = it.checkingIds + id) }
        viewModelScope.launch {
            when (val res = repository.checkLink(session.userId, id)) {
                is LinkResult.Success -> {
                    val code = res.link.httpStatus
                    _state.update { current ->
                        current.copy(
                            links = current.links.map { if (it.id == id) res.link else it },
                            checkingIds = current.checkingIds - id,
                            message = if (code != null) {
                                UiMessage("Checked: HTTP $code", isError = !(code in 200..399))
                            } else {
                                current.message
                            }
                        )
                    }
                }
                is LinkResult.Failure -> {
                    _state.update {
                        it.copy(
                            checkingIds = it.checkingIds - id,
                            message = UiMessage(res.error, isError = true)
                        )
                    }
                    // last_check was touched: reload so the UI reflects it.
                    loadLinks()
                }
            }
        }
    }

    /**
     * Re-checks every link in batches of [REFRESH_BATCH_SIZE] links checked
     * concurrently. Each batch is awaited in full before the next starts, so at
     * most 100 requests are in flight at once.
     */
    fun refreshAll() {
        val session = _state.value.session ?: return
        val snapshot = _state.value
        if (snapshot.refreshingAll || snapshot.links.isEmpty()) return

        _state.update { it.copy(refreshingAll = true) }
        viewModelScope.launch {
            val ids = snapshot.links.map { it.id }
            val total = ids.size
            var checked = 0

            // Checks one link and merges the result into the list.
            suspend fun checkOne(id: Long) {
                if (_state.value.links.none { it.id == id }) return // deleted meanwhile
                _state.update { it.copy(checkingIds = it.checkingIds + id) }
                runCatching { repository.checkLink(session.userId, id) }
                    .onSuccess { linkRes ->
                        if (linkRes is LinkResult.Success) {
                            _state.update { cur ->
                                cur.copy(
                                    links = cur.links.map { if (it.id == id) linkRes.link else it }
                                )
                            }
                        }
                    }
                _state.update { it.copy(checkingIds = it.checkingIds - id) }
                checked += 1
            }

            // Work through the links a batch at a time: the first 100 run in
            // parallel, then (after all of them settle) the next 100, and so on.
            for (batch in ids.chunked(REFRESH_BATCH_SIZE)) {
                val end = minOf(checked + batch.size, total)
                _state.update {
                    it.copy(message = UiMessage("Checking ${checked + 1}–$end of $total…"))
                }
                coroutineScope {
                    batch.forEach { id ->
                        launch { checkOne(id) }
                    }
                }
            }

            _state.update { it.copy(refreshingAll = false) }
            loadLinks() // trust the database for the final state
            _state.update {
                it.copy(
                    message = UiMessage("Re-checked $checked link${if (checked == 1) "" else "s"}.")
                )
            }
        }
    }

    /** Pins or unpins a link, then reloads the grouped list. */
    fun togglePin(link: Link) {
        val session = _state.value.session ?: return
        val nextPinned = !link.pinned
        viewModelScope.launch {
            when (val res = repository.setLinkPinned(session.userId, link.id, nextPinned)) {
                is LinkResult.Success -> {
                    _state.update {
                        it.copy(message = UiMessage(if (nextPinned) "Link pinned." else "Link unpinned."))
                    }
                }
                is LinkResult.Failure ->
                    _state.update { it.copy(message = UiMessage(res.error, isError = true)) }
            }
            loadLinks()
        }
    }

    /**
     * Persists a drag-reorder. `orderedIds` must contain pinned links first.
     * The list is optimistically reordered, then the DB response is trusted.
     */
    fun persistOrder(orderedIds: List<Long>) {
        val session = _state.value.session ?: return
        val current = _state.value.links
        val pinnedCount = current.count { it.pinned }

        val byId = current.associateBy { it.id }
        val optimistic = orderedIds.mapNotNull { byId[it] }
        if (optimistic.size == current.size) {
            _state.update { it.copy(links = optimistic) }
        }

        viewModelScope.launch {
            when (val res = repository.reorderLinks(session.userId, orderedIds, pinnedCount)) {
                is LinkListResult.Success ->
                    _state.update { it.copy(links = res.links) }
                is LinkListResult.Failure -> {
                    _state.update { it.copy(message = UiMessage(res.error, isError = true)) }
                    loadLinks() // roll back to what the database actually holds
                }
            }
        }
    }

    /** Opens a link in the default browser (validated to http/https only). */
    fun openExternal(context: Context, url: String) {
        val address = url.toHttpUrlOrNull()
        if (address == null) {
            _state.update { it.copy(message = UiMessage("That link is not a valid URL.", isError = true)) }
            return
        }
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(address.toString()))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

        runCatching { context.startActivity(intent) }.onFailure {
            _state.update {
                it.copy(message = UiMessage("Could not open the browser.", isError = true))
            }
        }
    }
}
