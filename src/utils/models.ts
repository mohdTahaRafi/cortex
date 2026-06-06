export interface ModelInfo {
  id: string;
  displayName: string;
  vramMB: number | null;
  familyTag: string;
}

function parseDisplayName(modelId: string): string {
  // Convert model IDs like "Llama-3.1-8B-Instruct-q4f32_1-MLC" to "Llama 3.1 8B Instruct (q4f32)"
  return modelId
    .replace(/-MLC$/, "")
    .replace(/-(\w+)$/, " ($1)")
    .replace(/-/g, " ");
}

function parseFamilyTag(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes("llama")) return "Llama";
  if (lower.includes("mistral") || lower.includes("mixtral")) return "Mistral";
  if (lower.includes("gemma")) return "Gemma";
  if (lower.includes("phi")) return "Phi";
  if (lower.includes("qwen")) return "Qwen";
  if (lower.includes("smollm")) return "SmolLM";
  if (lower.includes("deepseek")) return "DeepSeek";
  if (lower.includes("hermes")) return "Hermes";
  return "Other";
}

export async function getAllModels(): Promise<ModelInfo[]> {
  if (typeof window === "undefined") return []; // prevent build crash

  const { prebuiltAppConfig } = await import("@mlc-ai/web-llm");

  return prebuiltAppConfig.model_list.map((m) => ({
    id: m.model_id,
    displayName: parseDisplayName(m.model_id),
    vramMB: m.vram_required_MB ?? null,
    familyTag: parseFamilyTag(m.model_id),
  }));
}

export function formatSize(mb: number | null): string {
  if (mb === null) return "Unknown size";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}
