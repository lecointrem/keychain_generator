import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { KeychainConfig } from '../types';
import { buildKeychainGeometry } from '../geometry/buildKeychain';
import { buildQRGrid } from '../geometry/buildQR';
import { buildLogoGrid } from '../geometry/buildLogo';
import type { ReliefGrid } from '../geometry/relief';
import { useDebouncedValue } from './useDebouncedValue';

export function useKeychainGeometry(config: KeychainConfig) {
  const debounced = useDebouncedValue(config, 120);
  const [qrGrid, setQrGrid] = useState<ReliefGrid | null>(null);
  const [logoGrid, setLogoGrid] = useState<ReliefGrid | null>(null);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!debounced.qr.enabled) {
      setQrGrid(null);
      return;
    }
    try {
      setQrGrid(buildQRGrid(debounced.qr));
    } catch {
      setQrGrid(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debounced.qr.enabled,
    debounced.qr.text,
    debounced.qr.errorCorrection,
    debounced.qr.quietZone,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!debounced.logo.enabled || !debounced.logo.imageDataUrl) {
      setLogoGrid(null);
      return;
    }
    buildLogoGrid(debounced.logo)
      .then((g) => {
        if (!cancelled) setLogoGrid(g);
      })
      .catch(() => {
        if (!cancelled) setLogoGrid(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debounced.logo.enabled,
    debounced.logo.imageDataUrl,
    debounced.logo.resolution,
    debounced.logo.threshold,
    debounced.logo.invert,
  ]);

  useEffect(() => {
    try {
      const geo = buildKeychainGeometry(debounced, { qrGrid, logoGrid });
      if (geometryRef.current) geometryRef.current.dispose();
      geometryRef.current = geo;
      setGeometry(geo);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de génération de la géométrie');
    }
  }, [debounced, qrGrid, logoGrid]);

  useEffect(
    () => () => {
      geometryRef.current?.dispose();
    },
    [],
  );

  return { geometry, error };
}
