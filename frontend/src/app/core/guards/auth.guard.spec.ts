import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard, roleGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

describe('authGuard', () => {
  let authService: jasmine.SpyObj<Pick<AuthService, 'isAuthenticated'>>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', [], ['isAuthenticated']);
    router = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('returns true when authenticated', () => {
    Object.defineProperty(authService, 'isAuthenticated', { get: () => true, configurable: true });
    const route = {} as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('navigates to /login and returns false when not authenticated', () => {
    Object.defineProperty(authService, 'isAuthenticated', { get: () => false, configurable: true });
    const route = {} as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});

describe('roleGuard', () => {
  let authService: jasmine.SpyObj<Pick<AuthService, 'currentUser'>>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', [], ['currentUser']);
    router = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('returns true when user has allowed role', () => {
    Object.defineProperty(authService, 'currentUser', {
      get: () => ({ id: '1', orgId: 'o1', email: 'u@x.com', role: 'manager' }),
      configurable: true,
    });
    const guard = roleGuard('manager', 'org_admin');
    const route = {} as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => guard(route, state));

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('navigates to / and returns false when user role not allowed', () => {
    Object.defineProperty(authService, 'currentUser', {
      get: () => ({ id: '1', orgId: 'o1', email: 'u@x.com', role: 'employee' }),
      configurable: true,
    });
    const guard = roleGuard('org_admin');
    const route = {} as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => guard(route, state));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('navigates to /login when no current user', () => {
    Object.defineProperty(authService, 'currentUser', { get: () => null, configurable: true });
    const guard = roleGuard('manager');
    const route = {} as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => guard(route, state));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
