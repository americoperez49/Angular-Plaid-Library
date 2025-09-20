import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Observable, Subject, from, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

const PLAID_LINK_SCRIPT_URL = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

@Injectable({
  providedIn: 'root', // Or 'platform' if you want it available across platforms
})
export class PlaidLinkScriptLoader {
  private scriptLoaded = false;
  private scriptLoadSubject = new Subject<void>();

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /**
   * Loads the Plaid Link SDK script.
   * If the script is already loaded or currently loading, it returns an observable
   * that emits when the script is ready. Otherwise, it injects the script tag
   * and returns an observable that emits when the script has loaded.
   * @returns An Observable that emits when the Plaid Link script is loaded and ready.
   */
  loadScript(): Observable<void> {
    if (!isPlatformBrowser(this.platformId)) {
      // If not in a browser environment, we can't load the script.
      // Depending on requirements, you might want to throw an error or return an empty observable.
      // For now, we'll assume it's not critical for SSR and return an observable that completes immediately.
      return of(undefined);
    }

    if (this.scriptLoaded) {
      return of(undefined); // Script already loaded
    }

    // Check if script is already in the DOM (might be loaded by another instance)
    const existingScript = this.document.querySelector(`script[src="${PLAID_LINK_SCRIPT_URL}"]`);
    if (existingScript) {
      this.scriptLoaded = true;
      return of(undefined);
    }

    // Create a new script tag
    const script = this.document.createElement('script');
    script.src = PLAID_LINK_SCRIPT_URL;
    script.onload = () => {
      this.scriptLoaded = true;
      this.scriptLoadSubject.next();
      this.scriptLoadSubject.complete();
    };
    script.onerror = (error) => {
      console.error('Error loading Plaid Link script:', error);
      this.scriptLoadSubject.error(error);
    };

    this.document.body.appendChild(script);

    // Return an observable that completes when the script is loaded
    return from(this.scriptLoadSubject).pipe(
      tap(() => console.log('Plaid Link script loaded successfully.'))
    );
  }

  /**
   * Checks if the Plaid Link script is currently loaded or has been loaded.
   * @returns boolean
   */
  isScriptLoaded(): boolean {
    return this.scriptLoaded;
  }
}
