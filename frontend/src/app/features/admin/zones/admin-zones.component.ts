import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { MapComponent, MapMarker } from '../../../shared/components/map/map.component';
import { environment } from '../../../../environments/environment';

interface WorkZone {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  radius_meters: number;
  address: string | null;
  is_active: boolean;
}

@Component({
  selector: 'app-admin-zones',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MapComponent],
  templateUrl: './admin-zones.component.html',
  styleUrls: ['./admin-zones.component.scss'],
})
export class AdminZonesComponent implements OnInit {
  zones: WorkZone[] = [];
  markers: MapMarker[] = [];
  loading = true;
  showForm = false;
  saving = false;
  message: { text: string; type: 'success' | 'error' } | null = null;

  newZone = {
    name: '',
    type: 'depot',
    lat: 37.7749,
    lon: -122.4194,
    radiusMeters: 200,
    address: '',
  };

  zoneTypes = [
    { value: 'depot', label: 'Depot' },
    { value: 'route_start', label: 'Route Start' },
    { value: 'job_site', label: 'Job Site' },
    { value: 'landfill', label: 'Landfill' },
    { value: 'transfer_station', label: 'Transfer Station' },
  ];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadZones();
  }

  addZone(): void {
    if (!this.newZone.name || !this.newZone.lat || !this.newZone.lon) return;
    this.saving = true;

    this.http.post<any>(`${environment.apiUrl}/admin/zones`, this.newZone).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.message = { text: 'Zone created', type: 'success' };
        this.resetForm();
        this.loadZones();
        setTimeout(() => (this.message = null), 3000);
      },
      error: (err) => {
        this.saving = false;
        this.message = { text: err.error?.message || 'Failed to create zone', type: 'error' };
      },
    });
  }

  toggleActive(zone: WorkZone): void {
    this.http
      .put(`${environment.apiUrl}/admin/zones/${zone.id}`, { isActive: !zone.is_active })
      .subscribe({ next: () => this.loadZones() });
  }

  deleteZone(zone: WorkZone): void {
    this.http.delete(`${environment.apiUrl}/admin/zones/${zone.id}`).subscribe({
      next: () => {
        this.message = { text: 'Zone deleted', type: 'success' };
        this.loadZones();
        setTimeout(() => (this.message = null), 3000);
      },
    });
  }

  typeLabel(type: string): string {
    return this.zoneTypes.find((t) => t.value === type)?.label || type;
  }

  private loadZones(): void {
    this.http.get<any>(`${environment.apiUrl}/admin/zones`).subscribe({
      next: (res) => {
        this.zones = res.data.zones;
        this.updateMarkers();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private updateMarkers(): void {
    this.markers = this.zones
      .filter((z) => z.is_active)
      .map((z) => ({
        lat: Number(z.lat),
        lon: Number(z.lon),
        label: z.name,
        color: z.type === 'depot' ? ('blue' as const) : ('green' as const),
        popup: `<strong>${z.name}</strong><br>${this.typeLabel(z.type)}<br>${z.radius_meters}m radius`,
      }));
  }

  private resetForm(): void {
    this.newZone = {
      name: '',
      type: 'depot',
      lat: 37.7749,
      lon: -122.4194,
      radiusMeters: 200,
      address: '',
    };
  }
}
