// Phase 6.5: Mode management context
// Manages app mode (user vs demo) and user data detection
// Phase 6.9: Adds meaningful user data detection for Entry screen

import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadProfilesStateIfPresent } from '../persistence/profileStorage';
import { hasMeaningfulUserData } from '../entryHelpers';

export type AppMode = 'user' | 'demo';

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  hasUserData: boolean; // Storage key existence (preserved for backward compatibility)
  hasMeaningfulUserData: boolean; // Phase 6.9: Actual data content check
  modeInitialized: boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AppMode>('demo'); // Start with demo, will update after check
  const [hasUserData, setHasUserData] = useState<boolean>(false);
  const [hasMeaningfulUserDataState, setHasMeaningfulUserDataState] = useState<boolean>(false);
  const [modeInitialized, setModeInitialized] = useState(false);

  // Determine initial mode based on meaningful user data
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Check if persisted user data exists (storage key check)
      const persistedState = await loadProfilesStateIfPresent();
      if (cancelled) return;

      const userDataExists = persistedState !== null;
      setHasUserData(userDataExists);

      // Phase 6.9: Check for meaningful user data
      let meaningfulData = false;
      if (persistedState) {
        // Extract active profile snapshot
        const activeProfile = persistedState.profiles[persistedState.activeProfileId];
        if (activeProfile) {
          meaningfulData = hasMeaningfulUserData(activeProfile.snapshotState);
        }
      }
      setHasMeaningfulUserDataState(meaningfulData);

      // Default to 'user' ONLY if meaningful data exists, otherwise 'demo'
      const initialMode: AppMode = meaningfulData ? 'user' : 'demo';
      if (!cancelled) {
        setMode(initialMode);
        setModeInitialized(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ModeContext.Provider value={{ mode, setMode, hasUserData, hasMeaningfulUserData: hasMeaningfulUserDataState, modeInitialized }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within ModeProvider');
  }
  return context;
}
