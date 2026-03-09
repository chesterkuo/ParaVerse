interface ReportSection {
  title: string;
  content: string;
}

export function ReportViewer({ sections }: { sections: ReportSection[] }) {
  if (sections.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400 text-sm">
        No report sections available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section, idx) => (
        <div key={idx} className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-base font-semibold text-navy mb-3">{section.title}</h3>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {section.content}
          </div>
        </div>
      ))}
    </div>
  );
}
