import { ActionsBridgeService } from '../services/actions-bridge.service';
import { inject, provideEnvironmentInitializer } from '@angular/core';

export const provideActionsBridge = () =>
  provideEnvironmentInitializer(() => {
    inject(ActionsBridgeService);
  });
