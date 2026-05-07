import { describe, expect, it } from "vitest";
import { createJobDraftFromStructuredJob, jobDraftToCreateJobInput, jobDraftToWorkerAlertDraft } from "./job-draft";
import { normalizeJobsSchemaError } from "./jobs";
import { normaliseStringList } from "@/lib/stringLists";

describe("normaliseStringList", () => {
  it("normalizes an array of values", () => {
    expect(normaliseStringList([" Driver ", "CSCS", null, undefined])).toEqual(["Driver", "CSCS"]);
  });

  it("parses JSON array strings", () => {
    expect(normaliseStringList('["electrician", "plumber"]')).toEqual(["electrician", "plumber"]);
  });

  it("parses PostgreSQL array literals", () => {
    expect(normaliseStringList('{"electrician","plumber"}')).toEqual(["electrician", "plumber"]);
  });

  it("splits comma-separated text", () => {
    expect(normaliseStringList("electrician, plumber, carpenter")).toEqual([
      "electrician",
      "plumber",
      "carpenter",
    ]);
  });

  it("normalizes a JSONB array value", () => {
    expect(normaliseStringList(["basic", "urgent"])).toEqual(["basic", "urgent"]);
  });

  it("returns an empty list for null or undefined values", () => {
    expect(normaliseStringList(null)).toEqual([]);
    expect(normaliseStringList(undefined)).toEqual([]);
  });

  it("returns an empty list for an empty array", () => {
    expect(normaliseStringList([])).toEqual([]);
  });

  it("flattens nested arrays safely", () => {
    expect(normaliseStringList(["basic", ["PPE required", null], undefined])).toEqual([
      "basic",
      "PPE required",
    ]);
  });

  it("stringifies non-string values when useful", () => {
    expect(normaliseStringList(["basic", 42, true, null])).toEqual(["basic", "42", "true"]);
  });

  it("normalizes a plain string to a single item array", () => {
    expect(normaliseStringList("basic")).toEqual(["basic"]);
  });
});

describe("create job draft payload", () => {
  it("preserves skills_required, requirements, and selected_keywords arrays", () => {
    const structuredJob = {
      job_title: "Construction labourer",
      core_role: "Construction labourer",
      alert_type: "Job Alert",
      headcount_required: 2,
      location: "London",
      start_date: "2025-06-01",
      end_date: "2025-06-03",
      duration: "2 days",
      pay_rate: "£150 per day",
      skills_required: ["Driver"],
      tickets_required: ["CSCS"],
      dbs_requirement: "DBS Required",
      ppe_required: true,
      own_tools_required: false,
      ipaf_required: false,
      duties: "Move materials",
      shift_pattern: "Day shift",
      optional_supporting_notes: "Bring boots",
      selected_keywords: ["driver", "site"],
    };

    const draft = createJobDraftFromStructuredJob(structuredJob as any, {
      location_text: "London",
      location_display: "London",
      location_query: "London",
      formatted_address: "London",
      place_id: "place_123",
      postcode: "SW1A 1AA",
      locality: "London",
      administrative_area: "Greater London",
      country: "UK",
      latitude: 51.5074,
      longitude: -0.1278,
    });

    const payload = jobDraftToCreateJobInput(draft, "provider-123");

    expect(payload.skills_required).toEqual(["Driver"]);
    expect(payload.requirements).toContain("Driver");
    expect(payload.requirements).toContain("CSCS");
    expect(payload.requirements).toContain("DBS Required");
    expect(payload.requirements).toContain("PPE required");
    expect(payload.selected_keywords).toEqual(["driver", "site"]);
  });

  it("keeps worker alert simulator and saved job data aligned", () => {
    const structuredJob = {
      job_title: "Skilled Labourer",
      core_role: "labourer",
      alert_type: "urgent",
      headcount_required: 3,
      location: "Whitmore Cl, Arnos Grove, London N11 1PB, UK",
      start_date: "2026-05-02",
      end_date: "2026-05-09",
      duration: "7 days",
      pay_rate: "275 daily",
      skills_required: ["basic"],
      tickets_required: ["CSCS"],
      dbs_requirement: "Enhanced DBS Required",
      ppe_required: true,
      own_tools_required: true,
      ipaf_required: false,
      duties: "vary across the site",
      shift_pattern: "Day shift",
      optional_supporting_notes: "Stay safe",
      selected_keywords: [
        "urgent",
        "skilled labourer",
        "PPE required",
        "enhanced DBS required",
        "own tools required",
      ],
    };

    const location = {
      location_text: "Whitmore Cl, Arnos Grove, London N11 1PB, UK",
      location_display: "Whitmore Cl, Arnos Grove, London N11 1PB, UK",
      location_query: "Whitmore Cl, Arnos Grove, London N11 1PB, UK",
      formatted_address: "Whitmore Cl, Arnos Grove, London N11 1PB, UK",
      place_id: "place_abc123",
      postcode: "N11 1PB",
      locality: "London",
      administrative_area: "Greater London",
      country: "UK",
      latitude: 51.61389,
      longitude: -0.14121,
    };

    const draft = createJobDraftFromStructuredJob(structuredJob as any, location);
    const alertJob = jobDraftToWorkerAlertDraft(draft);

    expect(alertJob.skills).toEqual(["basic"]);
    expect(alertJob.requirements).toEqual(draft.requirements);
    expect(alertJob.compliance).toEqual(draft.requirements);
  });
});

describe("normalizeJobsSchemaError", () => {
  it("returns the original message for non-schema errors", () => {
    const message = "Unexpected alert_type in payload";
    expect(normalizeJobsSchemaError(message)).toBe(message);
  });

  it("returns a compatibility warning for missing job schema columns", () => {
    const message = "column jobs.alert_type does not exist";
    expect(normalizeJobsSchemaError(message)).toContain("Jobs schema is not ready yet");
  });
});
