package com.diyaa.calltracker.settings

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.diyaa.calltracker.data.SecureStorage
import com.diyaa.calltracker.ui.theme.CallTrackerTheme
import java.util.Calendar

class SettingsActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val storage = SecureStorage(this)
        setContent {
            CallTrackerTheme {
                SettingsScreen(storage = storage, onBack = { finish() })
            }
        }
    }
}

@Composable
private fun SettingsSectionCard(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
        content = content,
    )
}

// ── Day-of-week labels, ordered Mon–Sun ──────────────────────────────────────
private val DAY_LABELS = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

/** Convert Calendar.DAY_OF_WEEK (1=Sun … 7=Sat) to our bit index (0=Mon … 6=Sun). */
private fun dayToBitIndex(calendarDay: Int): Int = (calendarDay + 5) % 7

/** Convert our bit index back to Calendar.DAY_OF_WEEK. */
private fun bitIndexToDay(bit: Int): Int = (bit + 1) % 7 + 1

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsScreen(storage: SecureStorage, onBack: () -> Unit) {
    // ── State backed by SecureStorage ───────────────────────────────────────
    var selectedSim by remember { mutableStateOf(storage.selectedSim) }
    var ohStart by remember { mutableStateOf(storage.officeHoursStart) }
    var ohEnd by remember { mutableStateOf(storage.officeHoursEnd) }
    var ohEnabled by remember { mutableStateOf(storage.officeHoursEnabled) }
    var ohDays by remember { mutableIntStateOf(storage.officeDays) }

    // Time-picker visibility
    var showStartPicker by remember { mutableStateOf(false) }
    var showEndPicker by remember { mutableStateOf(false) }

    // Persist on every change
    fun persist() {
        storage.selectedSim = selectedSim
        storage.officeHoursStart = ohStart
        storage.officeHoursEnd = ohEnd
        storage.officeHoursEnabled = ohEnabled
        storage.officeDays = ohDays
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // ── Dual SIM section ────────────────────────────────────────────
            item {
                Spacer(Modifier.height(8.dp))
                Text("Dual SIM", style = MaterialTheme.typography.titleLarge)
            }

            item {
                SettingsSectionCard {
                    val options = listOf("sim1" to "SIM 1", "sim2" to "SIM 2", "both" to "Both")
                    var expanded by remember { mutableStateOf(false) }

                    ExposedDropdownMenuBox(
                        expanded = expanded,
                        onExpandedChange = { expanded = !expanded },
                    ) {
                        OutlinedTextField(
                            value = options.firstOrNull { it.first == selectedSim }?.second ?: "Both",
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Active SIM") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                            modifier = Modifier
                                .menuAnchor()
                                .fillMaxWidth(),
                        )
                        ExposedDropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false },
                        ) {
                            options.forEach { (key, label) ->
                                DropdownMenuItem(
                                    text = { Text(label) },
                                    onClick = {
                                        selectedSim = key
                                        expanded = false
                                        persist()
                                    },
                                )
                            }
                        }
                    }
                }
            }

            // ── Office Hours section ─────────────────────────────────────────
            item {
                Text("Office Hours", style = MaterialTheme.typography.titleLarge)
            }

            item {
                SettingsSectionCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Work days only", style = MaterialTheme.typography.bodyLarge)
                        Switch(
                            checked = ohEnabled,
                            onCheckedChange = {
                                ohEnabled = it
                                persist()
                            },
                        )
                    }

                    if (ohEnabled) {
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(
                            value = ohStart,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Start time") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { showStartPicker = true },
                        )

                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = ohEnd,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("End time") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { showEndPicker = true },
                        )

                        Text("Active days", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 14.dp, bottom = 8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                        ) {
                            for (i in 0..6) {
                                val mask = 1 shl i
                                val checked = (ohDays and mask) != 0
                                FilterChip(
                                    selected = checked,
                                    onClick = {
                                        ohDays = if (checked) ohDays and mask.inv() else ohDays or mask
                                        persist()
                                    },
                                    label = { Text(DAY_LABELS[i], fontSize = 12.sp) },
                                )
                            }
                        }
                    }
                }
            }

            // Bottom spacer
            item { Spacer(Modifier.height(32.dp)) }
        }

        // ── Time picker dialogs ─────────────────────────────────────────────
        if (showStartPicker) {
            TimePickerDialog(
                initial = ohStart,
                onConfirm = {
                    ohStart = it
                    showStartPicker = false
                    persist()
                },
                onDismiss = { showStartPicker = false },
            )
        }

        if (showEndPicker) {
            TimePickerDialog(
                initial = ohEnd,
                onConfirm = {
                    ohEnd = it
                    showEndPicker = false
                    persist()
                },
                onDismiss = { showEndPicker = false },
            )
        }
    }
}

// ── Simple time-picker dialog using Material3 TimePicker ─────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimePickerDialog(
    initial: String,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val parts = initial.split(":")
    val initHour = parts.getOrNull(0)?.toIntOrNull() ?: 9
    val initMinute = parts.getOrNull(1)?.toIntOrNull() ?: 0

    val timeState = rememberTimePickerState(
        initialHour = initHour.coerceIn(0, 23),
        initialMinute = initMinute.coerceIn(0, 59),
        is24Hour = true,
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Select time") },
        text = {
            TimePicker(state = timeState)
        },
        confirmButton = {
            TextButton(onClick = {
                onConfirm(String.format("%02d:%02d", timeState.hour, timeState.minute))
            }) { Text("OK") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
