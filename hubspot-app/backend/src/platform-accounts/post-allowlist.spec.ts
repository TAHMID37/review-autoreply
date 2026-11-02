import { isLocationAllowed, parseAllowedLocationIds } from "./post-allowlist";

describe("parseAllowedLocationIds", () => {
  it("accepts bare ids and resource names, ignoring blanks", () => {
    expect(parseAllowedLocationIds(" 123, locations/456 ,,accounts/9/locations/789 ")).toEqual(["123", "456", "789"]);
  });

  it("is empty for an empty setting", () => {
    expect(parseAllowedLocationIds("")).toEqual([]);
  });
});

describe("isLocationAllowed", () => {
  it("allows everything when no list is set", () => {
    expect(isLocationAllowed("accounts/1/locations/555", [])).toBe(true);
  });

  it("allows only listed locations", () => {
    expect(isLocationAllowed("accounts/1/locations/123", ["123"])).toBe(true);
    expect(isLocationAllowed("locations/123", ["123"])).toBe(true);
    expect(isLocationAllowed("accounts/1/locations/555", ["123"])).toBe(false);
  });

  it("does not match on a prefix or the account id", () => {
    expect(isLocationAllowed("accounts/1/locations/1234", ["123"])).toBe(false);
    expect(isLocationAllowed("accounts/123/locations/555", ["123"])).toBe(false);
  });
});
