import { useEffect, useState } from "react";

const tabs = [
  ["overview", "Resumen"],
  ["docker", "Docker"],
  ["projects", "Proyectos"],
  ["apps", "Aplicaciones"],
  ["monitoring", "Monitoreo"],
  ["domains", "Dominios"],
  ["logs", "Logs"],
  ["tasks", "Tareas"],
  ["security", "Seguridad"],
  ["system", "Sistema"],
  ["settings", "Configuración"],
];

function getTabFromHash() {
  const tabId = location.hash.slice("#tab-".length);
  return tabs.some(([id]) => id === tabId) ? tabId : "overview";
}

export default function DashboardTabs() {
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const activate = (tabId) => {
      const selectedTab = tabs.some(([id]) => id === tabId) ? tabId : "overview";
      setActiveTab(selectedTab);
      for (const [id] of tabs) {
        const panel = document.getElementById(`tab-${id}`);
        if (panel) {
          panel.hidden = id !== selectedTab;
          panel.classList.toggle("hidden", id !== selectedTab);
        }
      }
    };

    const syncFromHash = () => activate(getTabFromHash());
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function selectTab(tabId, { focus = false } = {}) {
    setActiveTab(tabId);
    for (const [id] of tabs) {
      const panel = document.getElementById(`tab-${id}`);
      if (panel) {
        panel.hidden = id !== tabId;
        panel.classList.toggle("hidden", id !== tabId);
      }
    }

    const hash = `#tab-${tabId}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
    if (focus) document.getElementById(`tab-button-${tabId}`)?.focus();
  }

  function handleKeyDown(event, index) {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    selectTab(tabs[nextIndex][0], { focus: true });
  }

  return (
    <nav
      className="dashboard-tabs flex gap-1 overflow-x-auto"
      role="tablist"
      aria-label="Categorías de administración"
    >
      {tabs.map(([id, label], index) => (
        <button
          id={`tab-button-${id}`}
          className="dashboard-tab shrink-0"
          type="button"
          role="tab"
          aria-selected={activeTab === id}
          aria-controls={`tab-${id}`}
          tabIndex={activeTab === id ? 0 : -1}
          key={id}
          onClick={() => selectTab(id)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
