import { useCallback, useState } from 'react';
import { useKeychainStore } from './store';
import { useKeychainGeometry } from './hooks/useKeychainGeometry';
import { useCustomFonts } from './hooks/useCustomFonts';
import { ControlsPanel } from './components/ControlsPanel';
import { Viewer3D } from './components/Viewer3D';
import { exportKeychainSTL } from './export/exportSTL';
import { exportKeychain3MF } from './export/export3MF';
import { buildQRGrid } from './geometry/buildQR';
import { buildLogoGrid } from './geometry/buildLogo';
import { buildTextGrid } from './geometry/buildText';
import type { KeychainConfig } from './types';
import './App.css';

async function collectGrids(config: KeychainConfig) {
  const qrGrid = config.qr.enabled ? buildQRGrid(config.qr) : null;
  const logoGrid = config.logo.enabled ? await buildLogoGrid(config.logo) : null;
  const text1Grid = config.text1.enabled ? await buildTextGrid(config.text1) : null;
  const text2Grid = config.text2.enabled ? await buildTextGrid(config.text2) : null;
  const text3Grid = config.text3.enabled ? await buildTextGrid(config.text3) : null;
  return { qrGrid, logoGrid, text1Grid, text2Grid, text3Grid };
}

function App() {
  const config = useKeychainStore((s) => s.config);
  useCustomFonts(config.customFonts);
  const { pieces, error } = useKeychainGeometry(config);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const grids = await collectGrids(config);
      await exportKeychainSTL(config, grids);
    } catch (e) {
      alert('Erreur lors de l\'export STL : ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExporting(false);
    }
  }, [config]);

  const handleExport3MF = useCallback(async () => {
    setExporting(true);
    try {
      const grids = await collectGrids(config);
      await exportKeychain3MF(config, grids);
    } catch (e) {
      alert('Erreur lors de l\'export 3MF : ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExporting(false);
    }
  }, [config]);

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <ControlsPanel onExport={handleExport} onExport3MF={handleExport3MF} exporting={exporting} />
      </aside>
      <main className="app-viewer">
        <Viewer3D pieces={pieces} error={error} />
      </main>
    </div>
  );
}

export default App;
