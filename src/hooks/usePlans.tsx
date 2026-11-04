import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  SECTION_VISIBILITY_KEYS,
  createDefaultPlanPrefs,
} from '../constants/plans';
import {
  loadPlans,
  removePlanItem,
  savePlanPrefs,
  upsertPlanItem,
} from '../storage/planStorage';
import type {
  CategoryId,
  PlanItem,
  PlanPrefs,
  PlanSection,
} from '../types';
import {
  startOfMonth,
  startOfWeekMonday,
} from '../utils/dateRange';
import { createId } from '../utils/id';
import {
  movePlanSection,
  normalizePlanTitle,
} from '../utils/plans';
import { dayStart } from '../utils/time';

export interface NewPlanInput {
  section: PlanSection;
  title: string;
  category: CategoryId;
  periodStart?: number | null;
  dueAt?: number | null;
}

interface PlanUpdate {
  title?: string;
  category?: CategoryId;
  dueAt?: number;
}

interface PlanContextValue {
  hydrated: boolean;
  busy: boolean;
  items: PlanItem[];
  prefs: PlanPrefs;
  addPlan: (input: NewPlanInput) => Promise<boolean>;
  updatePlan: (id: string, patch: PlanUpdate) => Promise<boolean>;
  toggleComplete: (id: string) => Promise<boolean>;
  removePlan: (id: string) => Promise<boolean>;
  setSectionVisible: (
    section: PlanSection,
    visible: boolean,
  ) => Promise<boolean>;
  moveSectionTo: (
    section: PlanSection,
    targetIndex: number,
  ) => Promise<boolean>;
}

const PlanContext = createContext<PlanContextValue | null>(null);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [prefs, setPrefs] = useState<PlanPrefs>(createDefaultPlanPrefs);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const loaded = await loadPlans().catch((error: unknown) => {
        console.warn('[tally] plan load failed', error);
        return null;
      });

      if (cancelled) return;
      if (loaded) {
        setItems(loaded.items);
        setPrefs(loaded.prefs);
      }
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const addPlan = useCallback(
    async (input: NewPlanInput): Promise<boolean> => {
      if (!hydrated || busyRef.current) return false;

      const title = normalizePlanTitle(input.title);
      if (!title) return false;

      let periodStart: number | null = null;
      let dueAt: number | null = null;

      if (input.section === 'deadline') {
        if (!isFiniteNumber(input.dueAt)) return false;
        dueAt = dayStart(input.dueAt);
      } else {
        if (!isFiniteNumber(input.periodStart)) return false;
        periodStart =
          input.section === 'week'
            ? startOfWeekMonday(input.periodStart)
            : startOfMonth(input.periodStart);
      }

      busyRef.current = true;
      setBusy(true);

      const now = Date.now();
      const item: PlanItem = {
        id: createId(),
        section: input.section,
        title,
        category: input.category,
        periodStart,
        dueAt,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      try {
        const next = await upsertPlanItem(item);
        setItems(next);
        return true;
      } catch (error) {
        console.warn('[tally] add plan failed', error);
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [hydrated],
  );

  const updatePlan = useCallback(
    async (id: string, patch: PlanUpdate): Promise<boolean> => {
      if (!hydrated || busyRef.current) return false;

      const existing = items.find((item) => item.id === id);
      if (!existing) return false;

      let title = existing.title;
      if (patch.title !== undefined) {
        title = normalizePlanTitle(patch.title);
        if (!title) return false;
      }

      let dueAt = existing.dueAt;
      if (existing.section === 'deadline' && patch.dueAt !== undefined) {
        if (!isFiniteNumber(patch.dueAt)) return false;
        dueAt = dayStart(patch.dueAt);
      }

      busyRef.current = true;
      setBusy(true);

      const nextItem: PlanItem = {
        ...existing,
        title,
        category: patch.category ?? existing.category,
        dueAt,
        updatedAt: Date.now(),
      };

      try {
        const next = await upsertPlanItem(nextItem);
        setItems(next);
        return true;
      } catch (error) {
        console.warn('[tally] update plan failed', error);
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [hydrated, items],
  );

  const toggleComplete = useCallback(
    async (id: string): Promise<boolean> => {
      if (!hydrated || busyRef.current) return false;

      const existing = items.find((item) => item.id === id);
      if (!existing) return false;

      busyRef.current = true;
      setBusy(true);

      const nextItem: PlanItem = {
        ...existing,
        completedAt:
          existing.completedAt === null ? Date.now() : null,
        updatedAt: Date.now(),
      };

      try {
        const next = await upsertPlanItem(nextItem);
        setItems(next);
        return true;
      } catch (error) {
        console.warn('[tally] toggle plan failed', error);
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [hydrated, items],
  );

  const removePlan = useCallback(
    async (id: string): Promise<boolean> => {
      if (!hydrated || busyRef.current) return false;

      busyRef.current = true;
      setBusy(true);

      try {
        const next = await removePlanItem(id);
        setItems(next);
        return true;
      } catch (error) {
        console.warn('[tally] remove plan failed', error);
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [hydrated],
  );

  const setSectionVisible = useCallback(
    async (
      section: PlanSection,
      visible: boolean,
    ): Promise<boolean> => {
      if (!hydrated || busyRef.current) return false;

      const key = SECTION_VISIBILITY_KEYS[section];
      if (prefs[key] === visible) return true;

      const previous = prefs;
      const next = { ...prefs, [key]: visible };
      setPrefs(next);
      busyRef.current = true;
      setBusy(true);

      try {
        await savePlanPrefs(next);
        return true;
      } catch (error) {
        console.warn('[tally] plan prefs save failed', error);
        setPrefs(previous);
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [hydrated, prefs],
  );

  const moveSectionTo = useCallback(
    async (
      section: PlanSection,
      targetIndex: number,
    ): Promise<boolean> => {
      if (!hydrated || busyRef.current) return false;

      const nextOrder = movePlanSection(
        prefs.sectionOrder,
        section,
        targetIndex,
      );
      const unchanged = nextOrder.every(
        (value, index) => value === prefs.sectionOrder[index],
      );
      if (unchanged) return true;

      const previous = prefs;
      const next = { ...prefs, sectionOrder: nextOrder };
      setPrefs(next);
      busyRef.current = true;
      setBusy(true);

      try {
        await savePlanPrefs(next);
        return true;
      } catch (error) {
        console.warn('[tally] plan order save failed', error);
        setPrefs(previous);
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [hydrated, prefs],
  );

  const value = useMemo<PlanContextValue>(
    () => ({
      hydrated,
      busy,
      items,
      prefs,
      addPlan,
      updatePlan,
      toggleComplete,
      removePlan,
      setSectionVisible,
      moveSectionTo,
    }),
    [
      hydrated,
      busy,
      items,
      prefs,
      addPlan,
      updatePlan,
      toggleComplete,
      removePlan,
      setSectionVisible,
      moveSectionTo,
    ],
  );

  return (
    <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
  );
}

export function usePlans(): PlanContextValue {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error('usePlans must be used within PlanProvider');
  }
  return context;
}
