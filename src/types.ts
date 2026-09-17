export type ShapeType = 'rounded-rect' | 'circle' | 'hexagon' | 'tag';

export type ReliefMode = 'raised' | 'engraved';

export interface ShapeConfig {
  type: ShapeType;
  width: number; // mm
  height: number; // mm (ignored for circle, uses width as diameter)
  cornerRadius: number; // mm, for rounded-rect / tag
  thickness: number; // mm, base plate thickness
}

export interface HoleConfig {
  enabled: boolean;
  diameter: number; // mm
  offsetX: number; // mm, horizontal offset from center
  offsetY: number; // mm, vertical offset from center (Y+ = up)
}

export interface ContourConfig {
  enabled: boolean;
  width: number; // mm, border thickness
  height: number; // mm, extra height added on top of base thickness
  color: string; // print color for this piece (used in the 3D preview and 3MF export)
}

export interface QRConfig {
  enabled: boolean;
  text: string;
  sizeRatio: number; // 0..1, fraction of the smallest plate dimension
  offsetX: number; // mm from center
  offsetY: number; // mm from center
  rotation: number; // degrees, clockwise
  moduleHeight: number; // mm relief height
  mode: ReliefMode;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
  quietZone: number; // modules of quiet zone margin
  color: string; // print color when raised (used in the 3D preview and 3MF export)
}

export interface LogoConfig {
  enabled: boolean;
  imageDataUrl: string | null;
  sizeRatio: number; // 0..1 fraction of smallest plate dimension (width of logo)
  offsetX: number;
  offsetY: number;
  rotation: number; // degrees, clockwise
  reliefHeight: number; // mm
  mode: ReliefMode;
  resolution: number; // pixels across the logo's longest side
  threshold: number; // 0..255 grayscale cutoff
  invert: boolean;
  color: string; // print color when raised (used in the 3D preview and 3MF export)
}

export interface TextZoneConfig {
  enabled: boolean;
  text: string;
  height: number; // mm, letter height
  offsetX: number; // mm from center
  offsetY: number; // mm from center
  rotation: number; // degrees, clockwise
  reliefHeight: number; // mm
  mode: ReliefMode;
  bold: boolean;
  fontFamily: string; // key into FONT_OPTIONS, or a custom font's cssFamily (src/fonts.ts)
  resolution: number; // pixels per letter height, controls crispness
  color: string; // print color when raised (used in the 3D preview and 3MF export)
}

export interface CustomFont {
  id: string;
  /** Display name shown in the picker (defaults to the uploaded filename). */
  name: string;
  /** Unique generated CSS font-family used to register/reference this font. */
  cssFamily: string;
  /** The font file itself, as a data URL — stays in the browser, never uploaded anywhere. */
  dataUrl: string;
}

export interface NFCConfig {
  enabled: boolean;
  diameter: number; // mm, tag diameter
  tagThickness: number; // mm, the physical NFC sticker's thickness
  clearance: number; // mm, extra play added on top of tagThickness for the pocket depth
  offsetX: number; // mm from center
  offsetY: number; // mm from center
}

export interface PrintProfileConfig {
  printerName: string; // shown as the 3MF's printer_model
  /** Must match your slicer's printer profile name exactly, or leave blank to not force one. */
  printerSettingsId: string;
  /** Must match your slicer's process/quality profile name exactly, or leave blank to not force one. */
  printSettingsId: string;
  /** Must match a filament profile name known to your slicer, or leave blank. */
  filament: string;
  bedWidth: number; // mm
  bedDepth: number; // mm
  bedHeight: number; // mm, max print height
}

export interface ExportConfig {
  filename: string;
  splitParts: boolean; // export base and relief separately for multi-color printing
  printProfile: PrintProfileConfig;
}

export interface KeychainConfig {
  shape: ShapeConfig;
  hole: HoleConfig;
  contour: ContourConfig;
  qr: QRConfig;
  logo: LogoConfig;
  text1: TextZoneConfig;
  text2: TextZoneConfig;
  text3: TextZoneConfig;
  nfc: NFCConfig;
  customFonts: CustomFont[];
  color: string;
  export: ExportConfig;
}
