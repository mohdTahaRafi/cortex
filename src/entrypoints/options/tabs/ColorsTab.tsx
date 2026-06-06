import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DEFAULT_COLOR_PROFILES,
  type ColorProfile,
} from "../../../utils/messages";
import { MessageFactory } from "@/utils/message-factory";

const PROFILE_PRESETS = [
  { id: "none", label: "Default", description: "No adjustments", emoji: "🔆" },
  {
    id: "soft",
    label: "Soft",
    description: "Reduces harsh brights",
    emoji: "☁️",
  },
  { id: "warm", label: "Warm", description: "Reduces blue light", emoji: "🌅" },
  { id: "cool", label: "Cool", description: "Soothing blue tint", emoji: "🌊" },
  {
    id: "mono",
    label: "Monochrome",
    description: "Remove color distractions",
    emoji: "⬜",
  },
  {
    id: "high-contrast",
    label: "High Contrast",
    description: "Enhanced visibility",
    emoji: "◼",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Your personalized settings",
    emoji: "🎨",
  },
];

const SWATCH_COLORS = [
  "#7c6af7",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#3b82f6",
  "#ec4899",
];

export default function ColorsTab() {
  const [active, setActive] = useState<string>("none");
  const [custom, setCustom] = useState(DEFAULT_COLOR_PROFILES.custom);

  useEffect(() => {
    chrome.storage.local.get(
      { colorProfile: DEFAULT_COLOR_PROFILES.none },
      (res) => {
        const profile = res.colorProfile as ColorProfile;
        setActive(profile.id);
        if (profile.id === "custom") setCustom(profile);
      },
    );
  }, []);

  const apply = (profileId: string, overrides?: Partial<ColorProfile>) => {
    const base =
      DEFAULT_COLOR_PROFILES[
        profileId as keyof typeof DEFAULT_COLOR_PROFILES
      ] ?? custom;
    const profile: ColorProfile = {
      ...base,
      ...overrides,
      id: profileId as ColorProfile["id"],
    };
    setActive(profileId);
    if (profileId === "custom") setCustom(profile);
    chrome.storage.local.set({ colorProfile: profile });
    chrome.runtime.sendMessage(MessageFactory.setColorProfile(profile));
  };

  return (
    <div className="max-w-2xl space-y-6 dark">
      {/* Preset Grid */}
      <div>
        <Label className="mb-3 block text-[10px] tracking-widest text-zinc-500 uppercase">
          Presets
        </Label>
        <div className="grid grid-cols-4 gap-2.5">
          {PROFILE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => apply(p.id)}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all duration-150",
                active === p.id
                  ? "border-violet-600/50 bg-violet-600/15 ring-1 ring-violet-600/30"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/60",
              )}
            >
              <span className="text-2xl">{p.emoji}</span>
              <span
                className={cn(
                  "text-xs leading-tight font-medium",
                  active === p.id ? "text-violet-300" : "text-zinc-200",
                )}
              >
                {p.label}
              </span>
              <span className="text-[10px] leading-tight text-zinc-500">
                {p.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Sliders */}
      <Card
        className={cn(
          "border-zinc-800 bg-zinc-900 transition-colors",
          active === "custom" && "border-violet-600/40",
        )}
      >
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <span>🎨</span>
            <span
              className={
                active === "custom" ? "text-violet-300" : "text-zinc-100"
              }
            >
              Custom Profile
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Saturation */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label className="text-zinc-300">Saturation</Label>
              <span className="font-semibold text-violet-400">
                {custom.saturation}%
              </span>
            </div>
            <Slider
              min={0}
              max={200}
              value={[custom.saturation]}
              onValueChange={([v]) => apply("custom", { saturation: v })}
              className="[&_.thumb]:bg-violet-500 [&_.track]:bg-violet-600"
            />
          </div>

          {/* Brightness */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label className="text-zinc-300">Brightness</Label>
              <span className="font-semibold text-violet-400">
                {custom.brightness}%
              </span>
            </div>
            <Slider
              min={50}
              max={150}
              value={[custom.brightness]}
              onValueChange={([v]) => apply("custom", { brightness: v })}
            />
          </div>

          {/* Contrast */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label className="text-zinc-300">Contrast</Label>
              <span className="font-semibold text-violet-400">
                {custom.contrast}%
              </span>
            </div>
            <Slider
              min={50}
              max={200}
              value={[custom.contrast]}
              onValueChange={([v]) => apply("custom", { contrast: v })}
            />
          </div>

          {/* Hue Rotate */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label className="text-zinc-300">Hue Rotate</Label>
              <span className="font-semibold text-violet-400">
                {custom.hueRotate}°
              </span>
            </div>
            <Slider
              min={0}
              max={360}
              value={[custom.hueRotate]}
              onValueChange={([v]) => apply("custom", { hueRotate: v })}
            />
          </div>

          <Button
            onClick={() => apply("custom", custom)}
            className="w-full bg-violet-600 text-white shadow-lg shadow-violet-900/20 hover:bg-violet-500"
          >
            Apply Custom Profile
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
