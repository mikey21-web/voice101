package com.diyaa.calltracker.capture

import org.junit.Assert.assertEquals
import org.junit.Test

class NativeRecorderStateTest {

    @Test
    fun `found recording resets to available with zero misses`() {
        val result = NativeRecorderState.next(current = false, misses = 2, found = true, threshold = 3)
        assertEquals(NativeRecorderState.Result(available = true, misses = 0), result)
    }

    @Test
    fun `unknown state accumulates misses instead of staying stuck`() {
        // Regression test: on first install `current` is null (unknown). The old code only
        // incremented misses when current == true, so a phone with no OEM recorder at all
        // never reached the threshold and the VOICE_CALL fallback never unlocked.
        var current: Boolean? = null
        var misses = 0
        repeat(3) {
            val result = NativeRecorderState.next(current, misses, found = false, threshold = 3)
            current = result.available
            misses = result.misses
        }
        assertEquals(false, current)
        assertEquals(3, misses)
    }

    @Test
    fun `known-true state still falls back to false after threshold misses`() {
        var current: Boolean? = true
        var misses = 0
        repeat(3) {
            val result = NativeRecorderState.next(current, misses, found = false, threshold = 3)
            current = result.available
            misses = result.misses
        }
        assertEquals(false, current)
    }

    @Test
    fun `misses below threshold do not flip availability`() {
        val result = NativeRecorderState.next(current = null, misses = 0, found = false, threshold = 3)
        assertEquals(null, result.available)
        assertEquals(1, result.misses)
    }
}
