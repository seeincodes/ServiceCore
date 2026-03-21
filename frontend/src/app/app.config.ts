import { ApplicationConfig, isDevMode, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { TranslateModule } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { authReducer } from './store/auth/auth.state';
import { driversReducer } from './store/drivers/drivers.state';
import { timesheetsReducer } from './store/timesheets/timesheets.state';
import { uiReducer } from './store/ui/ui.state';
import { AuthEffects } from './store/auth/auth.effects';
import { UiEffects } from './store/ui/ui.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    importProvidersFrom(TranslateModule.forRoot({ defaultLanguage: 'en' })),
    provideTranslateHttpLoader(),
    provideStore({
      auth: authReducer,
      drivers: driversReducer,
      timesheets: timesheetsReducer,
      ui: uiReducer,
    }),
    provideEffects([AuthEffects, UiEffects]),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
