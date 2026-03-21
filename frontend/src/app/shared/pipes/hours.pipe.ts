import { Pipe, PipeTransform } from '@angular/core';

/**
 * Converts decimal hours to human-readable format.
 * Examples:
 *   0.16  → "10m"
 *   0.5   → "30m"
 *   1     → "1h 0m"
 *   1.5   → "1h 30m"
 *   8.25  → "8h 15m"
 *   0     → "0m"
 */
@Pipe({ name: 'hoursDisplay', standalone: true })
export class HoursDisplayPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    if (value === 0) return '0m';

    const totalMinutes = Math.round(value * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  }
}
