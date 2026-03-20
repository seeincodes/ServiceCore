import {
  createAction,
  createReducer,
  createSelector,
  createFeatureSelector,
  on,
  props,
} from '@ngrx/store';

// State
export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export interface AuthUser {
  id: string;
  orgId: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
};

// Actions
export const login = createAction('[Auth] Login', props<{ email: string; password: string }>());
export const loginSuccess = createAction(
  '[Auth] Login Success',
  props<{ user: AuthUser; token: string }>(),
);
export const loginFailure = createAction('[Auth] Login Failure', props<{ error: string }>());
export const logout = createAction('[Auth] Logout');
export const setUser = createAction('[Auth] Set User', props<{ user: AuthUser }>());

// Reducer
export const authReducer = createReducer(
  initialState,
  on(login, (state) => ({ ...state, loading: true, error: null })),
  on(loginSuccess, (state, { user, token }) => ({
    ...state,
    user,
    token,
    loading: false,
    error: null,
  })),
  on(loginFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(logout, () => ({ ...initialState })),
  on(setUser, (state, { user }) => ({ ...state, user })),
);

// Selectors
export const selectAuthState = createFeatureSelector<AuthState>('auth');
export const selectUser = createSelector(selectAuthState, (state) => state.user);
export const selectToken = createSelector(selectAuthState, (state) => state.token);
export const selectAuthLoading = createSelector(selectAuthState, (state) => state.loading);
export const selectAuthError = createSelector(selectAuthState, (state) => state.error);
export const selectIsAuthenticated = createSelector(selectToken, (token) => !!token);
