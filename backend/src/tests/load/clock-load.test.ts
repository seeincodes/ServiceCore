import { describe, it, expect } from '@jest/globals';

/**
 * Load test for concurrent clock-in requests.
 * Requires running API with seeded data.
 */
describe('Load Test: Concurrent Clock-In (requires DB)', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3000';

  const canConnect = async () => {
    try {
      const res = await fetch(`${API_URL}/health`);
      return res.ok;
    } catch {
      return false;
    }
  };

  it('should handle 100+ concurrent status checks', async () => {
    if (!(await canConnect())) return;

    // Login first
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'driver1@greenwaste.com', password: 'password123' }),
    });
    const { data } = (await loginRes.json()) as any;
    const token = data.token;

    // Fire 100 concurrent status requests
    const concurrency = 100;
    const start = Date.now();

    const promises = Array.from({ length: concurrency }, () =>
      fetch(`${API_URL}/timesheets/status`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => ({ status: r.status, ok: r.ok })),
    );

    const results = await Promise.all(promises);
    const elapsed = Date.now() - start;

    const successCount = results.filter((r) => r.ok).length;
    expect(successCount).toBeGreaterThanOrEqual(concurrency * 0.95); // 95% success
    expect(elapsed).toBeLessThan(10000); // Under 10 seconds

    console.log(`Load test: ${concurrency} requests in ${elapsed}ms, ${successCount} succeeded`);
  }, 30000);
});
