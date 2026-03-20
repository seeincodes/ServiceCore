import {
  createAction,
  createReducer,
  createSelector,
  createFeatureSelector,
  on,
  props,
} from '@ngrx/store';

export interface DriverStatus {
  id: string;
  name: string;
  status: 'clocked_in' | 'clocked_out';
  hours: number;
  route: string | null;
  lastUpdate: string;
}

export interface DriversState {
  drivers: DriverStatus[];
  loading: boolean;
  error: string | null;
}

const initialState: DriversState = {
  drivers: [],
  loading: false,
  error: null,
};

// Actions
export const loadDrivers = createAction('[Drivers] Load');
export const loadDriversSuccess = createAction(
  '[Drivers] Load Success',
  props<{ drivers: DriverStatus[] }>(),
);
export const loadDriversFailure = createAction(
  '[Drivers] Load Failure',
  props<{ error: string }>(),
);
export const updateDriver = createAction(
  '[Drivers] Update Driver',
  props<{ driver: Partial<DriverStatus> & { id: string } }>(),
);

// Reducer
export const driversReducer = createReducer(
  initialState,
  on(loadDrivers, (state) => ({ ...state, loading: true })),
  on(loadDriversSuccess, (state, { drivers }) => ({
    ...state,
    drivers,
    loading: false,
    error: null,
  })),
  on(loadDriversFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(updateDriver, (state, { driver }) => ({
    ...state,
    drivers: state.drivers.map((d) => (d.id === driver.id ? { ...d, ...driver } : d)),
  })),
);

// Selectors
export const selectDriversState = createFeatureSelector<DriversState>('drivers');
export const selectAllDrivers = createSelector(selectDriversState, (state) => state.drivers);
export const selectDriversLoading = createSelector(selectDriversState, (state) => state.loading);
export const selectActiveDrivers = createSelector(selectAllDrivers, (drivers) =>
  drivers.filter((d) => d.status === 'clocked_in'),
);
