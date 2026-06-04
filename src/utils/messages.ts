export type { AccessibilityScore, AccessibilityScoreDetails } from "./cognitiveScore";

export type MessageAction =
  | "DOWNLOAD_MODEL"
  | "DELETE_MODEL"
  | "LOAD_MODEL"
  | "PROGRESS_UPDATE"
  | "CHAT_SEND"
  | "CHAT_CHUNK"
  | "REWRITE_TEXT"
  | "REWRITE_CHUNK"
  | "SET_COLOR_PROFILE"
  | "GET_STATE"
  | "ENGINE_READY"
  | "ENGINE_ERROR"
  | "GET_ACCESSIBILITY_SCORE"
  | "DEFINE_WORD"
  | "DEFINE_CHUNK";

export interface Message {
  action: MessageAction;
  payload?: unknown;
}

export interface DownloadModelMessage extends Message {
  action: "DOWNLOAD_MODEL";
  payload: { modelId: string };
}

export interface DeleteModelMessage extends Message {
  action: "DELETE_MODEL";
  payload: { modelId: string };
}

export interface LoadModelMessage extends Message {
  action: "LOAD_MODEL";
  payload: { modelId: string };
}

export interface ProgressUpdateMessage extends Message {
  action: "PROGRESS_UPDATE";
  payload: { modelId: string; progress: number; text: string };
}

export interface ChatSendMessage extends Message {
  action: "CHAT_SEND";
  payload: {
    messages: Array<{ role: string; content: string }>;
    modelId?: string;
  };
}

export interface ChatChunkMessage extends Message {
  action: "CHAT_CHUNK";
  payload: { chunk: string; done: boolean; requestId: string };
}

export interface RewriteTextMessage extends Message {
  action: "REWRITE_TEXT";
  payload: { text: string; prompt: string; requestId: string };
}

export interface RewriteChunkMessage extends Message {
  action: "REWRITE_CHUNK";
  payload: { chunk: string; done: boolean; requestId: string };
}

export interface DefineWordMessage extends Message {
  action: "DEFINE_WORD";
  payload: { word: string; requestId: string };
}

export interface DefineChunkMessage extends Message {
  action: "DEFINE_CHUNK";
  payload: { chunk: string; done: boolean; requestId: string };
}

export interface SetColorProfileMessage extends Message {
  action: "SET_COLOR_PROFILE";
  payload: ColorProfile;
}

export interface EngineReadyMessage extends Message {
  action: "ENGINE_READY";
  payload: { modelId: string };
}

export interface EngineErrorMessage extends Message {
  action: "ENGINE_ERROR";
  payload: { error: string; modelId?: string };
}

export interface ColorProfile {
  id: "none" | "warm" | "cool" | "mono" | "high-contrast" | "custom" | "soft";
  saturation: number; // 0–200 (100 = normal)
  brightness: number; // 50–150 (100 = normal)
  contrast: number; // 50–200 (100 = normal)
  hueRotate: number; // 0–360
}

export const DEFAULT_COLOR_PROFILES: Record<string, ColorProfile> = {
  none: {
    id: "none",
    saturation: 100,
    brightness: 100,
    contrast: 100,
    hueRotate: 0,
  },
  warm: {
    id: "warm",
    saturation: 80,
    brightness: 90,
    contrast: 92,
    hueRotate: 15,
  },
  cool: {
    id: "cool",
    saturation: 80,
    brightness: 92,
    contrast: 92,
    hueRotate: 190,
  },
  mono: {
    id: "mono",
    saturation: 0,
    brightness: 95,
    contrast: 90,
    hueRotate: 0,
  },
  "high-contrast": {
    id: "high-contrast",
    saturation: 110,
    brightness: 105,
    contrast: 130,
    hueRotate: 0,
  },
  soft: {
    id: "soft",
    saturation: 50,
    brightness: 85,
    contrast: 85,
    hueRotate: 0,
  },
  custom: {
    id: "custom",
    saturation: 80,
    brightness: 100,
    contrast: 100,
    hueRotate: 0,
  },
};
