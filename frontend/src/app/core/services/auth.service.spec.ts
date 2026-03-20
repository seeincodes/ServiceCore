import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService, { provide: Router, useValue: router }],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getToken', () => {
    it('returns null when no token stored', () => {
      expect(service.getToken()).toBeNull();
    });

    it('returns stored token', () => {
      localStorage.setItem('tk_token', 'abc');
      expect(service.getToken()).toBe('abc');
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when no token', () => {
      expect(service.isAuthenticated).toBe(false);
    });

    it('returns true when token present', () => {
      localStorage.setItem('tk_token', 'abc');
      expect(service.isAuthenticated).toBe(true);
    });
  });

  describe('login', () => {
    it('POSTs to /auth/login and stores token and user', () => {
      const response = {
        success: true,
        data: {
          user: { id: '1', orgId: 'o1', email: 'u@x.com', role: 'employee' },
          token: 'jwt-123',
        },
        timestamp: new Date().toISOString(),
      };

      service.login('u@x.com', 'pass').subscribe((res) => {
        expect(res.data.token).toBe('jwt-123');
        expect(service.getToken()).toBe('jwt-123');
        expect(service.currentUser).toEqual(response.data.user);
      });

      const req = httpMock.expectOne('http://localhost:3000/auth/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'u@x.com', password: 'pass' });
      expect(req.request.withCredentials).toBe(true);
      req.flush(response);
    });
  });

  describe('logout', () => {
    it('clears token, user, and navigates to /login', () => {
      localStorage.setItem('tk_token', 'x');
      service.currentUser$; // ensure subject exists
      service.logout();

      expect(service.getToken()).toBeNull();
      expect(service.currentUser).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);

      const req = httpMock.expectOne('http://localhost:3000/auth/logout');
      expect(req.request.method).toBe('POST');
      req.flush({});
    });
  });

  describe('refreshToken', () => {
    it('POSTs to /auth/refresh and updates stored token', () => {
      const response = {
        success: true,
        data: { token: 'new-jwt' },
        timestamp: new Date().toISOString(),
      };

      service.refreshToken().subscribe((res) => {
        expect(res.data.token).toBe('new-jwt');
        expect(service.getToken()).toBe('new-jwt');
      });

      const req = httpMock.expectOne('http://localhost:3000/auth/refresh');
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      req.flush(response);
    });
  });
});
