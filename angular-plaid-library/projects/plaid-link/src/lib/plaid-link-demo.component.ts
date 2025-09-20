import { Component, inject, OnDestroy, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgZone } from '@angular/core';

import { PlaidLinkService } from './plaid-link.service';
import {
  PlaidLinkOptions,
  PlaidLinkSuccessMetadata,
  PlaidLinkError,
  PlaidLinkExitMetadata,
  PlaidLinkEventMetadata,
} from './plaid-link.types';

@Component({
  selector: 'ng-plaid-link',
  standalone: true, // Using standalone component for simplicity
  imports: [CommonModule],
  template: `
    <h2>Plaid Link Demo Component</h2>

    <div *ngIf="plaidLinkService.error() as error">
      <h3>Error:</h3>
      <pre>{{ error | json }}</pre>
    </div>

    <div *ngIf="plaidLinkService.linkSessionId()">
      <h3>Link Session ID:</h3>
      <p>{{ plaidLinkService.linkSessionId() }}</p>
    </div>

    <button (click)="openPlaidLink()" [disabled]="!plaidLinkService.isReady() || isLoading()">
      {{ isLoading() ? 'Opening...' : 'Open Plaid Link' }}
    </button>
  `,
  styles: [
    `
      button {
        margin-top: 10px;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
      pre {
        background-color: #f4f4f4;
        padding: 10px;
        border-radius: 5px;
        margin-top: 10px;
        white-space: pre-wrap; /* Ensures long lines wrap */
        word-wrap: break-word; /* Breaks words if necessary */
      }
      ul {
        list-style: none;
        padding: 0;
      }
      li {
        margin-bottom: 5px;
        border-bottom: 1px dashed #eee;
        padding-bottom: 5px;
      }
      h3 {
        margin-top: 20px;
        margin-bottom: 5px;
      }
    `,
  ],
})
export class PlaidLinkDemoComponent implements OnInit, OnDestroy {
  readonly plaidLinkService = inject(PlaidLinkService);
  private readonly ngZone = inject(NgZone);

  @Input() linkToken: string | null = null; // Default to empty string
  @Output() onSuccess = new EventEmitter<any>(); // Using 'any' for now, will refine types
  @Output() onExit = new EventEmitter<any>(); // Using 'any' for now, will refine types
  @Output() onEvent = new EventEmitter<any>(); // Using 'any' for now, will refine types
  @Output() onLoad = new EventEmitter<void>();

  // Removed events, lastSuccess, lastExit properties as they are no longer needed for internal display

  // Removed Subscription as it's no longer used
  // private subscriptions = new Subscription();
  private isOpening = false; // Local state to prevent multiple opens

  ngOnInit(): void {}

  ngOnDestroy(): void {}

  openPlaidLink(): void {
    if (!this.plaidLinkService.isReady() || this.isOpening) {
      return; // Do nothing if not ready or already opening
    }

    this.isOpening = true; // Set loading state

    // Use the input linkToken
    const linkToken = this.linkToken;

    if (!linkToken) {
      // Simplified check for empty token
      console.error('Link token is missing.');
      this.isOpening = false;
      // Emit an exit event with an error if token is missing
      this.onExit.emit({
        error: { error_type: 'INVALID_INPUT', error_message: 'Link token is missing.' },
        metadata: {},
      });
      return;
    }

    const options: PlaidLinkOptions = {
      token: linkToken,
      onSuccess: (public_token, metadata) => {
        this.onSuccess.emit({ public_token, metadata });
        this.isOpening = false; // Reset loading state on success
      },
      onExit: (error, metadata) => {
        this.onExit.emit({ error, metadata });
        this.isOpening = false; // Reset loading state on exit
      },
      onEvent: (eventName, metadata) => {
        this.onEvent.emit({ eventName, metadata });
      },
      onLoad: () => {
        this.onLoad.emit();
        console.log('Plaid Link onLoad called'); // Keep this log for debugging if needed
      },
    };

    this.plaidLinkService.open(options);
  }

  isLoading(): boolean {
    return this.isOpening;
  }
}
