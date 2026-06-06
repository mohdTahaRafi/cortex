import { useState, useEffect } from "react";
import { Search, CheckSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ModelCard, type ModelStatus } from "../../../components/ModelCard";
import { getAllModels, type ModelInfo } from "../../../utils/models";
import { MessageFactory } from "@/utils/message-factory";

interface ModelsTabProps {
  activeModel: string;
  onModelChange: (id: string) => void;
}

export default function ModelsTab({
  activeModel,
  onModelChange,
}: ModelsTabProps) {
  const [allModels, setAllModels] = useState<ModelInfo[]>([]);
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("All");
  const [showDownloadedOnly, setShowDownloadedOnly] = useState(false);
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ModelStatus>>({});

  useEffect(() => {
    getAllModels().then(setAllModels).catch(console.error);
  }, []);

  useEffect(() => {
    chrome.storage.local.get({ downloadedModels: [] }, (res) => {
      setDownloadedModels(res.downloadedModels as string[]);
    });
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
    ) => {
      if (changes.downloadedModels) {
        setDownloadedModels(changes.downloadedModels.newValue as string[]);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    const messageListener = (msg: {
      action: string;
      payload: {
        modelId: string;
        progress: number;
        text: string;
        error?: string;
      };
    }) => {
      if (msg.action === "PROGRESS_UPDATE") {
        const { modelId, progress, text } = msg.payload;
        setStatuses((prev) => ({
          ...prev,
          [modelId]: {
            ...prev[modelId],
            downloading: progress >= 0 && progress < 100,
            downloaded: progress === 100,
            progress: Math.max(0, progress),
            progressText: text,
            error: "",
          },
        }));
      }
      if (msg.action === "ENGINE_READY") {
        onModelChange(msg.payload.modelId);
        setStatuses((prev) => ({
          ...prev,
          [msg.payload.modelId]: {
            ...prev[msg.payload.modelId],
            downloading: false,
            downloaded: true,
            loaded: true,
            progress: 100,
          },
        }));
      }
      if (msg.action === "ENGINE_ERROR") {
        setStatuses((prev) => ({
          ...prev,
          [msg.payload.modelId ?? ""]: {
            ...prev[msg.payload.modelId ?? ""],
            downloading: false,
            error: msg.payload.text ?? msg.payload.error ?? "Unknown error",
          },
        }));
      }
    };
    chrome.runtime.onMessage.addListener(
      messageListener as Parameters<
        typeof chrome.runtime.onMessage.addListener
      >[0],
    );
    return () =>
      chrome.runtime.onMessage.removeListener(
        messageListener as Parameters<
          typeof chrome.runtime.onMessage.addListener
        >[0],
      );
  }, [onModelChange]);

  const families = [
    "All",
    ...Array.from(new Set(allModels.map((m) => m.familyTag))).sort(),
  ];

  const filtered = allModels.filter((m) => {
    const matchSearch =
      m.displayName.toLowerCase().includes(search.toLowerCase()) ||
      m.id.toLowerCase().includes(search.toLowerCase());
    const matchFamily = familyFilter === "All" || m.familyTag === familyFilter;
    const matchDownloaded =
      !showDownloadedOnly || downloadedModels.includes(m.id);
    return matchSearch && matchFamily && matchDownloaded;
  });

  const getStatus = (modelId: string): ModelStatus => {
    const base = statuses[modelId];
    return {
      downloaded: base?.downloaded ?? downloadedModels.includes(modelId),
      downloading: base?.downloading ?? false,
      progress: base?.progress ?? 0,
      progressText: base?.progressText ?? "",
      error: base?.error ?? "",
      loaded: base?.loaded ?? modelId === activeModel,
    };
  };

  const download = (modelId: string) => {
    setStatuses((prev) => ({
      ...prev,
      [modelId]: {
        ...getStatus(modelId),
        downloading: true,
        progress: 0,
        error: "",
      },
    }));
    chrome.runtime.sendMessage(MessageFactory.downloadModel(modelId));
  };

  const del = (modelId: string) => {
    chrome.runtime.sendMessage(
      MessageFactory.deleteModel(modelId),
      () => {
        setStatuses((prev) => ({
          ...prev,
          [modelId]: {
            ...getStatus(modelId),
            downloaded: false,
            loaded: false,
          },
        }));
        if (modelId === activeModel) onModelChange("");
      },
    );
  };

  const load = (modelId: string) => {
    setStatuses((prev) => ({
      ...prev,
      [modelId]: {
        ...getStatus(modelId),
        downloading: true,
        progress: 0,
        progressText: "Loading…",
      },
    }));
    chrome.runtime.sendMessage(MessageFactory.loadModel(modelId));
  };

  const stats = [
    { label: "Available", value: filtered.length, color: "text-violet-400" },
    {
      label: "Downloaded",
      value: downloadedModels.length,
      color: "text-emerald-400",
    },
    { label: "Active", value: activeModel ? 1 : 0, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-5 dark">
      {/* Search + Filter */}
      <div className="flex gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search models…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-zinc-800 bg-zinc-900 pl-9 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-violet-600 focus-visible:ring-violet-500/40"
          />
        </div>

        <Select value={familyFilter} onValueChange={setFamilyFilter}>
          <SelectTrigger className="w-36 border-zinc-800 bg-zinc-900 text-zinc-300 focus:ring-violet-500/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-200">
            {families.map((f) => (
              <SelectItem
                key={f}
                value={f}
                className="focus:bg-zinc-800 focus:text-zinc-100"
              >
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDownloadedOnly((v) => !v)}
          className={cn(
            "h-10 gap-1.5 border-zinc-800 text-xs transition-colors",
            showDownloadedOnly
              ? "border-violet-600/50 bg-violet-600/20 text-violet-300 hover:bg-violet-600/30"
              : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
          )}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          Downloaded
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="border-zinc-800 bg-zinc-900">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="mt-1 text-[10px] tracking-wider text-zinc-500 uppercase">
                {s.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Model list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-zinc-500">
            No models match your search
          </div>
        )}
        {filtered.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            status={getStatus(model.id)}
            onDownload={() => download(model.id)}
            onDelete={() => del(model.id)}
            onLoad={() => load(model.id)}
          />
        ))}
      </div>
    </div>
  );
}
