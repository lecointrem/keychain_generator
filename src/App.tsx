import { useCallback, useState } from 'react';
import { useKeychainStore } from './store';
import { useKeychainGeometry } from './hooks/useKeychainGeometry';
import { ControlsPanel } from './components/ControlsPanel';
import { Viewer3D } from './components/Viewer3D';
import { exportKeychainSTL } from './export/exportSTL';
import { buildQRGrid } from './geometry/buildQR';
import { buildLogoGrid } from './geometry/buildLogo';
import { buildTextGrid } from './geometry/buildText';
import './App.css';

function App() {
  const config = useKeychainStore((s) => s.config);
  const { geometry, error } = useKeychainGeometry(config);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const qrGrid = config.qr.enabled ? buildQRGrid(config.qr) : null;
      const logoGrid = config.logo.enabled ? await buildLogoGrid(config.logo) : null;
      const text1Grid = config.text1.enabled ? await buildTextGrid(config.text1) : null;
      const text2Grid = config.text2.enabled ? await buildTextGrid(config.text2) : null;
      await exportKeychainSTL(config, { qrGrid, logoGrid, text1Grid, text2Grid });
    } catch (e) {
      alert('Erreur lors de l\'export STL : ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExporting(false);
    }
  }, [config]);

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <ControlsPanel onExport={handleExport} exporting={exporting} />
      </aside>
      <main className="app-viewer">
        <Viewer3D geometry={geometry} color={config.color} error={error} />
      </main>
    </div>
  );
}

export default App;
