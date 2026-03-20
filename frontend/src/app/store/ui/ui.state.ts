import {
  createAction,
  createReducer,
  createSelector,
  createFeatureSelector,
  on,
  props,
} from '@ngrx/store';

export interface UiState {
  isOnline: boolean;
  syncing: boolean;
  pendingCount: number;
  lastSyncResult: string | null;
}

const initialState: UiState = {
  isOnline: true,
  syncing: false,
  pendingCount: 0,
  lastSyncResult: null,
};

// Actions
export const setOnlineStatus = createAction(
  '[UI] Set Online Status',
  props<{ isOnline: boolean }>(),
);
export const setSyncing = createAction('[UI] Set Syncing', props<{ syncing: boolean }>());
export const setPendingCount = createAction('[UI] Set Pending Count', props<{ count: number }>());
export const setSyncResult = createAction(
  '[UI] Set Sync Result',
  props<{ result: string | null }>(),
);
export const syncOfflineEntries = createAction('[UI] Sync Offline Entries');

// Reducer
export const uiReducer = createReducer(
  initialState,
  on(setOnlineStatus, (state, { isOnline }) => ({ ...state, isOnline })),
  on(setSyncing, (state, { syncing }) => ({ ...state, syncing })),
  on(setPendingCount, (state, { count }) => ({ ...state, pendingCount: count })),
  on(setSyncResult, (state, { result }) => ({ ...state, lastSyncResult: result })),
);

// Selectors
export const selectUiState = createFeatureSelector<UiState>('ui');
export const selectIsOnline = createSelector(selectUiState, (state) => state.isOnline);
export const selectIsSyncing = createSelector(selectUiState, (state) => state.syncing);
export const selectPendingCount = createSelector(selectUiState, (state) => state.pendingCount);
export const selectLastSyncResult = createSelector(selectUiState, (state) => state.lastSyncResult);
