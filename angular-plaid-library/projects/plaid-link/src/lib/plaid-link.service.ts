import { Injectable, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { signal, Signal, computed, effect, WritableSignal } from '@angular/core';
import { Observable, Subject, from, of, throwError } from 'rxjs';
import { catchError, tap, switchMap } from 'rxjs/operators';

import { PlaidLinkScriptLoader } from './plaid-link-script-loader.service';
import {
  PlaidLinkOptions,
  PlaidLinkHandler,
  PlaidLinkSuccessMetadata,
  PlaidLinkError,
  PlaidLinkExitMetadata,
  PlaidLinkEventMetadata,
} from './plaid-link.types';

@Injectable({
  providedIn: 'root',
})
export class PlaidLinkService {
  // Signals for managing Plaid Link state
  private readonly _isReady = signal(false);
  readonly isReady: Signal<boolean> = this._isReady.asReadonly();

  private readonly _error = signal<PlaidLinkError | null>(null);
  readonly error: Signal<PlaidLinkError | null> = this._error.asReadonly();

  private readonly _linkSessionId = signal<string | null>(null);
  readonly linkSessionId: Signal<string | null> = this._linkSessionId.asReadonly();

  // Subjects for emitting events that can be subscribed to by components
  private readonly _onSuccessSubject = new Subject<{
    public_token: string;
    metadata: PlaidLinkSuccessMetadata;
  }>();
  readonly onSuccess$ = this._onSuccessSubject.asObservable();

  private readonly _onExitSubject = new Subject<{
    error: PlaidLinkError | null;
    metadata: PlaidLinkExitMetadata;
  }>();
  readonly onExit$ = this._onExitSubject.asObservable();

  private readonly _onEventSubject = new Subject<{
    eventName: string;
    metadata: PlaidLinkEventMetadata;
  }>();
  readonly onEvent$ = this._onEventSubject.asObservable();

  private plaidLinkHandler: PlaidLinkHandler | null = null;
  private readonly plaidScriptUrl = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

  constructor(
    private scriptLoader: PlaidLinkScriptLoader,
    @Inject(PLATFORM_ID) private platformId: Object,
    private ngZone: NgZone // Use NgZone to run callbacks outside Angular's zone if necessary
  ) {
    // Effect to handle script loading and initialization
    effect(() => {
      // Only proceed if in a browser environment
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      // Load the script and then initialize Plaid Link handler
      this.scriptLoader
        .loadScript()
        .pipe(
          catchError((err) => {
            console.error('Failed to load Plaid Link script:', err);
            this._error.set({
              error_type: 'LINK_ERROR',
              error_code: 'SCRIPT_LOAD_FAILED',
              error_message: 'Failed to load Plaid Link SDK script.',
              display_message: 'Could not initialize Plaid Link. Please try again later.',
            });
            this._isReady.set(false);
            return throwError(() => err); // Re-throw the error
          }),
          tap(() => {
            // Script loaded, now we can potentially initialize Plaid.create
            // We don't initialize here because Plaid.create needs a link_token,
            // which is dynamic. Initialization will happen when open() is called.
            // However, we can set _isReady to true once the script is loaded.
            this._isReady.set(true);
            console.log('Plaid Link SDK is ready.');
          })
        )
        .subscribe();
    });
  }

  /**
   * Initializes and opens the Plaid Link flow.
   * @param options - PlaidLinkOptions including token, callbacks, etc.
   */
  open(options: PlaidLinkOptions): void {
    if (!isPlatformBrowser(this.platformId)) {
      console.warn('Plaid Link can only be opened in a browser environment.');
      return;
    }

    if (!this._isReady()) {
      console.error('Plaid Link SDK is not ready. Cannot open Link.');
      this._error.set({
        error_type: 'LINK_ERROR',
        error_code: 'SDK_NOT_READY',
        error_message: 'Plaid Link SDK is not ready.',
        display_message: 'Plaid Link is not available at the moment. Please try again later.',
      });
      return;
    }

    // Ensure we are running within Angular's zone for change detection
    this.ngZone.run(() => {
      // Reset previous state
      this._error.set(null);
      this._linkSessionId.set(null);

      // Wrap callbacks to run within Angular's zone
      const wrappedOptions: PlaidLinkOptions = {
        ...options,
        token: options.token, // Ensure token is passed
        onSuccess: (public_token, metadata) => {
          this.ngZone.run(() => {
            this._linkSessionId.set(metadata.link_session_id || null);
            this._onSuccessSubject.next({ public_token, metadata });
            options.onSuccess?.(public_token, metadata); // Call original if provided
          });
        },
        onExit: (error, metadata) => {
          this.ngZone.run(() => {
            this._error.set(error);
            this._linkSessionId.set(metadata.link_session_id || null);
            this._onExitSubject.next({ error, metadata });
            options.onExit?.(error, metadata); // Call original if provided
          });
        },
        onEvent: (eventName, metadata) => {
          this.ngZone.run(() => {
            // Capture link_session_id if available in event metadata
            if (metadata.link_session_id) {
              this._linkSessionId.set(metadata.link_session_id);
            }
            this._onEventSubject.next({ eventName, metadata });
            options.onEvent?.(eventName, metadata); // Call original if provided
          });
        },
        onLoad: () => {
          this.ngZone.run(() => {
            // The script is loaded, but onLoad means Link UI is ready to be opened.
            // We already set _isReady to true when the script loads.
            // This callback might be useful for other purposes if needed.
            console.log('Plaid Link UI is ready to be opened.');
          });
        },
      };

      try {
        // Check if Plaid global object exists
        if (window.Plaid && window.Plaid.create) {
          this.plaidLinkHandler = window.Plaid.create(wrappedOptions);
          this.plaidLinkHandler.open();
        } else {
          console.error('Plaid.create function not found. Ensure the script is loaded correctly.');
          this._error.set({
            error_type: 'LINK_ERROR',
            error_code: 'PLAID_CREATE_NOT_FOUND',
            error_message: 'Plaid.create function is not available.',
            display_message:
              'Plaid Link could not be initialized. Please check your configuration.',
          });
        }
      } catch (e: any) {
        console.error('Error opening Plaid Link:', e);
        this._error.set({
          error_type: 'LINK_ERROR',
          error_code: 'OPEN_FAILED',
          error_message: e.message || 'An unknown error occurred.',
          display_message: 'An error occurred while opening Plaid Link. Please try again.',
        });
      }
    });
  }

  /**
   * Programmatically closes the Plaid Link flow.
   * @param options - Optional configuration, e.g., { force: true } to exit immediately.
   */
  exit(options?: { force?: boolean }): void {
    if (!this.plaidLinkHandler) {
      console.warn('Plaid Link handler is not initialized. Cannot exit.');
      return;
    }
    this.plaidLinkHandler.exit(options);
  }

  /**
   * Destroys the Plaid Link handler instance.
   * This is typically called when the component using Plaid Link is destroyed.
   * Note: The usePlaidLink hook in React automatically handles destruction on unmount.
   * For Angular, we might need to explicitly call this if managing the handler lifecycle manually.
   */
  destroy(): void {
    if (this.plaidLinkHandler) {
      this.plaidLinkHandler.destroy();
      this.plaidLinkHandler = null;
      this._isReady.set(false); // Reset ready state
      console.log('Plaid Link handler destroyed.');
    }
  }

  /**
   * Checks if the Plaid Link SDK script is loaded.
   * @returns boolean
   */
  isPlaidScriptLoaded(): boolean {
    return this.scriptLoader.isScriptLoaded();
  }
}
