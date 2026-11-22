import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  DEFAULT_PROFILE,
  loadProfile,
  saveProfile,
} from '../storage/profileStorage';
import type { Profile } from '../types';

interface ProfileContextValue {
  hydrated: boolean;
  profile: Profile;
  updateProfile: (
    patch: Partial<Pick<Profile, 'displayName' | 'avatarUri'>>,
  ) => Promise<boolean>;
  reloadProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>({ ...DEFAULT_PROFILE });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadProfile().catch(() => null);
      if (cancelled) return;
      if (loaded) setProfile(loaded);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<Profile, 'displayName' | 'avatarUri'>>) => {
      const next = {
        ...profile,
        ...patch,
        updatedAt: Date.now(),
      };
      setProfile(next);
      try {
        const saved = await saveProfile(next);
        setProfile(saved);
        return true;
      } catch (error) {
        console.warn('[tally] failed to save profile', error);
        return false;
      }
    },
    [profile],
  );

  const reloadProfile = useCallback(async () => {
    const loaded = await loadProfile().catch(() => null);
    if (loaded) setProfile(loaded);
  }, []);

  const value = useMemo(
    () => ({ hydrated, profile, updateProfile, reloadProfile }),
    [hydrated, profile, updateProfile, reloadProfile],
  );

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('useProfile must be used inside ProfileProvider');
  return value;
}
