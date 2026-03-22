import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import db from '../../shared/database/connection';
import { AuthenticatedUser, UserRole } from '../../shared/types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRY = (process.env.JWT_EXPIRY || '24h') as jwt.SignOptions['expiresIn'];
const REFRESH_TOKEN_EXPIRY = (process.env.REFRESH_TOKEN_EXPIRY ||
  '7d') as jwt.SignOptions['expiresIn'];

export interface TokenPair {
  token: string;
  refreshToken: string;
}

export interface LoginResult {
  user: Omit<AuthenticatedUser, 'passwordHash'> & {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  tokens: TokenPair;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await db('users').where({ email, is_active: true }).first();

  if (!user) {
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  const tokens = generateTokens({
    id: user.id,
    orgId: user.org_id,
    email: user.email,
    role: user.role,
  });

  return {
    user: {
      id: user.id,
      orgId: user.org_id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
    },
    tokens,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  const payload = verifyToken(refreshToken);
  if (!payload) {
    throw new Error('Invalid refresh token');
  }

  const user = await db('users').where({ id: payload.id, is_active: true }).first();

  if (!user) {
    throw new Error('User not found');
  }

  return generateTokens({
    id: user.id,
    orgId: user.org_id,
    email: user.email,
    role: user.role,
  });
}

export async function getUserById(userId: string): Promise<Record<string, unknown> | null> {
  const user = await db('users')
    .join('orgs', 'users.org_id', 'orgs.id')
    .where({ 'users.id': userId, 'users.is_active': true })
    .select(
      'users.id',
      'users.org_id',
      'users.email',
      'users.first_name',
      'users.last_name',
      'users.role',
      'users.phone',
      'orgs.name as org_name',
      'orgs.slug as org_slug',
    )
    .first();

  return user || null;
}

export async function registerUser(
  orgId: string,
  email: string,
  password: string,
  role: UserRole,
  firstName?: string,
  lastName?: string,
  phone?: string,
): Promise<Record<string, unknown>> {
  const existing = await db('users').where({ org_id: orgId, email }).first();
  if (existing) {
    throw new Error('User already exists in this organization');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db('users')
    .insert({
      org_id: orgId,
      email,
      password_hash: passwordHash,
      role,
      first_name: firstName,
      last_name: lastName,
      phone,
    })
    .returning(['id', 'org_id', 'email', 'role', 'first_name', 'last_name']);

  return user;
}

function generateTokens(payload: AuthenticatedUser): TokenPair {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { token, refreshToken };
}

function verifyToken(token: string): AuthenticatedUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    return decoded;
  } catch {
    return null;
  }
}
