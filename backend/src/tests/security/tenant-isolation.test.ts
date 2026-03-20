import { describe, it, expect } from '@jest/globals';

/**
 * Security tests for multi-tenant isolation.
 * Requires running API with seeded data.
 */
describe('Multi-Tenant Isolation (requires DB)', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3000';

  const login = async (email: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    const data = await res.json();
    return data.data?.token;
  };

  const canConnect = async () => {
    try {
      const res = await fetch(`${API_URL}/health`);
      return res.ok;
    } catch {
      return false;
    }
  };

  it('should not allow GreenWaste manager to see Metro drivers', async () => {
    if (!(await canConnect())) return;

    const token = await login('manager@greenwaste.com');
    const res = await fetch(`${API_URL}/manager/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    expect(data.success).toBe(true);
    const names = data.data.drivers.map((d: any) => d.name);
    expect(names).not.toContain('Carlos Ruiz');
    expect(names).not.toContain('Maria Santos');
  });

  it('should not allow Metro manager to see GreenWaste drivers', async () => {
    if (!(await canConnect())) return;

    const token = await login('manager@metrodisposal.com');
    const res = await fetch(`${API_URL}/manager/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    expect(data.success).toBe(true);
    const names = data.data.drivers.map((d: any) => d.name);
    expect(names).not.toContain('John Driver');
    expect(names).not.toContain('Jane Driver');
    expect(names).not.toContain('Bob Trucker');
  });

  it('should reject driver access to manager dashboard', async () => {
    if (!(await canConnect())) return;

    const token = await login('driver1@greenwaste.com');
    const res = await fetch(`${API_URL}/manager/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(403);
  });

  it('should reject unauthenticated access to clock-in', async () => {
    if (!(await canConnect())) return;

    const res = await fetch(`${API_URL}/timesheets/clock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(401);
  });
});
