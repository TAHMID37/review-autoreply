import { isUninstall } from "./hubspot-webhooks.controller";

describe("isUninstall", () => {
  it("recognises an uninstall in whichever field HubSpot names it", () => {
    expect(isUninstall({ subscriptionType: "app.uninstall" })).toBe(true);
    expect(isUninstall({ eventType: "APP_UNINSTALL" })).toBe(true);
    expect(isUninstall({ type: "4-1916193: App uninstall event" })).toBe(true);
  });

  it("ignores everything else, including installs", () => {
    expect(isUninstall({ subscriptionType: "app.install" })).toBe(false);
    expect(isUninstall({ subscriptionType: "contact.creation" })).toBe(false);
    expect(isUninstall({})).toBe(false);
  });
});
