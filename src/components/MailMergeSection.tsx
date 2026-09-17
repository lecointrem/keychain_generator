import { useMemo, useState, type ChangeEvent } from 'react';
import { useKeychainStore } from '../store';
import { parseCsv } from '../utils/csv';
import {
  buildMailMergeRows,
  estimatePlates,
  exportMailMergeIndividual,
  exportMailMergePlated,
  EMPTY_MAPPING,
  type MailMergeFormat,
  type MailMergeMapping,
} from '../export/mailMerge';
import { Section, SelectField, SliderField } from './fields';

const MAPPING_FIELDS: { key: keyof MailMergeMapping; label: string }[] = [
  { key: 'qr', label: 'Colonne pour le QR code' },
  { key: 'text1', label: 'Colonne pour Texte 1' },
  { key: 'text2', label: 'Colonne pour Texte 2' },
  { key: 'text3', label: 'Colonne pour Texte 3' },
];

const FORMAT_OPTIONS: { value: MailMergeFormat; label: string }[] = [
  { value: '3mf', label: '3MF (multicouleur)' },
  { value: 'stl', label: 'STL' },
];

export function MailMergeSection() {
  const config = useKeychainStore((s) => s.config);
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<MailMergeMapping>(EMPTY_MAPPING);
  const [format, setFormat] = useState<MailMergeFormat>('3mf');
  const [bedWidth, setBedWidth] = useState(220);
  const [bedDepth, setBedDepth] = useState(220);
  const [spacing, setSpacing] = useState(4);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCsv(reader.result as string);
        if (parsed.headers.length === 0 || parsed.rows.length === 0) {
          setError('Le fichier CSV semble vide.');
          return;
        }
        setHeaders(parsed.headers);
        setCsvRows(parsed.rows);
        setMapping(EMPTY_MAPPING);
        setError(null);
      } catch {
        setError('Impossible de lire ce fichier CSV.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const rows = useMemo(
    () => (headers.length > 0 ? buildMailMergeRows(headers, csvRows, mapping) : []),
    [headers, csvRows, mapping],
  );
  const hasAnyMapping = Boolean(mapping.qr || mapping.text1 || mapping.text2 || mapping.text3);
  const plateInfo = useMemo(
    () => (rows.length > 0 ? estimatePlates(config, rows.length, bedWidth, bedDepth, spacing) : null),
    [config, rows.length, bedWidth, bedDepth, spacing],
  );

  async function runExport(kind: 'individual' | 'plated') {
    setProgress({ done: 0, total: rows.length });
    setError(null);
    try {
      if (kind === 'individual') {
        await exportMailMergeIndividual(config, rows, format, (done, total) => setProgress({ done, total }));
      } else {
        await exportMailMergePlated(config, rows, format, bedWidth, bedDepth, spacing, (done, total) =>
          setProgress({ done, total }),
        );
      }
    } catch (e) {
      setError('Erreur pendant la génération : ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setProgress(null);
    }
  }

  return (
    <Section title="Publipostage (CSV)" defaultOpen={false}>
      <p className="field-hint">
        Importe un CSV (une ligne par personne) pour générer un porte-clé par ligne à partir du gabarit actuel
        (forme, couleurs, logo, contour...). Seuls le QR code et les 3 zones de texte varient par ligne.
      </p>
      <label className="field">
        <div className="field-row">
          <span>Fichier CSV</span>
        </div>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} />
      </label>

      {error && <p className="field-hint field-error">{error}</p>}

      {headers.length > 0 && (
        <>
          <p className="field-hint">
            {csvRows.length} ligne(s) détectée(s). Colonnes : {headers.join(', ')}
          </p>

          {MAPPING_FIELDS.map(({ key, label }) => (
            <label className="field" key={key}>
              <div className="field-row">
                <span>{label}</span>
              </div>
              <select
                value={mapping[key] ?? ''}
                onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || null }))}
              >
                <option value="">— Ne pas utiliser —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          ))}

          {!hasAnyMapping && <p className="field-hint">Associe au moins une colonne pour continuer.</p>}

          {hasAnyMapping && rows[0] && (
            <div className="font-preview mail-merge-preview">
              Aperçu ligne 1 — QR : {rows[0].qr || '(gabarit)'} · Texte 1 : {rows[0].text1 || '(gabarit)'} · Texte 2 :{' '}
              {rows[0].text2 || '(gabarit)'} · Texte 3 : {rows[0].text3 || '(gabarit)'}
            </div>
          )}

          <SelectField label="Format d'export" value={format} options={FORMAT_OPTIONS} onChange={setFormat} />

          <p className="field-hint">Réglages du plateau (pour l'export groupé) :</p>
          <SliderField
            label="Largeur du plateau"
            value={bedWidth}
            min={100}
            max={500}
            step={5}
            unit=" mm"
            onChange={setBedWidth}
          />
          <SliderField
            label="Profondeur du plateau"
            value={bedDepth}
            min={100}
            max={500}
            step={5}
            unit=" mm"
            onChange={setBedDepth}
          />
          <SliderField
            label="Espacement entre pièces"
            value={spacing}
            min={1}
            max={20}
            step={0.5}
            unit=" mm"
            onChange={setSpacing}
          />

          {plateInfo && (
            <p className="field-hint">
              {plateInfo.perPlate} pièce(s) par plateau ({plateInfo.cols}×{plateInfo.rowsPerPlate}) → {plateInfo.plates}{' '}
              plateau(x) pour {rows.length} personne(s).
            </p>
          )}

          {progress && (
            <p className="field-hint">
              Génération {progress.done}/{progress.total}…
            </p>
          )}

          <button
            className="btn-primary"
            type="button"
            disabled={!hasAnyMapping || !!progress}
            onClick={() => runExport('individual')}
            style={{ marginBottom: 8 }}
          >
            Exporter {rows.length} fichier(s) individuels (.zip)
          </button>
          <button
            className="btn-primary"
            type="button"
            disabled={!hasAnyMapping || !!progress}
            onClick={() => runExport('plated')}
          >
            Exporter en plateaux groupés (.zip)
          </button>
        </>
      )}
    </Section>
  );
}
