// Test-side environment for the gate-diagnostics tests.
//
// MUST be imported before "../convex/pawapay": that module captures
// PAWAPAY_API_TOKEN at import time (module-level const), and the gate
// tests must pass Gate 1 (503) to reach gates 2–5d. The value below is a
// fake placeholder — never a real credential, never sent anywhere
// (outbound calls are mocked in the tests that reach them).
export const GATE_DIAG_TEST_TOKEN = "diag-test-token-not-a-real-secret";

if (!process.env.PAWAPAY_API_TOKEN) {
  process.env.PAWAPAY_API_TOKEN = GATE_DIAG_TEST_TOKEN;
}
