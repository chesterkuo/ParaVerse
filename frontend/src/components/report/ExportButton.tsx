import { FileDown } from "lucide-react";

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
        className="flex items-center gap-1.5 px-4 py-2 bg-navy text-white rounded hover:bg-navy/90 text-sm font-medium cursor-pointer"
      >
        <FileDown size={16} />
        Export PDF
      </button>
      <button
        onClick={() => handleExport("docx")}
        className="flex items-center gap-1.5 px-4 py-2 bg-violet text-white rounded hover:bg-violet/90 text-sm font-medium cursor-pointer"
      >
        <FileDown size={16} />
        Export DOCX
      </button>
    </div>
  );
}
