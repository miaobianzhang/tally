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
  FALLBACK_CATEGORY,
  createCategoryLookup,
  resolveCategory as resolveFromList,
} from '../constants/categories';
import {
  loadCategories,
  replaceCategories,
} from '../storage/categoryStorage';
import type {
  CategoryDefinition,
  CategoryId,
  CategoryLookup,
} from '../types';
import {
  createCustomCategoryId,
  isHexColor,
  normalizeCategoryLabel,
  normalizeColor,
} from '../utils/categoryValidation';

interface AddCategoryInput {
  label: string;
  color: string;
  countsAsFocus: boolean;
}

interface CategoryContextValue {
  hydrated: boolean;
  busy: boolean;
  categories: CategoryDefinition[];
  activeCategories: CategoryDefinition[];
  lookup: CategoryLookup;
  addCategory: (input: AddCategoryInput) => Promise<boolean>;
  updateCategory: (
    id: CategoryId,
    patch: Partial<
      Pick<CategoryDefinition, 'label' | 'color' | 'countsAsFocus'>
    >,
  ) => Promise<boolean>;
  archiveCategory: (id: CategoryId) => Promise<boolean>;
  restoreCategory: (id: CategoryId) => Promise<boolean>;
  deleteCategory: (id: CategoryId) => Promise<boolean>;
  moveCategory: (
    id: CategoryId,
    direction: -1 | 1,
  ) => Promise<boolean>;
  ensureReferencedCategories: (ids: readonly CategoryId[]) => Promise<void>;
  resolveCategory: (id: CategoryId) => CategoryDefinition;
  reloadCategories: () => Promise<void>;
}

const CategoryContext = createContext<CategoryContextValue | null>(null);

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const categoriesRef = useRef<CategoryDefinition[]>([]);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadCategories().catch(() => null);
      if (cancelled) return;
      if (loaded) {
        categoriesRef.current = loaded;
        setCategories(loaded);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = useCallback(async (next: CategoryDefinition[]) => {
    const previous = categoriesRef.current;
    categoriesRef.current = next;
    setCategories(next);
    try {
      const saved = await replaceCategories(next);
      categoriesRef.current = saved;
      setCategories(saved);
      return true;
    } catch (error) {
      console.warn('[tally] failed to save categories', error);
      categoriesRef.current = previous;
      setCategories(previous);
      return false;
    }
  }, []);

  const lookup = useMemo(() => createCategoryLookup(categories), [categories]);
  const activeCategories = useMemo(
    () => lookup.active as CategoryDefinition[],
    [lookup],
  );

  const addCategory = useCallback(
    async (input: AddCategoryInput) => {
      if (busyRef.current) return false;
      const label = normalizeCategoryLabel(input.label);
      if (!label) return false;
      const current = categoriesRef.current;
      const duplicate = current.some(
        (category) =>
          !category.archived &&
          category.label.toLowerCase() === label.toLowerCase(),
      );
      if (duplicate) return false;

      busyRef.current = true;
      setBusy(true);
      try {
        const now = Date.now();
        const order = current.reduce(
          (max, category) => Math.max(max, category.order),
          -1,
        );
        const next: CategoryDefinition[] = [
          ...current,
          {
            id: createCustomCategoryId(),
            label,
            color: normalizeColor(input.color, FALLBACK_CATEGORY.color),
            archived: false,
            countsAsFocus: input.countsAsFocus,
            order: order + 1,
            createdAt: now,
            updatedAt: now,
          },
        ];
        return await commit(next);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [commit],
  );

  const updateCategory = useCallback(
    async (
      id: CategoryId,
      patch: Partial<
        Pick<CategoryDefinition, 'label' | 'color' | 'countsAsFocus'>
      >,
    ) => {
      if (busyRef.current) return false;
      const current = categoriesRef.current;
      const existing = current.find((category) => category.id === id);
      if (!existing) return false;

      const nextLabel =
        patch.label === undefined
          ? existing.label
          : normalizeCategoryLabel(patch.label);
      if (!nextLabel) return false;
      const duplicate = current.some(
        (category) =>
          category.id !== id &&
          !category.archived &&
          category.label.toLowerCase() === nextLabel.toLowerCase(),
      );
      if (duplicate) return false;

      busyRef.current = true;
      setBusy(true);
      try {
        const next = current.map((category) =>
          category.id === id
            ? {
                ...category,
                label: nextLabel,
                color:
                  patch.color === undefined
                    ? category.color
                    : isHexColor(patch.color)
                      ? patch.color.toUpperCase()
                      : category.color,
                countsAsFocus:
                  patch.countsAsFocus ?? category.countsAsFocus,
                updatedAt: Date.now(),
              }
            : category,
        );
        return await commit(next);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [commit],
  );

  const setArchived = useCallback(
    async (id: CategoryId, archived: boolean) => {
      if (busyRef.current) return false;
      const current = categoriesRef.current;
      const existing = current.find((category) => category.id === id);
      if (!existing || existing.archived === archived) return false;
      if (archived) {
        const activeCount = current.filter(
          (category) => !category.archived,
        ).length;
        if (activeCount <= 1) return false;
      }

      busyRef.current = true;
      setBusy(true);
      try {
        const next = current.map((category) =>
          category.id === id
            ? { ...category, archived, updatedAt: Date.now() }
            : category,
        );
        return await commit(next);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [commit],
  );

  const archiveCategory = useCallback(
    (id: CategoryId) => setArchived(id, true),
    [setArchived],
  );
  const restoreCategory = useCallback(
    (id: CategoryId) => setArchived(id, false),
    [setArchived],
  );

  const deleteCategory = useCallback(
    async (id: CategoryId) => {
      if (busyRef.current) return false;
      const current = categoriesRef.current;
      const existing = current.find(
        (category) => category.id === id && !category.deleted,
      );
      if (!existing) return false;
      if (
        !existing.archived &&
        current.filter(
          (category) => !category.archived && !category.deleted,
        ).length <= 1
      ) {
        return false;
      }

      busyRef.current = true;
      setBusy(true);
      try {
        const now = Date.now();
        const next = current.map((category) =>
          category.id === id
            ? {
                ...category,
                archived: true,
                deleted: true,
                updatedAt: now,
              }
            : category,
        );
        return await commit(next);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [commit],
  );

  const moveCategory = useCallback(
    async (id: CategoryId, direction: -1 | 1) => {
      if (busyRef.current) return false;
      const current = categoriesRef.current;
      const active = current
        .filter(
          (category) => !category.archived && !category.deleted,
        )
        .sort(
          (a, b) =>
            a.order - b.order || a.createdAt - b.createdAt,
        );
      const index = active.findIndex((category) => category.id === id);
      if (index < 0) return false;
      const target = index + direction;
      if (target < 0 || target >= active.length) return false;

      const reordered = [...active];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(target, 0, moved);
      const archived = current
        .filter((category) => category.archived && !category.deleted)
        .sort(
          (a, b) =>
            a.order - b.order || a.createdAt - b.createdAt,
        );
      const deleted = current
        .filter((category) => category.deleted)
        .sort(
          (a, b) =>
            a.order - b.order || a.createdAt - b.createdAt,
        );
      const now = Date.now();
      const next = [...reordered, ...archived, ...deleted].map(
        (category, order) => ({
          ...category,
          order,
          updatedAt:
            category.order === order ? category.updatedAt : now,
        }),
      );

      busyRef.current = true;
      setBusy(true);
      try {
        return await commit(next);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [commit],
  );

  const ensureReferencedCategories = useCallback(
    async (ids: readonly CategoryId[]) => {
      const current = categoriesRef.current;
      const known = new Set(current.map((category) => category.id));
      const missing = [...new Set(ids)].filter((id) => !known.has(id));
      if (missing.length === 0) return;

      const placeholders: CategoryDefinition[] = missing.map(
        (id, index) => ({
          id,
          label: FALLBACK_CATEGORY.label,
          color: FALLBACK_CATEGORY.color,
          archived: true,
          countsAsFocus: false,
          order: current.length + index,
          createdAt: 0,
          updatedAt: 0,
        }),
      );
      await commit([...current, ...placeholders]);
    },
    [commit],
  );

  const reloadCategories = useCallback(async () => {
    const loaded = await loadCategories().catch(() => null);
    if (!loaded) return;
    categoriesRef.current = loaded;
    setCategories(loaded);
  }, []);

  const resolveCategory = useCallback(
    (id: CategoryId) => resolveFromList(categoriesRef.current, id),
    [],
  );

  const value = useMemo<CategoryContextValue>(
    () => ({
      hydrated,
      busy,
      categories,
      activeCategories,
      lookup,
      addCategory,
      updateCategory,
      archiveCategory,
      restoreCategory,
      deleteCategory,
      moveCategory,
      ensureReferencedCategories,
      resolveCategory,
      reloadCategories,
    }),
    [
      hydrated,
      busy,
      categories,
      activeCategories,
      lookup,
      addCategory,
      updateCategory,
      archiveCategory,
      restoreCategory,
      deleteCategory,
      moveCategory,
      ensureReferencedCategories,
      resolveCategory,
      reloadCategories,
    ],
  );

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories(): CategoryContextValue {
  const value = useContext(CategoryContext);
  if (!value) {
    throw new Error('useCategories must be used inside CategoryProvider');
  }
  return value;
}
