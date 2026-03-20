import { TestBed } from '@angular/core/testing';
import { OfflineStoreService, OfflineClockEntry } from './offline-store.service';

describe('OfflineStoreService', () => {
  let service: OfflineStoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OfflineStoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add and retrieve entries', async () => {
    const entry: OfflineClockEntry = {
      id: 'test-1',
      action: 'clock_in',
      timestamp: new Date().toISOString(),
      idempotencyKey: 'key-1',
    };

    await service.addEntry(entry);
    const entries = await service.getAllEntries();
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries.find((e) => e.id === 'test-1')).toBeTruthy();

    // Cleanup
    await service.removeEntry('test-1');
  });

  it('should remove entries', async () => {
    const entry: OfflineClockEntry = {
      id: 'test-remove',
      action: 'clock_out',
      timestamp: new Date().toISOString(),
      idempotencyKey: 'key-remove',
    };

    await service.addEntry(entry);
    await service.removeEntry('test-remove');
    const entries = await service.getAllEntries();
    expect(entries.find((e) => e.id === 'test-remove')).toBeFalsy();
  });

  it('should count entries', async () => {
    const before = await service.getCount();
    const entry: OfflineClockEntry = {
      id: 'test-count',
      action: 'clock_in',
      timestamp: new Date().toISOString(),
      idempotencyKey: 'key-count',
    };

    await service.addEntry(entry);
    const after = await service.getCount();
    expect(after).toBe(before + 1);

    await service.removeEntry('test-count');
  });
});
