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

interface TileStyle {
  name: string;
  url: string;
  attribution: string;
  dark?: boolean;
}

const TILE_STYLES: TileStyle[] = [
  {
    name: 'Standard',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
  },
  {
    name: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap',
  },
];

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-wrapper">
      <div #mapContainer class="map-container" [style.height]="height"></div>
      <div class="style-switcher" *ngIf="showStyleSwitcher">
        <button
          *ngFor="let style of tileStyles; let i = index"
          [class.active]="i === activeStyleIndex"
          (click)="switchStyle(i)"
        >
          {{ style.name }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .map-wrapper {
        position: relative;
      }
      .map-container {
        width: 100%;
        border-radius: 12px;
        overflow: hidden;
      }
      .style-switcher {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 400;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        max-width: 200px;
        justify-content: flex-end;
      }
      .style-switcher button {
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 600;
        border: none;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.92);
        color: #333;
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(4px);
        transition: all 0.15s;
      }
      .style-switcher button:hover {
        background: #fff;
        transform: scale(1.05);
      }
      .style-switcher button.active {
        background: #1a73e8;
        color: #fff;
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
  @Input() showStyleSwitcher = true;

  tileStyles = TILE_STYLES;
  activeStyleIndex = 0;

  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
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

  /** Pan and zoom the map to a specific marker, opening its popup. */
  focusMarker(index: number): void {
    if (!this.map || index < 0 || index >= this.markers.length) return;
    const m = this.markers[index];
    this.map.flyTo([m.lat, m.lon], 16, { duration: 0.8 });

    // Open the popup for this marker
    const layers = this.markerLayer.getLayers();
    if (layers[index]) {
      (layers[index] as L.Marker).openPopup();
    }
  }

  switchStyle(index: number): void {
    if (!this.map || index === this.activeStyleIndex) return;
    this.activeStyleIndex = index;
    const style = TILE_STYLES[index];

    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }

    this.tileLayer = L.tileLayer(style.url, {
      attribution: style.attribution,
      maxZoom: 19,
    }).addTo(this.map);
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement).setView(this.center, this.zoom);

    const style = TILE_STYLES[this.activeStyleIndex];
    this.tileLayer = L.tileLayer(style.url, {
      attribution: style.attribution,
      maxZoom: 19,
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
