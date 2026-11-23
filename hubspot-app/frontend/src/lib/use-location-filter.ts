"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { Location } from "@/types/api";

const STORAGE_KEY = "reviewtune:location-filter";

function readStored(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * The location filter shared by Reviews, Alerts and Reports: the ticked
 * locations, and the one chosen ("" = all). The choice is remembered, and
 * forgotten if that location is no longer one of the business's.
 */
export function useLocationFilter() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationIdState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    apiFetch<Location[]>("/locations")
      .then((all) => {
        const ticked = all.filter((l) => l.syncEnabled);
        setLocations(ticked);
        const stored = readStored();
        setLocationIdState(ticked.some((l) => l.id === stored) ? stored : "");
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const setLocationId = useCallback((id: string) => {
    setLocationIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // The filter still works for this visit.
    }
  }, []);

  return { locations, locationId, setLocationId, ready };
}
