// The server's WebAuthn options, in the JSON form the browser ceremony takes. The contract types
// them loosely (it leaves the base64url challenge and credential ids `unknown`); they come from the
// server's WebAuthn library for this one ceremony and pass through unchanged.
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

export const requestOptions = (options: object) =>
  options as unknown as PublicKeyCredentialRequestOptionsJSON;

export const creationOptions = (options: object) =>
  options as unknown as PublicKeyCredentialCreationOptionsJSON;
