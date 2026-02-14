import { NgrxActionRecord } from '../models/ngrx-action-record.model';
import { inject, Injectable, NgZone, OnDestroy } from '@angular/core';
import { ActionsStore } from './actions-store.service';
import { isDevToolsEnv } from '../utils/dev-mode.utils';
import { Nullable } from '../types/nullable.type';
import { RuntimeMessage } from '../models/chrome-runtime-message.model';

/**
 * Bridge service between the DevTools extension panel and the inspected page.
 *
 * Main responsibilities:
 * - Establishes connection with the Chrome runtime port
 * - Receives the stream of NgRx actions from the background script
 * - Forwards actions to {@link ActionsStore}
 * - Automatically reconnects on disconnect
 * - Clears the store on page navigation
 * - Supports mock mode outside DevTools
 */
@Injectable({
  providedIn: 'root',
})
export class ActionsBridgeService implements OnDestroy {
  //region DI

  private readonly _store: ActionsStore = inject(ActionsStore);

  private readonly _zone: NgZone = inject(NgZone);

  //endregion

  //region Fields

  /**
   * Active connection to the Chrome runtime port.
   */
  // @ts-ignore
  private _port: Nullable<chrome.runtime.Port>;

  /**
   * Reconnect timer.
   */
  private _reconnectTimer: Nullable<ReturnType<typeof setTimeout>>;

  /**
   * Mock mode timers.
   */
  private readonly _mockTimers: number[] = [];

  /**
   * DevTools navigation event handler.
   * Stored as a reference for correct removeListener.
   */
  private readonly _onNavigatedHandler = (): void => {
    this._zone.run(() => this._store.clear());
  };

  //region Constants

  /**
   * Reconnect delay in milliseconds.
   */
  private readonly _reconnectDelay = 1000;

  /**
   * Name of the Chrome runtime port.
   */
  private readonly _portName = 'ngrx-actions-visualizer';

  //region Constructor
  constructor() {
    if (isDevToolsEnv()) {
      this._connect();
    } else {
      this._initMockMode();
    }
  }

  //endregion
  //region Hooks

  /**
   * Cleans up resources.
   *
   * Called by Angular when the service is destroyed
   * (e.g., when the DevTools panel is closed).
   */
  ngOnDestroy(): void {
    this._cleanupPort();
    this._cleanupTimers();

    // @ts-ignore
    chrome?.devtools?.network?.onNavigated?.removeListener(
      this._onNavigatedHandler,
    );
  }

  //endregion
  //region Private

  /**
   * Establishes a connection with the Chrome runtime.
   */
  private _connect(): void {
    if (this._port) return;

    try {
      // @ts-ignore
      this._port = chrome.runtime.connect({ name: this._portName });

      // @ts-ignore
      const tabId: number = chrome.devtools.inspectedWindow.tabId;

      this._port.postMessage({
        type: 'INIT',
        tabId,
      });

      this._port.onMessage.addListener(this._handleMessage);
      this._port.onDisconnect.addListener(this._handleDisconnect);

      // @ts-ignore
      chrome.devtools.network.onNavigated.addListener(this._onNavigatedHandler);
    } catch {
      this._scheduleReconnect();
    }
  }

  /**
   * Completely cleans up the current connection.
   */
  private _cleanupPort(): void {
    if (!this._port) return;

    this._port.onMessage.removeListener(this._handleMessage);
    this._port.onDisconnect.removeListener(this._handleDisconnect);
    this._port.disconnect();

    this._port = null;
  }

  // Message Handling

  /**
   * Handler for incoming messages from the runtime port.
   */
  private readonly _handleMessage = (
    msg: RuntimeMessage<NgrxActionRecord>,
  ): void => {
    if (msg.type !== 'NGRX_ACTION') return;

    this._zone.run(() => this._store.add(msg.payload));
  };

  /**
   * Handler for port disconnect events.
   */
  private readonly _handleDisconnect = (): void => {
    this._cleanupPort();
    this._scheduleReconnect();
  };

  /**
   * Schedules a reconnect.
   */
  private _scheduleReconnect(): void {
    if (this._reconnectTimer) return;

    this._reconnectTimer = setTimeout((): void => {
      this._reconnectTimer = null;
      this._connect();
    }, this._reconnectDelay);
  }

  // Mock Mode

  /**
   * Initializes mock mode.
   *
   * Used outside DevTools:
   * - dynamically loads test actions
   * - emulates a dispatch stream
   */
  private _initMockMode(): void {
    import('../mocks/actions.mock').then(({ generateMockActions }) => {
      const actions: NgrxActionRecord[] = generateMockActions();

      actions.forEach((action: NgrxActionRecord, index: number) => {
        const timer: number = window.setTimeout((): void => {
          this._zone.run((): void => this._store.add(action));
        }, index * 500);

        this._mockTimers.push(timer);
      });
    });
  }

  /**
   * Clears all timers.
   */
  private _cleanupTimers(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    this._mockTimers.forEach(clearTimeout);
    this._mockTimers.length = 0;
  }

  //endregion
}
