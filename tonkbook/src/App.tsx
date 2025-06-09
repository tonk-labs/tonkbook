import React from "react";
import { Route, Routes } from "react-router-dom";
import { MainView } from "./views";

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<MainView />} />
    </Routes>
  );
};

export default App;
