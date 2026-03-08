export interface ChunkOptions {
  chunkSize: number;   // in words
  overlap: number;     // in words
}

export function chunkText(text: string, options: ChunkOptions = { chunkSize: 512, overlap: 50 }): string[] {
  if (!text.trim()) return [];
  const { chunkSize, overlap } = options;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    const paraWordCount = words.length;

    if (currentWordCount + paraWordCount <= chunkSize) {
      currentChunk.push(para);
      currentWordCount += paraWordCount;
    } else {
      if (currentChunk.length > 0) chunks.push(currentChunk.join("\n\n"));
      if (paraWordCount > chunkSize) {
        for (let i = 0; i < words.length; i += chunkSize - overlap) {
          const slice = words.slice(i, i + chunkSize);
          if (slice.length > 0) chunks.push(slice.join(" "));
        }
        currentChunk = [];
        currentWordCount = 0;
      } else {
        const prevText = currentChunk.join("\n\n");
        const prevWords = prevText.split(/\s+/);
        const overlapWords = prevWords.slice(-overlap);
        currentChunk = [overlapWords.join(" "), para];
        currentWordCount = overlap + paraWordCount;
      }
    }
  }
  if (currentChunk.length > 0) chunks.push(currentChunk.join("\n\n"));
  return chunks;
}
