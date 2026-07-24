package com.diyaa.calltracker.capture

/**
 * Pure state transition for [com.diyaa.calltracker.data.SecureStorage.nativeRecorderAvailable]:
 * given whether this call's native recording was found, decides the next `(available, misses)`
 * pair. Pulled out of [CallStateReceiver] so the "unknown state must still accumulate misses"
 * rule (the bug that silently blocked the VOICE_CALL fallback on phones with no OEM recorder)
 * can be unit-tested without an Android context.
 */
object NativeRecorderState {
    data class Result(val available: Boolean?, val misses: Int)

    fun next(current: Boolean?, misses: Int, found: Boolean, threshold: Int): Result {
        if (found) return Result(available = true, misses = 0)
        val newMisses = misses + 1
        val newAvailable = if (newMisses >= threshold) false else current
        return Result(available = newAvailable, misses = newMisses)
    }
}
