import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { searchApi, type SearchResult, type SearchOptions } from "../../api/search";

const MODES: { value: SearchOptions["mode"]; label: string }[] = [
  { value: "hybrid", label: "Hybrid" },
  { value: "semantic", label: "Semantic" },
  { value: "keyword", label: "Keyword" },
];

export function HybridSearch({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchOptions["mode"]>("hybrid");

  const { mutate, data, isPending, isSuccess } = useMutation({
    mutationFn: (params: { query: string; mode: SearchOptions["mode"] }) =>
      searchApi.search(projectId, params.query, { mode: params.mode }),
  });

  const results: SearchResult[] = data?.data?.data ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    mutate({ query: query.trim(), mode });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-3 border-b border-gray-200">
        <h3 className="font-semibold text-navy text-sm">Hybrid Search</h3>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents, events, agents..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-violet"
          />
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as SearchOptions["mode"])}
            className="px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:border-violet"
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!query.trim() || isPending}
            className="bg-navy text-white px-4 py-2 rounded text-sm hover:bg-navy/90 disabled:opacity-50"
          >
            {isPending ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {isSuccess && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">
              {results.length} result{results.length !== 1 ? "s" : ""} &middot;{" "}
              {MODES.find((m) => m.value === mode)?.label} mode
            </span>
          </div>

          {results.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <ul className="space-y-2">
              {results.map((result) => (
                <li
                  key={result.id}
                  className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {result.title && (
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {result.title}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">
                        {result.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium text-violet">
                        {Math.round(result.score * 100)}%
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                        {result.source}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
