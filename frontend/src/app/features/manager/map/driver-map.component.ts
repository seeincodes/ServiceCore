import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MapComponent, MapMarker, GeoZone } from '../../../shared/components/map/map.component';
import { environment } from '../../../../environments/environment';

interface DriverLocation {
  id: string;
  name: string;
  status: string;
  lat: number | null;
  lon: number | null;
  route: string | null;
  hours: number;
}

@Component({
  selector: 'app-driver-map',
  standalone: true,
  imports: [CommonModule, MapComponent],
  template: `
    <div class="map-page">
      <h1>Driver Map</h1>
      <div class="map-stats" *ngIf="drivers.length > 0">
        <span class="stat active">{{ activeCount }} active</span>
        <span class="stat total">{{ drivers.length }} total</span>
        <span class="stat alerts" *ngIf="outsideZone > 0">{{ outsideZone }} outside zone</span>
      </div>
      <app-map [markers]="markers" [zones]="zones" height="500px"></app-map>
      <div class="driver-list">
        <div
          *ngFor="let d of drivers"
          class="driver-item"
          [class.active]="d.status === 'clocked_in'"
        >
          <span class="driver-name">{{ d.name }}</span>
          <span class="driver-status">{{ d.status === 'clocked_in' ? 'Active' : 'Off' }}</span>
          <span class="driver-hours">{{ d.hours }}h</span>
          <span class="driver-route" *ngIf="d.route">Route {{ d.route }}</span>
          <span class="driver-loc" *ngIf="!d.lat">No GPS</span>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./driver-map.component.scss'],
})
export class DriverMapComponent implements OnInit {
  drivers: DriverLocation[] = [];
  markers: MapMarker[] = [];
  zones: GeoZone[] = [];
  outsideZone = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any>(`${environment.apiUrl}/manager/dashboard`).subscribe({
      next: (res) => {
        this.drivers = res.data.drivers.map((d: any) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          lat: d.locationLat || 37.7749 + (Math.random() - 0.5) * 0.05, // Fallback for demo
          lon: d.locationLon || -122.4194 + (Math.random() - 0.5) * 0.05,
          route: d.route,
          hours: d.hours,
        }));

        this.markers = this.drivers
          .filter((d) => d.lat && d.lon)
          .map((d) => ({
            lat: d.lat!,
            lon: d.lon!,
            label: d.name,
            color: d.status === 'clocked_in' ? ('green' as const) : ('gray' as const),
            popup: `<strong>${d.name}</strong><br>${d.status === 'clocked_in' ? 'Active' : 'Off'} | ${d.hours}h${d.route ? ' | Route ' + d.route : ''}`,
          }));

        // Demo geofence zone
        this.zones = [
          { lat: 37.7749, lon: -122.4194, radiusMeters: 5000, label: 'San Francisco Zone' },
        ];
      },
    });
  }

  get activeCount(): number {
    return this.drivers.filter((d) => d.status === 'clocked_in').length;
  }
}
