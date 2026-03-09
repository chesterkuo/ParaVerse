import { useState } from "react";

export function ManualActionPanel({ onAction, disabled }: {
  onAction: (text: string) => void;
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
      <h3 className="text-sm font-semibold text-gray-600 mb-3">Manual Action</h3>
      <textarea rows={3} value={actionText} onChange={(e) => setActionText(e.target.value)}
        placeholder="Describe the action to inject..."
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-concordia resize-none" />
      <button onClick={handleSubmit} disabled={disabled || !actionText.trim()}
        className="mt-2 w-full bg-concordia text-white py-2 rounded text-sm font-medium hover:bg-concordia/90 disabled:opacity-50">
        Inject Action
      </button>
    </div>
  );
}
