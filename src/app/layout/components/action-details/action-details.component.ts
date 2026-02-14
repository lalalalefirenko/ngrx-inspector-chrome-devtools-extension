import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  InputSignal,
  signal,
  WritableSignal,
} from '@angular/core';
import { ActionsStore } from '../../../core/services/actions-store.service';
import { ActionDetailsTabsComponent } from './action-details-tabs/action-details-tabs.component';
import { ActionPayloadComponent } from './action-payload/action-payload.component';
import { ActionDiffComponent } from './action-diff/action-diff.component';
import { ActionStateComponent } from './action-state/action-state.component';
import { SettingsComponent } from '../settings/settings.component';

type ActionDetailsTab = 'payload' | 'state' | 'diff';

/**
 * Component displaying the details of the selected NgRx action.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'action-details',
  standalone: true,
  imports: [
    ActionDetailsTabsComponent,
    ActionPayloadComponent,
    ActionStateComponent,
    ActionDiffComponent,
  ],
  templateUrl: 'action-details.component.html',
  styleUrl: 'action-details.component.scss',
})
export class ActionDetailsComponent {
  //region DI

  /**
   * NgRx actions store.
   */
  readonly store: ActionsStore = inject(ActionsStore);

  //endregion
  //region Inputs

  /**
   * Whether the action details tab can be displayed.
   */
  readonly canDisplayDetails: InputSignal<boolean> = input.required();

  //endregion
  //region Fields

  /**
   * Currently active tab.
   */
  readonly currentTab: WritableSignal<ActionDetailsTab> = signal('payload');

  //endregion
}
