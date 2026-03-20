import { describe, it, expect } from '@jest/globals';

/**
 * Integration tests for auth flow.
 * These require a running database — skip if DB not available.
 */
describe('Auth Integration (requires DB)', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3000';

  const canConnect = async () => {
    try {
      const res = await fetch(`${API_URL}/health`);
      return res.ok;
    } catch {
      return false;
    }
  };

  it('should login with valid credentials', async () => {
    if (!(await canConnect())) return;

    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'driver1@greenwaste.com', password: 'password123' }),
    });

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.token).toBeDefined();
    expect(data.data.user.role).toBe('employee');
  });

  it('should reject invalid password', async () => {
    if (!(await canConnect())) return;

    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'driver1@greenwaste.com', password: 'wrongpassword' }),
    });

    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('should return user info with valid token', async () => {
    if (!(await canConnect())) return;

    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'driver1@greenwaste.com', password: 'password123' }),
    });
    const loginData = await loginRes.json();

    const meRes = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.data.token}` },
    });
    const meData = await meRes.json();
    expect(meData.success).toBe(true);
    expect(meData.data.user.email).toBe('driver1@greenwaste.com');
  });

  it('should reject request without token', async () => {
    if (!(await canConnect())) return;

    const res = await fetch(`${API_URL}/auth/me`);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(res.status).toBe(401);
  });
});
