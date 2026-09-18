import { useState, type ChangeEvent } from 'react';
import { useKeychainStore } from '../store';
import type { ShapeType, ReliefMode } from '../types';
import { ColorField, SelectField, Section, SliderField, TextField, ToggleField } from './fields';
import { TextZoneSection } from './TextZoneSection';
import { MailMergeSection } from './MailMergeSection';
import { downloadBlob } from '../utils/download';
import { fetchImageAsDataUrl } from '../utils/fetchImage';

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
  onExport3MF: () => void;
  exporting: boolean;
}

export function ControlsPanel({ onExport, onExport3MF, exporting }: Props) {
  const config = useKeychainStore((s) => s.config);
  const setShape = useKeychainStore((s) => s.setShape);
  const setHole = useKeychainStore((s) => s.setHole);
  const setContour = useKeychainStore((s) => s.setContour);
  const setQR = useKeychainStore((s) => s.setQR);
  const setLogo = useKeychainStore((s) => s.setLogo);
  const setText1 = useKeychainStore((s) => s.setText1);
  const setText2 = useKeychainStore((s) => s.setText2);
  const setText3 = useKeychainStore((s) => s.setText3);
  const setNFC = useKeychainStore((s) => s.setNFC);
  const setExport = useKeychainStore((s) => s.setExport);
  const setColor = useKeychainStore((s) => s.setColor);
  const addCustomFont = useKeychainStore((s) => s.addCustomFont);
  const removeCustomFont = useKeychainStore((s) => s.removeCustomFont);
  const reset = useKeychainStore((s) => s.reset);
  const loadConfig = useKeychainStore((s) => s.loadConfig);

  const [logoUrl, setLogoUrl] = useState('');
  const [logoUrlLoading, setLogoUrlLoading] = useState(false);
  const [logoUrlError, setLogoUrlError] = useState<string | null>(null);

  function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogo({ imageDataUrl: reader.result as string, enabled: true });
    };
    reader.readAsDataURL(file);
  }

  async function handleLogoUrlLoad() {
    const url = logoUrl.trim();
    if (!url) return;
    setLogoUrlLoading(true);
    setLogoUrlError(null);
    try {
      const dataUrl = await fetchImageAsDataUrl(url);
      setLogo({ imageDataUrl: dataUrl, enabled: true });
    } catch (e) {
      setLogoUrlError(e instanceof Error ? e.message : String(e));
    } finally {
      setLogoUrlLoading(false);
    }
  }

  function handleFontUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const name = file.name.replace(/\.[^.]+$/, '');
      addCustomFont({
        id,
        name,
        cssFamily: `CustomFont_${id}`,
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  const isVectorLogo = Boolean(config.logo.imageDataUrl?.startsWith('data:image/svg+xml')) && config.logo.vectorize;

  function handleSaveProfile() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'profil-porte-cle.json');
  }

  function handleLoadProfile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        loadConfig(parsed);
      } catch {
        alert('Fichier de profil invalide.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h1>Générateur de porte-clés</h1>
        <button className="btn-ghost" onClick={reset} type="button">
          Réinitialiser
        </button>
      </div>

      <Section title="Profil" defaultOpen={false}>
        <p className="field-hint">Sauvegarde tous les réglages actuels dans un fichier, à recharger plus tard.</p>
        <button className="btn-ghost" type="button" onClick={handleSaveProfile} style={{ width: '100%', marginBottom: 8 }}>
          Enregistrer le profil (.json)
        </button>
        <label className="field">
          <div className="field-row">
            <span>Charger un profil</span>
          </div>
          <input type="file" accept="application/json,.json" onChange={handleLoadProfile} />
        </label>
      </Section>

      <Section title="Forme & dimensions">
        <div className="field-row" style={{ gap: 8, marginBottom: 10 }}>
          <button
            className="btn-ghost"
            type="button"
            style={{ flex: 1 }}
            onClick={() => setShape({ type: 'rounded-rect', width: 50, height: 30, cornerRadius: 4 })}
          >
            Porte-clé 50×30
          </button>
          <button
            className="btn-ghost"
            type="button"
            style={{ flex: 1 }}
            onClick={() => setShape({ type: 'rounded-rect', width: 85, height: 54, cornerRadius: 3 })}
          >
            Carte CR80 85×54
          </button>
        </div>
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
            <p className="field-hint">
              Position : décalage par rapport au centre de la plaque (0 mm = centre, Y+ vers le haut).
            </p>
            <SliderField
              label="Décalage horizontal"
              value={config.hole.offsetX}
              min={-100}
              max={100}
              step={0.5}
              unit=" mm"
              onChange={(offsetX) => setHole({ offsetX })}
            />
            <SliderField
              label="Décalage vertical"
              value={config.hole.offsetY}
              min={-50}
              max={50}
              step={0.5}
              unit=" mm"
              onChange={(offsetY) => setHole({ offsetY })}
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
            <ColorField label="Couleur" value={config.contour.color} onChange={(color) => setContour({ color })} />
          </>
        )}
      </Section>

      <Section title="QR Code">
        <ToggleField label="Activer" checked={config.qr.enabled} onChange={(enabled) => setQR({ enabled })} />
        {config.qr.enabled && (
          <>
            <TextField
              label="Valeur (URL, texte...)"
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
            <p className="field-hint">
              Position : décalage par rapport au centre de la plaque (0 mm = centre, Y+ vers le haut).
            </p>
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
              label="Rotation"
              value={config.qr.rotation}
              min={0}
              max={360}
              step={1}
              unit="°"
              onChange={(rotation) => setQR({ rotation })}
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
            {config.qr.mode === 'raised' && (
              <ColorField label="Couleur" value={config.qr.color} onChange={(color) => setQR({ color })} />
            )}
          </>
        )}
      </Section>

      <Section title="Logo d'entreprise" defaultOpen>
        <ToggleField label="Activer" checked={config.logo.enabled} onChange={(enabled) => setLogo({ enabled })} />
        <label className="field">
          <div className="field-row">
            <span>Image (PNG, JPG, SVG)</span>
          </div>
          <input type="file" accept="image/*" onChange={handleLogoUpload} />
          {config.logo.imageDataUrl && (
            <div className="logo-preview">
              <img src={config.logo.imageDataUrl} alt="Aperçu du logo" />
            </div>
          )}
        </label>
        <label className="field">
          <div className="field-row">
            <span>Ou depuis une URL (image, SVG...)</span>
          </div>
          <input
            type="text"
            placeholder="https://..."
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={handleLogoUrlLoad}
            disabled={logoUrlLoading || !logoUrl.trim()}
          >
            {logoUrlLoading ? 'Chargement…' : 'Charger'}
          </button>
          {logoUrlError && <p className="field-hint field-error">{logoUrlError}</p>}
          <p className="field-hint">
            Ne fonctionne que si le site source autorise le CORS (Wikimedia par exemple) — sinon, télécharge
            l'image et utilise l'import de fichier ci-dessus.
          </p>
        </label>
        {config.logo.enabled && config.logo.imageDataUrl?.startsWith('data:image/svg+xml') && (
          <>
            <ToggleField
              label="Vectoriser le SVG (contours nets)"
              checked={config.logo.vectorize}
              onChange={(vectorize) => setLogo({ vectorize })}
            />
            <p className="field-hint">
              Extrait les tracés vectoriels du SVG au lieu de le pixelliser — bords nets, pas d'effet d'escalier
              sur les diagonales. Si le SVG contient du texte (balises &lt;text&gt;), il est automatiquement
              pixellisé à part et fusionné avec le reste vectorisé. Bascule entièrement en mode pixel seulement
              si des tracés en contour non remplis (stroke) sont présents, ou si le SVG ne peut pas être
              analysé.
            </p>
          </>
        )}
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
            <p className="field-hint">
              Position : décalage par rapport au centre de la plaque (0 mm = centre, Y+ vers le haut). Par défaut, le
              logo est placé un peu au-dessus du centre.
            </p>
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
              label="Rotation"
              value={config.logo.rotation}
              min={0}
              max={360}
              step={1}
              unit="°"
              onChange={(rotation) => setLogo({ rotation })}
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
            {!isVectorLogo && (
              <>
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
                <ToggleField
                  label="Négatif (inverser le motif)"
                  checked={config.logo.invert}
                  onChange={(invert) => setLogo({ invert })}
                />
                <p className="field-hint">
                  Inverse les zones qui deviennent du relief : ce qui était plein devient vide, et inversement.
                </p>
              </>
            )}
            {config.logo.mode === 'raised' && (
              <ColorField label="Couleur" value={config.logo.color} onChange={(color) => setLogo({ color })} />
            )}
          </>
        )}
      </Section>

      <Section title="Polices personnalisées" defaultOpen={false}>
        <p className="field-hint">
          Importe tes propres fichiers de police (.ttf, .otf, .woff, .woff2). Ils restent uniquement dans ton
          navigateur — jamais publiés ni envoyés où que ce soit — et apparaissent ensuite dans le choix de police de
          chaque zone de texte.
        </p>
        <label className="field">
          <div className="field-row">
            <span>Ajouter une police</span>
          </div>
          <input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleFontUpload} />
        </label>
        {config.customFonts.length > 0 && (
          <ul className="custom-font-list">
            {config.customFonts.map((f) => (
              <li key={f.id} style={{ fontFamily: f.cssFamily }}>
                <span>{f.name}</span>
                <button type="button" className="btn-ghost" onClick={() => removeCustomFont(f.id)}>
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <TextZoneSection
        title="Texte libre 1"
        zone={config.text1}
        onChange={setText1}
        customFonts={config.customFonts}
      />
      <TextZoneSection
        title="Texte libre 2"
        zone={config.text2}
        onChange={setText2}
        customFonts={config.customFonts}
      />
      <TextZoneSection
        title="Texte libre 3"
        zone={config.text3}
        onChange={setText3}
        customFonts={config.customFonts}
      />

      <Section title="Tag NFC intégré" defaultOpen={false}>
        <ToggleField label="Activer" checked={config.nfc.enabled} onChange={(enabled) => setNFC({ enabled })} />
        {config.nfc.enabled && (
          <>
            <p className="field-hint">
              Poche cylindrique entièrement fermée, à mi-épaisseur de la plaque. Nécessite une pause d'impression à
              cette hauteur pour insérer le tag, puis reprendre. Assure-toi que l'épaisseur de la plaque est
              suffisante (profondeur de poche + au moins 0.4 mm de parois).
            </p>
            <SliderField
              label="Diamètre du tag"
              value={config.nfc.diameter}
              min={10}
              max={40}
              step={0.5}
              unit=" mm"
              onChange={(diameter) => setNFC({ diameter })}
            />
            <SliderField
              label="Épaisseur du tag"
              value={config.nfc.tagThickness}
              min={0.05}
              max={1}
              step={0.05}
              unit=" mm"
              onChange={(tagThickness) => setNFC({ tagThickness })}
            />
            <SliderField
              label="Jeu (tolérance)"
              value={config.nfc.clearance}
              min={0}
              max={1}
              step={0.05}
              unit=" mm"
              onChange={(clearance) => setNFC({ clearance })}
            />
            <p className="field-hint">
              Profondeur totale de la poche : {(config.nfc.tagThickness + config.nfc.clearance).toFixed(2)} mm.
              Position : décalage par rapport au centre de la plaque.
            </p>
            <SliderField
              label="Décalage X"
              value={config.nfc.offsetX}
              min={-40}
              max={40}
              step={0.5}
              unit=" mm"
              onChange={(offsetX) => setNFC({ offsetX })}
            />
            <SliderField
              label="Décalage Y"
              value={config.nfc.offsetY}
              min={-40}
              max={40}
              step={0.5}
              unit=" mm"
              onChange={(offsetY) => setNFC({ offsetY })}
            />
          </>
        )}
      </Section>

      <Section title="Apparence" defaultOpen={false}>
        <label className="field">
          <div className="field-row">
            <span>Couleur de la base</span>
          </div>
          <input type="color" value={config.color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <p className="field-hint">
          Utilisée dans l'aperçu 3D et dans l'export 3MF (une couleur par élément, pour l'impression multicouleur).
        </p>
      </Section>

      <Section title="Export" defaultOpen={false}>
        <TextField label="Nom de fichier" value={config.export.filename} onChange={(filename) => setExport({ filename })} />
        <button className="btn-primary" type="button" onClick={onExport3MF} disabled={exporting} style={{ marginBottom: 8 }}>
          {exporting ? 'Génération…' : 'Exporter en 3MF (multicouleur)'}
        </button>
        <p className="field-hint">
          Le 3MF porte la couleur de chaque élément (base, contour, QR, logo, textes en relief) — les slicers
          compatibles (BambuStudio, OrcaSlicer...) les assignent automatiquement à un filament/AMS.
        </p>

        <Section title="Profil d'impression (3MF)" defaultOpen={false}>
          <p className="field-hint">
            Ces réglages sont embarqués dans le fichier 3MF. S'ils ne correspondent à aucun profil connu de ton
            slicer, laisse-les vides — sinon le slicer peut essayer de faire correspondre un profil inexistant et
            retomber sur des réglages par défaut (temp./premier layer) qui ne sont pas les tiens. En cas de doute,
            garde ton propre profil au moment d'ouvrir le fichier plutôt que celui du projet.
          </p>
          <TextField
            label="Nom imprimante"
            value={config.export.printProfile.printerName}
            onChange={(printerName) =>
              setExport({ printProfile: { ...config.export.printProfile, printerName } })
            }
          />
          <TextField
            label="ID profil imprimante (slicer)"
            value={config.export.printProfile.printerSettingsId}
            onChange={(printerSettingsId) =>
              setExport({ printProfile: { ...config.export.printProfile, printerSettingsId } })
            }
          />
          <TextField
            label="ID profil d'impression (process)"
            value={config.export.printProfile.printSettingsId}
            onChange={(printSettingsId) =>
              setExport({ printProfile: { ...config.export.printProfile, printSettingsId } })
            }
          />
          <TextField
            label="Profil filament"
            value={config.export.printProfile.filament}
            onChange={(filament) => setExport({ printProfile: { ...config.export.printProfile, filament } })}
          />
          <SliderField
            label="Largeur du plateau"
            value={config.export.printProfile.bedWidth}
            min={100}
            max={500}
            step={5}
            unit=" mm"
            onChange={(bedWidth) => setExport({ printProfile: { ...config.export.printProfile, bedWidth } })}
          />
          <SliderField
            label="Profondeur du plateau"
            value={config.export.printProfile.bedDepth}
            min={100}
            max={500}
            step={5}
            unit=" mm"
            onChange={(bedDepth) => setExport({ printProfile: { ...config.export.printProfile, bedDepth } })}
          />
          <SliderField
            label="Hauteur d'impression max"
            value={config.export.printProfile.bedHeight}
            min={100}
            max={500}
            step={5}
            unit=" mm"
            onChange={(bedHeight) => setExport({ printProfile: { ...config.export.printProfile, bedHeight } })}
          />
          <p className="field-hint">
            Le diamètre de buse embarqué (0.4mm) est fixé par la librairie d'export et n'est pas modifiable ici.
          </p>
        </Section>

        <ToggleField
          label="Export STL multi-pièces (multicouleur)"
          checked={config.export.splitParts}
          onChange={(splitParts) => setExport({ splitParts })}
        />
        <button className="btn-primary" type="button" onClick={onExport} disabled={exporting}>
          {exporting ? 'Génération du STL…' : 'Exporter en STL'}
        </button>
      </Section>

      <MailMergeSection />
    </div>
  );
}
