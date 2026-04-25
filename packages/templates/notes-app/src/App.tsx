import React, { useState } from "react";

export default function App() {
  const [currentPage, setCurrentPage] = useState("/");

  const pages: Record<string, React.ReactNode> = {
    "/": <div id="page-home">/* Note list with search */</div>,
    "/edit": <div id="page-edit">/* Note editor */</div>,
    "/folders": <div id="page-folders">/* Folder management */</div>,
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-20">{pages[currentPage] || pages["/"]}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-200 flex justify-around py-3 px-4 safe-area-pb">
        {[
          { route: "/", label: "Notes", icon: "📝" },
          { route: "/edit", label: "New", icon: "✏️" },
          { route: "/folders", label: "Folders", icon: "📁" },
        ].map((tab) => (
          <button
            key={tab.route}
            onClick={() => setCurrentPage(tab.route)}
            className={`flex flex-col items-center text-xs ${
              currentPage === tab.route ? "text-primary" : "text-text-secondary"
            }`}
          >
            <span className="text-lg mb-0.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
