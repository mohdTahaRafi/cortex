import { useEffect, useState, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Logo from "@/assets/icon.png";
import {
  BookA,
  BookOpenText,
  BotMessageSquare,
  Brain,
  Cog,
  Highlighter,
  Pencil,
  Type,
} from "lucide-react";
import { ColorProfile, DEFAULT_COLOR_PROFILES } from "@/utils/messages";
import type { AccessibilityScore } from "@/utils/messages";
import { AccessibilityScoreSection } from "./AccessibilityScore";
import { MessageFactory } from "@/utils/message-factory";

const PROFILES = [
  { id: "none", label: "Default", emoji: "🔆" },
  { id: "soft", label: "Soft", emoji: "☁️" },
  { id: "warm", label: "Warm", emoji: "🌅" },
  { id: "cool", label: "Cool", emoji: "🌊" },
  { id: "mono", label: "Mono", emoji: "⬜" },
  { id: "high-contrast", label: "Contrast", emoji: "⬛" },
] as const;

const FONTS = [
  { id: "default", label: "Default Font" },
  { id: "Lexend", label: "Lexend" },
  { id: "OpenDyslexic", label: "OpenDyslexic" },
  { id: "Comic Sans MS", label: "Comic Sans" },
];

/* ------------------------------------------------------ */
/*                  Cortex Popup App                       */
/* ------------------------------------------------------ */
export default function App() {
  const [rewriteEnabled, setRewriteEnabled] = useState(false);
  const [activeProfile, setActiveProfile] = useState<string>("none");
  const [activeModel, setActiveModel] = useState<string>("");
  const [activeFont, setActiveFont] = useState<string>("default");
  const [rulerEnabled, setRulerEnabled] = useState(false);
  const [readModeEnabled, setReadModeEnabled] = useState(false);
  const [dictEnabled, setDictEnabled] = useState(false);

  // load all settings from localStorage
  useEffect(() => {
    chrome.storage.local.get(
      {
        rewriteEnabled: false,
        dictEnabled: false,
        colorProfile: DEFAULT_COLOR_PROFILES.none,
        activeModel: "",
        activeFont: "default",
      },
      (res) => {
        setRewriteEnabled(res.rewriteEnabled as boolean);
        setDictEnabled(res.dictEnabled as boolean);
        setActiveProfile((res.colorProfile as ColorProfile).id);
        setActiveModel(res.activeModel as string);
        setActiveFont(res.activeFont as string);
        // rulerEnabled and readModeEnabled are tab-local, not restored from storage
      },
    );
  }, []);

  useEffect(() => {
    (async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) return;
      chrome.tabs
        .sendMessage(tab.id, { action: "GET_TAB_STATE" })
        .then((state) => {
          if (!state) return;
          setRulerEnabled(state.rulerEnabled ?? false);
          setReadModeEnabled(state.readModeEnabled ?? false);
        })
        .catch(() => {}); // tab may not have content script (e.g. chrome:// pages)
    })();
  }, []);

  const setFont = async (value: string) => {
    setActiveFont(value);
    await chrome.storage.local.set({ activeFont: value });
  };

  const toggleRewrite = async () => {
    const next = !rewriteEnabled;
    setRewriteEnabled(next);
    await chrome.storage.local.set({ rewriteEnabled: next });
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      chrome.tabs
        .sendMessage(tab.id, MessageFactory.toggleRewrite(next))
        .catch(() => {});
    }
  };

  const toggleDict = async () => {
    const next = !dictEnabled;
    setDictEnabled(next);
    await chrome.storage.local.set({ dictEnabled: next });
  };


  const setProfile = async (profileId: string) => {
    const profile =
      DEFAULT_COLOR_PROFILES[profileId as keyof typeof DEFAULT_COLOR_PROFILES];
    if (!profile) return;
    setActiveProfile(profileId);
    await chrome.storage.local.set({ colorProfile: profile });
    await chrome.runtime.sendMessage(MessageFactory.setColorProfile(profile));
  };

  const openOptions = async (tab?: string) => {
    if (tab) await chrome.storage.local.set({ _openTab: tab });
    chrome.tabs.create({ url: chrome.runtime.getURL("/options.html") });
  };

  const analyzeScore = useCallback(async (): Promise<AccessibilityScore> => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) throw new Error("No active tab found");

      const result = await chrome.tabs.sendMessage(tab.id, {
        action: "GET_ACCESSIBILITY_SCORE",
      });

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }
      if (!result) {
        throw new Error("Content script not found. Try refreshing the page.");
      }

      if (result.error) throw new Error(result.error);
      const accessibilityScore = result as AccessibilityScore;
      return accessibilityScore;
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : "Could not analyze this page";
      if (
        msg.includes("Receiving end does not exist") ||
        msg.includes("Content script not found")
      ) {
        msg = "Script not loaded. Please refresh this page.";
      } else if (msg.includes("Cannot access")) {
        msg = "Cannot analyze system pages or new tabs.";
      }
      throw e;
    } finally {
    }
  }, []);

  return (
    <div className="dark" style={{ width: 350, minHeight: 300 }}>
      <div className="bg-background text-foreground flex h-full w-full flex-col font-sans">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3">
            <img 
            src={Logo}
            alt="Cortex Logo" 
            className="h-7 w-7 rounded-sm"
            />
          <div>
            <p className="text-[13px] leading-none font-semibold">Cortex</p>
            <p className="text-muted-foreground mt-0.5 text-[10px]">
              Cognitive Accessibility
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground ml-auto h-auto px-2 py-1 text-xs"
            onClick={() => openOptions()}
          >
            Settings <Cog />
          </Button>
        </div>

        <Separator />

        {/* ------------ Cognitive Accessibility Score ----------- */}
        <AccessibilityScoreSection onAnalyze={analyzeScore} />

        {/* Model Status */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <p className="text-muted-foreground text-[11px]">Active Model</p>
          {activeModel ? (
            <Badge
              variant="secondary"
              className="max-w-40 truncate text-[11px] text-green-400"
            >
              {activeModel.replace(/-MLC$/, "")}
            </Badge>
          ) : (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-[11px]"
              onClick={() => openOptions("models")}
            >
              Download a model →
            </Button>
          )}
        </div>

        <Separator />

        {/* Simplify Text */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <Label className="text-[13px] font-medium">
              Simplify Text <Pencil size={12} />
            </Label>
            <p className="text-muted-foreground mt-0.5 text-[10px]">
              {rewriteEnabled
                ? "Showing buttons on paragraphs"
                : "Adds a button below each paragraph"}
            </p>
          </div>
          <Switch checked={rewriteEnabled} onCheckedChange={toggleRewrite} />
        </div>

        <Separator />

        {/* Dictionary Mode */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <Label className="text-[13px] font-medium">
              Dictionary Mode <BookA size={13} />
            </Label>
            <p className="text-muted-foreground mt-0.5 text-[10px]">
              {dictEnabled
                ? "Double-click a word for simple definitions"
                : "Popup definition on double-click"}
            </p>
          </div>
          <Switch checked={dictEnabled} onCheckedChange={toggleDict} />
        </div>

        <Separator />

        {/* Reading Ruler */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <Label className="text-[13px] font-medium">
              Reading Ruler <Highlighter size={13} />
            </Label>
            <p className="text-muted-foreground mt-0.5 text-[10px]">
              {rulerEnabled
                ? "Ruler active — Alt+R to toggle"
                : "Focus aid for reading"}
            </p>
          </div>
          <Switch
            checked={rulerEnabled}
            onCheckedChange={async (next) => {
              setRulerEnabled(next);
              const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
              });
              if (tab?.id) {
                chrome.tabs
                  .sendMessage(tab.id, {
                    action: "SET_RULER_ENABLED",
                    value: next,
                  })
                  .catch(() => {});
              }
            }}
          />
        </div>

        <Separator />

        {/* Read Mode */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <Label className="text-[13px] font-medium">
              Read Mode <BookOpenText size={13} />
            </Label>
            <p className="text-muted-foreground mt-0.5 text-[10px]">
              {readModeEnabled
                ? "Hiding clutter — Esc to exit"
                : "Show only article content"}
            </p>
          </div>
          <Switch
            checked={readModeEnabled}
            onCheckedChange={async (next) => {
              setReadModeEnabled(next);
              const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
              });
              if (tab?.id) {
                chrome.tabs
                  .sendMessage(tab.id, {
                    action: "SET_READ_MODE_ENABLED",
                    value: next,
                  })
                  .catch(() => {});
              }
            }}
          />
        </div>

        <Separator />

        {/* Dyslexia Fonts */}
        <div className="px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Label className="text-[13px] font-medium">Dyslexia Fonts</Label>
            <Type size={13} />
          </div>
          <p className="text-muted-foreground mb-2 text-[10px]">
            Override website fonts
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {FONTS.map((f) => (
              <Button
                key={f.id}
                variant={activeFont === f.id ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFont(f.id)}
                title={f.label}
                className="h-auto flex-col items-center gap-1 px-1 py-1.5"
              >
                <span
                  className="text-[11px] leading-none"
                  style={f.id !== "default" ? { fontFamily: f.id } : {}}
                >
                  Aa
                </span>
                <span className="text-muted-foreground text-[9px] leading-none">
                  {f.label}
                </span>
              </Button>
            ))}
          </div>
        </div>
        <Separator />

        {/* Color Profiles */}
        <div className="px-4 py-3">
          <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
            Color Profile
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {PROFILES.map((p) => (
              <Button
                key={p.id}
                variant={activeProfile === p.id ? "secondary" : "outline"}
                size="sm"
                onClick={() => setProfile(p.id)}
                title={p.label}
                className="flex h-auto flex-col items-center gap-1 px-1 py-1.5"
              >
                <span className="text-base">{p.emoji}</span>
                <span className="text-muted-foreground text-[9px] leading-none">
                  {p.label}
                </span>
              </Button>
            ))}
          </div>
          <Button
            variant="link"
            size="sm"
            className="text-muted-foreground mt-1 h-auto w-full py-1 text-[11px]"
            onClick={() => openOptions("colors")}
          >
            Customize profiles →
          </Button>
        </div>

        <Separator />

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-[11px]"
            onClick={() => openOptions("models")}
          >
            Models <Brain />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-[11px]"
            onClick={() => openOptions("chat")}
            disabled={!activeModel}
          >
            Chat <BotMessageSquare />
          </Button>
        </div>
        {!activeModel && (
          <p className="w-full text-center text-[10px] leading-relaxed text-orange-600 dark:text-orange-500">
            Please download a model to use chat.
          </p>
        )}
      </div>
    </div>
  );
}
