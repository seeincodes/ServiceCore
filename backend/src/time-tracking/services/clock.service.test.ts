import * as clockService from './clock.service';
import db from '../../shared/database/connection';
import { emitToOrg } from '../../shared/websocket/socket';

jest.mock('../../shared/database/connection');
jest.mock('../../shared/websocket/socket', () => ({
  emitToOrg: jest.fn(),
}));

const mockDb = db as unknown as jest.Mock;
const mockEmitToOrg = emitToOrg as jest.MockedFunction<typeof emitToOrg>;

function makeThenableArray(rows: unknown[]) {
  const chain: Record<string, jest.Mock | unknown> = {};
  chain.where = jest.fn(() => chain);
  chain.whereNotNull = jest.fn(() => chain);
  chain.then = jest.fn((resolve: (v: unknown) => void) => {
    resolve(rows);
    return Promise.resolve(rows);
  });
  return chain;
}

describe('clock.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('clockIn', () => {
    it('returns existing entry when idempotency key matches', async () => {
      const existing = {
        id: 'entry-dup',
        clock_in: new Date('2025-06-01T08:00:00.000Z'),
        route_id: 'route-99',
        project_id: 'proj-1',
      };
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existing),
      });

      const result = await clockService.clockIn({
        orgId: 'org-1',
        userId: 'user-1',
        idempotencyKey: 'idem-1',
      });

      expect(result.entryId).toBe('entry-dup');
      expect(result.status).toBe('clocked_in');
      expect(result.routeId).toBe('route-99');
      expect(result.projectId).toBe('proj-1');
      expect(mockEmitToOrg).not.toHaveBeenCalled();
    });

    it('throws when user already has an open entry', async () => {
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 'open-entry' }),
      });

      await expect(clockService.clockIn({ orgId: 'org-1', userId: 'user-1' })).rejects.toThrow(
        'Already clocked in',
      );
    });

    it('throws when daily worked hours reach safety limit', async () => {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 16 * 60 * 60 * 1000);
      const closedEntries = [{ clock_in: dayStart, clock_out: dayEnd }];

      let call = 0;
      mockDb.mockImplementation(() => {
        call += 1;
        // call 1: check for open entry
        if (call === 1) {
          return {
            where: jest.fn().mockReturnThis(),
            whereNull: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue(undefined),
          };
        }
        // call 2: schedule lookup (auto-fill project/route)
        if (call === 2) {
          return {
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue(undefined),
          };
        }
        // call 3: getTodayHours — completed entries
        if (call === 3) {
          return makeThenableArray(closedEntries);
        }
        return {};
      });

      await expect(clockService.clockIn({ orgId: 'org-1', userId: 'user-1' })).rejects.toThrow(
        /Safety limit/,
      );
    });

    it('inserts entry and emits clock_in on success', async () => {
      const clockInTime = new Date('2025-06-02T09:00:00.000Z');
      let call = 0;
      mockDb.mockImplementation(() => {
        call += 1;
        // call 1: check for open entry
        if (call === 1) {
          return {
            where: jest.fn().mockReturnThis(),
            whereNull: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue(undefined),
          };
        }
        // call 2: getTodayHours (schedule lookup skipped — both projectId & routeId provided)
        if (call === 2) {
          return makeThenableArray([]);
        }
        // call 3: insert clock entry
        if (call === 3) {
          return {
            insert: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([
                {
                  id: 'new-entry',
                  clock_in: clockInTime,
                  route_id: 'R1',
                  project_id: 'P1',
                },
              ]),
            }),
          };
        }
        return {};
      });

      const result = await clockService.clockIn({
        orgId: 'org-1',
        userId: 'user-1',
        routeId: 'R1',
        projectId: 'P1',
      });

      expect(result.entryId).toBe('new-entry');
      expect(result.status).toBe('clocked_in');
      expect(mockEmitToOrg).toHaveBeenCalledWith(
        'org-1',
        'clock_in',
        expect.objectContaining({ userId: 'user-1', entryId: 'new-entry' }),
      );
    });
  });

  describe('clockOut', () => {
    it('throws when no active clock-in', async () => {
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
      });

      await expect(clockService.clockOut('org-1', 'user-1')).rejects.toThrow(
        'No active clock-in found',
      );
    });

    it('updates entry and returns hours worked', async () => {
      const clockIn = new Date(Date.now() - 2 * 60 * 60 * 1000);
      let call = 0;
      mockDb.mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return {
            where: jest.fn().mockReturnThis(),
            whereNull: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({ id: 'e1', clock_in: clockIn }),
          };
        }
        return {
          where: jest.fn().mockReturnThis(),
          update: jest.fn().mockResolvedValue(1),
        };
      });

      const result = await clockService.clockOut('org-1', 'user-1');

      expect(result.entryId).toBe('e1');
      expect(result.status).toBe('clocked_out');
      expect(result.hoursWorked).toBeCloseTo(2, 1);
      expect(mockEmitToOrg).toHaveBeenCalledWith(
        'org-1',
        'clock_out',
        expect.objectContaining({ userId: 'user-1', entryId: 'e1' }),
      );
    });

    it('emits ot_alert when shift is very long', async () => {
      const clockIn = new Date(Date.now() - 40 * 60 * 60 * 1000);
      let call = 0;
      mockDb.mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return {
            where: jest.fn().mockReturnThis(),
            whereNull: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({ id: 'e-long', clock_in: clockIn }),
          };
        }
        return {
          where: jest.fn().mockReturnThis(),
          update: jest.fn().mockResolvedValue(1),
        };
      });

      await clockService.clockOut('org-1', 'user-1');

      expect(mockEmitToOrg).toHaveBeenCalledWith(
        'org-1',
        'ot_alert',
        expect.objectContaining({ userId: 'user-1', alertType: expect.any(String) }),
      );
    });
  });

  describe('getActiveEntry', () => {
    it('returns first open entry or undefined', async () => {
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      });

      const entry = await clockService.getActiveEntry('org-1', 'user-1');
      expect(entry).toBeNull();
    });
  });
});
