// Plaid Link SDK Types for Angular Library

// --- Metadata Schemas ---

export interface PlaidInstitution {
  name: string | null;
  institution_id: string | null;
}

export interface PlaidAccount {
  id: string;
  name: string;
  mask: string | null;
  type: string; // See Plaid Account Type schema
  subtype: string | null; // See Plaid Account Subtype schema
  verification_status: string | null;
  is_business?: boolean;
  is_personal?: boolean;
}

export interface PlaidLinkSuccessMetadata {
  institution: PlaidInstitution | null;
  accounts: PlaidAccount[];
  link_session_id: string;
  // Other potential fields from Plaid docs, add as needed
}

export interface PlaidLinkError {
  error_type: string | null;
  error_code: string | null;
  error_message: string | null;
  display_message: string | null;
}

export interface PlaidLinkExitMetadata {
  institution: PlaidInstitution | null;
  status: string | null; // e.g., 'requires_credentials'
  link_session_id: string;
  request_id: string | null;
  // Other potential fields from Plaid docs, add as needed
}

export interface PlaidLinkEventMetadata {
  // This is a broad schema, specific fields depend on the eventName
  institution_id?: string | null;
  institution_name?: string | null;
  error_type?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  exit_status?: string | null;
  institution_search_query?: string | null;
  mfa_type?: string | null;
  view_name?: string | null;
  request_id?: string | null;
  link_session_id?: string | null;
  timestamp?: string | null; // ISO 8601 format
  selection?: any | null; // Depends on event
  account_number_mask?: string | null;
  routing_number?: string | null;
  // Add other common or important fields
  [key: string]: any; // Allow for dynamic properties
}

// --- Callback Types ---

export type PlaidLinkOnSuccess = (public_token: string, metadata: PlaidLinkSuccessMetadata) => void;

export type PlaidLinkOnExit = (
  error: PlaidLinkError | null,
  metadata: PlaidLinkExitMetadata
) => void;

export type PlaidLinkOnEvent = (
  eventName: string, // Consider using a union of PlaidLinkStableEvent and string for broader compatibility
  metadata: PlaidLinkEventMetadata
) => void;

export type PlaidLinkOnLoad = () => void;

// --- Configuration Object ---

export interface PlaidLinkOptions {
  token: string; // Generated link_token
  onSuccess: PlaidLinkOnSuccess;
  onExit?: PlaidLinkOnExit;
  onEvent?: PlaidLinkOnEvent;
  onLoad?: PlaidLinkOnLoad;
  receivedRedirectUri?: string; // For OAuth flows
  // Other options can be added here as needed, e.g.,
  // env: 'sandbox' | 'development' | 'production';
  // products: string[]; // Note: products are typically configured via link_token
  // country_codes: string[]; // Note: country_codes are typically configured via link_token
}

// --- Plaid Link Handler Return Type (for Plaid.create) ---
// This represents the object returned by Plaid.create, which has open, exit, destroy methods.
// We'll define this in the service/component that uses it, but the types are useful.
export interface PlaidLinkHandler {
  open: () => void;
  exit: (options?: { force?: boolean }) => void;
  destroy: () => void;
}

// --- Plaid Link Hook Return Type (for usePlaidLink in React) ---
// This is for reference, as we are building an Angular library.
// export interface PlaidLinkHook {
//   open: () => void;
//   exit: (options?: { force?: boolean }) => void;
//   ready: boolean;
//   error: PlaidLinkError | null;
// }

// --- Plaid SDK Global Object ---
// This is a declaration for the global Plaid object loaded from the CDN.
// Adjust properties as needed based on actual CDN script.
declare global {
  interface Window {
    Plaid: {
      create: (options: PlaidLinkOptions) => PlaidLinkHandler;
      // Other Plaid global functions if any
    };
  }
}
