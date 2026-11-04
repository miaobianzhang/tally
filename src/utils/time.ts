const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Live timer display: HH:MM:SS (hours may exceed 99). */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

/** Human duration for summaries: 45秒 / 23分 / 1小时23分. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}秒`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}分`;
  if (minutes === 0) return `${hours}小时`;
  return `${hours}小时${minutes}分`;
}

/** Clock label for start/end times, e.g. 14:32. */
export function formatClockTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Date header, e.g. 11月1日 周六. */
export function formatDateLabel(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
}

export function dayStart(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function nextDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}

/**
 * Largest-remainder allocation so the integer shares sum exactly to
 * `totalUnits`. Used both for top-level percentages (100) and for allocating
 * a category's percentage among its activities.
 */
export function allocateShares(
  values: number[],
  totalUnits: number,
): number[] {
  const target = Math.max(0, Math.floor(totalUnits));
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0 || target <= 0) return values.map(() => 0);

  const raw = values.map((value) => (Math.max(0, value) / total) * target);
  const floors = raw.map((value) => Math.floor(value));
  const remainder = target - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  const result = [...floors];
  for (let index = 0; index < remainder; index += 1) {
    result[order[index % order.length].index] += 1;
  }
  return result;
}

/** Largest-remainder rounding so displayed percentages sum to 100. */
export function computePercentages(values: number[]): number[] {
  return allocateShares(values, 100);
}

/** Keep tiny non-zero shares honest instead of displaying 0%. */
export function formatPercent(percentage: number, valueMs: number): string {
  if (valueMs > 0 && percentage === 0) return '<1%';
  return `${percentage}%`;
}
