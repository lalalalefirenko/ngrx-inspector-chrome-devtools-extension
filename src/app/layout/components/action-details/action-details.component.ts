import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  InputSignal,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { ActionsStore } from '../../../core/services/actions-store.service';
import { ActionDetailsTabsComponent } from './action-details-tabs/action-details-tabs.component';
import { ActionPayloadComponent } from './action-payload/action-payload.component';
import { ActionDiffComponent } from './action-diff/action-diff.component';
import { ActionStateComponent } from './action-state/action-state.component';
import { NgrxActionRecord } from '../../../core/models/ngrx-action-record.model';
import { Nullable } from '../../../core/types/nullable.type';

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

  private readonly _store: ActionsStore = inject(ActionsStore);

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

  /**
   * The currently selected NgRx action.
   */
  protected readonly selectedAction: Signal<Nullable<NgrxActionRecord>> =
    this._store.selectedAction;

  /**
   * Path to the pinned node in the state.
   */
  protected readonly pinnedPath: Signal<Nullable<string[]>> =
    this._store.pinnedPath;

  //endregion
  //region Events

  /**
   * Pins a node in the state tree.
   *
   * @param path Path to the node to pin.
   */
  protected pinNode(path: string[]): void {
    this._store.pinNode(path);
  }

  /**
   * Unpins the currently pinned node.
   */
  protected unpinNode(): void {
    this._store.unpinNode();
  }

  //endregion
}
