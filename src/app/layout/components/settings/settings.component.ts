import { ChangeDetectionStrategy, Component, inject, Signal } from '@angular/core';
import { SettingsStoreService } from '../../../core/services/settings-store.service';
import { FormsModule } from '@angular/forms';
import { ActionFilter } from '../../../core/models/filter.model';

/**
 * Component for configuring the extension settings.
 * Allows adding new rules for filtering NgRx actions.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settings',
  standalone: true,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  imports: [FormsModule],
})
export class SettingsComponent {
  //region DI

  private readonly _settingsStore: SettingsStoreService = inject(SettingsStoreService);

  //endregion
  //region Fields

  /**
   * Value of the new filter rule to be added.
   */
  newPattern: string = '';

  /**
   * Current list of action filters.
   */
  protected readonly filters: Signal<ActionFilter[]> = this._settingsStore.filters;

  //endregion
  //region Constructor

  constructor() {
    // Load saved filters on initialization
    this._settingsStore.load();
  }

  //endregion
  //region Public

  /**
   * Adds a new action filter rule to the settings store.
   * Ignores empty or whitespace-only input.
   */
  add(): void {
    if (!this.newPattern.trim()) return;
    this._settingsStore.add(this.newPattern.trim());
    this.newPattern = '';
  }

  /**
   * Toggles a filter on or off.
   *
   * @param id Filter ID to toggle.
   */
  protected toggle(id: string): void {
    this._settingsStore.toggle(id);
  }

  /**
   * Removes a filter.
   *
   * @param id Filter ID to remove.
   */
  protected remove(id: string): void {
    this._settingsStore.remove(id);
  }

  //endregion
}
