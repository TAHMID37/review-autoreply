"use client";

import type { Location } from "@/types/api";

/** "All locations" plus each ticked location. Hidden when there is nothing to choose between. */
export function LocationFilter({
  locations,
  value,
  onChange,
}: {
  locations: Location[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (locations.length < 2) return null;
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Location"
      className="max-w-[16rem] rounded-md border border-gray-300 px-2 py-1.5 text-sm text-ink focus:border-brand-pink focus:outline-none"
    >
      <option value="">All locations</option>
      {locations.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
