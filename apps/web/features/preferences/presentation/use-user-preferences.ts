"use client";

import { useEffect, useState, useCallback } from "react";
import {
   DEFAULT_USER_PREFERENCES,
   type UserPreferences,
} from "../domain/user-preferences";
import {
   loadStoredPreferences,
   saveStoredPreferences,
   subscribeToPreferences,
} from "../data/preferences-storage";

export interface UseUserPreferencesReturn {
   preferences: UserPreferences;
   updatePreferences: (
      update:
         Partial<UserPreferences> | ((prev: UserPreferences) => UserPreferences)
   ) => UserPreferences;
   isHydrated: boolean;
}

/**
 * Hook providing reactive access and mutations to persistent user preferences.
 */
export function useUserPreferences(): UseUserPreferencesReturn {
   const [preferences, setPreferences] = useState<UserPreferences>(
      () => DEFAULT_USER_PREFERENCES
   );
   const [isHydrated, setIsHydrated] = useState<boolean>(false);

   useEffect(() => {
      setPreferences(loadStoredPreferences());
      setIsHydrated(true);

      const unsubscribe = subscribeToPreferences((updated) => {
         setPreferences(updated);
      });

      return unsubscribe;
   }, []);

   const updatePreferences = useCallback(
      (
         update:
            | Partial<UserPreferences>
            | ((prev: UserPreferences) => UserPreferences)
      ) => {
         const updated = saveStoredPreferences(update);
         setPreferences(updated);
         return updated;
      },
      []
   );

   return {
      preferences,
      updatePreferences,
      isHydrated,
   };
}
