import { useCallback, useState } from 'react';
import { useKeychainStore } from './store';
import { useKeychainGeometry } from './hooks/useKeychainGeometry';
import { useCustomFonts } from './hooks/useCustomFonts';
import { ControlsPanel } from './components/ControlsPanel';
import { Viewer3D } from './components/Viewer3D';
import { exportKeychainSTL } from './export/exportSTL';
import { exportKeychain3MF } from './export/export3MF';
import { collectGrids } from './geometry/collectGrids';
import './App.css';

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
