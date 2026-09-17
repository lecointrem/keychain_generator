import { create } from 'zustand';
import type {
  ContourConfig,
  ExportConfig,
  HoleConfig,
  KeychainConfig,
  LogoConfig,
  NFCConfig,
  QRConfig,
  ShapeConfig,
  TextZoneConfig,
} from './types';

export const defaultConfig: KeychainConfig = {
  shape: {
    type: 'rounded-rect',
    width: 50,
    height: 30,
    cornerRadius: 4,
    thickness: 3,
  },
  hole: {
    enabled: true,
    diameter: 4,
    offsetFromTop: 4,
    offsetX: 0,
  },
  contour: {
    enabled: true,
    width: 1.5,
    height: 0.8,
  },
  qr: {
    enabled: true,
    text: 'https://example.com',
    sizeRatio: 0.55,
    offsetX: 0,
    offsetY: -2,
    rotation: 0,
    moduleHeight: 0.6,
    mode: 'raised',
    errorCorrection: 'M',
    quietZone: 1,
  },
  logo: {
    enabled: false,
    imageDataUrl: null,
    sizeRatio: 0.3,
    offsetX: 0,
    offsetY: 10,
    rotation: 0,
    reliefHeight: 0.6,
    mode: 'raised',
    resolution: 48,
    threshold: 128,
    invert: false,
  },
  text1: {
    enabled: false,
    text: 'VOTRE TEXTE',
    height: 3,
    offsetX: 0,
    offsetY: -12,
    rotation: 0,
    reliefHeight: 0.6,
    mode: 'raised',
    bold: false,
    fontFamily: 'roboto',
    resolution: 32,
  },
  text2: {
    enabled: false,
    text: 'TEXTE 2',
    height: 3,
    offsetX: 20,
    offsetY: 0,
    rotation: 90,
    reliefHeight: 0.6,
    mode: 'raised',
    bold: false,
    fontFamily: 'roboto',
    resolution: 32,
  },
  text3: {
    enabled: false,
    text: 'TEXTE 3',
    height: 3,
    offsetX: -20,
    offsetY: 0,
    rotation: 270,
    reliefHeight: 0.6,
    mode: 'raised',
    bold: false,
    fontFamily: 'roboto',
    resolution: 32,
  },
  nfc: {
    enabled: false,
    diameter: 25,
    tagThickness: 0.2,
    clearance: 0.2,
    offsetX: 0,
    offsetY: 0,
  },
  color: '#e6e6e6',
  export: {
    filename: 'porte-cle',
    splitParts: false,
  },
};

interface KeychainStore {
  config: KeychainConfig;
  setShape: (patch: Partial<ShapeConfig>) => void;
  setHole: (patch: Partial<HoleConfig>) => void;
  setContour: (patch: Partial<ContourConfig>) => void;
  setQR: (patch: Partial<QRConfig>) => void;
  setLogo: (patch: Partial<LogoConfig>) => void;
  setText1: (patch: Partial<TextZoneConfig>) => void;
  setText2: (patch: Partial<TextZoneConfig>) => void;
  setText3: (patch: Partial<TextZoneConfig>) => void;
  setNFC: (patch: Partial<NFCConfig>) => void;
  setExport: (patch: Partial<ExportConfig>) => void;
  setColor: (color: string) => void;
  reset: () => void;
  loadConfig: (loaded: unknown) => void;
}

/**
 * Merges a loaded profile over the defaults, key by key, so an older or partial
 * profile (missing fields added in a later version of the app) still loads safely.
 */
function mergeWithDefaults(loaded: unknown): KeychainConfig {
  const src = (loaded && typeof loaded === 'object' ? loaded : {}) as Partial<
    Record<keyof KeychainConfig, unknown>
  >;
  const merged = { ...defaultConfig } as KeychainConfig;
  for (const key of Object.keys(defaultConfig) as (keyof KeychainConfig)[]) {
    const value = src[key];
    if (key === 'color') {
      if (typeof value === 'string') merged.color = value;
      continue;
    }
    if (value && typeof value === 'object') {
      (merged as unknown as Record<string, unknown>)[key] = {
        ...(defaultConfig[key] as object),
        ...(value as object),
      };
    }
  }
  return merged;
}

export const useKeychainStore = create<KeychainStore>((set) => ({
  config: defaultConfig,
  setShape: (patch) =>
    set((s) => ({ config: { ...s.config, shape: { ...s.config.shape, ...patch } } })),
  setHole: (patch) =>
    set((s) => ({ config: { ...s.config, hole: { ...s.config.hole, ...patch } } })),
  setContour: (patch) =>
    set((s) => ({ config: { ...s.config, contour: { ...s.config.contour, ...patch } } })),
  setQR: (patch) =>
    set((s) => ({ config: { ...s.config, qr: { ...s.config.qr, ...patch } } })),
  setLogo: (patch) =>
    set((s) => ({ config: { ...s.config, logo: { ...s.config.logo, ...patch } } })),
  setText1: (patch) =>
    set((s) => ({ config: { ...s.config, text1: { ...s.config.text1, ...patch } } })),
  setText2: (patch) =>
    set((s) => ({ config: { ...s.config, text2: { ...s.config.text2, ...patch } } })),
  setText3: (patch) =>
    set((s) => ({ config: { ...s.config, text3: { ...s.config.text3, ...patch } } })),
  setNFC: (patch) =>
    set((s) => ({ config: { ...s.config, nfc: { ...s.config.nfc, ...patch } } })),
  setExport: (patch) =>
    set((s) => ({ config: { ...s.config, export: { ...s.config.export, ...patch } } })),
  setColor: (color) => set((s) => ({ config: { ...s.config, color } })),
  reset: () => set({ config: defaultConfig }),
  loadConfig: (loaded) => set({ config: mergeWithDefaults(loaded) }),
}));
