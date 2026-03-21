import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
  discardPeriodicTasks,
} from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ClockButtonComponent } from './clock-button.component';
import { ClockService } from '../../../core/services/clock.service';

describe('ClockButtonComponent', () => {
  let fixture: ComponentFixture<ClockButtonComponent>;
  let component: ClockButtonComponent;
  let clockService: jasmine.SpyObj<ClockService>;

  beforeEach(async () => {
    clockService = jasmine.createSpyObj('ClockService', ['getStatus', 'clockIn', 'clockOut']);
    clockService.getStatus.and.returnValue(
      of({ success: true, data: { clockedIn: false }, timestamp: '' }),
    );

    await TestBed.configureTestingModule({
      imports: [ClockButtonComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ClockService, useValue: clockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClockButtonComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('shows CLOCK IN when not clocked in', () => {
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.clock-button');
    expect(btn.textContent).toContain('CLOCK IN');
  });

  it('shows CLOCK OUT when status is clocked in', () => {
    clockService.getStatus.and.returnValue(
      of({
        success: true,
        data: {
          clockedIn: true,
          entryId: 'e1',
          clockInTime: new Date().toISOString(),
          elapsedHours: 0,
        },
        timestamp: '',
      }),
    );
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.clock-button');
    expect(btn.textContent).toContain('CLOCK OUT');
  });

  it('calls clockIn on tap when not clocked in', fakeAsync(() => {
    spyOnProperty(navigator, 'geolocation', 'get').and.returnValue(
      undefined as unknown as Geolocation,
    );
    clockService.clockIn.and.returnValue(
      of({
        success: true,
        data: {
          entryId: 'new-e',
          status: 'clocked_in',
          timestamp: new Date().toISOString(),
        },
        timestamp: '',
      }),
    );

    fixture.detectChanges();
    tick();
    const btn = fixture.nativeElement.querySelector('.clock-button');
    btn.click();
    tick();

    expect(clockService.clockIn).toHaveBeenCalled();
    const call = clockService.clockIn.calls.mostRecent();
    expect(call.args[0]?.idempotencyKey).toBeDefined();
    fixture.detectChanges();
    expect(component.confirmation?.type).toBe('success');
    expect(component.confirmation?.message).toMatch(/Clocked in at/);
    discardPeriodicTasks();
  }));

  it('shows error when clockIn fails', fakeAsync(() => {
    spyOnProperty(navigator, 'geolocation', 'get').and.returnValue(
      undefined as unknown as Geolocation,
    );
    clockService.clockIn.and.returnValue(
      throwError(() => ({ error: { error: 'Already clocked in' } })),
    );

    fixture.detectChanges();
    tick();
    fixture.nativeElement.querySelector('.clock-button').click();
    tick();
    fixture.detectChanges();

    expect(component.confirmation?.type).toBe('error');
    expect(component.confirmation?.message).toContain('Already clocked in');
  }));

  it('calls clockOut when clocked in', fakeAsync(() => {
    clockService.getStatus.and.returnValue(
      of({
        success: true,
        data: {
          clockedIn: true,
          entryId: 'e99',
          clockInTime: new Date(Date.now() - 3600000).toISOString(),
        },
        timestamp: '',
      }),
    );
    clockService.clockOut.and.returnValue(
      of({
        success: true,
        data: {
          entryId: 'e99',
          status: 'clocked_out',
          hoursWorked: 1,
          timestamp: new Date().toISOString(),
        },
        timestamp: '',
      }),
    );

    fixture.detectChanges();
    tick();
    fixture.nativeElement.querySelector('.clock-button').click();
    tick();
    fixture.detectChanges();

    expect(clockService.clockOut).toHaveBeenCalledWith('e99');
    expect(component.confirmation?.type).toBe('success');
    expect(component.confirmation?.message).toMatch(/Clocked out at/);
    discardPeriodicTasks();
  }));
});
