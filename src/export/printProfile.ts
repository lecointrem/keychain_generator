import type { PrintProfileConfig } from '../types';

/**
 * Builds the printJobConfig three-3mf-exporter expects from our own print profile
 * settings, instead of letting it fall back to its hardcoded Bambu Lab A1 defaults
 * (wrong bed size, and printer/process IDs that don't exist in a non-Bambu slicer —
 * if the slicer tries to match them on import, it can silently substitute its own
 * generic fallback settings, which is a real source of first-layer problems).
 *
 * `bedWidth`/`bedDepth` can be overridden (e.g. by the mail-merge plate size the
 * user actually tiled against) while the rest of the profile stays constant.
 */
export function buildPrintJobConfig(
  profile: PrintProfileConfig,
  bedWidthOverride?: number,
  bedDepthOverride?: number,
) {
  const width = bedWidthOverride ?? profile.bedWidth;
  const depth = bedDepthOverride ?? profile.bedDepth;
  return {
    printer_name: profile.printerName,
    printerSettingsId: profile.printerSettingsId,
    printSettingsId: profile.printSettingsId,
    filament: profile.filament,
    printableWidth: width,
    printableDepth: depth,
    printableHeight: profile.bedHeight,
    printableArea: [`0x0`, `${width}x0`, `${width}x${depth}`, `0x${depth}`] as const,
  };
}
