import { describe, expect, it } from "vitest";
import {
  formatProviderRequestedNames,
  getRequestedWorkerIdsFromBody,
  isUuid,
  uniqueStringList,
} from "@/lib/provider-requested-workforce";

describe("formatProviderRequestedNames", () => {
  it("returns empty text for no names", () => {
    expect(formatProviderRequestedNames([])).toBe("");
  });

  it("formats one, two, and three names", () => {
    expect(formatProviderRequestedNames(["Sam Rex"])).toBe("Sam Rex");
    expect(formatProviderRequestedNames(["Sam Rex", "Joseph Kutosi"])).toBe("Sam Rex, Joseph Kutosi");
    expect(formatProviderRequestedNames(["A", "B", "C"])).toBe("A, B, C");
  });

  it("limits four names to three plus an ellipsis", () => {
    expect(formatProviderRequestedNames(["A", "B", "C", "D"])).toBe("A, B, C, ...");
  });
});

describe("uniqueStringList", () => {
  it("deduplicates selected ids while preserving order", () => {
    expect(uniqueStringList(["worker-1", "worker-2", "worker-1", ""])).toEqual(["worker-1", "worker-2"]);
  });
});

describe("requested workers payload parsing", () => {
  it("accepts canonical and compatibility payload field names", () => {
    expect(getRequestedWorkerIdsFromBody({ worker_ids: ["worker-1"] })).toEqual(["worker-1"]);
    expect(getRequestedWorkerIdsFromBody({ workforceIds: ["worker-2"] })).toEqual(["worker-2"]);
    expect(getRequestedWorkerIdsFromBody({ selectedWorkforceIds: ["worker-3"] })).toEqual(["worker-3"]);
  });

  it("validates uuid strings", () => {
    expect(isUuid("bfb5e347-c1b9-4815-9c0c-243493d44445")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});
