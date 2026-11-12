package com.example.dailyplanner.ui.links

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.dailyplanner.ui.LinkEditorState
import com.example.dailyplanner.ui.theme.Base600
import com.example.dailyplanner.ui.theme.Base700
import com.example.dailyplanner.ui.theme.Base800
import com.example.dailyplanner.ui.theme.Brand
import com.example.dailyplanner.ui.theme.RedLight
import com.example.dailyplanner.ui.theme.Slate100
import com.example.dailyplanner.ui.theme.Slate200
import com.example.dailyplanner.ui.theme.Slate400
import com.example.dailyplanner.ui.theme.Slate500

/**
 * Create / edit dialog. Fields mirror the modal in links.html: URL (required),
 * name (optional), and — when editing — the HTTP status and last-check values
 * that the checker normally maintains.
 */
@Composable
fun LinkEditorDialog(
    editor: LinkEditorState,
    onUpdate: ((LinkEditorState) -> LinkEditorState) -> Unit,
    onSubmit: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = { if (!editor.saving) onDismiss() },
        containerColor = Base800,
        title = {
            Text(
                text = if (editor.isEditing) "Edit Link" else "New Link",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = Slate100
            )
        },
        text = {
            Column {
                FieldLabel("URL *")
                OutlinedTextField(
                    value = editor.url,
                    onValueChange = { v -> onUpdate { it.copy(url = v, error = null) } },
                    singleLine = true,
                    enabled = !editor.saving,
                    placeholder = { Text("https://example.com/page", color = Slate500) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    colors = editorFieldColors(),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(Modifier.height(12.dp))
                FieldLabel("Name")
                OutlinedTextField(
                    value = editor.name,
                    onValueChange = { v -> onUpdate { it.copy(name = v) } },
                    singleLine = true,
                    enabled = !editor.saving,
                    placeholder = { Text("e.g. Docs (optional)", color = Slate500) },
                    colors = editorFieldColors(),
                    modifier = Modifier.fillMaxWidth()
                )

                if (editor.isEditing) {
                    Spacer(Modifier.height(12.dp))
                    Row(Modifier.fillMaxWidth()) {
                        Column(Modifier.weight(1f)) {
                            FieldLabel("HTTP Status")
                            OutlinedTextField(
                                value = editor.httpStatus,
                                onValueChange = { v -> onUpdate { it.copy(httpStatus = v) } },
                                singleLine = true,
                                enabled = !editor.saving,
                                placeholder = { Text("200", color = Slate500) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                colors = editorFieldColors(),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        Spacer(Modifier.padding(horizontal = 6.dp))
                        Column(Modifier.weight(1f)) {
                            FieldLabel("Last Check")
                            OutlinedTextField(
                                value = editor.lastCheck,
                                onValueChange = { v -> onUpdate { it.copy(lastCheck = v) } },
                                singleLine = true,
                                enabled = !editor.saving,
                                placeholder = { Text("YYYY-MM-DD HH:MM", color = Slate500) },
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.Text,
                                    imeAction = ImeAction.Done
                                ),
                                colors = editorFieldColors(),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }

                if (editor.error != null) {
                    Text(
                        text = editor.error,
                        color = RedLight,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 10.dp)
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onSubmit, enabled = !editor.saving) {
                Text(
                    text = if (editor.saving) "Saving…" else "Save",
                    color = Brand,
                    fontWeight = FontWeight.SemiBold
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !editor.saving) {
                Text("Cancel", color = Slate400)
            }
        }
    )
}

@Composable
private fun FieldLabel(text: String) {
    Text(
        text = text,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        color = Slate400,
        modifier = Modifier.padding(bottom = 4.dp)
    )
}

@Composable
private fun editorFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedContainerColor = Base700,
    unfocusedContainerColor = Base700,
    focusedBorderColor = Brand,
    unfocusedBorderColor = Base600,
    focusedTextColor = Slate200,
    unfocusedTextColor = Slate200,
    cursorColor = Brand
)
