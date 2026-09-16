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
  offsetFromTop: number; // mm, distance from top edge to hole center
  offsetX: number; // mm, horizontal offset from center
}

export interface ContourConfig {
  enabled: boolean;
  width: number; // mm, border thickness
  height: number; // mm, extra height added on top of base thickness
}

export interface QRConfig {
  enabled: boolean;
  text: string;
  sizeRatio: number; // 0..1, fraction of the smallest plate dimension
  offsetX: number; // mm from center
  offsetY: number; // mm from center
  moduleHeight: number; // mm relief height
  mode: ReliefMode;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
  quietZone: number; // modules of quiet zone margin
}

export interface LogoConfig {
  enabled: boolean;
  imageDataUrl: string | null;
  sizeRatio: number; // 0..1 fraction of smallest plate dimension (width of logo)
  offsetX: number;
  offsetY: number;
  reliefHeight: number; // mm
  mode: ReliefMode;
  resolution: number; // pixels across the logo's longest side
  threshold: number; // 0..255 grayscale cutoff
  invert: boolean;
}

export interface ExportConfig {
  filename: string;
  splitParts: boolean; // export base and relief separately for multi-color printing
}

export interface KeychainConfig {
  shape: ShapeConfig;
  hole: HoleConfig;
  contour: ContourConfig;
  qr: QRConfig;
  logo: LogoConfig;
  color: string;
  export: ExportConfig;
}
