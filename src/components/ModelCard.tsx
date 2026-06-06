import { Download, Play, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FamilyBadge } from "../entrypoints/options/tabs/FamilyBadge";
import type { ModelInfo } from "../utils/models";
import { formatSize } from "../utils/models";

export interface ModelStatus {
  downloaded: boolean;
  downloading: boolean;
  progress: number;
  progressText: string;
  error: string;
  loaded: boolean;
}

interface ModelCardProps {
  model: ModelInfo;
  status: ModelStatus;
  onDownload: () => void;
  onDelete: () => void;
  onLoad: () => void;
}

export function ModelCard({
  model,
  status,
  onDownload,
  onDelete,
  onLoad,
}: ModelCardProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-900 transition-colors duration-150 hover:border-zinc-700">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Info */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="truncate text-sm font-medium text-zinc-100"
                title={model.id}
              >
                {model.displayName}
              </span>
              <FamilyBadge tag={model.familyTag} />
              {status.loaded && (
                <Badge
                  variant="outline"
                  className="h-4 border-emerald-800/50 bg-emerald-950/60 px-2 text-[10px] font-semibold text-emerald-400"
                >
                  Active
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-zinc-500">
              {formatSize(model.vramMB)} VRAM
            </p>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            {!status.downloaded && !status.downloading && (
              <Button
                size="sm"
                variant="default"
                className="h-7 bg-violet-600 px-3 text-xs text-white hover:bg-violet-500"
                onClick={onDownload}
              >
                <Download className="mr-1.5 h-3 w-3" />
                Download
              </Button>
            )}

            {status.downloaded && !status.loaded && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 bg-violet-600 px-3 text-xs text-white hover:bg-violet-500"
                  onClick={onLoad}
                >
                  <Play className="mr-1.5 h-3 w-3" />
                  Load
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-zinc-500 hover:bg-red-950/30 hover:text-red-400"
                  onClick={onDelete}
                  title="Delete model"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}

            {status.loaded && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-zinc-500 hover:bg-red-950/30 hover:text-red-400"
                onClick={onDelete}
                title="Delete model"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}

            {status.downloading && (
              <span className="text-xs text-zinc-500">Downloading…</span>
            )}
          </div>
        </div>

        {/* Progress */}
        {status.downloading && (
          <div className="mt-3 space-y-1.5">
            <Progress
              value={status.progress}
              className="h-1.5 bg-zinc-800 [&>div]:bg-violet-500"
            />
            <p className="text-[11px] text-zinc-500">
              {status.progress}% — {status.progressText}
            </p>
          </div>
        )}

        {/* Error */}
        {status.error && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-red-400">
            <span>⚠</span> {status.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
