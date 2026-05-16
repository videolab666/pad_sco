// Configuration for the double-yellow.be public feeds integration.

export const DY_BASE = "https://tennispadel.double-yellow.be"

// Which Sequence-* array to use as the primary platform list.
export const DY_SEQUENCE_KEY = "Sequence-TennisPadel"

// Tournament filtering by dates (mirrors the Android app settings).
export const DY_FILTER = {
  wasBusyDaysBack: 3, // tournament ended no more than N days ago
  willStartDaysAhead: 30, // starts no later than N days from now
  maxDurationDays: 30, // for NON-leagues: drop tournaments longer than N days
}

// Allowed host for the proxy (SSRF protection).
export const DY_ALLOWED_HOST = "tennispadel.double-yellow.be"
