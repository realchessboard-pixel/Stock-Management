import { renderBarcodeSvg } from "@/server/barcodes";

/**
 * Server-rendered Code 128 SVG. Safe to inline: codes are restricted to
 * [A-Za-z0-9-._/+*$%] by validation and bwip-js draws text as paths.
 */
export function BarcodeImage({ code, className, includeText = true }: { code: string; className?: string; includeText?: boolean }) {
  const svg = renderBarcodeSvg(code, { includeText });
  return <div className={className} role="img" aria-label={`Barcode ${code}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
