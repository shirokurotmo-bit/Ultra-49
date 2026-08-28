import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './components/novels/Home Page';
import NovelEditorPage from './components/editor/Novel Editor Page';
import ReaderPage from './components/reader/Reader Page';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor/:novelId" element={<NovelEditorPage />} />
        <Route path="/reader/:novelId" element={<ReaderPage />} />
      </Routes>
    </BrowserRouter>
  );
}
