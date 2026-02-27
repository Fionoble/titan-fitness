/** crypto.randomUUID() requires a secure context (HTTPS). Fallback for HTTP/dev. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Normalize exercise name for fuzzy matching across AI-generated variations.
 *  "Dumbbell Bench Press", "DB Bench Press", "Flat Dumbbell Bench" → "dumbbell bench press" */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Expand common abbreviations
    .replace(/\bdb\b/g, 'dumbbell')
    .replace(/\bbb\b/g, 'barbell')
    .replace(/\bkb\b/g, 'kettlebell')
    .replace(/\boh\b/g, 'overhead')
    .replace(/\brdl\b/g, 'romanian deadlift')
    // Remove filler words
    .replace(/\b(flat|standard|basic|regular|classic|traditional|weighted|bodyweight)\b/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
