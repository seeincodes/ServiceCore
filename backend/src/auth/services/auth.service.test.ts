import * as authService from './auth.service';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../../shared/database/connection';

jest.mock('../../shared/database/connection');
jest.mock('bcrypt');

const mockDb = db as unknown as jest.Mock;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('throws when user not found', async () => {
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
      } as unknown as ReturnType<typeof db>);

      await expect(authService.login('nobody@example.com', 'pass')).rejects.toThrow(
        'Invalid email or password',
      );
    });

    it('throws when password invalid', async () => {
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 'user-1',
          org_id: 'org-1',
          email: 'user@example.com',
          password_hash: 'hashed',
          role: 'employee',
          first_name: 'Jane',
          last_name: 'Doe',
        }),
      } as unknown as ReturnType<typeof db>);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login('user@example.com', 'wrong')).rejects.toThrow(
        'Invalid email or password',
      );
    });

    it('returns user and tokens when credentials valid', async () => {
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 'user-1',
          org_id: 'org-1',
          email: 'user@example.com',
          password_hash: 'hashed',
          role: 'manager',
          first_name: 'Jane',
          last_name: 'Doe',
        }),
      } as unknown as ReturnType<typeof db>);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login('user@example.com', 'correct');

      expect(result.user).toMatchObject({
        id: 'user-1',
        orgId: 'org-1',
        email: 'user@example.com',
        role: 'manager',
        firstName: 'Jane',
        lastName: 'Doe',
      });
      expect(result.tokens).toHaveProperty('token');
      expect(result.tokens).toHaveProperty('refreshToken');
      expect(typeof result.tokens.token).toBe('string');
      expect(typeof result.tokens.refreshToken).toBe('string');
    });
  });

  describe('refreshAccessToken', () => {
    it('throws when refresh token invalid', async () => {
      await expect(authService.refreshAccessToken('invalid-jwt')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('returns new token pair when refresh token valid', async () => {
      const secret = process.env.JWT_SECRET || 'test-secret';
      const payload = { id: 'user-1', orgId: 'org-1', email: 'u@x.com', role: 'employee' };
      const refreshToken = jwt.sign(payload, secret, { expiresIn: '7d' });

      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 'user-1',
          org_id: 'org-1',
          email: 'u@x.com',
          role: 'employee',
        }),
      } as unknown as ReturnType<typeof db>);

      const tokens = await authService.refreshAccessToken(refreshToken);

      expect(tokens).toHaveProperty('token');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.token).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });
  });

  describe('getUserById', () => {
    it('returns null when user not found', async () => {
      const chain = {
        join: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.mockReturnValue(chain as unknown as ReturnType<typeof db>);

      const result = await authService.getUserById('missing-id');
      expect(result).toBeNull();
    });

    it('returns user when found', async () => {
      const chain = {
        join: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 'user-1',
          org_id: 'org-1',
          email: 'u@x.com',
          first_name: 'A',
          last_name: 'B',
          role: 'employee',
          org_name: 'Org',
          org_slug: 'org',
        }),
      };
      mockDb.mockReturnValue(chain as unknown as ReturnType<typeof db>);

      const result = await authService.getUserById('user-1');
      expect(result).not.toBeNull();
      expect(result?.email).toBe('u@x.com');
    });
  });

  describe('registerUser', () => {
    it('throws when user already exists in org', async () => {
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 'existing' }),
      } as unknown as ReturnType<typeof db>);

      await expect(
        authService.registerUser('org-1', 'existing@x.com', 'password', 'employee'),
      ).rejects.toThrow('User already exists in this organization');
    });

    it('inserts and returns user when new', async () => {
      const insertedUser = {
        id: 'new-id',
        org_id: 'org-1',
        email: 'new@x.com',
        role: 'employee',
        first_name: 'New',
        last_name: 'User',
      };
      mockDb.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([insertedUser]),
      } as unknown as ReturnType<typeof db>);
      (mockBcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const result = await authService.registerUser(
        'org-1',
        'new@x.com',
        'password',
        'employee',
        'New',
        'User',
      );

      expect(result).toEqual(insertedUser);
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password', 10);
    });
  });
});
