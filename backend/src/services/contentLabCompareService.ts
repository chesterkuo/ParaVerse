export interface SentimentComparison {
  divergenceScore: number;
  winnerIndex: number;
  trajectoryA: number[];
  trajectoryB: number[];
}

export function compareSentimentCurves(
  curveA: number[],
  curveB: number[]
): SentimentComparison {
  const len = Math.min(curveA.length, curveB.length);
  let sumDiff = 0;
  for (let i = 0; i < len; i++) {
    sumDiff += curveB[i] - curveA[i];
  }
  const avgDiff = len > 0 ? sumDiff / len : 0;
  return {
    divergenceScore: Math.abs(avgDiff),
    winnerIndex: avgDiff >= 0 ? 1 : 0,
    trajectoryA: curveA,
    trajectoryB: curveB,
  };
}

export interface KeywordOverlap {
  shared: string[];
  uniqueA: string[];
  uniqueB: string[];
}

export function computeKeywordOverlap(
  kwA: string[],
  kwB: string[]
): KeywordOverlap {
  const setB = new Set(kwB);
  const setA = new Set(kwA);
  return {
    shared: kwA.filter((k) => setB.has(k)),
    uniqueA: kwA.filter((k) => !setB.has(k)),
    uniqueB: kwB.filter((k) => !setA.has(k)),
  };
}
