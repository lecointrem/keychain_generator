import { create } from 'zustand';
import type {
  ContourConfig,
  ExportConfig,
  HoleConfig,
  KeychainConfig,
  LogoConfig,
  QRConfig,
  ShapeConfig,
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
    reliefHeight: 0.6,
    mode: 'raised',
    resolution: 48,
    threshold: 128,
    invert: false,
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
  setExport: (patch: Partial<ExportConfig>) => void;
  setColor: (color: string) => void;
  reset: () => void;
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
  setExport: (patch) =>
    set((s) => ({ config: { ...s.config, export: { ...s.config.export, ...patch } } })),
  setColor: (color) => set((s) => ({ config: { ...s.config, color } })),
  reset: () => set({ config: defaultConfig }),
}));
