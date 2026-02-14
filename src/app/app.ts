import {
  ChangeDetectionStrategy,
  Component,
  effect,
  EffectRef,
  inject,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { ActionDetailsComponent } from './layout/components/action-details/action-details.component';
import { ActionsListComponent } from './layout/components/actions-list/actions-list.component';
import { SettingsComponent } from './layout/components/settings/settings.component';
import { ActionsStore } from './core/services/actions-store.service';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { Nullable } from './core/types/nullable.type';
import { ClearAllSvgComponent } from './layout/components/svg/clear-all-svg/clear-all-svg.component';
import { SettingsSvgComponent } from './layout/components/svg/settings-svg/settings-svg.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-root',
  imports: [
    ActionsListComponent,
    ActionDetailsComponent,
    SettingsComponent,
    ReactiveFormsModule,
    ClearAllSvgComponent,
    SettingsSvgComponent,
  ],
  templateUrl: 'app.html',
  styleUrl: 'app.scss',
})
export class App {
  //region DI

  private readonly _storeService: ActionsStore = inject(ActionsStore);

  //endregion
  //region Fields

  /**
   * Is the settings component currently open?
   */
  readonly isSettingsOpened: WritableSignal<boolean> = signal(false);

  /**
   * Control for searching actions by string.
   */
  readonly searchControl: FormControl<string> = new FormControl();

  /**
   * Signal containing the new value of the actions search control.
   */
  readonly searchValue: Signal<Nullable<string>> = toSignal(
    this.searchControl.valueChanges.pipe(
      map((value: string): string => (value && value.length >= 2 ? value : '')),
      distinctUntilChanged(),
      debounceTime(300),
    ),
  );

  //endregion
  //region Effects

  /**
   * Effect responsible for updating the search value in the actions store.
   */
  readonly permitSearchByControlNewValue: EffectRef = effect((): void =>
    this._storeService.searchValue.set(this.searchValue() || ''),
  );

  //endregion
  //region Events

  /**
   * Toggles the display of the settings panel.
   */
  toggleSettings(): void {
    this.isSettingsOpened.update((v: boolean): boolean => !v);
  }

  /**
   * Closes the settings panel.
   */
  closeSettings(): void {
    this.isSettingsOpened.set(false);
  }

  /**
   * Handler for the button that clears actions data.
   */
  clearActionsData(): void {
    this.searchControl.setValue('');
    this._storeService.clear();
  }

  //endregion
}
