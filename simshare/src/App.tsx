import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import ModList from "./components/ModList";
import SaveList from "./components/SaveList";
import ProfileList from "./components/ProfileList";
import ActivityLog from "./components/ActivityLog";
import Settings from "./components/Settings";
import { useAppStore } from "./stores/useAppStore";
import { useTauriEvents } from "./hooks/useTauriEvents";

function App() {
  const page = useAppStore((s) => s.page);
  useTauriEvents();

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard />;
      case "mods":
        return <ModList />;
      case "saves":
        return <SaveList />;
      case "profiles":
        return <ProfileList />;
      case "activity":
        return <ActivityLog />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return <Layout>{renderPage()}</Layout>;
}

export default App;
