/**
 * Philippine 5.0 grade scale: 1.0 (highest) to 5.0 (fail).
 * Converts percentage (0-100) to grade point.
 */
export function percentToGradePoint5(percent: number): number {
  if (percent >= 96) return 1.0;
  if (percent >= 94) return 1.25;
  if (percent >= 92) return 1.5;
  if (percent >= 89) return 1.75;
  if (percent >= 87) return 2.0;
  if (percent >= 84) return 2.25;
  if (percent >= 81) return 2.5;
  if (percent >= 78) return 2.75;
  if (percent >= 75) return 3.0;
  if (percent >= 72) return 3.25;
  if (percent >= 69) return 3.5;
  if (percent >= 66) return 3.75;
  if (percent >= 60) return 4.0;
  return 5.0; // 50-59 or below
}

/** Format as string (e.g. "1.25", "2.00", "5.0") for display. */
export function formatGradePoint5(percent: number): string {
  const gp = percentToGradePoint5(percent);
  return gp % 1 === 0 ? gp.toFixed(1) : gp.toFixed(2);
}
