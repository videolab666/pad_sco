package com.padel.cameraagent

import org.junit.Assert.assertEquals
import org.junit.Test

class StreamRecoveryPolicyTest {
    @Test fun operatorStopNeverRecovers() {
        assertEquals(
            RecoveryAction.NONE,
            StreamRecoveryPolicy.decide(
                nowMs = 500_000,
                streamDesired = false,
                lastProgressMs = 0,
                consecutiveFailures = 99,
                lastRebootMs = null,
            ),
        )
    }

    @Test fun freshProgressNeedsNoRecovery() {
        assertEquals(
            RecoveryAction.NONE,
            StreamRecoveryPolicy.decide(100_000, true, 20_001, 4, null),
        )
    }

    @Test fun staleProgressTriggersColdRestartBeforeFiveFailures() {
        assertEquals(
            RecoveryAction.COLD_RESTART,
            StreamRecoveryPolicy.decide(100_000, true, 0, 4, null),
        )
    }

    @Test fun fifthFailedRecoveryAllowsOneGuardedReboot() {
        assertEquals(
            RecoveryAction.REBOOT_DEVICE,
            StreamRecoveryPolicy.decide(100_000, true, 0, 5, null),
        )
        assertEquals(
            RecoveryAction.COLD_RESTART,
            StreamRecoveryPolicy.decide(
                nowMs = StreamRecoveryPolicy.REBOOT_COOLDOWN_MS - 1,
                streamDesired = true,
                lastProgressMs = 0,
                consecutiveFailures = 5,
                lastRebootMs = 0,
            ),
        )
    }

    @Test fun stableProgressResetsFailureCount() {
        assertEquals(0, StreamRecoveryPolicy.updatedFailureCount(5, madeProgress = true))
        assertEquals(5, StreamRecoveryPolicy.updatedFailureCount(5, madeProgress = false))
    }
}
