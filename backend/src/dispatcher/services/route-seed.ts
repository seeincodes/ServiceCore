import db from '../../shared/database/connection';
import redis from '../../shared/database/redis';
import logger from '../../shared/utils/logger';

interface SeededRoute {
  id: string;
  name: string;
  projectId: string;
  projectCode: string;
  stops: number;
  status: string;
  assignedDriverId?: string;
  waypoints: { id: string; name: string; lat: number; lon: number; notes?: string }[];
}

// Route templates per project code
const ROUTE_TEMPLATES: Record<
  string,
  Omit<SeededRoute, 'assignedDriverId' | 'projectId' | 'projectCode'>[]
> = {
  'RES-PICKUP': [
    {
      id: 'RES-01',
      name: 'Sunset Residential',
      stops: 6,
      status: 'active',
      waypoints: [
        {
          id: 'w1',
          name: 'Depot - Bayshore Yard',
          lat: 37.7196,
          lon: -122.3992,
          notes: 'Load truck',
        },
        {
          id: 'w2',
          name: 'Inner Sunset - Irving St',
          lat: 37.7637,
          lon: -122.4627,
          notes: 'Curbside bins',
        },
        {
          id: 'w3',
          name: 'Outer Sunset - Taraval',
          lat: 37.7424,
          lon: -122.4949,
          notes: 'Green bins only',
        },
        { id: 'w4', name: 'Parkside - 26th Ave', lat: 37.7382, lon: -122.4838, notes: '40 homes' },
        { id: 'w5', name: 'Lake Merced', lat: 37.7285, lon: -122.4937, notes: 'End of street' },
        { id: 'w6', name: 'Depot Return', lat: 37.7196, lon: -122.3992, notes: 'Weigh truck' },
      ],
    },
    {
      id: 'RES-02',
      name: 'Richmond Residential',
      stops: 5,
      status: 'active',
      waypoints: [
        { id: 'w1', name: 'Depot - Bayshore Yard', lat: 37.7196, lon: -122.3992 },
        {
          id: 'w2',
          name: 'Inner Richmond - Clement St',
          lat: 37.7828,
          lon: -122.4597,
          notes: 'Narrow streets',
        },
        {
          id: 'w3',
          name: 'Outer Richmond - Balboa',
          lat: 37.7755,
          lon: -122.5078,
          notes: '30 homes',
        },
        { id: 'w4', name: 'Sea Cliff', lat: 37.7856, lon: -122.4902, notes: 'Steep driveways' },
        { id: 'w5', name: 'Depot Return', lat: 37.7196, lon: -122.3992 },
      ],
    },
  ],
  'COM-PICKUP': [
    {
      id: 'COM-01',
      name: 'Downtown Commercial',
      stops: 8,
      status: 'active',
      waypoints: [
        {
          id: 'w1',
          name: 'Depot - Bayshore Yard',
          lat: 37.7196,
          lon: -122.3992,
          notes: 'Load truck, check route sheet',
        },
        {
          id: 'w2',
          name: 'Market St & 3rd',
          lat: 37.7869,
          lon: -122.4025,
          notes: 'Use loading dock on 3rd St side',
        },
        {
          id: 'w3',
          name: 'Union Square',
          lat: 37.7879,
          lon: -122.4074,
          notes: "4 dumpsters behind Macy's",
        },
        {
          id: 'w4',
          name: 'Financial District',
          lat: 37.7946,
          lon: -122.3999,
          notes: 'Basement access, ring buzzer #3',
        },
        {
          id: 'w5',
          name: 'Embarcadero Center',
          lat: 37.7954,
          lon: -122.3962,
          notes: 'Parking garage level B2',
        },
        {
          id: 'w6',
          name: 'Ferry Building',
          lat: 37.7955,
          lon: -122.3935,
          notes: 'Recycling only — no trash',
        },
        {
          id: 'w7',
          name: 'SOMA - Howard St',
          lat: 37.7833,
          lon: -122.3958,
          notes: '2 bins, narrow alley',
        },
        {
          id: 'w8',
          name: 'Depot Return',
          lat: 37.7196,
          lon: -122.3992,
          notes: 'Weigh truck, submit log',
        },
      ],
    },
    {
      id: 'COM-02',
      name: 'Mission Commercial',
      stops: 6,
      status: 'active',
      waypoints: [
        { id: 'w1', name: 'Depot - Bayshore Yard', lat: 37.7196, lon: -122.3992 },
        {
          id: 'w2',
          name: '16th & Mission',
          lat: 37.7649,
          lon: -122.4194,
          notes: 'Restaurant row — 8 bins',
        },
        {
          id: 'w3',
          name: '24th & Valencia',
          lat: 37.7526,
          lon: -122.4202,
          notes: 'Watch for bike lane',
        },
        {
          id: 'w4',
          name: 'Castro & 18th',
          lat: 37.7609,
          lon: -122.435,
          notes: '3 commercial dumpsters',
        },
        { id: 'w5', name: 'Noe Valley shops', lat: 37.7502, lon: -122.4337, notes: '5 businesses' },
        { id: 'w6', name: 'Depot Return', lat: 37.7196, lon: -122.3992 },
      ],
    },
  ],
  RECYCLING: [
    {
      id: 'RCY-01',
      name: 'North Beach Recycling',
      stops: 5,
      status: 'active',
      waypoints: [
        { id: 'w1', name: 'Depot - Bayshore Yard', lat: 37.7196, lon: -122.3992 },
        {
          id: 'w2',
          name: 'Chinatown - Grant Ave',
          lat: 37.7941,
          lon: -122.4078,
          notes: 'Blue bins only',
        },
        {
          id: 'w3',
          name: 'North Beach - Columbus',
          lat: 37.8005,
          lon: -122.4109,
          notes: 'Cardboard + cans',
        },
        {
          id: 'w4',
          name: 'Fishermans Wharf',
          lat: 37.808,
          lon: -122.4177,
          notes: 'Tourist area — be careful',
        },
        { id: 'w5', name: 'Depot Return', lat: 37.7196, lon: -122.3992 },
      ],
    },
  ],
  'BULK-WASTE': [
    {
      id: 'BLK-01',
      name: 'Bayview Bulk Pickup',
      stops: 5,
      status: 'active',
      waypoints: [
        { id: 'w1', name: 'Depot - Bayshore Yard', lat: 37.7196, lon: -122.3992 },
        {
          id: 'w2',
          name: 'Potrero Hill',
          lat: 37.7607,
          lon: -122.3918,
          notes: 'Scheduled pickup — couch + mattress',
        },
        { id: 'w3', name: 'Dogpatch', lat: 37.7567, lon: -122.3873, notes: 'Construction debris' },
        { id: 'w4', name: 'Hunters Point', lat: 37.7247, lon: -122.3811, notes: 'Appliances' },
        { id: 'w5', name: 'Depot Return', lat: 37.7196, lon: -122.3992 },
      ],
    },
  ],
  'YARD-WORK': [
    {
      id: 'YRD-01',
      name: 'Golden Gate Park Maintenance',
      stops: 4,
      status: 'active',
      waypoints: [
        { id: 'w1', name: 'Depot - Bayshore Yard', lat: 37.7196, lon: -122.3992 },
        {
          id: 'w2',
          name: 'GGP - East Meadow',
          lat: 37.7694,
          lon: -122.4662,
          notes: 'Mowing + debris',
        },
        {
          id: 'w3',
          name: 'GGP - Stow Lake',
          lat: 37.7683,
          lon: -122.4754,
          notes: 'Trash bins around lake',
        },
        { id: 'w4', name: 'Depot Return', lat: 37.7196, lon: -122.3992 },
      ],
    },
  ],
};

/**
 * Seeds Redis with demo route data linked to projects.
 */
export async function seedDemoRoutes(): Promise<void> {
  try {
    const orgs = await db('orgs').where({ is_active: true }).select('id', 'config');

    for (const org of orgs) {
      const config = typeof org.config === 'string' ? JSON.parse(org.config) : org.config || {};
      if (config.dispatcher_api_url) continue;

      const cacheKey = `routes:${org.id}`;
      const existing = await redis.get(cacheKey);
      if (existing) continue;

      // Get projects for this org
      const projects = await db('projects')
        .where({ org_id: org.id, is_active: true })
        .select('id', 'code', 'name');

      // Get drivers
      const drivers = await db('users')
        .where({ org_id: org.id, role: 'employee', is_active: true })
        .select('id');

      const allRoutes: SeededRoute[] = [];
      let driverIdx = 0;

      for (const project of projects) {
        const templates = ROUTE_TEMPLATES[project.code] || [];
        for (const tmpl of templates) {
          allRoutes.push({
            ...tmpl,
            projectId: project.id,
            projectCode: project.code,
            assignedDriverId:
              drivers.length > 0 ? drivers[driverIdx % drivers.length].id : undefined,
          });
          driverIdx++;
        }
      }

      if (allRoutes.length > 0) {
        await redis.setex(cacheKey, 86400, JSON.stringify(allRoutes));
        logger.info('Demo routes seeded', { orgId: org.id, count: allRoutes.length });
      }
    }
  } catch (err) {
    logger.warn('Failed to seed demo routes', { error: (err as Error).message });
  }
}
