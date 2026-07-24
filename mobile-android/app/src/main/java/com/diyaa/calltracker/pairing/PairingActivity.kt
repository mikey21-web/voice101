package com.diyaa.calltracker.pairing

import android.Manifest
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.viewmodel.compose.viewModel
import com.diyaa.calltracker.capture.CapabilityChecker
import com.diyaa.calltracker.settings.SettingsActivity

private data class PermissionSpec(val permission: String, val label: String, val icon: ImageVector)

private val REQUIRED_PERMISSION_SPECS = buildList {
    add(PermissionSpec(Manifest.permission.READ_CALL_LOG, "Call log access", Icons.Filled.History))
    add(PermissionSpec(Manifest.permission.READ_PHONE_STATE, "Phone state", Icons.Filled.Phone))
    add(PermissionSpec(Manifest.permission.RECORD_AUDIO, "Microphone", Icons.Filled.Mic))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        add(PermissionSpec(Manifest.permission.POST_NOTIFICATIONS, "Notifications", Icons.Filled.Notifications))
    }
}

class PairingActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            com.diyaa.calltracker.ui.theme.CallTrackerTheme {
                PairingScreen()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PairingScreen(viewModel: PairingViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        BrandMark(size = 30.dp)
                        Spacer(Modifier.width(10.dp))
                        Text("Call Tracker", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    }
                },
                actions = {
                    IconButton(onClick = {
                        context.startActivity(Intent(context, SettingsActivity::class.java))
                    }) {
                        Icon(Icons.Filled.Settings, contentDescription = "Settings")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp),
        ) {
            when (val s = state) {
                is PairingState.Paired -> PairedContent(onUnpair = { viewModel.unpair() })
                else -> UnpairedContent(
                    state = s,
                    onPair = { code -> viewModel.pair(code) },
                )
            }
        }
    }
}

@Composable
private fun BrandMark(size: androidx.compose.ui.unit.Dp) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primary),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.Filled.Call,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onPrimary,
            modifier = Modifier.size(size * 0.55f),
        )
    }
}

// ── Unpaired: hero + permission checklist + code entry ──────────────────────

@Composable
private fun UnpairedContent(state: PairingState, onPair: (String) -> Unit) {
    var code by remember { mutableStateOf("") }
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var grantedMap by remember { mutableStateOf(currentPermissionGrants(context)) }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        grantedMap = currentPermissionGrants(context)
    }

    // Re-check on resume — the user may grant permissions via system settings, not just the dialog.
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) grantedMap = currentPermissionGrants(context)
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val allGranted = grantedMap.values.all { it }

    Spacer(Modifier.height(24.dp))
    BrandMark(size = 64.dp)
    Spacer(Modifier.height(16.dp))
    Text("Connect this phone", style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    Spacer(Modifier.height(4.dp))
    Text(
        "Enter the pairing code shown on the dashboard's “Pair a device” screen.",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth(),
    )

    Spacer(Modifier.height(24.dp))
    SectionCard {
        CodeEntryField(code = code, onCodeChange = { code = it })
    }

    Spacer(Modifier.height(16.dp))
    SectionCard {
        Text("Permissions needed", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(4.dp))
        REQUIRED_PERMISSION_SPECS.forEach { spec ->
            PermissionRow(spec = spec, granted = grantedMap[spec.permission] == true)
        }
        if (!allGranted) {
            Spacer(Modifier.height(10.dp))
            FilledTonalButton(
                onClick = { permissionLauncher.launch(REQUIRED_PERMISSION_SPECS.map { it.permission }.toTypedArray()) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Grant permissions") }
        }
    }

    Spacer(Modifier.height(20.dp))
    Button(
        onClick = { onPair(code) },
        enabled = state !is PairingState.Pairing && code.length == 6,
        modifier = Modifier.fillMaxWidth().height(50.dp),
        shape = RoundedCornerShape(14.dp),
    ) {
        if (state is PairingState.Pairing) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
        } else {
            Text("Pair device", fontWeight = FontWeight.SemiBold)
        }
    }

    if (state is PairingState.Error) {
        Spacer(Modifier.height(12.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(MaterialTheme.colorScheme.errorContainer)
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Filled.WarningAmber, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(state.message, color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodyMedium)
        }
    }
    Spacer(Modifier.height(24.dp))
}

private fun currentPermissionGrants(context: Context): Map<String, Boolean> =
    REQUIRED_PERMISSION_SPECS.associate {
        it.permission to (ContextCompat.checkSelfPermission(context, it.permission) == PackageManager.PERMISSION_GRANTED)
    }

@Composable
private fun PermissionRow(spec: PermissionSpec, granted: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(spec.icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(12.dp))
        Text(spec.label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
        Icon(
            if (granted) Icons.Filled.Check else Icons.Outlined.RadioButtonUnchecked,
            contentDescription = if (granted) "Granted" else "Not granted",
            tint = if (granted) com.diyaa.calltracker.ui.theme.SuccessGreen else MaterialTheme.colorScheme.outline,
            modifier = Modifier.size(20.dp),
        )
    }
}

/** Six boxed digits, styled like a one-time-passcode entry field rather than a plain text box. */
@Composable
private fun CodeEntryField(code: String, onCodeChange: (String) -> Unit) {
    Text("Pairing code", style = MaterialTheme.typography.titleMedium)
    Spacer(Modifier.height(10.dp))

    Box {
        // Invisible field that owns the actual text input + keyboard/focus behavior.
        BasicCodeInput(code = code, onCodeChange = onCodeChange)
    }
}

@Composable
private fun BasicCodeInput(code: String, onCodeChange: (String) -> Unit) {
    val focusRequester = remember { androidx.compose.ui.focus.FocusRequester() }
    androidx.compose.foundation.text.BasicTextField(
        value = code,
        onValueChange = { onCodeChange(it.filter(Char::isDigit).take(6)) },
        modifier = Modifier
            .fillMaxWidth()
            .focusRequester(focusRequester),
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.NumberPassword),
        decorationBox = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                for (i in 0 until 6) {
                    val filled = i < code.length
                    val active = i == code.length
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                            .then(
                                if (active) Modifier.background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(10.dp))
                                else Modifier,
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = if (filled) code[i].toString() else "",
                            style = MaterialTheme.typography.headlineSmall,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }
        },
    )
    LaunchedEffect(Unit) { focusRequester.requestFocus() }
}

// ── Paired: status card + capability card + settings link ───────────────────

@Composable
private fun ColumnScope.PairedContent(onUnpair: () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var capability by remember { mutableStateOf(CapabilityChecker.checkSimRecording(context)) }

    // Re-probe whenever the screen resumes — role grants and Settings changes only take
    // effect after the user returns from the system role-request dialog, so a one-shot
    // check at first composition would keep showing a stale "not supported" verdict.
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                capability = CapabilityChecker.checkSimRecording(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val roleManager = remember { context.getSystemService(RoleManager::class.java) }
    val roleAvailable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
        roleManager?.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) == true
    val roleLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        capability = CapabilityChecker.checkSimRecording(context)
    }

    Spacer(Modifier.height(20.dp))

    // ── Status card ──
    SectionCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(com.diyaa.calltracker.ui.theme.SuccessGreenContainer),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Check, contentDescription = null, tint = com.diyaa.calltracker.ui.theme.SuccessGreen)
            }
            Spacer(Modifier.width(14.dp))
            Column {
                Text("Connected", style = MaterialTheme.typography.titleLarge)
                Text("Watching for calls in the background", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }

    Spacer(Modifier.height(14.dp))

    // ── Recording capability card ──
    SectionCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Mic, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(10.dp))
            Text("Call recording", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            StatusChip(supported = capability.isSupported)
        }

        if (!capability.isSupported) {
            Spacer(Modifier.height(10.dp))
            if (!capability.hasCallScreeningRole && roleAvailable) {
                Text(
                    "Grant the call-screening role below — some devices only expose call audio to the app holding it.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(10.dp))
                FilledTonalButton(
                    onClick = { roleLauncher.launch(roleManager!!.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)) },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Enable call recording") }
            } else if (!capability.voiceCallSourceAvailable) {
                Text(
                    "This phone's manufacturer blocks third-party call recording outright — no app can override this. Calls will still be logged without audio.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }

    Spacer(Modifier.height(14.dp))

    // ── Settings link row ──
    SectionCard(padding = 0.dp) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .clickable { context.startActivity(Intent(context, SettingsActivity::class.java)) }
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Filled.Settings, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(12.dp))
            Text("Dual SIM & office hours", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            Icon(Icons.Filled.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.outline)
        }
    }

    Spacer(Modifier.weight(1f))
    OutlinedButton(
        onClick = onUnpair,
        modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
    ) { Text("Unpair device") }
}

@Composable
private fun StatusChip(supported: Boolean) {
    val bg = if (supported) com.diyaa.calltracker.ui.theme.SuccessGreenContainer else com.diyaa.calltracker.ui.theme.WarningAmberContainer
    val fg = if (supported) com.diyaa.calltracker.ui.theme.SuccessGreen else com.diyaa.calltracker.ui.theme.WarningAmber
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(if (supported) "Supported" else "Limited", color = fg, style = MaterialTheme.typography.labelLarge.copy(fontSize = 12.sp))
    }
}

@Composable
private fun SectionCard(padding: androidx.compose.ui.unit.Dp = 16.dp, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(padding),
        content = content,
    )
}
