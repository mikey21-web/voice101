package com.diyaa.calltracker.capture

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.telephony.TelephonyManager
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.diyaa.calltracker.data.SecureStorage
import com.diyaa.calltracker.data.local.AppDatabase
import com.diyaa.calltracker.sync.CallSyncWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.Calendar

/**
 * Watches system-wide call state to know when a call has just ended, so we can pull it from
 * CallLog and attach any OEM-native recording (or, as a last-resort fallback, attempt a
 * direct VOICE_CALL capture via [CallRecordingService]).
 *
 * Recording priority:
 * 1. Native OEM recorder (file-watcher via MediaStore) — primary path
 * 2. Direct VOICE_CALL capture — only if native recorder was not found for several
 *    consecutive calls and the device passes [CapabilityChecker].
 */
class CallStateReceiver : BroadcastReceiver() {

    private var callStartEpochMs: Long = 0L
    /** Set to true when SIM config or office-hours indicate this call should be ignored. */
    private var skipThisCall: Boolean = false

    override fun onReceive(context: Context, intent: Intent) {
        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        when (state) {
            TelephonyManager.EXTRA_STATE_OFFHOOK -> onCallActive(context, intent)
            TelephonyManager.EXTRA_STATE_IDLE -> onCallEnded(context)
        }
    }

    private fun onCallActive(context: Context, intent: Intent) {
        callStartEpochMs = System.currentTimeMillis()

        val storage = SecureStorage(context)

        // ── Dual-SIM check ──────────────────────────────────────────────────
        val configuredSim = storage.selectedSim
        skipThisCall = false

        if (configuredSim != "both") {
            val slotId = intent.getIntExtra("com.android.phone.extra.slot_id", -1)
            // Fallback extras used by some OEMs
            val slotFallback = intent.getIntExtra("slot_id", -1)
            val actualSlot = if (slotId >= 0) slotId else slotFallback

            val expectedSlot = if (configuredSim == "sim1") 0 else 1
            if (actualSlot >= 0 && actualSlot != expectedSlot) {
                skipThisCall = true
            }
        }

        // ── Caller ID notification ──────────────────────────────────────────
        val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
        if (!skipThisCall && incomingNumber != null) {
            val pendingResult = goAsync()
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    CallerIdNotification.show(context, incomingNumber)
                } finally {
                    pendingResult.finish()
                }
            }
        }
    }

    private fun onCallEnded(context: Context) {
        CallRecordingService.stop(context)

        // ── Office-hours check (checked at end time) ────────────────────────
        val storage = SecureStorage(context)
        if (!skipThisCall && isOutsideOfficeHours(storage)) {
            skipThisCall = true
        }

        if (skipThisCall) return

        val pendingResult = goAsync()
        val startMs = callStartEpochMs
        // CallLog's own write for the just-ended call can lag by a second or two behind the
        // IDLE broadcast; a short delay avoids reading a stale row. The native recorder also
        // needs a moment to finalise its file.
        Handler(Looper.getMainLooper()).postDelayed({
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val entry = CallLogReader.readLatest(context)
                    if (entry != null) {
                        val dao = AppDatabase.get(context).callDao()
                        val alreadyLogged = dao.existsForCall(entry.fromNumber, entry.toNumber, entry.startedAt) > 0
                        if (!alreadyLogged) {
                            // Primary path: try to find an OEM native recording
                            var recordingPath: String? = null
                            val nativeAvailable = storage.nativeRecorderAvailable
                            if (nativeAvailable != false && startMs > 0) {
                                recordingPath = NativeRecordingWatcher.pollForRecording(
                                    context = context,
                                    afterEpochMs = startMs,
                                )
                                val next = NativeRecorderState.next(
                                    current = nativeAvailable,
                                    misses = storage.nativeRecorderMisses,
                                    found = recordingPath != null,
                                    threshold = SecureStorage.NATIVE_RECORDER_FAIL_THRESHOLD,
                                )
                                storage.nativeRecorderAvailable = next.available
                                storage.nativeRecorderMisses = next.misses
                            }

                            // Fallback: direct VOICE_CALL capture if native recorder not found
                            if (recordingPath == null && nativeAvailable == false) {
                                val capability = CapabilityChecker.checkSimRecording(context)
                                if (capability.isSupported && CapabilityChecker.hasRecordAudioPermission(context)) {
                                    // Start recording now — the call is still recent; Capture what we can
                                    CallRecordingService.start(context)
                                    Handler(Looper.getMainLooper()).postDelayed({
                                        CallRecordingService.stop(context)
                                        val fallbackPath = CallRecordingService.lastRecordingPath(context)
                                        CoroutineScope(Dispatchers.IO).launch {
                                            dao.insert(entry.copy(localRecordingPath = fallbackPath))

                                            // Show post-call note prompt
                                            val displayNumber = if (entry.direction == "INBOUND") entry.fromNumber else entry.toNumber
                                            NotePromptManager.showNotePrompt(
                                                context = context,
                                                localId = entry.localId,
                                                fromNumber = displayNumber,
                                                direction = entry.direction,
                                                durationSec = entry.durationSec,
                                                source = entry.source,
                                            )

                                            WorkManager.getInstance(context).enqueue(
                                                OneTimeWorkRequestBuilder<CallSyncWorker>().build()
                                            )
                                            pendingResult.finish()
                                        }
                                    }, 3000)
                                    return@launch
                                }
                            }

                            dao.insert(entry.copy(localRecordingPath = recordingPath))

                            // Show post-call note prompt
                            val displayNumber = if (entry.direction == "INBOUND") entry.fromNumber else entry.toNumber
                            NotePromptManager.showNotePrompt(
                                context = context,
                                localId = entry.localId,
                                fromNumber = displayNumber,
                                direction = entry.direction,
                                durationSec = entry.durationSec,
                                source = entry.source,
                            )

                            WorkManager.getInstance(context).enqueue(
                                OneTimeWorkRequestBuilder<CallSyncWorker>().build()
                            )
                        }
                    }
                } finally {
                    pendingResult.finish()
                }
            }
        }, 2000)
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /** Returns `true` when office-hours filtering is enabled and the current time/day
     *  falls outside the configured window. */
    private fun isOutsideOfficeHours(storage: SecureStorage): Boolean {
        if (!storage.officeHoursEnabled) return false

        val cal = Calendar.getInstance()

        // Check day-of-week bitmask
        val dayBit = 1 shl dayToBitIndex(cal.get(Calendar.DAY_OF_WEEK))
        if ((storage.officeDays and dayBit) == 0) return true

        // Check time range
        val nowMin = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
        val startParts = storage.officeHoursStart.split(":")
        val endParts = storage.officeHoursEnd.split(":")
        val startMin = (startParts.getOrNull(0)?.toIntOrNull() ?: 9) * 60 +
                (startParts.getOrNull(1)?.toIntOrNull() ?: 0)
        val endMin = (endParts.getOrNull(0)?.toIntOrNull() ?: 18) * 60 +
                (endParts.getOrNull(1)?.toIntOrNull() ?: 0)

        return nowMin < startMin || nowMin >= endMin
    }

    /** Converts [Calendar.DAY_OF_WEEK] (1=Sun … 7=Sat) to bit index (0=Mon … 6=Sun). */
    private fun dayToBitIndex(calendarDay: Int): Int = (calendarDay + 5) % 7
}
