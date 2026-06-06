import { useState, useEffect } from "react";
import { CheckCircle2, RotateCcw, Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DEFAULT_REWRITE_PROMPT } from "../../../utils/storage";

const KBD = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex items-center rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] leading-none text-zinc-400">
    {children}
  </kbd>
);

const PROMPT_TIPS = [
  "Keep sentences short (max 15 words)",
  "Avoid jargon and complex vocabulary",
  "One idea per sentence",
  "Add bullet points for lists",
];

export default function SettingsTab() {
  const [prompt, setPrompt] = useState("");
  const [rewriteEnabled, setRewriteEnabled] = useState(false);
  const [rulerEnabled, setRulerEnabled] = useState(false);
  const [rulerAutoSnap, setRulerAutoSnap] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(
      {
        rewritePrompt: DEFAULT_REWRITE_PROMPT,
        rewriteEnabled: false,
        rulerEnabled: false,
        rulerAutoSnap: false,
      },
      (res) => {
        setPrompt(res.rewritePrompt as string);
        setRewriteEnabled(res.rewriteEnabled as boolean);
        setRulerEnabled(res.rulerEnabled as boolean);
        setRulerAutoSnap(res.rulerAutoSnap as boolean);
      },
    );
  }, []);

  const save = async () => {
    await chrome.storage.local.set({
      rewritePrompt: prompt,
      rewriteEnabled,
      rulerEnabled,
      rulerAutoSnap,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggle = async (key: string, val: boolean) => {
    await chrome.storage.local.set({ [key]: val });
  };

  return (
    <div className="max-w-2xl space-y-4 dark">
      {/* Simplify Text */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-100">
                ✦ Simplify Text Globally
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Show "Simplify" buttons under paragraphs on all websites
              </p>
            </div>
            <Switch
              checked={rewriteEnabled}
              onCheckedChange={async (val) => {
                setRewriteEnabled(val);
                await toggle("rewriteEnabled", val);
              }}
              className="data-[state=checked]:bg-violet-600"
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto-Snap Ruler */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-100">
                🎯 Auto-Snap Ruler
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Automatically frame clicked elements without holding{" "}
                <KBD>Ctrl</KBD>
              </p>
            </div>
            <Switch
              checked={rulerAutoSnap}
              onCheckedChange={async (val) => {
                setRulerAutoSnap(val);
                await toggle("rulerAutoSnap", val);
              }}
              className="data-[state=checked]:bg-violet-600"
            />
          </div>
        </CardContent>
      </Card>

      {/* Reading Ruler */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="mb-2 text-sm font-medium text-zinc-100">
                📏 Reading Ruler
              </p>
              <div className="space-y-1 text-[11px] leading-relaxed text-zinc-500">
                {[
                  [["Shift", "R"], "toggle visibility"],
                  [["Click"], "snap ruler to cursor"],
                  [["Ctrl", "Click"], "perfectly frame HTML element"],
                  [["Esc"], "exit snapped mode"],
                  [["↑", "↓"], "move position"],
                  [["Ctrl", "↑", "↓"], "fine adjustment"],
                  [["←", "→"], "adjust height"],
                ].map(([keys, desc], i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex gap-0.5">
                      {(keys as string[]).map((k) => (
                        <KBD key={k}>{k}</KBD>
                      ))}
                    </span>
                    <span>{desc as string}</span>
                  </div>
                ))}
              </div>
            </div>
            <Switch
              checked={rulerEnabled}
              onCheckedChange={async (val) => {
                setRulerEnabled(val);
                await toggle("rulerEnabled", val);
              }}
              className="shrink-0 data-[state=checked]:bg-violet-600"
            />
          </div>
        </CardContent>
      </Card>

      {/* Prompt Editor */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-100">
                System Prompt
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs text-zinc-500">
                Instructions sent to the AI when simplifying text
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPrompt(DEFAULT_REWRITE_PROMPT)}
              className="h-7 gap-1.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={10}
            placeholder="Enter your system prompt…"
            className="resize-y border-zinc-700 bg-zinc-950 font-mono text-xs leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus-visible:border-violet-600 focus-visible:ring-violet-500/40"
          />
          <p className="text-[10px] text-zinc-600">
            Use clear instructions to guide how the AI simplifies text for
            neurodivergent readers.
          </p>
        </CardContent>
      </Card>

      {/* Prompt Tips */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="p-5">
          <p className="mb-3 text-xs font-semibold text-violet-400">
            ✦ Prompt Tips
          </p>
          <ul className="space-y-2">
            {PROMPT_TIPS.map((tip, i) => (
              <li key={i} className="flex gap-2 text-xs text-zinc-400">
                <span className="shrink-0 text-violet-500">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Save */}
      <Button
        onClick={save}
        className="w-full gap-2 bg-violet-600 text-white shadow-lg shadow-violet-900/20 hover:bg-violet-500"
      >
        {saved ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Saved!
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Save Settings
          </>
        )}
      </Button>
    </div>
  );
}
