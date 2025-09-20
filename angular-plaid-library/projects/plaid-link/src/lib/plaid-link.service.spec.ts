import { TestBed, fakeAsync, tick, ComponentFixture } from '@angular/core/testing';
import { Injectable, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { signal, Signal, computed, effect, WritableSignal } from '@angular/core';
import { Observable, Subject, from, of, throwError } from 'rxjs';
import { catchError, tap, switchMap } from 'rxjs/operators';

// Import the services and types to be tested
import { PlaidLinkService } from './plaid-link.service';
import { PlaidLinkScriptLoader } from './plaid-link-script-loader.service';
import {
  PlaidLinkOptions,
  PlaidLinkHandler,
  PlaidLinkSuccessMetadata,
  PlaidLinkError,
  PlaidLinkExitMetadata,
  PlaidLinkEventMetadata,
} from './plaid-link.types';

// Mock the global Plaid object and its methods
declare global {
  interface Window {
    Plaid: {
      create: (options: PlaidLinkOptions) => PlaidLinkHandler;
    };
  }
}

// Mock PlaidLinkScriptLoader
class MockPlaidLinkScriptLoader {
  // Simulate script loading success
  loadScript = jasmine.createSpy('loadScript').and.returnValue(of(undefined));
  isScriptLoaded = jasmine.createSpy('isScriptLoaded').and.returnValue(true);
}

describe('PlaidLinkService', () => {
  let service: PlaidLinkService;
  let scriptLoader: MockPlaidLinkScriptLoader;
  let ngZone: NgZone;

  // Mock NgZone to ensure callbacks run synchronously in tests
  @Injectable()
  class MockNgZone extends NgZone {
    constructor() {
      super({ enableLongStackTrace: false });
    }
    override run<T>(fn: () => T): T {
      return fn();
    }
    override runOutsideAngular<T>(fn: () => T): T {
      return fn();
    }
  }

  beforeEach(async () => {
    // Mock the global Plaid object before each test
    // Store original Plaid if it exists, then replace it
    const originalPlaid = (window as any).Plaid;
    (window as any).Plaid = {
      create: jasmine.createSpy('Plaid.create').and.returnValue({
        open: jasmine.createSpy('open'),
        exit: jasmine.createSpy('exit'),
        destroy: jasmine.createSpy('destroy'),
      }),
    };

    await TestBed.configureTestingModule({
      providers: [
        PlaidLinkService,
        { provide: PlaidLinkScriptLoader, useClass: MockPlaidLinkScriptLoader },
        { provide: PLATFORM_ID, useValue: 'browser' }, // Simulate browser environment
        { provide: NgZone, useClass: MockNgZone }, // Use mock NgZone
      ],
    }).compileComponents();

    service = TestBed.inject(PlaidLinkService);
    scriptLoader = TestBed.inject(PlaidLinkScriptLoader) as any; // Cast to mock type
    ngZone = TestBed.inject(NgZone);

    // Ensure the script loader is marked as loaded for tests that don't mock loadScript
    scriptLoader.isScriptLoaded.and.returnValue(true);

    // Clean up the mock Plaid object after each test
    return () => {
      (window as any).Plaid = originalPlaid;
    };
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load the Plaid Link script on initialization', () => {
    // The script loading is handled by an effect in the constructor.
    // We check if loadScript was called.
    expect(scriptLoader.loadScript).toHaveBeenCalled();
  });

  it('should set isReady to true when script is loaded', fakeAsync(() => {
    // Mock loadScript to simulate success
    scriptLoader.loadScript.and.returnValue(of(undefined));
    // Re-initialize service to trigger effect with mocked loadScript
    service = TestBed.inject(PlaidLinkService); // Re-inject to re-run constructor effect

    // The effect runs asynchronously, so we need to tick or wait
    // Since MockNgZone runs synchronously, the effect should have run.
    // However, if the effect itself has async operations, we might need tick.
    // For now, let's check if isReady is true.
    expect(service.isReady()).toBe(true);
  }));

  it('should set error state if script fails to load', fakeAsync(() => {
    const loadError = new Error('Failed to load script');
    scriptLoader.loadScript.and.returnValue(throwError(() => loadError));

    // Re-initialize service to trigger effect with mocked loadScript error
    service = TestBed.inject(PlaidLinkService);

    // The effect should have caught the error and set the service's error state
    expect(service.error()).toEqual({
      error_type: 'LINK_ERROR',
      error_code: 'SCRIPT_LOAD_FAILED',
      error_message: 'Failed to load Plaid Link SDK script.',
      display_message: 'Could not initialize Plaid Link. Please try again later.',
    });
    expect(service.isReady()).toBe(false);
  }));

  describe('open', () => {
    const mockLinkOptions: PlaidLinkOptions = {
      token: 'mock-link-token',
      onSuccess: jasmine.createSpy('onSuccess'),
      onExit: jasmine.createSpy('onExit'),
      onEvent: jasmine.createSpy('onEvent'),
      onLoad: jasmine.createSpy('onLoad'),
    };

    it('should not open if script is not ready', () => {
      // Manually set isReady to false for this test
      (service as any)._isReady.set(false);
      service.open(mockLinkOptions);
      expect((window as any).Plaid.create).not.toHaveBeenCalled();
      expect(service.error()).not.toBeNull();
    });

    it('should call Plaid.create and open when ready', () => {
      // isReady is true by default due to MockPlaidLinkScriptLoader
      service.open(mockLinkOptions);

      expect((window as any).Plaid.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          token: 'mock-link-token',
          // Callbacks are wrapped, so we can't directly check them here without deeper inspection
        })
      );
      expect((window as any).Plaid.create('mock-link-token' as any).open).toHaveBeenCalled();
    });

    it('should set linkSessionId and emit onSuccess when onSuccess callback is triggered', (done) => {
      const mockPublicToken = 'mock-public-token';
      const mockMetadata: PlaidLinkSuccessMetadata = {
        institution: { name: 'Test Bank', institution_id: 'ins_123' },
        accounts: [],
        link_session_id: 'session-123',
      };

      // Spy on the internal onSuccessSubject
      service.onSuccess$.subscribe(({ public_token, metadata }) => {
        expect(public_token).toBe(mockPublicToken);
        expect(metadata).toEqual(mockMetadata);
        expect(service.linkSessionId()).toBe('session-123');
        done();
      });

      // Manually trigger the wrapped onSuccess callback
      service.open(mockLinkOptions);
      const plaidCreateSpy = (window as any).Plaid.create as jasmine.Spy;
      const plaidHandler = plaidCreateSpy.calls.mostRecent().returnValue;

      // Find the wrapped onSuccess callback from the options passed to Plaid.create
      const optionsPassedToPlaidCreate = plaidCreateSpy.calls.mostRecent().args[0];
      const wrappedOnSuccess = optionsPassedToPlaidCreate.onSuccess;

      // Call the wrapped callback
      wrappedOnSuccess(mockPublicToken, mockMetadata);
    });

    it('should set linkSessionId and emit onExit when onExit callback is triggered', (done) => {
      const mockError: PlaidLinkError = {
        error_type: 'ITEM_ERROR',
        error_code: 'INVALID_CREDENTIALS',
        error_message: 'Bad creds',
        display_message: 'Invalid credentials',
      };
      const mockMetadata: PlaidLinkExitMetadata = {
        institution: null,
        status: 'requires_credentials',
        link_session_id: 'session-456',
        request_id: 'req-789',
      };

      service.onExit$.subscribe(({ error, metadata }) => {
        expect(error).toEqual(mockError);
        expect(metadata).toEqual(mockMetadata);
        expect(service.linkSessionId()).toBe('session-456');
        done();
      });

      service.open(mockLinkOptions);
      const plaidCreateSpy = (window as any).Plaid.create as jasmine.Spy;
      const optionsPassedToPlaidCreate = plaidCreateSpy.calls.mostRecent().args[0];
      const wrappedOnExit = optionsPassedToPlaidCreate.onExit;

      wrappedOnExit(mockError, mockMetadata);
    });

    it('should set linkSessionId and emit onEvent when onEvent callback is triggered', (done) => {
      const mockEventName = 'OPEN';
      const mockMetadata: PlaidLinkEventMetadata = {
        link_session_id: 'session-789',
        institution_id: 'ins_456',
        timestamp: new Date().toISOString(),
      };

      service.onEvent$.subscribe(({ eventName, metadata }) => {
        expect(eventName).toBe(mockEventName);
        expect(metadata).toEqual(mockMetadata);
        expect(service.linkSessionId()).toBe('session-789');
        done();
      });

      service.open(mockLinkOptions);
      const plaidCreateSpy = (window as any).Plaid.create as jasmine.Spy;
      const optionsPassedToPlaidCreate = plaidCreateSpy.calls.mostRecent().args[0];
      const wrappedOnEvent = optionsPassedToPlaidCreate.onEvent;

      wrappedOnEvent(mockEventName, mockMetadata);
    });

    it('should handle errors during Plaid.create call', () => {
      const creationError = new Error('Failed to create Plaid handler');
      (window as any).Plaid.create.and.throwError(creationError.message);

      service.open(mockLinkOptions);

      expect(service.error()).toEqual({
        error_type: 'LINK_ERROR',
        error_code: 'OPEN_FAILED',
        error_message: creationError.message,
        display_message: 'An error occurred while opening Plaid Link. Please try again.',
      });
      expect((window as any).Plaid.create('mock-link-token' as any).open).not.toHaveBeenCalled();
    });
  });

  describe('exit', () => {
    it('should call plaidLinkHandler.exit if handler exists', () => {
      // Manually set up the handler for this test
      const mockHandler: PlaidLinkHandler = {
        open: jasmine.createSpy('open'),
        exit: jasmine.createSpy('exit'),
        destroy: jasmine.createSpy('destroy'),
      };
      (window as any).Plaid.create.and.returnValue(mockHandler);
      service.open({ token: 'test-token', onSuccess: () => {} }); // Initialize handler

      service.exit();
      expect(mockHandler.exit).toHaveBeenCalledWith(undefined); // Default exit
    });

    it('should call plaidLinkHandler.exit with force option if provided', () => {
      const mockHandler: PlaidLinkHandler = {
        open: jasmine.createSpy('open'),
        exit: jasmine.createSpy('exit'),
        destroy: jasmine.createSpy('destroy'),
      };
      (window as any).Plaid.create.and.returnValue(mockHandler);
      service.open({ token: 'test-token', onSuccess: () => {} });

      service.exit({ force: true });
      expect(mockHandler.exit).toHaveBeenCalledWith({ force: true });
    });

    it('should do nothing if handler does not exist', () => {
      // Ensure handler is null
      (service as any).plaidLinkHandler = null;
      spyOn((window as any).Plaid.create('mock-link-token' as any), 'exit'); // Spy on a non-existent handler method

      service.exit();
      expect((window as any).Plaid.create('mock-link-token' as any).exit).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should call plaidLinkHandler.destroy if handler exists', () => {
      const mockHandler: PlaidLinkHandler = {
        open: jasmine.createSpy('open'),
        exit: jasmine.createSpy('exit'),
        destroy: jasmine.createSpy('destroy'),
      };
      (window as any).Plaid.create.and.returnValue(mockHandler);
      service.open({ token: 'test-token', onSuccess: () => {} }); // Initialize handler

      service.destroy();
      expect(mockHandler.destroy).toHaveBeenCalled();
      expect((service as any).plaidLinkHandler).toBeNull();
      expect(service.isReady()).toBe(false); // Should reset ready state
    });

    it('should do nothing if handler does not exist', () => {
      // Ensure handler is null
      (service as any).plaidLinkHandler = null;
      spyOn((window as any).Plaid.create('mock-link-token' as any), 'destroy'); // Spy on a non-existent handler method

      service.destroy();
      expect((window as any).Plaid.create('mock-link-token' as any).destroy).not.toHaveBeenCalled();
    });
  });

  describe('isPlaidScriptLoaded', () => {
    it('should return the status from the script loader', () => {
      scriptLoader.isScriptLoaded.and.returnValue(true);
      expect(service.isPlaidScriptLoaded()).toBe(true);

      scriptLoader.isScriptLoaded.and.returnValue(false);
      expect(service.isPlaidScriptLoaded()).toBe(false);
    });
  });
});
