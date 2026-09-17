import type { CustomFont, ReliefMode, TextZoneConfig } from '../types';
import { Section, SelectField, SliderField, TextField, ToggleField } from './fields';
import { FONT_OPTIONS, cssFamilyFor } from '../fonts';

const MODE_OPTIONS: { value: ReliefMode; label: string }[] = [
  { value: 'raised', label: 'En relief (surélevé)' },
  { value: 'engraved', label: 'Gravé (creusé)' },
];

interface Props {
  title: string;
  zone: TextZoneConfig;
  onChange: (patch: Partial<TextZoneConfig>) => void;
  customFonts: CustomFont[];
}

export function TextZoneSection({ title, zone, onChange, customFonts }: Props) {
  return (
    <Section title={title} defaultOpen={false}>
      <ToggleField label="Activer" checked={zone.enabled} onChange={(enabled) => onChange({ enabled })} />
      {zone.enabled && (
        <>
          <TextField label="Valeur" value={zone.text} placeholder="Votre texte" onChange={(text) => onChange({ text })} />
          <label className="field">
            <div className="field-row">
              <span>Police</span>
            </div>
            <select value={zone.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })}>
              <optgroup label="Polices intégrées">
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
              {customFonts.length > 0 && (
                <optgroup label="Mes polices">
                  {customFonts.map((f) => (
                    <option key={f.id} value={f.cssFamily}>
                      {f.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          {zone.text.trim() && (
            <div className="font-preview" style={{ fontFamily: cssFamilyFor(zone.fontFamily) }}>
              {zone.text}
            </div>
          )}
          <SelectField label="Mode" value={zone.mode} options={MODE_OPTIONS} onChange={(mode) => onChange({ mode })} />
          <ToggleField label="Gras" checked={zone.bold} onChange={(bold) => onChange({ bold })} />
          <SliderField
            label="Hauteur des lettres"
            value={zone.height}
            min={1}
            max={15}
            step={0.25}
            unit=" mm"
            onChange={(height) => onChange({ height })}
          />
          <p className="field-hint">
            Position : décalage par rapport au centre de la plaque (0 mm = centre, Y+ vers le haut).
          </p>
          <SliderField
            label="Décalage X"
            value={zone.offsetX}
            min={-40}
            max={40}
            step={0.5}
            unit=" mm"
            onChange={(offsetX) => onChange({ offsetX })}
          />
          <SliderField
            label="Décalage Y"
            value={zone.offsetY}
            min={-40}
            max={40}
            step={0.5}
            unit=" mm"
            onChange={(offsetY) => onChange({ offsetY })}
          />
          <SliderField
            label="Rotation"
            value={zone.rotation}
            min={0}
            max={360}
            step={1}
            unit="°"
            onChange={(rotation) => onChange({ rotation })}
          />
          <SliderField
            label="Hauteur du relief"
            value={zone.reliefHeight}
            min={0.2}
            max={2}
            step={0.05}
            unit=" mm"
            onChange={(reliefHeight) => onChange({ reliefHeight })}
          />
          <SliderField
            label="Résolution (détail)"
            value={zone.resolution}
            min={12}
            max={80}
            step={1}
            unit=" px"
            onChange={(resolution) => onChange({ resolution })}
          />
        </>
      )}
    </Section>
  );
}
