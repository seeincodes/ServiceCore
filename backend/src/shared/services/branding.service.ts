import db from '../database/connection';
import redis from '../database/redis';
import logger from '../utils/logger';

const ORG_CONFIG_TTL = 3600; // 1 hour

export interface OrgBranding {
  logo: string;
  primaryColor: string;
  secondaryColor?: string;
  customDomain?: string;
  companyName: string;
}

export interface OrgFeatureToggles {
  smsEnabled: boolean;
  qbSyncEnabled: boolean;
  otWorkflowEnabled: boolean;
  dispatcherEnabled: boolean;
  ivrEnabled: boolean;
}

export interface OrgPublicConfig {
  branding: OrgBranding;
  features: OrgFeatureToggles;
}

/**
 * Get org branding and feature config (cached in Redis).
 */
export async function getOrgConfig(orgId: string): Promise<OrgPublicConfig | null> {
  const cacheKey = `org_config:${orgId}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const org = await db('orgs').where({ id: orgId, is_active: true }).first();
  if (!org) return null;

  const config = typeof org.config === 'string' ? JSON.parse(org.config) : org.config || {};
  const branding = typeof org.branding === 'string' ? JSON.parse(org.branding) : org.branding || {};

  const result: OrgPublicConfig = {
    branding: {
      logo: branding.logo || '',
      primaryColor: branding.primaryColor || branding.primary_color || '#1a73e8',
      secondaryColor: branding.secondaryColor || branding.secondary_color,
      customDomain: branding.customDomain || branding.custom_domain,
      companyName: org.name,
    },
    features: {
      smsEnabled: config.sms_enabled !== false,
      qbSyncEnabled: config.qb_enabled === true,
      otWorkflowEnabled: config.ot_workflow_enabled !== false,
      dispatcherEnabled: !!config.dispatcher_api_url,
      ivrEnabled: config.ivr_enabled === true,
    },
  };

  await redis.setex(cacheKey, ORG_CONFIG_TTL, JSON.stringify(result));
  return result;
}

/**
 * Update org branding.
 */
export async function updateBranding(orgId: string, branding: Partial<OrgBranding>): Promise<void> {
  const org = await db('orgs').where({ id: orgId }).first();
  if (!org) throw new Error('Org not found');

  const existing = typeof org.branding === 'string' ? JSON.parse(org.branding) : org.branding || {};
  const updated = { ...existing, ...branding };

  await db('orgs')
    .where({ id: orgId })
    .update({
      branding: JSON.stringify(updated),
      updated_at: new Date(),
    });

  // Invalidate cache
  await redis.del(`org_config:${orgId}`);
  logger.info('Org branding updated', { orgId });
}

/**
 * Update org feature toggles.
 */
export async function updateFeatureToggles(
  orgId: string,
  toggles: Partial<Record<string, boolean>>,
): Promise<void> {
  const org = await db('orgs').where({ id: orgId }).first();
  if (!org) throw new Error('Org not found');

  const existing = typeof org.config === 'string' ? JSON.parse(org.config) : org.config || {};
  const updated = { ...existing, ...toggles };

  await db('orgs')
    .where({ id: orgId })
    .update({
      config: JSON.stringify(updated),
      updated_at: new Date(),
    });

  await redis.del(`org_config:${orgId}`);
  logger.info('Org feature toggles updated', { orgId });
}

/**
 * Resolve org by custom domain or slug.
 */
export async function resolveOrg(
  slugOrDomain: string,
): Promise<{ id: string; slug: string } | null> {
  // Check by custom domain first
  const byDomain = await db('orgs')
    .where({ is_active: true })
    .whereRaw("branding->>'custom_domain' = ?", [slugOrDomain])
    .select('id', 'slug')
    .first();

  if (byDomain) return byDomain;

  // Fall back to slug
  const bySlug = await db('orgs')
    .where({ slug: slugOrDomain, is_active: true })
    .select('id', 'slug')
    .first();

  return bySlug || null;
}
