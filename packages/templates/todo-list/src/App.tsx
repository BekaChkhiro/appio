import React, { useState } from "react";

// Component bodies are injected by the code generator from the hybrid spec.
// Each component receives props defined in template.config.json.
// The code generator replaces placeholder JSX with AI-generated JSX bodies.
// Page components import the store directly: `import { useTaskStore } from "../stores/taskStore"`

export default function App() {
  const [currentPage, setCurrentPage] = useState("/");

  // Routing placeholder — code generator fills in page components
  const pages: Record<string, React.ReactNode> = {
    "/": <div id="page-home">/* Home page components injected here */</div>,
    "/add": <div id="page-add">/* Add task page injected here */</div>,
    "/categories": <div id="page-categories">/* Categories page injected here */</div>,
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-20">{pages[currentPage] || pages["/"]}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-200 flex justify-around py-3 px-4 safe-area-pb">
        {[
          { route: "/", label: "Tasks", icon: "list" },
          { route: "/add", label: "Add", icon: "plus" },
          { route: "/categories", label: "Categories", icon: "tag" },
        ].map((tab) => (
          <button
            key={tab.route}
            onClick={() => setCurrentPage(tab.route)}
            className={`flex flex-col items-center text-xs ${
              currentPage === tab.route ? "text-primary" : "text-text-secondary"
            }`}
          >
            <span className="text-lg mb-0.5">{tab.icon === "list" ? "📋" : tab.icon === "plus" ? "➕" : "🏷️"}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
