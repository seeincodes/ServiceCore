import {
  driversReducer,
  loadDrivers,
  loadDriversSuccess,
  loadDriversFailure,
  updateDriver,
  DriversState,
  DriverStatus,
} from './drivers.state';

describe('Drivers Reducer', () => {
  const initialState: DriversState = { drivers: [], loading: false, error: null };
  const mockDrivers: DriverStatus[] = [
    {
      id: '1',
      name: 'John',
      status: 'clocked_in',
      hours: 4,
      route: '42',
      lastUpdate: '2026-03-20T10:00:00Z',
    },
    { id: '2', name: 'Jane', status: 'clocked_out', hours: 0, route: null, lastUpdate: '' },
  ];

  it('should return initial state', () => {
    const state = driversReducer(undefined, { type: 'unknown' });
    expect(state).toEqual(initialState);
  });

  it('should set loading on loadDrivers', () => {
    const state = driversReducer(initialState, loadDrivers());
    expect(state.loading).toBe(true);
  });

  it('should set drivers on loadDriversSuccess', () => {
    const state = driversReducer(initialState, loadDriversSuccess({ drivers: mockDrivers }));
    expect(state.drivers).toEqual(mockDrivers);
    expect(state.loading).toBe(false);
  });

  it('should set error on loadDriversFailure', () => {
    const state = driversReducer(initialState, loadDriversFailure({ error: 'fail' }));
    expect(state.error).toBe('fail');
  });

  it('should update a specific driver', () => {
    const loaded = driversReducer(initialState, loadDriversSuccess({ drivers: mockDrivers }));
    const state = driversReducer(
      loaded,
      updateDriver({ driver: { id: '1', status: 'clocked_out', hours: 8 } }),
    );
    expect(state.drivers[0].status).toBe('clocked_out');
    expect(state.drivers[0].hours).toBe(8);
    expect(state.drivers[1]).toEqual(mockDrivers[1]); // unchanged
  });
});
