import React from "react";
import { Route, Routes } from "react-router-dom";
import { MainView, NotesView } from "./views";

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<MainView />} />
      <Route path="/notes/:noteId" element={<NotesView />} />
    </Routes>
  );
};

export default App;
