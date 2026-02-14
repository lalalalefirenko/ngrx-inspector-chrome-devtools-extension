import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { NgrxActionRecord } from '../../../../core/models/ngrx-action-record.model';
import { JsonTreeComponent } from '../../json-tab/json-tree.component';
import { JsonTreeNode } from '../../../../core/models/json-tree-node.model';
import { buildJsonTree } from '../../../../core/utils/json-tree.utils';

/**
 * Component for displaying the payload of the current NgRx action.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'action-payload',
  standalone: true,
  imports: [JsonTreeComponent],
  templateUrl: 'action-payload.component.html',
})
export class ActionPayloadComponent {
  //region Inputs

  /**
   * The current NgRx action whose payload should be displayed.
   */
  readonly action: InputSignal<NgrxActionRecord> = input.required();

  //endregion
  //region Fields

  /**
   * Payload of the current NgRx action transformed into a JSON tree.
   */
  readonly jsonTreeFromAction: Signal<JsonTreeNode> = computed(
    (): JsonTreeNode => buildJsonTree(this.action()?.payload),
  );

  //endregion
}
