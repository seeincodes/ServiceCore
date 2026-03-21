import {
  Component,
  Input,
  OnInit,
  OnChanges,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

export interface MapMarker {
  lat: number;
  lon: number;
  label: string;
  color?: 'green' | 'red' | 'blue' | 'orange' | 'gray';
  popup?: string;
}

export interface GeoZone {
  lat: number;
  lon: number;
  radiusMeters: number;
  label: string;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  template: `<div #mapContainer class="map-container" [style.height]="height"></div>`,
  styles: [
    `
      .map-container {
        width: 100%;
        border-radius: 12px;
        overflow: hidden;
      }
    `,
  ],
})
export class MapComponent implements AfterViewInit, OnChanges {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  @Input() markers: MapMarker[] = [];
  @Input() zones: GeoZone[] = [];
  @Input() height = '400px';
  @Input() center: [number, number] = [37.7749, -122.4194];
  @Input() zoom = 11;

  private map: L.Map | null = null;
  private markerLayer = L.layerGroup();
  private zoneLayer = L.layerGroup();

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(): void {
    if (this.map) {
      this.updateMarkers();
      this.updateZones();
    }
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement).setView(this.center, this.zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.markerLayer.addTo(this.map);
    this.zoneLayer.addTo(this.map);

    this.updateMarkers();
    this.updateZones();
  }

  private updateMarkers(): void {
    this.markerLayer.clearLayers();

    const colorMap: Record<string, string> = {
      green: '#34a853',
      red: '#ea4335',
      blue: '#1a73e8',
      orange: '#f57c00',
      gray: '#9e9e9e',
    };

    for (const m of this.markers) {
      const color = colorMap[m.color || 'blue'] || '#1a73e8';
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([m.lat, m.lon], { icon });
      if (m.popup || m.label) {
        marker.bindPopup(m.popup || m.label);
      }
      marker.bindTooltip(m.label, { permanent: false });
      this.markerLayer.addLayer(marker);
    }

    // Auto-fit bounds if markers exist
    if (this.markers.length > 0 && this.map) {
      const bounds = L.latLngBounds(this.markers.map((m) => [m.lat, m.lon]));
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }

  private updateZones(): void {
    this.zoneLayer.clearLayers();

    for (const z of this.zones) {
      const circle = L.circle([z.lat, z.lon], {
        radius: z.radiusMeters,
        color: '#1a73e8',
        fillColor: '#1a73e8',
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '5, 5',
      });
      circle.bindTooltip(z.label);
      this.zoneLayer.addLayer(circle);
    }
  }
}
