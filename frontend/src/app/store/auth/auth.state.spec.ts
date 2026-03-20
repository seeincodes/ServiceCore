import {
  authReducer,
  login,
  loginSuccess,
  loginFailure,
  logout,
  setUser,
  AuthState,
  AuthUser,
} from './auth.state';

describe('Auth Reducer', () => {
  const initialState: AuthState = { user: null, token: null, loading: false, error: null };
  const mockUser: AuthUser = { id: '1', orgId: 'org1', email: 'test@test.com', role: 'employee' };

  it('should return initial state', () => {
    const state = authReducer(undefined, { type: 'unknown' });
    expect(state).toEqual(initialState);
  });

  it('should set loading on login', () => {
    const state = authReducer(initialState, login({ email: 'a@b.com', password: 'pass' }));
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('should set user and token on loginSuccess', () => {
    const state = authReducer(initialState, loginSuccess({ user: mockUser, token: 'abc' }));
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe('abc');
    expect(state.loading).toBe(false);
  });

  it('should set error on loginFailure', () => {
    const state = authReducer(initialState, loginFailure({ error: 'Bad creds' }));
    expect(state.error).toBe('Bad creds');
    expect(state.loading).toBe(false);
  });

  it('should clear state on logout', () => {
    const loggedIn = authReducer(initialState, loginSuccess({ user: mockUser, token: 'abc' }));
    const state = authReducer(loggedIn, logout());
    expect(state).toEqual(initialState);
  });

  it('should set user on setUser', () => {
    const state = authReducer(initialState, setUser({ user: mockUser }));
    expect(state.user).toEqual(mockUser);
  });
});
