import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';

export type ActionDetailsTab = 'payload' | 'state' | 'diff';

/**
 * Component for action details tabs.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'action-details-tabs',
  standalone: true,
  templateUrl: 'action-details-tabs.component.html',
  styleUrl: 'action-details-tabs.component.scss',
})
export class ActionDetailsTabsComponent {
  //region Inputs

  /**
   * Currently active tab.
   */
  readonly activeTab: InputSignal<ActionDetailsTab> = input.required();

  //endregion
  //region Outputs

  /**
   * Event emitted when a request is made to switch to another tab.
   */
  readonly tabChange: OutputEmitterRef<ActionDetailsTab> = output();

  //endregion
  //region Events

  /**
   * Handles tab click event.
   */
  tryChangeTab(tab: ActionDetailsTab): void {
    if (tab !== this.activeTab()) {
      this.tabChange.emit(tab);
    }
  }
  //endregion
}
