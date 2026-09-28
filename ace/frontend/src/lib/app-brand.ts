/**
 * This dashboard serves ONE brand - ACE Training and MultiSkills Training each
 * have their own copy of the app on their own domain. Everything the UI needs
 * to say about which brand it is comes from here.
 *
 * Keep in step with the backend's src/config/app-brand.ts.
 */
export const APP_BRAND = {
  /** Shown under the logo in the sidebar and in the browser tab title. */
  displayName: "ACE Training",
} as const;
