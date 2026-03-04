import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import GridView from './components/GridView.jsx';
import SearchView from './components/SearchView.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<GridView />} />
        <Route path="search" element={<SearchView />} />
      </Route>
    </Routes>
  );
}
