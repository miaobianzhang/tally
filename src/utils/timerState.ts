import {
  isCategoryId,
  type TimerPrefill,
  type TimerState,
} from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTimerPrefill(value: unknown): value is TimerPrefill {
  return (
    isRecord(value) &&
    typeof value.planId === 'string' &&
    value.planId.length > 0 &&
    typeof value.activity === 'string' &&
    value.activity.trim().length > 0 &&
    isCategoryId(value.category)
  );
}

export function isTimerState(value: unknown): value is TimerState {
  if (!isRecord(value)) return false;
  if (value.status === 'idle') return true;
  if (value.status === 'running') {
    return typeof value.id === 'string' && isFiniteNumber(value.startedAt);
  }
  if (value.status === 'pending') {
    return (
      typeof value.id === 'string' &&
      isFiniteNumber(value.startedAt) &&
      isFiniteNumber(value.endedAt)
    );
  }
  return false;
}

/**
 * Only the timer's core fields decide whether it survives a reload. A damaged
 * optional prefill is stripped instead of discarding a running timer.
 */
export function sanitizeTimerState(value: unknown): TimerState {
  if (!isTimerState(value)) return { status: 'idle' };
  if (value.status === 'idle') return { status: 'idle' };

  const prefill = isTimerPrefill(value.prefill)
    ? value.prefill
    : null;

  if (value.status === 'running') {
    return prefill
      ? {
          status: 'running',
          id: value.id,
          startedAt: value.startedAt,
          prefill,
        }
      : {
          status: 'running',
          id: value.id,
          startedAt: value.startedAt,
        };
  }

  return prefill
    ? {
        status: 'pending',
        id: value.id,
        startedAt: value.startedAt,
        endedAt: value.endedAt,
        prefill,
      }
    : {
        status: 'pending',
        id: value.id,
        startedAt: value.startedAt,
        endedAt: value.endedAt,
      };
}
