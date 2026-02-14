import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SettingsStoreService } from '../../../core/services/settings-store.service';
import { FormsModule } from '@angular/forms';

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

  /**
   * Settings store service for managing action filters.
   */
  readonly settingsStore: SettingsStoreService = inject(SettingsStoreService);

  //endregion
  //region Fields

  /**
   * Value of the new filter rule to be added.
   */
  newPattern: string = '';

  //endregion
  //region Constructor

  constructor() {
    // Load saved filters on initialization
    this.settingsStore.load();
  }

  //endregion
  //region Public

  /**
   * Adds a new action filter rule to the settings store.
   * Ignores empty or whitespace-only input.
   */
  add(): void {
    if (!this.newPattern.trim()) return;
    this.settingsStore.add(this.newPattern.trim());
    this.newPattern = '';
  }

  //endregion
}
