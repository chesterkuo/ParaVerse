const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

interface ExportButtonProps {
  simId: string;
}

export function ExportButton({ simId }: ExportButtonProps) {
  const handleExport = (format: "pdf" | "docx") => {
    const token = localStorage.getItem("access_token");
    const url = `${API_BASE}/simulations/${simId}/report/export?format=${format}&token=${encodeURIComponent(token ?? "")}`;
    window.open(url, "_blank");
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleExport("pdf")}
        className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
      >
        Export PDF
      </button>
      <button
        onClick={() => handleExport("docx")}
        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
      >
        Export DOCX
      </button>
    </div>
  );
}
