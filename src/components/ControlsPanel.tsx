import type { ChangeEvent } from 'react';
import { useKeychainStore } from '../store';
import type { ShapeType, ReliefMode } from '../types';
import { SelectField, Section, SliderField, TextField, ToggleField } from './fields';

const SHAPE_OPTIONS: { value: ShapeType; label: string }[] = [
  { value: 'rounded-rect', label: 'Rectangle arrondi' },
  { value: 'circle', label: 'Cercle' },
  { value: 'hexagon', label: 'Hexagone' },
  { value: 'tag', label: 'Étiquette (pilule)' },
];

const MODE_OPTIONS: { value: ReliefMode; label: string }[] = [
  { value: 'raised', label: 'En relief (surélevé)' },
  { value: 'engraved', label: 'Gravé (creusé)' },
];

const EC_OPTIONS = [
  { value: 'L' as const, label: 'L — basse (7%)' },
  { value: 'M' as const, label: 'M — moyenne (15%)' },
  { value: 'Q' as const, label: 'Q — élevée (25%)' },
  { value: 'H' as const, label: 'H — maximale (30%)' },
];

interface Props {
  onExport: () => void;
  exporting: boolean;
}

export function ControlsPanel({ onExport, exporting }: Props) {
  const config = useKeychainStore((s) => s.config);
  const setShape = useKeychainStore((s) => s.setShape);
  const setHole = useKeychainStore((s) => s.setHole);
  const setContour = useKeychainStore((s) => s.setContour);
  const setQR = useKeychainStore((s) => s.setQR);
  const setLogo = useKeychainStore((s) => s.setLogo);
  const setExport = useKeychainStore((s) => s.setExport);
  const setColor = useKeychainStore((s) => s.setColor);
  const reset = useKeychainStore((s) => s.reset);

  function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogo({ imageDataUrl: reader.result as string, enabled: true });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h1>Générateur de porte-clés</h1>
        <button className="btn-ghost" onClick={reset} type="button">
          Réinitialiser
        </button>
      </div>

      <Section title="Forme & dimensions">
        <SelectField
          label="Forme"
          value={config.shape.type}
          options={SHAPE_OPTIONS}
          onChange={(type) => setShape({ type })}
        />
        <SliderField
          label={config.shape.type === 'circle' ? 'Diamètre' : 'Largeur'}
          value={config.shape.width}
          min={15}
          max={120}
          step={0.5}
          unit=" mm"
          onChange={(width) => setShape({ width })}
        />
        {config.shape.type !== 'circle' && (
          <SliderField
            label="Hauteur"
            value={config.shape.height}
            min={15}
            max={120}
            step={0.5}
            unit=" mm"
            onChange={(height) => setShape({ height })}
          />
        )}
        {(config.shape.type === 'rounded-rect' || config.shape.type === 'hexagon') && (
          <SliderField
            label="Rayon des coins"
            value={config.shape.cornerRadius}
            min={0}
            max={Math.min(config.shape.width, config.shape.height) / 2}
            step={0.25}
            unit=" mm"
            onChange={(cornerRadius) => setShape({ cornerRadius })}
          />
        )}
        <SliderField
          label="Épaisseur"
          value={config.shape.thickness}
          min={1.5}
          max={10}
          step={0.1}
          unit=" mm"
          onChange={(thickness) => setShape({ thickness })}
        />
      </Section>

      <Section title="Trou d'attache">
        <ToggleField label="Activer" checked={config.hole.enabled} onChange={(enabled) => setHole({ enabled })} />
        {config.hole.enabled && (
          <>
            <SliderField
              label="Diamètre"
              value={config.hole.diameter}
              min={2}
              max={10}
              step={0.1}
              unit=" mm"
              onChange={(diameter) => setHole({ diameter })}
            />
            <SliderField
              label="Distance du bord haut"
              value={config.hole.offsetFromTop}
              min={2}
              max={20}
              step={0.1}
              unit=" mm"
              onChange={(offsetFromTop) => setHole({ offsetFromTop })}
            />
            <SliderField
              label="Décalage horizontal"
              value={config.hole.offsetX}
              min={-30}
              max={30}
              step={0.5}
              unit=" mm"
              onChange={(offsetX) => setHole({ offsetX })}
            />
          </>
        )}
      </Section>

      <Section title="Contour">
        <ToggleField
          label="Activer"
          checked={config.contour.enabled}
          onChange={(enabled) => setContour({ enabled })}
        />
        {config.contour.enabled && (
          <>
            <SliderField
              label="Largeur du bourrelet"
              value={config.contour.width}
              min={0.5}
              max={5}
              step={0.1}
              unit=" mm"
              onChange={(width) => setContour({ width })}
            />
            <SliderField
              label="Hauteur du bourrelet"
              value={config.contour.height}
              min={0.2}
              max={3}
              step={0.1}
              unit=" mm"
              onChange={(height) => setContour({ height })}
            />
          </>
        )}
      </Section>

      <Section title="QR Code">
        <ToggleField label="Activer" checked={config.qr.enabled} onChange={(enabled) => setQR({ enabled })} />
        {config.qr.enabled && (
          <>
            <TextField
              label="Contenu (URL, texte...)"
              value={config.qr.text}
              placeholder="https://..."
              onChange={(text) => setQR({ text })}
            />
            <SelectField
              label="Correction d'erreur"
              value={config.qr.errorCorrection}
              options={EC_OPTIONS}
              onChange={(errorCorrection) => setQR({ errorCorrection })}
            />
            <SelectField label="Mode" value={config.qr.mode} options={MODE_OPTIONS} onChange={(mode) => setQR({ mode })} />
            <SliderField
              label="Taille"
              value={config.qr.sizeRatio}
              min={0.15}
              max={0.9}
              step={0.01}
              unit=""
              onChange={(sizeRatio) => setQR({ sizeRatio })}
            />
            <SliderField
              label="Décalage X"
              value={config.qr.offsetX}
              min={-40}
              max={40}
              step={0.5}
              unit=" mm"
              onChange={(offsetX) => setQR({ offsetX })}
            />
            <SliderField
              label="Décalage Y"
              value={config.qr.offsetY}
              min={-40}
              max={40}
              step={0.5}
              unit=" mm"
              onChange={(offsetY) => setQR({ offsetY })}
            />
            <SliderField
              label="Hauteur du relief"
              value={config.qr.moduleHeight}
              min={0.2}
              max={2}
              step={0.05}
              unit=" mm"
              onChange={(moduleHeight) => setQR({ moduleHeight })}
            />
            <SliderField
              label="Zone de silence"
              value={config.qr.quietZone}
              min={0}
              max={4}
              step={1}
              unit=" mod."
              onChange={(quietZone) => setQR({ quietZone })}
            />
          </>
        )}
      </Section>

      <Section title="Logo d'entreprise" defaultOpen={false}>
        <ToggleField label="Activer" checked={config.logo.enabled} onChange={(enabled) => setLogo({ enabled })} />
        <label className="field">
          <div className="field-row">
            <span>Image (PNG, JPG, SVG)</span>
          </div>
          <input type="file" accept="image/*" onChange={handleLogoUpload} />
        </label>
        {config.logo.enabled && (
          <>
            <SelectField
              label="Mode"
              value={config.logo.mode}
              options={MODE_OPTIONS}
              onChange={(mode) => setLogo({ mode })}
            />
            <SliderField
              label="Taille"
              value={config.logo.sizeRatio}
              min={0.05}
              max={0.9}
              step={0.01}
              unit=""
              onChange={(sizeRatio) => setLogo({ sizeRatio })}
            />
            <SliderField
              label="Décalage X"
              value={config.logo.offsetX}
              min={-40}
              max={40}
              step={0.5}
              unit=" mm"
              onChange={(offsetX) => setLogo({ offsetX })}
            />
            <SliderField
              label="Décalage Y"
              value={config.logo.offsetY}
              min={-40}
              max={40}
              step={0.5}
              unit=" mm"
              onChange={(offsetY) => setLogo({ offsetY })}
            />
            <SliderField
              label="Hauteur du relief"
              value={config.logo.reliefHeight}
              min={0.2}
              max={2}
              step={0.05}
              unit=" mm"
              onChange={(reliefHeight) => setLogo({ reliefHeight })}
            />
            <SliderField
              label="Résolution (détail)"
              value={config.logo.resolution}
              min={12}
              max={96}
              step={1}
              unit=" px"
              onChange={(resolution) => setLogo({ resolution })}
            />
            <SliderField
              label="Seuil noir/blanc"
              value={config.logo.threshold}
              min={10}
              max={245}
              step={1}
              unit=""
              onChange={(threshold) => setLogo({ threshold })}
            />
            <ToggleField label="Inverser" checked={config.logo.invert} onChange={(invert) => setLogo({ invert })} />
          </>
        )}
      </Section>

      <Section title="Apparence" defaultOpen={false}>
        <label className="field">
          <div className="field-row">
            <span>Couleur (aperçu uniquement)</span>
          </div>
          <input type="color" value={config.color} onChange={(e) => setColor(e.target.value)} />
        </label>
      </Section>

      <Section title="Export" defaultOpen={false}>
        <TextField label="Nom de fichier" value={config.export.filename} onChange={(filename) => setExport({ filename })} />
        <ToggleField
          label="Export multi-pièces (multicouleur)"
          checked={config.export.splitParts}
          onChange={(splitParts) => setExport({ splitParts })}
        />
        <button className="btn-primary" type="button" onClick={onExport} disabled={exporting}>
          {exporting ? 'Génération du STL…' : 'Exporter en STL'}
        </button>
      </Section>
    </div>
  );
}
