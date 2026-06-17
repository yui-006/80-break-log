import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { CoursePage } from './pages/CoursePage';
import { RecordPage } from './pages/RecordPage';
import { HoleInputPage } from './pages/HoleInputPage';
import { ScoreCardPage } from './pages/ScoreCardPage';
import { LossDetailPage } from './pages/LossDetailPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { PracticePage } from './pages/PracticePage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          {/* Auth page: standalone, no bottom nav */}
          <Route path="/auth" element={<AuthPage />} />
          {/* Main app */}
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="courses" element={<CoursePage />} />
            <Route path="record" element={<RecordPage />} />
            <Route path="rounds/:roundId/hole/:holeNo" element={<HoleInputPage />} />
            <Route path="rounds/:roundId/scorecard" element={<ScoreCardPage />} />
            <Route path="rounds/:roundId/loss/:lossKey" element={<LossDetailPage />} />
            <Route path="analysis" element={<AnalysisPage />} />
            <Route path="practice" element={<PracticePage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}
