import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
} from '@angular/core';

/**
 * "Clear All" icon component.
 * Renders an SVG icon with configurable width, height, and fill color.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'clear-all-svg',
  templateUrl: 'clear-all-svg.component.html',
  styleUrl: 'clear-all-svg.component.scss',
})
export class ClearAllSvgComponent {
  //region Inputs

  /**
   * Icon width.
   */
  readonly width: InputSignal<string> = input('24px');

  /**
   * Icon height.
   */
  readonly height: InputSignal<string> = input('24px');

  /**
   * Fill color of the icon.
   */
  readonly fill: InputSignal<string> = input('#ffffff');

  //endregion
}
