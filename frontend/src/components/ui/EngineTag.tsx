import { ENGINE_COLORS, ENGINE_LABELS } from "@/utils/engineLabel";
import type { EngineType } from "@shared/types/project";

export function EngineTag({ type }: { type: EngineType }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-white"
      style={{ backgroundColor: ENGINE_COLORS[type] }}
    >
      {ENGINE_LABELS[type]}
    </span>
  );
}
