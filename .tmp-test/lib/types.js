"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYNC_SCHEMA_VERSION = void 0;
// ─── Realtime sync model (Task 2: durable sync and replay) ─────────────────────
/**
 * Schema version of the persisted operation log. Bump when the shape of
 * MatchOperation / MatchSyncRecord changes so older payloads can be rejected
 * or migrated instead of corrupting the scoring state.
 */
exports.SYNC_SCHEMA_VERSION = 1;
