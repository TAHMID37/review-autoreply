import { isOriginAllowed, normaliseDomain } from "./allowed-domains";

describe("normaliseDomain", () => {
  it("strips protocol, path and port", () => {
    expect(normaliseDomain("https://www.Example.com:443/reviews?x=1")).toBe("www.example.com");
  });
  it("keeps wildcards", () => {
    expect(normaliseDomain("*.example.com.au")).toBe("*.example.com.au");
  });
  it("rejects junk", () => {
    expect(normaliseDomain("not a domain")).toBeNull();
    expect(normaliseDomain("")).toBeNull();
  });
});

describe("isOriginAllowed", () => {
  it("allows the domain and its www", () => {
    expect(isOriginAllowed("https://example.com", ["example.com"])).toBe(true);
    expect(isOriginAllowed("https://www.example.com", ["example.com"])).toBe(true);
    expect(isOriginAllowed("https://example.com", ["www.example.com"])).toBe(true);
  });
  it("allows subdomains only with a wildcard", () => {
    expect(isOriginAllowed("https://shop.example.com", ["example.com"])).toBe(false);
    expect(isOriginAllowed("https://shop.example.com", ["*.example.com"])).toBe(true);
  });
  it("does not allow look-alike domains", () => {
    expect(isOriginAllowed("https://evilexample.com", ["*.example.com"])).toBe(false);
    expect(isOriginAllowed("https://example.com.evil.io", ["example.com"])).toBe(false);
  });
  it("refuses requests with no origin", () => {
    expect(isOriginAllowed(undefined, ["example.com"])).toBe(false);
  });
});
