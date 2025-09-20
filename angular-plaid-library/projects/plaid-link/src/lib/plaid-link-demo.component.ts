import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgZone } from '@angular/core';
import { Subscription } from 'rxjs';

import { PlaidLinkService } from './plaid-link.service';
import {
  PlaidLinkOptions,
  PlaidLinkSuccessMetadata,
  PlaidLinkError,
  PlaidLinkExitMetadata,
  PlaidLinkEventMetadata,
} from './plaid-link.types';

@Component({
  selector: 'lib-plaid-link-demo',
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

    <h3>Events:</h3>
    <ul>
      <li *ngFor="let event of events">
        <strong>{{ event.eventName }}</strong
        >: {{ event.metadata | json }}
      </li>
    </ul>

    <h3>Success Responses:</h3>
    <pre *ngIf="lastSuccess">{{ lastSuccess | json }}</pre>

    <h3>Exit Responses:</h3>
    <pre *ngIf="lastExit">{{ lastExit | json }}</pre>
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

  // For displaying events
  events: { eventName: string; metadata: PlaidLinkEventMetadata }[] = [];
  lastSuccess: { public_token: string; metadata: PlaidLinkSuccessMetadata } | null = null;
  lastExit: { error: PlaidLinkError | null; metadata: PlaidLinkExitMetadata } | null = null;

  private subscriptions = new Subscription();
  private isOpening = false; // Local state to prevent multiple opens

  ngOnInit(): void {
    // Subscribe to Plaid Link events
    this.subscriptions.add(
      this.plaidLinkService.onSuccess$.subscribe((response) => {
        this.ngZone.run(() => {
          // Ensure updates happen within Angular's zone
          this.lastSuccess = response;
          this.isOpening = false; // Reset loading state on success
          console.log('Plaid Link Success:', response);
        });
      })
    );

    this.subscriptions.add(
      this.plaidLinkService.onExit$.subscribe((response) => {
        this.ngZone.run(() => {
          // Ensure updates happen within Angular's zone
          this.lastExit = response;
          this.isOpening = false; // Reset loading state on exit
          console.log('Plaid Link Exit:', response);
        });
      })
    );

    this.subscriptions.add(
      this.plaidLinkService.onEvent$.subscribe((event) => {
        this.ngZone.run(() => {
          // Ensure updates happen within Angular's zone
          this.events.push(event);
          // Keep only the last 10 events for brevity
          if (this.events.length > 10) {
            this.events.shift();
          }
          console.log('Plaid Link Event:', event);
        });
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    // Optionally destroy the Plaid Link handler when the component is destroyed
    // This depends on the lifecycle management strategy.
    // If the service manages a single instance, destroying it here might be too aggressive.
    // For now, we'll rely on the service's destroy method if needed.
    // this.plaidLinkService.destroy();
  }

  openPlaidLink(): void {
    if (!this.plaidLinkService.isReady() || this.isOpening) {
      return; // Do nothing if not ready or already opening
    }

    this.isOpening = true; // Set loading state

    // IMPORTANT: Replace 'YOUR_GENERATED_LINK_TOKEN' with a dynamically generated token
    // from your backend. This is a placeholder for demonstration.
    const linkToken = 'YOUR_GENERATED_LINK_TOKEN';

    if (!linkToken || linkToken === 'YOUR_GENERATED_LINK_TOKEN') {
      console.error(
        'Link token is missing or is a placeholder. Please generate a real link token.'
      );
      // The service handles setting its own error state.
      // The component should react to the error signal, not set it directly.
      this.isOpening = false;
      return;
    }

    const options: PlaidLinkOptions = {
      token: linkToken,
      onSuccess: (public_token, metadata) => {
        // This callback is handled by the service, but you can also react here if needed.
        console.log('Demo Component: onSuccess received', public_token, metadata);
        // Typically, you would exchange the public_token for an access_token on your backend.
      },
      onExit: (error, metadata) => {
        // This callback is handled by the service, but you can also react here if needed.
        console.log('Demo Component: onExit received', error, metadata);
      },
      onEvent: (eventName, metadata) => {
        // This callback is handled by the service, but you can also react here if needed.
        console.log('Demo Component: onEvent received', eventName, metadata);
      },
      // onLoad: () => {
      //   console.log('Demo Component: onLoad called');
      // }
    };

    this.plaidLinkService.open(options);
  }

  isLoading(): boolean {
    return this.isOpening;
  }
}
