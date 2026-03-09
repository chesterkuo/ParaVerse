import { useState, useRef, useCallback } from "react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  disabled?: boolean;
}

const DEFAULT_ACCEPT = ".pdf,.txt,.md";

export function FileUpload({ onFileSelect, accept = DEFAULT_ACCEPT, disabled = false }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file || disabled) return;
      onFileSelect(file);
    },
    [onFileSelect, disabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFile(e.target.files?.[0]);
      // Reset so the same file can be selected again
      e.target.value = "";
    },
    [handleFile],
  );

  return (
    <div
      className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer
        ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-200" : ""}
        ${isDragging ? "border-violet bg-violet/5" : "border-gray-300 hover:border-violet/50 bg-white"}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />
      <div className="space-y-2">
        <div className="text-3xl text-gray-300">
          {isDragging ? "\u2B07" : "\u{1F4C4}"}
        </div>
        <p className="text-sm font-medium text-gray-600">
          {isDragging ? "Drop file here" : "Drag & drop a file or click to browse"}
        </p>
        <p className="text-xs text-gray-400">Supports {accept}</p>
      </div>
    </div>
  );
}
