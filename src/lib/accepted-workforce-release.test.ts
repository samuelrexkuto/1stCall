import { describe, expect, it } from "vitest";
import { getReleasedAcceptedWorkers } from "@/lib/accepted-workforce-release";

describe("getReleasedAcceptedWorkers", () => {
  it("returns only accepted workers released to the client", () => {
    expect(getReleasedAcceptedWorkers({
      matching_workers: [
        { accepted_by_worker: true, released_to_client: true },
        { accepted_by_worker: true, released_to_client: false },
        { accepted_by_worker: false, released_to_client: true },
      ],
    })).toHaveLength(1);
  });
});
