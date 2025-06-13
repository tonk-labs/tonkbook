import React, { useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { MainView, NotesView, DigestView } from "./views";
import { Book, Newspaper } from "lucide-react";

const App: React.FC = () => {
  const location = useLocation();
  const [currentView, setCurrentView] = useState<"notes" | "digest">(
    location.pathname === "/digest" ? "digest" : "notes",
  );

  const showToggle = !location.pathname.includes("/notes/");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal Toggle */}
      {showToggle && (
        <div className="max-w-6xl mx-auto pt-8">
          <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setCurrentView("notes")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === "notes"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Book className="w-4 h-4" />
              Notes
            </button>
            <button
              onClick={() => setCurrentView("digest")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === "digest"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Newspaper className="w-4 h-4" />
              Daily Digest
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div>
        {showToggle ? (
          currentView === "notes" ? (
            <MainView />
          ) : (
            <DigestView />
          )
        ) : (
          <Routes>
            <Route path="/notes/:noteId" element={<NotesView />} />
          </Routes>
        )}
      </div>
    </div>
  );
};

export default App;
