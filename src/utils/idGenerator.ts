import { StickyNote, Trade } from '../types';

/**
 * Normalizes a trade ID prefix (e.g. 'ELEC-' -> 'ELEC', 'conc' -> 'CONC').
 */
export function normalizePrefix(rawPrefix: string): string {
  const cleaned = (rawPrefix || 'ACT').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned || 'ACT';
}

/**
 * Generates the next unique Activity ID for a trade, spaced by 10 (e.g. ELEC-010, ELEC-020).
 * If existing activities have IDs matching the prefix, it finds the maximum number and adds 10.
 * Otherwise it starts at 010.
 */
export function generateNextTaskId(
  trade: Trade | undefined,
  existingTasks: StickyNote[],
  step: number = 10
): string {
  const prefix = normalizePrefix(trade?.idPrefix || trade?.code || 'ACT');
  const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');

  let maxNum = 0;
  for (const t of existingTasks) {
    const match = t.id.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum === 0 ? step : Math.ceil((maxNum + 1) / step) * step;
  const formattedNum = String(nextNum).padStart(3, '0');
  const candidateId = `${prefix}-${formattedNum}`;

  // Ensure candidate ID is completely unique
  if (!existingTasks.some((t) => t.id === candidateId)) {
    return candidateId;
  }

  // Fallback increment if collision
  let counter = nextNum + step;
  while (existingTasks.some((t) => t.id === `${prefix}-${String(counter).padStart(3, '0')}`)) {
    counter += step;
  }
  return `${prefix}-${String(counter).padStart(3, '0')}`;
}
