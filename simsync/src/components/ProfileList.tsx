import { useState, useEffect } from "react";
import { Plus, Upload } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { useLogStore } from "../stores/useLogStore";
import ProfileCard from "./ProfileCard";
import * as cmd from "../lib/commands";
import { open, save } from "@tauri-apps/plugin-dialog";

export default function ProfileList() {
  const profiles = useAppStore((s) => s.profiles);
  const setProfiles = useAppStore((s) => s.setProfiles);
  const addLog = useLogStore((s) => s.addLog);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    cmd.listProfiles().then(setProfiles).catch(console.error);
  }, [setProfiles]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await cmd.saveProfile(name, desc, "\uD83D\uDCE6");
      const updated = await cmd.listProfiles();
      setProfiles(updated);
      setName("");
      setDesc("");
      setShowCreate(false);
      addLog(`Profile "${name}" created`, "success");
    } catch (e) {
      addLog(`Failed to create profile: ${e}`, "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await cmd.deleteProfile(id);
      const updated = await cmd.listProfiles();
      setProfiles(updated);
      addLog("Profile deleted", "info");
    } catch (e) {
      addLog(`Failed to delete profile: ${e}`, "error");
    }
  };

  const handleLoad = async (id: string) => {
    try {
      await cmd.loadProfile(id);
      addLog("Profile loaded", "success");
    } catch (e) {
      addLog(`Failed to load profile: ${e}`, "error");
    }
  };

  const handleExport = async (id: string, profileName: string) => {
    try {
      const dest = await save({
        defaultPath: `${profileName}.simsync-profile`,
        filters: [{ name: "SimSync Profile", extensions: ["simsync-profile"] }],
      });
      if (dest) {
        await cmd.exportProfile(id, dest);
        const filename = dest.split(/[/\\]/).pop() || dest;
        addLog(`Profile exported as ${filename}`, "success");
      }
    } catch (e) {
      addLog(`Failed to export profile: ${e}`, "error");
    }
  };

  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "SimSync Profile", extensions: ["simsync-profile"] }],
      });
      if (selected) {
        const path = typeof selected === "string" ? selected : selected;
        await cmd.importProfile(path);
        const updated = await cmd.listProfiles();
        setProfiles(updated);
        addLog("Profile imported", "success");
      }
    } catch (e) {
      addLog(`Failed to import profile: ${e}`, "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Mod Profiles</h2>
        <div className="flex gap-2">
          <button
            onClick={handleImport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card border border-border hover:bg-bg-card-hover text-sm transition-colors"
          >
            <Upload size={14} />
            Import
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            onDelete={() => handleDelete(profile.id)}
            onLoad={() => handleLoad(profile.id)}
            onExport={() => handleExport(profile.id, profile.name)}
          />
        ))}

        {showCreate ? (
          <div className="bg-bg-card rounded-xl border border-accent/50 p-4 space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              placeholder="Profile name..."
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={256}
              placeholder="Description..."
              rows={2}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="flex-1 bg-accent hover:bg-accent-light text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                Save Profile
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-2 rounded-lg bg-bg-card-hover text-txt-dim text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-bg-card rounded-xl border border-dashed border-border hover:border-accent/50 p-6 flex flex-col items-center justify-center gap-2 text-txt-dim hover:text-accent-light transition-colors min-h-[140px]"
          >
            <Plus size={24} />
            <span className="text-sm">Create New Profile</span>
          </button>
        )}
      </div>
    </div>
  );
}
