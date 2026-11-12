package com.example.dailyplanner.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.dailyplanner.ui.AuthMode
import com.example.dailyplanner.ui.theme.Base700
import com.example.dailyplanner.ui.theme.Base800
import com.example.dailyplanner.ui.theme.Base900
import com.example.dailyplanner.ui.theme.Brand
import com.example.dailyplanner.ui.theme.GreenLight
import com.example.dailyplanner.ui.theme.RedLight
import com.example.dailyplanner.ui.theme.Slate200
import com.example.dailyplanner.ui.theme.Slate400
import com.example.dailyplanner.ui.theme.Slate500

/**
 * Sign-in / registration screen, ported from index.html + auth.ts.
 */
@Composable
fun AuthScreen(
    mode: AuthMode,
    busy: Boolean,
    message: String?,
    messageIsError: Boolean,
    onModeChange: (AuthMode) -> Unit,
    onSubmit: (username: String, password: String) -> Unit
) {
    var username by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    val keyboard = LocalSoftwareKeyboardController.current

    val submit = {
        keyboard?.hide()
        onSubmit(username, password)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Base900, Base700)))
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 380.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Base800)
                .border(1.dp, Base600Color, RoundedCornerShape(16.dp))
                .padding(32.dp)
        ) {
            Text(
                text = "Welcome",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Slate200,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
            Text(
                text = "Sign in or create an account",
                fontSize = 14.sp,
                color = Slate400,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp, bottom = 20.dp)
            )

            // Mode tabs
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Base900)
                    .padding(4.dp)
            ) {
                ModeTab(
                    label = "Login",
                    selected = mode == AuthMode.LOGIN,
                    modifier = Modifier.weight(1f),
                    onClick = { onModeChange(AuthMode.LOGIN) }
                )
                ModeTab(
                    label = "Register",
                    selected = mode == AuthMode.REGISTER,
                    modifier = Modifier.weight(1f),
                    onClick = { onModeChange(AuthMode.REGISTER) }
                )
            }

            Spacer(Modifier.height(20.dp))

            FieldLabel("Username")
            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                singleLine = true,
                enabled = !busy,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Text,
                    imeAction = ImeAction.Next
                ),
                colors = authFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(Modifier.height(12.dp))

            FieldLabel("Password")
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                singleLine = true,
                enabled = !busy,
                visualTransformation = if (passwordVisible) {
                    VisualTransformation.None
                } else {
                    PasswordVisualTransformation()
                },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done
                ),
                keyboardActions = KeyboardActions(onDone = { submit() }),
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(
                            imageVector = if (passwordVisible) {
                                Icons.Filled.VisibilityOff
                            } else {
                                Icons.Filled.Visibility
                            },
                            contentDescription = if (passwordVisible) "Hide password" else "Show password",
                            tint = Slate400
                        )
                    }
                },
                colors = authFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(Modifier.height(20.dp))

            // Submit button
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (busy) Brand.copy(alpha = 0.6f) else Brand)
                    .clickable(enabled = !busy) { submit() },
                contentAlignment = Alignment.Center
            ) {
                if (busy) {
                    CircularProgressIndicator(
                        color = androidx.compose.ui.graphics.Color.White,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(20.dp)
                    )
                } else {
                    Text(
                        text = if (mode == AuthMode.LOGIN) "Login" else "Create Account",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = androidx.compose.ui.graphics.Color.White
                    )
                }
            }

            // Message
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 14.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = message ?: "",
                    fontSize = 14.sp,
                    color = if (messageIsError) RedLight else GreenLight,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
private fun ModeTab(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (selected) Brand else androidx.compose.ui.graphics.Color.Transparent)
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (selected) androidx.compose.ui.graphics.Color.White else Slate400
        )
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(
        text = text,
        fontSize = 12.sp,
        color = Slate400,
        modifier = Modifier.padding(bottom = 6.dp)
    )
}

@Composable
private fun authFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedContainerColor = Base900,
    unfocusedContainerColor = Base900,
    focusedBorderColor = Brand,
    unfocusedBorderColor = Slate500,
    focusedTextColor = Slate200,
    unfocusedTextColor = Slate200,
    cursorColor = Brand
)

private val Base600Color = com.example.dailyplanner.ui.theme.Base600
