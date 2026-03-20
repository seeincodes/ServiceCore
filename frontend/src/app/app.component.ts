import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OfflineIndicatorComponent } from './shared/components/offline-indicator/offline-indicator.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, OfflineIndicatorComponent],
  template: `
    <app-offline-indicator></app-offline-indicator>
    <router-outlet></router-outlet>
  `,
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'TimeKeeper';
}
