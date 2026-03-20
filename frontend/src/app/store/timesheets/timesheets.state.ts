import {
  createAction,
  createReducer,
  createSelector,
  createFeatureSelector,
  on,
  props,
} from '@ngrx/store';

export interface TimesheetEntry {
  id: string;
  userId: string;
  userName: string;
  weekEnding: string;
  status: string;
  hoursWorked: number;
  otHours: number;
}

export interface TimesheetsState {
  pending: TimesheetEntry[];
  loading: boolean;
  error: string | null;
}

const initialState: TimesheetsState = {
  pending: [],
  loading: false,
  error: null,
};

// Actions
export const loadPending = createAction('[Timesheets] Load Pending');
export const loadPendingSuccess = createAction(
  '[Timesheets] Load Pending Success',
  props<{ timesheets: TimesheetEntry[] }>(),
);
export const loadPendingFailure = createAction(
  '[Timesheets] Load Pending Failure',
  props<{ error: string }>(),
);
export const removeTimesheet = createAction('[Timesheets] Remove', props<{ id: string }>());

// Reducer
export const timesheetsReducer = createReducer(
  initialState,
  on(loadPending, (state) => ({ ...state, loading: true })),
  on(loadPendingSuccess, (state, { timesheets }) => ({
    ...state,
    pending: timesheets,
    loading: false,
    error: null,
  })),
  on(loadPendingFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(removeTimesheet, (state, { id }) => ({
    ...state,
    pending: state.pending.filter((t) => t.id !== id),
  })),
);

// Selectors
export const selectTimesheetsState = createFeatureSelector<TimesheetsState>('timesheets');
export const selectPendingTimesheets = createSelector(
  selectTimesheetsState,
  (state) => state.pending,
);
export const selectTimesheetsLoading = createSelector(
  selectTimesheetsState,
  (state) => state.loading,
);
