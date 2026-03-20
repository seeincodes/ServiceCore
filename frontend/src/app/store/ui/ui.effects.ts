import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { from } from 'rxjs';
import { map, exhaustMap, tap } from 'rxjs/operators';
import { SyncService } from '../../core/services/sync.service';
import * as UiActions from './ui.state';

@Injectable()
export class UiEffects {
  syncOffline$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UiActions.syncOfflineEntries),
      exhaustMap(() =>
        from(this.syncService.syncPendingEntries()).pipe(
          map(() => UiActions.setSyncing({ syncing: false })),
        ),
      ),
    ),
  );

  updatePendingCount$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(UiActions.setSyncing),
        tap(async () => {
          const count = await this.syncService.getPendingCount();
          this.store.dispatch(UiActions.setPendingCount({ count }));
        }),
      ),
    { dispatch: false },
  );

  constructor(
    private actions$: Actions,
    private syncService: SyncService,
    private store: Store,
  ) {}
}
