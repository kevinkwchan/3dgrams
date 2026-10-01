import { Navigate, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home';
import { Library } from './pages/Library';
import { Play } from './pages/Play';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/library" element={<Library />} />
      <Route path="/daily" element={<Play daily />} />
      <Route path="/play/:id" element={<Play />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
