import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { jwtInterceptor } from './jwt.interceptor';
import { AuthService } from '../services/auth.service';
import { of } from 'rxjs';

describe('jwtInterceptor', () => {
  let authService: jasmine.SpyObj<Pick<AuthService, 'getToken' | 'refreshToken' | 'logout'>>;

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', ['getToken', 'refreshToken', 'logout']);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: AuthService, useValue: authService }],
    });
  });

  it('does not add Authorization header for /auth/login', (done) => {
    authService.getToken.and.returnValue('some-token');
    const req = new HttpRequest('GET', 'http://localhost:3000/auth/login');
    let capturedReq: HttpRequest<unknown> | null = null;
    const next: HttpHandlerFn = (r) => {
      capturedReq = r;
      return of({ body: {} } as any);
    };

    TestBed.runInInjectionContext(() => {
      jwtInterceptor(req, next).subscribe(() => {
        expect(capturedReq?.headers.has('Authorization')).toBe(false);
        done();
      });
    });
  });

  it('does not add Authorization header for /auth/refresh', (done) => {
    authService.getToken.and.returnValue('some-token');
    const req = new HttpRequest('GET', 'http://localhost:3000/auth/refresh');
    let capturedReq: HttpRequest<unknown> | null = null;
    const next: HttpHandlerFn = (r) => {
      capturedReq = r;
      return of({ body: {} } as any);
    };

    TestBed.runInInjectionContext(() => {
      jwtInterceptor(req, next).subscribe(() => {
        expect(capturedReq?.headers.has('Authorization')).toBe(false);
        done();
      });
    });
  });

  it('adds Bearer token to other requests when token exists', (done) => {
    authService.getToken.and.returnValue('my-jwt');
    const req = new HttpRequest('GET', 'http://localhost:3000/api/me');
    let capturedReq: HttpRequest<unknown> | null = null;
    const next: HttpHandlerFn = (r) => {
      capturedReq = r;
      return of({ body: {} } as any);
    };

    TestBed.runInInjectionContext(() => {
      jwtInterceptor(req, next).subscribe(() => {
        expect(capturedReq?.headers.get('Authorization')).toBe('Bearer my-jwt');
        done();
      });
    });
  });

  it('forwards request without header when no token', (done) => {
    authService.getToken.and.returnValue(null);
    const req = new HttpRequest('GET', 'http://localhost:3000/api/me');
    let capturedReq: HttpRequest<unknown> | null = null;
    const next: HttpHandlerFn = (r) => {
      capturedReq = r;
      return of({ body: {} } as any);
    };

    TestBed.runInInjectionContext(() => {
      jwtInterceptor(req, next).subscribe(() => {
        expect(capturedReq?.headers.has('Authorization')).toBe(false);
        done();
      });
    });
  });
});
