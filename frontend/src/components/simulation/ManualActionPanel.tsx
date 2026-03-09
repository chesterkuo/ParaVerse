import { useState } from "react";

export function ManualActionPanel({ onAction, onSave, onLoad, disabled }: {
  onAction: (text: string) => void;
  onSave: () => void;
  onLoad: () => void;
  disabled?: boolean;
}) {
  const [actionText, setActionText] = useState("");

  const handleSubmit = () => {
    if (!actionText.trim()) return;
    onAction(actionText);
    setActionText("");
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 border-t-4 border-t-concordia">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">Manual Action (TrainLab)</h3>
      <textarea rows={3} value={actionText} onChange={(e) => setActionText(e.target.value)}
        placeholder="Enter your decision as natural language..."
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-concordia resize-none" />
      <div className="mt-2 flex gap-2">
        <button onClick={handleSubmit} disabled={disabled || !actionText.trim()}
          className="bg-concordia text-white px-4 py-2 rounded text-sm font-medium hover:bg-concordia/90 disabled:opacity-50">
          Submit Action
        </button>
        <button onClick={onSave}
          className="border border-gray-300 px-3 py-2 rounded text-sm hover:bg-gray-50">
          Save Checkpoint
        </button>
        <button onClick={onLoad}
          className="border border-gray-300 px-3 py-2 rounded text-sm hover:bg-gray-50">
          Load Checkpoint
        </button>
      </div>
    </div>
  );
}
