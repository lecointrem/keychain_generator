import { useEffect, useRef } from 'react';
import type { CustomFont } from '../types';

/**
 * Registers uploaded custom fonts with the browser's FontFace API so canvas text
 * rendering and CSS previews can use them by family name. Purely client-side: the
 * font file lives only in the browser (as a data URL in app state), never uploaded
 * or published anywhere.
 */
export function useCustomFonts(customFonts: CustomFont[]) {
  const registeredRef = useRef<Map<string, FontFace>>(new Map());

  useEffect(() => {
    const registered = registeredRef.current;
    const currentIds = new Set(customFonts.map((f) => f.id));

    for (const [id, face] of registered) {
      if (!currentIds.has(id)) {
        document.fonts.delete(face);
        registered.delete(id);
      }
    }

    for (const font of customFonts) {
      if (registered.has(font.id)) continue;
      const face = new FontFace(font.cssFamily, `url(${font.dataUrl})`);
      registered.set(font.id, face);
      face
        .load()
        .then((loaded) => {
          document.fonts.add(loaded);
        })
        .catch(() => {
          registered.delete(font.id);
        });
    }
  }, [customFonts]);
}
