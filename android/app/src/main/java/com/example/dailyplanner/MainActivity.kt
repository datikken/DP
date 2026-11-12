package com.example.dailyplanner

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.example.dailyplanner.ui.AppRoot
import com.example.dailyplanner.ui.AppViewModel
import com.example.dailyplanner.ui.theme.DailyPlannerTheme

class MainActivity : ComponentActivity() {

    private val viewModel: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            DailyPlannerTheme {
                AppRoot(viewModel)
            }
        }
    }
}
