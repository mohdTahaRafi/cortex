import { Badge } from "@/components/ui/badge";

const FAMILY_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  Llama: {
    bg: "bg-violet-950/60",
    text: "text-violet-400",
    border: "border-violet-800/50",
  },
  Mistral: {
    bg: "bg-blue-950/60",
    text: "text-blue-400",
    border: "border-blue-800/50",
  },
  Gemma: {
    bg: "bg-emerald-950/60",
    text: "text-emerald-400",
    border: "border-emerald-800/50",
  },
  Phi: {
    bg: "bg-amber-950/60",
    text: "text-amber-400",
    border: "border-amber-800/50",
  },
  Qwen: {
    bg: "bg-pink-950/60",
    text: "text-pink-400",
    border: "border-pink-800/50",
  },
  SmolLM: {
    bg: "bg-indigo-950/60",
    text: "text-indigo-400",
    border: "border-indigo-800/50",
  },
  DeepSeek: {
    bg: "bg-cyan-950/60",
    text: "text-cyan-400",
    border: "border-cyan-800/50",
  },
  Hermes: {
    bg: "bg-purple-950/60",
    text: "text-purple-400",
    border: "border-purple-800/50",
  },
  Other: {
    bg: "bg-zinc-800/60",
    text: "text-zinc-400",
    border: "border-zinc-700/50",
  },
};

export function FamilyBadge({ tag }: { tag: string }) {
  const c = FAMILY_COLORS[tag] ?? FAMILY_COLORS.Other;
  return (
    <Badge
      variant="outline"
      className={`h-4 px-2 py-0 text-[10px] font-semibold ${c.bg} ${c.text} ${c.border}`}
    >
      {tag}
    </Badge>
  );
}
