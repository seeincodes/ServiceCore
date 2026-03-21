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

// Route templates per project code — each route has enough stops for ~6 hours
const ROUTE_TEMPLATES: Record<
  string,
  Omit<SeededRoute, 'assignedDriverId' | 'projectId' | 'projectCode'>[]
> = {
  'RES-PICKUP': [
    {
      id: 'RES-01',
      name: 'Sunset & Parkside Residential',
      stops: 20,
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
          name: 'Inner Sunset - Irving St',
          lat: 37.7637,
          lon: -122.4627,
          notes: 'Curbside bins — 12 homes',
        },
        {
          id: 'w3',
          name: 'Inner Sunset - Judah St',
          lat: 37.7609,
          lon: -122.4633,
          notes: '10 homes, tight street',
        },
        {
          id: 'w4',
          name: 'Inner Sunset - Kirkham St',
          lat: 37.7584,
          lon: -122.464,
          notes: '8 homes',
        },
        {
          id: 'w5',
          name: 'Golden Gate Heights',
          lat: 37.756,
          lon: -122.468,
          notes: 'Steep hills — use parking brake',
        },
        {
          id: 'w6',
          name: 'Outer Sunset - Noriega St',
          lat: 37.7535,
          lon: -122.485,
          notes: '15 homes',
        },
        {
          id: 'w7',
          name: 'Outer Sunset - Ortega St',
          lat: 37.751,
          lon: -122.487,
          notes: '12 homes',
        },
        {
          id: 'w8',
          name: 'Outer Sunset - Pacheco St',
          lat: 37.749,
          lon: -122.489,
          notes: '10 homes',
        },
        {
          id: 'w9',
          name: 'Outer Sunset - Quintara St',
          lat: 37.747,
          lon: -122.491,
          notes: '14 homes',
        },
        {
          id: 'w10',
          name: 'Outer Sunset - Rivera St',
          lat: 37.745,
          lon: -122.493,
          notes: '11 homes',
        },
        {
          id: 'w11',
          name: 'Outer Sunset - Santiago St',
          lat: 37.743,
          lon: -122.4945,
          notes: '9 homes',
        },
        {
          id: 'w12',
          name: 'Outer Sunset - Taraval St',
          lat: 37.7424,
          lon: -122.4949,
          notes: 'Green bins only — 13 homes',
        },
        { id: 'w13', name: 'Parkside - 19th Ave', lat: 37.74, lon: -122.476, notes: '10 homes' },
        { id: 'w14', name: 'Parkside - 23rd Ave', lat: 37.739, lon: -122.48, notes: '12 homes' },
        { id: 'w15', name: 'Parkside - 26th Ave', lat: 37.7382, lon: -122.4838, notes: '8 homes' },
        { id: 'w16', name: 'Parkside - 30th Ave', lat: 37.7375, lon: -122.488, notes: '11 homes' },
        {
          id: 'w17',
          name: 'Lake Merced North',
          lat: 37.7285,
          lon: -122.4937,
          notes: '6 homes, end of street',
        },
        {
          id: 'w18',
          name: 'Stonestown Area',
          lat: 37.727,
          lon: -122.4778,
          notes: 'Apartment complex — 4 dumpsters',
        },
        {
          id: 'w19',
          name: 'SF State Area',
          lat: 37.7237,
          lon: -122.4787,
          notes: 'Student housing bins',
        },
        {
          id: 'w20',
          name: 'Depot Return',
          lat: 37.7196,
          lon: -122.3992,
          notes: 'Weigh truck, submit log',
        },
      ],
    },
    {
      id: 'RES-02',
      name: 'Richmond & Marina Residential',
      stops: 18,
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
          name: 'Inner Richmond - Clement St',
          lat: 37.7828,
          lon: -122.4597,
          notes: 'Narrow streets — 15 homes',
        },
        {
          id: 'w3',
          name: 'Inner Richmond - Geary Blvd',
          lat: 37.7808,
          lon: -122.46,
          notes: '10 homes',
        },
        {
          id: 'w4',
          name: 'Inner Richmond - Anza St',
          lat: 37.779,
          lon: -122.461,
          notes: '12 homes',
        },
        {
          id: 'w5',
          name: 'Central Richmond - 10th Ave',
          lat: 37.781,
          lon: -122.468,
          notes: '8 homes',
        },
        {
          id: 'w6',
          name: 'Central Richmond - 15th Ave',
          lat: 37.781,
          lon: -122.473,
          notes: '14 homes',
        },
        {
          id: 'w7',
          name: 'Outer Richmond - Balboa St',
          lat: 37.7755,
          lon: -122.5078,
          notes: '10 homes',
        },
        {
          id: 'w8',
          name: 'Outer Richmond - Cabrillo St',
          lat: 37.774,
          lon: -122.505,
          notes: '9 homes',
        },
        {
          id: 'w9',
          name: 'Outer Richmond - Fulton St',
          lat: 37.772,
          lon: -122.503,
          notes: '11 homes',
        },
        {
          id: 'w10',
          name: 'Sea Cliff',
          lat: 37.7856,
          lon: -122.4902,
          notes: 'Steep driveways — 6 homes',
        },
        {
          id: 'w11',
          name: 'Presidio Heights',
          lat: 37.788,
          lon: -122.45,
          notes: 'Large bins — 8 homes',
        },
        { id: 'w12', name: 'Laurel Heights', lat: 37.785, lon: -122.452, notes: '10 homes' },
        {
          id: 'w13',
          name: 'Marina - Chestnut St',
          lat: 37.801,
          lon: -122.437,
          notes: 'Apartments — 5 dumpsters',
        },
        { id: 'w14', name: 'Marina - Lombard St', lat: 37.799, lon: -122.435, notes: '12 homes' },
        { id: 'w15', name: 'Marina Blvd', lat: 37.8067, lon: -122.4371, notes: 'Waterfront bins' },
        { id: 'w16', name: 'Cow Hollow', lat: 37.7975, lon: -122.439, notes: '8 homes' },
        {
          id: 'w17',
          name: 'Pacific Heights',
          lat: 37.7925,
          lon: -122.435,
          notes: '7 homes, permit parking',
        },
        { id: 'w18', name: 'Depot Return', lat: 37.7196, lon: -122.3992, notes: 'Weigh truck' },
      ],
    },
  ],
  'COM-PICKUP': [
    {
      id: 'COM-01',
      name: 'Downtown & FiDi Commercial',
      stops: 22,
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
          notes: 'Loading dock on 3rd St side',
        },
        {
          id: 'w3',
          name: 'Yerba Buena Center',
          lat: 37.7855,
          lon: -122.402,
          notes: '2 dumpsters behind building',
        },
        {
          id: 'w4',
          name: "Union Square - Macy's",
          lat: 37.7879,
          lon: -122.4074,
          notes: '4 dumpsters, use freight elevator',
        },
        {
          id: 'w5',
          name: 'Union Square - Saks',
          lat: 37.7885,
          lon: -122.4065,
          notes: '2 compactors',
        },
        {
          id: 'w6',
          name: 'Stockton St Shops',
          lat: 37.787,
          lon: -122.4068,
          notes: '6 bins behind stores',
        },
        {
          id: 'w7',
          name: 'Financial District - California St',
          lat: 37.7932,
          lon: -122.3995,
          notes: 'Basement — buzzer #3',
        },
        {
          id: 'w8',
          name: 'Financial District - Pine St',
          lat: 37.792,
          lon: -122.401,
          notes: '3 bins in alley',
        },
        {
          id: 'w9',
          name: 'Financial District - Bush St',
          lat: 37.791,
          lon: -122.402,
          notes: '2 dumpsters',
        },
        {
          id: 'w10',
          name: 'FiDi - Montgomery St',
          lat: 37.7946,
          lon: -122.3999,
          notes: 'Office tower — loading dock B2',
        },
        { id: 'w11', name: 'FiDi - Sansome St', lat: 37.794, lon: -122.401, notes: '4 bins' },
        {
          id: 'w12',
          name: 'Embarcadero Center 1',
          lat: 37.7954,
          lon: -122.3962,
          notes: 'Parking garage level B2',
        },
        {
          id: 'w13',
          name: 'Embarcadero Center 3',
          lat: 37.795,
          lon: -122.3945,
          notes: 'Loading dock east side',
        },
        {
          id: 'w14',
          name: 'Ferry Building',
          lat: 37.7955,
          lon: -122.3935,
          notes: 'Recycling only — no trash',
        },
        { id: 'w15', name: 'Rincon Center', lat: 37.792, lon: -122.392, notes: '3 compactors' },
        {
          id: 'w16',
          name: 'SOMA - Howard St',
          lat: 37.7833,
          lon: -122.3958,
          notes: '2 bins, narrow alley',
        },
        {
          id: 'w17',
          name: 'SOMA - Folsom St',
          lat: 37.783,
          lon: -122.393,
          notes: 'Tech offices — 5 bins',
        },
        { id: 'w18', name: 'SOMA - Harrison St', lat: 37.781, lon: -122.394, notes: '4 bins' },
        {
          id: 'w19',
          name: 'SOMA - Bryant St',
          lat: 37.779,
          lon: -122.395,
          notes: 'Warehouse district — 3 dumpsters',
        },
        {
          id: 'w20',
          name: 'South Beach',
          lat: 37.783,
          lon: -122.388,
          notes: 'Condo complexes — 6 bins',
        },
        {
          id: 'w21',
          name: 'AT&T Park Area',
          lat: 37.7785,
          lon: -122.3895,
          notes: 'Restaurant row — 8 bins',
        },
        {
          id: 'w22',
          name: 'Depot Return',
          lat: 37.7196,
          lon: -122.3992,
          notes: 'Weigh truck, submit log',
        },
      ],
    },
    {
      id: 'COM-02',
      name: 'Mission & Castro Commercial',
      stops: 16,
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
          name: '16th & Mission - Restaurant Row',
          lat: 37.7649,
          lon: -122.4194,
          notes: '8 restaurant bins',
        },
        {
          id: 'w3',
          name: '16th & Valencia',
          lat: 37.7649,
          lon: -122.4215,
          notes: '5 business bins',
        },
        { id: 'w4', name: '18th & Mission', lat: 37.761, lon: -122.419, notes: '6 bins' },
        { id: 'w5', name: '20th & Mission', lat: 37.758, lon: -122.4185, notes: '4 bins' },
        { id: 'w6', name: '22nd & Valencia', lat: 37.755, lon: -122.42, notes: 'Cafes — 5 bins' },
        {
          id: 'w7',
          name: '24th & Valencia',
          lat: 37.7526,
          lon: -122.4202,
          notes: 'Watch for bike lane',
        },
        {
          id: 'w8',
          name: '24th & Mission',
          lat: 37.7526,
          lon: -122.418,
          notes: 'Market area — 7 bins',
        },
        {
          id: 'w9',
          name: 'Dolores & 18th',
          lat: 37.7609,
          lon: -122.4268,
          notes: '3 business bins',
        },
        {
          id: 'w10',
          name: 'Castro & 18th',
          lat: 37.7609,
          lon: -122.435,
          notes: '3 commercial dumpsters',
        },
        { id: 'w11', name: 'Castro & Market', lat: 37.7625, lon: -122.435, notes: '5 bins' },
        { id: 'w12', name: 'Upper Market', lat: 37.764, lon: -122.433, notes: '4 restaurant bins' },
        {
          id: 'w13',
          name: 'Noe Valley - 24th St shops',
          lat: 37.7502,
          lon: -122.4337,
          notes: '5 businesses',
        },
        { id: 'w14', name: 'Noe Valley - Church St', lat: 37.751, lon: -122.428, notes: '4 bins' },
        { id: 'w15', name: 'Glen Park Village', lat: 37.734, lon: -122.433, notes: '3 bins' },
        { id: 'w16', name: 'Depot Return', lat: 37.7196, lon: -122.3992, notes: 'Weigh truck' },
      ],
    },
  ],
  RECYCLING: [
    {
      id: 'RCY-01',
      name: 'North SF Recycling',
      stops: 18,
      status: 'active',
      waypoints: [
        {
          id: 'w1',
          name: 'Depot - Bayshore Yard',
          lat: 37.7196,
          lon: -122.3992,
          notes: 'Load recycling truck',
        },
        {
          id: 'w2',
          name: 'Chinatown - Grant Ave',
          lat: 37.7941,
          lon: -122.4078,
          notes: 'Blue bins only — 10 stops',
        },
        {
          id: 'w3',
          name: 'Chinatown - Stockton St',
          lat: 37.7935,
          lon: -122.4085,
          notes: '8 bins, narrow',
        },
        {
          id: 'w4',
          name: 'North Beach - Columbus Ave',
          lat: 37.8005,
          lon: -122.4109,
          notes: 'Cardboard + cans',
        },
        { id: 'w5', name: 'North Beach - Grant Ave', lat: 37.7995, lon: -122.408, notes: '6 bins' },
        { id: 'w6', name: 'North Beach - Green St', lat: 37.7998, lon: -122.4115, notes: '5 bins' },
        {
          id: 'w7',
          name: 'Telegraph Hill',
          lat: 37.8024,
          lon: -122.4058,
          notes: 'Walk-up bins — 4 stops',
        },
        {
          id: 'w8',
          name: 'Fishermans Wharf - Taylor St',
          lat: 37.808,
          lon: -122.415,
          notes: 'Tourist area — be careful',
        },
        {
          id: 'w9',
          name: 'Fishermans Wharf - Jefferson St',
          lat: 37.808,
          lon: -122.4177,
          notes: 'Restaurant recycling',
        },
        {
          id: 'w10',
          name: 'Pier 39 Area',
          lat: 37.8087,
          lon: -122.4098,
          notes: 'Large bins — 3 compactors',
        },
        { id: 'w11', name: 'Russian Hill - Polk St', lat: 37.796, lon: -122.421, notes: '7 bins' },
        { id: 'w12', name: 'Russian Hill - Hyde St', lat: 37.797, lon: -122.419, notes: '5 bins' },
        {
          id: 'w13',
          name: 'Nob Hill - California St',
          lat: 37.792,
          lon: -122.414,
          notes: 'Hotels — 4 compactors',
        },
        { id: 'w14', name: 'Nob Hill - Powell St', lat: 37.791, lon: -122.41, notes: '6 bins' },
        {
          id: 'w15',
          name: 'Tenderloin - Turk St',
          lat: 37.783,
          lon: -122.413,
          notes: 'Apartment recycling — 8 bins',
        },
        { id: 'w16', name: 'Tenderloin - Eddy St', lat: 37.7835, lon: -122.414, notes: '6 bins' },
        {
          id: 'w17',
          name: 'Civic Center',
          lat: 37.779,
          lon: -122.418,
          notes: 'City Hall area — 5 bins',
        },
        { id: 'w18', name: 'Depot Return', lat: 37.7196, lon: -122.3992, notes: 'Sort and weigh' },
      ],
    },
  ],
  'BULK-WASTE': [
    {
      id: 'BLK-01',
      name: 'South SF Bulk Pickup',
      stops: 15,
      status: 'active',
      waypoints: [
        {
          id: 'w1',
          name: 'Depot - Bayshore Yard',
          lat: 37.7196,
          lon: -122.3992,
          notes: 'Load flatbed',
        },
        {
          id: 'w2',
          name: 'Potrero Hill - 18th St',
          lat: 37.7607,
          lon: -122.3918,
          notes: 'Couch + mattress',
        },
        {
          id: 'w3',
          name: 'Potrero Hill - 20th St',
          lat: 37.759,
          lon: -122.393,
          notes: 'Old appliances',
        },
        {
          id: 'w4',
          name: 'Dogpatch - 3rd St',
          lat: 37.7567,
          lon: -122.3873,
          notes: 'Construction debris',
        },
        {
          id: 'w5',
          name: 'Dogpatch - Illinois St',
          lat: 37.755,
          lon: -122.387,
          notes: 'Lumber pile',
        },
        {
          id: 'w6',
          name: 'Bayview - Evans Ave',
          lat: 37.743,
          lon: -122.389,
          notes: '2 refrigerators',
        },
        {
          id: 'w7',
          name: 'Bayview - 3rd St',
          lat: 37.7319,
          lon: -122.391,
          notes: 'Bulk furniture',
        },
        {
          id: 'w8',
          name: 'Bayview - Palou Ave',
          lat: 37.735,
          lon: -122.392,
          notes: 'Yard waste pile',
        },
        {
          id: 'w9',
          name: 'Hunters Point - Innes Ave',
          lat: 37.728,
          lon: -122.383,
          notes: 'Old washer/dryer',
        },
        {
          id: 'w10',
          name: 'Hunters Point - Jennings St',
          lat: 37.7247,
          lon: -122.3811,
          notes: 'Mattresses x3',
        },
        {
          id: 'w11',
          name: 'Visitacion Valley',
          lat: 37.715,
          lon: -122.405,
          notes: 'Couch + table',
        },
        {
          id: 'w12',
          name: 'Excelsior - Mission St',
          lat: 37.723,
          lon: -122.432,
          notes: 'Hot water heater',
        },
        { id: 'w13', name: 'Crocker Amazon', lat: 37.711, lon: -122.435, notes: 'Carpet rolls' },
        {
          id: 'w14',
          name: 'Transfer Station Drop-off',
          lat: 37.718,
          lon: -122.397,
          notes: 'Unload bulk items',
        },
        { id: 'w15', name: 'Depot Return', lat: 37.7196, lon: -122.3992, notes: 'Clean truck' },
      ],
    },
  ],
  'YARD-WORK': [
    {
      id: 'YRD-01',
      name: 'Parks & Public Spaces',
      stops: 16,
      status: 'active',
      waypoints: [
        {
          id: 'w1',
          name: 'Depot - Bayshore Yard',
          lat: 37.7196,
          lon: -122.3992,
          notes: 'Load equipment trailer',
        },
        {
          id: 'w2',
          name: 'GGP - East Meadow',
          lat: 37.7694,
          lon: -122.4662,
          notes: 'Mowing — 45 min',
        },
        {
          id: 'w3',
          name: 'GGP - Sharon Meadow',
          lat: 37.7685,
          lon: -122.458,
          notes: 'Mowing + edging — 30 min',
        },
        {
          id: 'w4',
          name: 'GGP - Stow Lake',
          lat: 37.7683,
          lon: -122.4754,
          notes: 'Trash bins around lake — 20 min',
        },
        {
          id: 'w5',
          name: 'GGP - Spreckels Lake',
          lat: 37.77,
          lon: -122.488,
          notes: 'Trim hedges — 25 min',
        },
        {
          id: 'w6',
          name: 'GGP - Bison Paddock',
          lat: 37.7705,
          lon: -122.492,
          notes: 'Fence line clearing — 20 min',
        },
        {
          id: 'w7',
          name: 'Dolores Park',
          lat: 37.7596,
          lon: -122.4269,
          notes: 'Trash + mowing — 40 min',
        },
        {
          id: 'w8',
          name: 'Mission Dolores Park - Upper',
          lat: 37.761,
          lon: -122.426,
          notes: 'Hill mowing — 25 min',
        },
        {
          id: 'w9',
          name: 'Balboa Park',
          lat: 37.722,
          lon: -122.441,
          notes: 'Playground area — 20 min',
        },
        {
          id: 'w10',
          name: 'McLaren Park - Entrance',
          lat: 37.719,
          lon: -122.42,
          notes: 'Trail clearing — 30 min',
        },
        {
          id: 'w11',
          name: 'McLaren Park - Hilltop',
          lat: 37.718,
          lon: -122.422,
          notes: 'Brush removal — 25 min',
        },
        {
          id: 'w12',
          name: 'Glen Canyon Park',
          lat: 37.738,
          lon: -122.44,
          notes: 'Trail maintenance — 20 min',
        },
        {
          id: 'w13',
          name: 'Buena Vista Park',
          lat: 37.769,
          lon: -122.441,
          notes: 'Leaf blowing — 15 min',
        },
        {
          id: 'w14',
          name: 'Alamo Square',
          lat: 37.776,
          lon: -122.434,
          notes: 'Mowing + trash — 25 min',
        },
        {
          id: 'w15',
          name: 'Lafayette Park',
          lat: 37.791,
          lon: -122.428,
          notes: 'Trim + trash — 20 min',
        },
        {
          id: 'w16',
          name: 'Depot Return',
          lat: 37.7196,
          lon: -122.3992,
          notes: 'Clean equipment, refuel',
        },
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

      const projects = await db('projects')
        .where({ org_id: org.id, is_active: true })
        .select('id', 'code', 'name');

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
