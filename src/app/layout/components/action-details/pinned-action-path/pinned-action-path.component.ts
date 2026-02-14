import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { Nullable } from '../../../../core/types/nullable.type';

/**
 * Component for displaying the path of a pinned NgRx action.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'action-path',
  standalone: true,
  templateUrl: 'pinned-action-path.component.html',
  styleUrl: 'pinned-action-path.component.scss',
})
export class PinnedActionPathComponent {
  //region Inputs

  /**
   * Path of the pinned NgRx action.
   */
  readonly actionPath: InputSignal<Nullable<string[]>> = input.required();

  //endregion
  //region Outputs

  /**
   * Event requesting to select a new path.
   */
  readonly setNewPath: OutputEmitterRef<Nullable<string[]>> = output();

  //endregion
  //region Events

  /**
   * Proceeds to the specified segment of the pinned path.
   *
   * @param pathIndex Index of the segment to navigate to.
   * @param isLast Whether this is the last segment in the path.
   */
  proceedToPath(pathIndex: number, isLast: boolean): void {
    if (pathIndex === 0) {
      this.setNewPath.emit(null);
    } else if (!isLast) {
      // Remove "Store" from the path
      const currentPathWithoutStoreRoot: Nullable<string[]> =
        this.actionPath()?.slice(1);
      // Adjust index because "Store" is removed
      pathIndex--;

      const newPath: string[] =
        currentPathWithoutStoreRoot?.reduce(
          (
            allPath: string[],
            currentPathItem: string,
            currentIndex: number,
          ): string[] =>
            currentIndex <= pathIndex ? [...allPath, currentPathItem] : allPath,
          [],
        ) ?? [];

      this.setNewPath.emit(newPath);
    }
  }

  //endregion
}
