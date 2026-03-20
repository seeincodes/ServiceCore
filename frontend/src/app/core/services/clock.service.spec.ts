import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ClockService } from './clock.service';

describe('ClockService', () => {
  let service: ClockService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ClockService],
    });
    service = TestBed.inject(ClockService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getStatus', () => {
    it('GETs /timesheets/status', () => {
      const payload = {
        success: true,
        data: { clockedIn: true, entryId: 'e1', clockInTime: '2025-01-01T12:00:00.000Z' },
        timestamp: '',
      };
      service.getStatus().subscribe((res) => {
        expect(res.data.clockedIn).toBe(true);
        expect(res.data.entryId).toBe('e1');
      });
      const req = httpMock.expectOne('http://localhost:3000/timesheets/status');
      expect(req.request.method).toBe('GET');
      req.flush(payload);
    });
  });

  describe('clockIn', () => {
    it('POSTs body with optional location and idempotencyKey', () => {
      const body = {
        routeId: 'R1',
        location: { lat: 40, lon: -74 },
        idempotencyKey: 'uuid-1',
      };
      const response = {
        success: true,
        data: {
          entryId: 'new',
          status: 'clocked_in',
          timestamp: '2025-01-01T08:00:00.000Z',
          routeId: 'R1',
        },
        timestamp: '',
      };
      service.clockIn(body).subscribe((res) => expect(res.data.entryId).toBe('new'));
      const req = httpMock.expectOne('http://localhost:3000/timesheets/clock-in');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush(response);
    });

    it('POSTs empty object when no params', () => {
      const response = {
        success: true,
        data: { entryId: 'x', status: 'clocked_in', timestamp: '' },
        timestamp: '',
      };
      service.clockIn().subscribe();
      const req = httpMock.expectOne('http://localhost:3000/timesheets/clock-in');
      expect(req.request.body).toEqual({});
      req.flush(response);
    });
  });

  describe('clockOut', () => {
    it('POSTs entryId when provided', () => {
      const response = {
        success: true,
        data: { entryId: 'e1', status: 'clocked_out', hoursWorked: 8, timestamp: '' },
        timestamp: '',
      };
      service.clockOut('e1').subscribe((res) => expect(res.data.hoursWorked).toBe(8));
      const req = httpMock.expectOne('http://localhost:3000/timesheets/clock-out');
      expect(req.request.body).toEqual({ entryId: 'e1' });
      req.flush(response);
    });

    it('POSTs undefined entryId as missing key behavior', () => {
      const response = {
        success: true,
        data: { entryId: 'e1', status: 'clocked_out', hoursWorked: 1, timestamp: '' },
        timestamp: '',
      };
      service.clockOut().subscribe();
      const req = httpMock.expectOne('http://localhost:3000/timesheets/clock-out');
      expect(req.request.body).toEqual({ entryId: undefined });
      req.flush(response);
    });
  });
});
