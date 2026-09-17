import '@fontsource/roboto/400.css';
import '@fontsource/roboto/700.css';
import '@fontsource/oswald/600.css';
import '@fontsource/pacifico/400.css';
import '@fontsource/permanent-marker/400.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/600.css';

export interface FontOption {
  value: string;
  label: string;
  cssFamily: string;
}

/** Open-source webfonts (self-hosted, no CDN) available for the free text zones. */
export const FONT_OPTIONS: FontOption[] = [
  { value: 'roboto', label: 'Roboto (sans-serif)', cssFamily: 'Roboto' },
  { value: 'jost', label: 'Jost (géométrique, alt. Avant Garde Gothic)', cssFamily: 'Jost' },
  { value: 'oswald', label: 'Oswald (condensé)', cssFamily: 'Oswald' },
  { value: 'bebas-neue', label: 'Bebas Neue (affiche)', cssFamily: 'Bebas Neue' },
  { value: 'pacifico', label: 'Pacifico (script)', cssFamily: 'Pacifico' },
  { value: 'permanent-marker', label: 'Permanent Marker (manuscrit)', cssFamily: 'Permanent Marker' },
];

export function cssFamilyFor(value: string): string {
  return FONT_OPTIONS.find((f) => f.value === value)?.cssFamily ?? 'Roboto';
}
