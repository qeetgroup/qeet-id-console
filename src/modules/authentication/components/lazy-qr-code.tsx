import type { QRCodeProps } from "@qeetrix/ui";
import { lazy, Suspense } from "react";

// The qrcode encoder is needed only while enrolling an authenticator or pairing a phone, and the
// shell imports this module's barrel, so the encoder loads with the first code instead.
const KitQRCode = lazy(() =>
  import("@qeetrix/ui/components/QRCode").then((m) => ({ default: m.QRCode })),
);

/** Renders the kit's QRCode, loading its encoder on first use behind a tile of the same size. */
export function LazyQRCode(props: QRCodeProps) {
  const placeholder = (
    <div
      aria-hidden="true"
      className="aspect-square max-w-full shrink-0"
      style={{ width: props.size ?? 200 }}
    />
  );
  return (
    <Suspense fallback={placeholder}>
      <KitQRCode {...props} />
    </Suspense>
  );
}
