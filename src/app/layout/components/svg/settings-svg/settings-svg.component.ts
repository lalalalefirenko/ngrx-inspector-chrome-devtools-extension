import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
} from '@angular/core';

/**
 * "Settings" icon component.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'settings-svg',
  templateUrl: 'settings-svg.component.html',
  styleUrl: 'settings-svg.component.scss',
})
export class SettingsSvgComponent {
  //region Inputs

  /** Width of the icon */
  readonly width: InputSignal<string> = input('24px');

  /** Height of the icon */
  readonly height: InputSignal<string> = input('24px');

  /** Fill color of the icon */
  readonly fill: InputSignal<string> = input('#ffffff');

  //endregion
}
