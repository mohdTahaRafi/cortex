import { useState, useEffect } from "react";
import { Bot, MessageSquare, Palette, Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ModelsTab from "./tabs/ModelsTab";
import ChatTab from "./tabs/ChatTab";
import ColorsTab from "./tabs/ColorsTab";
import SettingsTab from "./tabs/SettingsTab";
import Logo from "@/assets/icon.png";

type Tab = "models" | "chat" | "colors" | "settings";

const TABS: {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    id: "models",
    label: "Models",
    icon: <Bot className="h-4 w-4" />,
    description: "Download and manage AI models in your browser",
  },
  {
    id: "chat",
    label: "Chat",
    icon: <MessageSquare className="h-4 w-4" />,
    description: "Test your loaded model in a conversation",
  },
  {
    id: "colors",
    label: "Colors",
    icon: <Palette className="h-4 w-4" />,
    description: "Customize visual filters to reduce sensory overload",
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings className="h-4 w-4" />,
    description: "Configure the text simplification prompt and global options",
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("models");
  const [activeModel, setActiveModel] = useState("");

  useEffect(() => {
    chrome.storage.local.get({ activeModel: "", _openTab: "" }, (res) => {
      setActiveModel(res.activeModel as string);
      if (res._openTab) {
        setActiveTab(res._openTab as Tab);
        chrome.storage.local.remove("_openTab");
      }
    });
  }, []);

  const currentTab = TABS.find((t) => t.id === activeTab);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 font-sans text-zinc-100 antialiased">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
        {/* Logo */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            <img src={Logo} alt="Cortex Logo" className="h-8 w-8 rounded-sm" />
            <div>
              <p className="text-sm font-semibold tracking-tight text-zinc-100">
                Cortex
              </p>
              <p className="mt-0.5 text-[10px] leading-none text-zinc-500">
                Cognitive Accessibility
              </p>
            </div>
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "group flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-all duration-150",
                activeTab === tab.id
                  ? "bg-violet-500/15 font-medium text-violet-300"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
              )}
            >
              <span
                className={cn(
                  "transition-colors duration-150",
                  activeTab === tab.id
                    ? "text-violet-400"
                    : "text-zinc-500 group-hover:text-zinc-300",
                )}
              >
                {tab.icon}
              </span>
              {tab.label}
              {activeTab === tab.id && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400" />
              )}
            </button>
          ))}
        </nav>

        <Separator className="bg-zinc-800" />

        {/* Active model chip */}
        <div className="px-4 py-4">
          {activeModel ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[10px] font-medium tracking-wider text-emerald-400 uppercase">
                  Active
                </span>
              </div>
              <p className="text-[11px] leading-snug break-all text-zinc-300">
                {activeModel.replace(/-MLC$/, "")}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
              <span className="text-[10px] text-zinc-500">No model loaded</span>
            </div>
          )}
        </div>
      </aside>

      {/* ------------------------ Main ------------------------ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 border-b border-zinc-800 bg-zinc-900/60 px-8 py-5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-zinc-500">{currentTab?.icon}</span>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-zinc-100">
                {currentTab?.label}
              </h1>
              <p className="mt-0.5 text-xs text-zinc-500">
                {currentTab?.description}
              </p>
            </div>
            {activeModel && activeTab === "chat" && (
              <Badge
                variant="outline"
                className="ml-auto border-emerald-800 bg-emerald-950/50 text-[10px] text-emerald-400"
              >
                {activeModel.replace(/-MLC$/, "")}
              </Badge>
            )}
          </div>
        </header>

        {/* Tab content */}
        <main className="flex-1 overflow-y-auto p-8">
          {activeTab === "models" && (
            <ModelsTab
              activeModel={activeModel}
              onModelChange={setActiveModel}
            />
          )}
          {activeTab === "chat" && <ChatTab activeModel={activeModel} />}
          {activeTab === "colors" && <ColorsTab />}
          {activeTab === "settings" && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}
