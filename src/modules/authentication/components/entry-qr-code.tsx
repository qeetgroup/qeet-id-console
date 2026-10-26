import { QRCode } from "@qeetrix/react/experimental";

/** The authenticator-app QR code, in its own module so its encoder loads only when setup starts. */
export function EntryQrCode({ value, label }: { value: string; label: string }) {
  return <QRCode value={value} label={label} size={152} />;
}
