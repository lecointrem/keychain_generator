import { useEffect, useRef, useState } from 'react';
import { buildKeychainPieces, type ColoredPiece } from '../geometry/buildKeychain';
import { buildQRGrid } from '../geometry/buildQR';
import { buildLogoGrid } from '../geometry/buildLogo';
import { buildTextGrid } from '../geometry/buildText';
import type { ReliefGrid } from '../geometry/relief';
import type { KeychainConfig } from '../types';
import { useDebouncedValue } from './useDebouncedValue';

export function useKeychainGeometry(config: KeychainConfig) {
  const debounced = useDebouncedValue(config, 120);
  const [qrGrid, setQrGrid] = useState<ReliefGrid | null>(null);
  const [logoGrid, setLogoGrid] = useState<ReliefGrid | null>(null);
  const [text1Grid, setText1Grid] = useState<ReliefGrid | null>(null);
  const [text2Grid, setText2Grid] = useState<ReliefGrid | null>(null);
  const [text3Grid, setText3Grid] = useState<ReliefGrid | null>(null);
  const [pieces, setPieces] = useState<ColoredPiece[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const piecesRef = useRef<ColoredPiece[] | null>(null);

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
    let cancelled = false;
    if (!debounced.text1.enabled) {
      setText1Grid(null);
      return;
    }
    buildTextGrid(debounced.text1)
      .then((g) => {
        if (!cancelled) setText1Grid(g);
      })
      .catch(() => {
        if (!cancelled) setText1Grid(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debounced.text1.enabled,
    debounced.text1.text,
    debounced.text1.bold,
    debounced.text1.fontFamily,
    debounced.text1.resolution,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!debounced.text2.enabled) {
      setText2Grid(null);
      return;
    }
    buildTextGrid(debounced.text2)
      .then((g) => {
        if (!cancelled) setText2Grid(g);
      })
      .catch(() => {
        if (!cancelled) setText2Grid(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debounced.text2.enabled,
    debounced.text2.text,
    debounced.text2.bold,
    debounced.text2.fontFamily,
    debounced.text2.resolution,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!debounced.text3.enabled) {
      setText3Grid(null);
      return;
    }
    buildTextGrid(debounced.text3)
      .then((g) => {
        if (!cancelled) setText3Grid(g);
      })
      .catch(() => {
        if (!cancelled) setText3Grid(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debounced.text3.enabled,
    debounced.text3.text,
    debounced.text3.bold,
    debounced.text3.fontFamily,
    debounced.text3.resolution,
  ]);

  useEffect(() => {
    try {
      const built = buildKeychainPieces(debounced, { qrGrid, logoGrid, text1Grid, text2Grid, text3Grid });
      piecesRef.current?.forEach((p) => p.geometry.dispose());
      piecesRef.current = built;
      setPieces(built);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de génération de la géométrie');
    }
  }, [debounced, qrGrid, logoGrid, text1Grid, text2Grid, text3Grid]);

  useEffect(
    () => () => {
      piecesRef.current?.forEach((p) => p.geometry.dispose());
    },
    [],
  );

  return { pieces, error };
}
