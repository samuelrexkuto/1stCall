"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

interface DispatchJobSummary {
  job_id: string;
  job_title: string;
  company_name: string;
  area: string | null;
  postcode: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  trade_type: string | null;
  workers_required: number;
  workers_confirmed: number;
  fill_status: string;
  broadcast_status: string;
  payment_status: string;
  skill_tags: string[];
}

interface MatchedWorker {
  worker_id: string;
  full_name: string;
  mobile: string;
  primary_role: string | null;
  town: string | null;
  postcode: string;
  available_today: boolean;
  priority_tier: string;
  whatsapp_opt_in: boolean;
  right_to_work: boolean;
  contract_signed: boolean;
  matched_skill_count: number;
}

interface ResponseResult {
  worker_id: string;
  full_name: string;
  mobile: string;
  channel: string;
  response_type: string | null;
  response_time: string | null;
  booking_status: string | null;
}

export function JobDispatchConsole({
  job,
  matchedWorkers,
  responseResults,
}: {
  job: DispatchJobSummary;
  matchedWorkers: MatchedWorker[];
  responseResults: ResponseResult[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [workerName, setWorkerName] = useState("");
  const [workerTown, setWorkerTown] = useState("");
  const [priorityTier, setPriorityTier] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState("");
  const [availableToday, setAvailableToday] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [feedback, setFeedback] = useState("");

  const filteredWorkers = useMemo(() => {
    return matchedWorkers.filter((worker) => {
      const matchesName = worker.full_name
        .toLowerCase()
        .includes(workerName.trim().toLowerCase());
      const matchesTown = workerTown
        ? (worker.town ?? "").toLowerCase().includes(workerTown.trim().toLowerCase())
        : true;
      const matchesPriority = priorityTier ? worker.priority_tier === priorityTier : true;
      const matchesWhatsApp =
        whatsappOptIn === ""
          ? true
          : worker.whatsapp_opt_in === (whatsappOptIn === "true");
      const matchesAvailable =
        availableToday === ""
          ? true
          : worker.available_today === (availableToday === "true");

      return (
        matchesName &&
        matchesTown &&
        matchesPriority &&
        matchesWhatsApp &&
        matchesAvailable
      );
    });
  }, [availableToday, matchedWorkers, priorityTier, whatsappOptIn, workerName, workerTown]);

  const resultsSummary = responseResults.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.response_type === "accepted") acc.accepted += 1;
      if (row.response_type === "declined") acc.declined += 1;
      if (row.response_type === "no_response") acc.noResponse += 1;
      return acc;
    },
    { total: 0, accepted: 0, declined: 0, noResponse: 0 },
  );

  function toggleWorker(workerId: string) {
    setSelectedWorkerIds((current) =>
      current.includes(workerId)
        ? current.filter((id) => id !== workerId)
        : [...current, workerId],
    );
  }

  async function handleBroadcast() {
    if (selectedWorkerIds.length === 0) {
      setFeedback("Select at least one worker before broadcasting.");
      return;
    }

    const response = await fetch(`/api/jobs/${job.job_id}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workerIds: selectedWorkerIds,
        channel,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setFeedback(payload.error ?? "Broadcast failed.");
      return;
    }

    setFeedback(payload.message ?? "Broadcast queued locally.");
    setSelectedWorkerIds([]);
    startTransition(() => router.refresh());
  }

  async function handleResponseUpdate(workerId: string, responseType: "accepted" | "declined" | "no_response") {
    const response = await fetch(`/api/jobs/${job.job_id}/responses/${workerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responseType }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setFeedback(payload.error ?? "Unable to update response.");
      return;
    }

    setFeedback(payload.message ?? "Response updated.");
    startTransition(() => router.refresh());
  }

  return (
    <main>
      <p style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link href="/jobs">Back to jobs</Link>
        <Link href={`/jobs?title=${encodeURIComponent(job.job_title)}`}>Return to overview with filter</Link>
      </p>

      <h1 style={{ marginBottom: "0.5rem" }}>{job.job_title}</h1>
      <p style={{ marginTop: 0 }}>Job-anchored dispatch flow for local operations testing.</p>

      <section
        style={{
          padding: "1rem",
          background: "#ffffff",
          border: "1px solid #dbe1ea",
          borderRadius: 8,
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Job Summary</h2>
        <p><strong>Provider:</strong> {job.company_name}</p>
        <p><strong>Role / Trade:</strong> {job.trade_type ?? "-"}</p>
        <p><strong>Area / Postcode:</strong> {job.area ?? "-"} / {job.postcode}</p>
        <p><strong>Start:</strong> {job.start_date} {job.start_time ?? ""} {job.end_time ? `to ${job.end_time}` : ""}</p>
        <p><strong>Workers:</strong> {job.workers_confirmed}/{job.workers_required} confirmed</p>
        <p><strong>Fill Status:</strong> {job.fill_status}</p>
        <p><strong>Broadcast Status:</strong> {job.broadcast_status}</p>
        <p><strong>Payment Status:</strong> {job.payment_status}</p>
        <p><strong>Skill Tags:</strong> {job.skill_tags.length ? job.skill_tags.join(", ") : "-"}</p>
      </section>

      <section
        style={{
          padding: "1rem",
          background: "#ffffff",
          border: "1px solid #dbe1ea",
          borderRadius: 8,
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Broadcast Job</h2>
        <p style={{ marginTop: 0 }}>
          Matching based on primary role and compliance readiness.
        </p>

        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            marginBottom: "1rem",
          }}
        >
          <label>
            Worker name
            <input
              value={workerName}
              onChange={(event) => setWorkerName(event.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Town
            <input
              value={workerTown}
              onChange={(event) => setWorkerTown(event.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Priority tier
            <select
              value={priorityTier}
              onChange={(event) => setPriorityTier(event.target.value)}
              style={{ display: "block", width: "100%" }}
            >
              <option value="">All</option>
              <option value="standard">standard</option>
              <option value="preferred">preferred</option>
              <option value="vip">vip</option>
              <option value="restricted">restricted</option>
            </select>
          </label>
          <label>
            WhatsApp opt-in
            <select
              value={whatsappOptIn}
              onChange={(event) => setWhatsappOptIn(event.target.value)}
              style={{ display: "block", width: "100%" }}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label>
            Available today
            <select
              value={availableToday}
              onChange={(event) => setAvailableToday(event.target.value)}
              style={{ display: "block", width: "100%" }}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <p style={{ margin: 0 }}>Selected staff: {selectedWorkerIds.length}</p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <label>
              Method
              <select
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
                style={{ display: "block", width: "100%" }}
              >
                <option value="ivr">Call</option>
                <option value="sms">Text</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </label>
            <button type="button" disabled={isPending || selectedWorkerIds.length === 0} onClick={handleBroadcast}>
              {isPending ? "Sending..." : "Broadcast"}
            </button>
          </div>
        </div>

        {feedback ? (
          <p
            style={{
              padding: "0.75rem",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 8,
            }}
          >
            {feedback}
          </p>
        ) : null}

        {filteredWorkers.length === 0 ? (
          <p>No matched staff available for this job.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "#ffffff",
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }} />
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>Name</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>Primary Role</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>Town</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>Postcode</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>Available</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>Priority</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>WhatsApp</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>RTW</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>Contract</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkers.map((worker) => (
                  <tr key={worker.worker_id}>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>
                      <input
                        type="checkbox"
                        checked={selectedWorkerIds.includes(worker.worker_id)}
                        onChange={() => toggleWorker(worker.worker_id)}
                        aria-label={`Select ${worker.full_name}`}
                      />
                    </td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{worker.full_name}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{worker.primary_role ?? "-"}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{worker.town ?? "-"}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{worker.postcode}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{worker.available_today ? "Yes" : "No"}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{worker.priority_tier}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{worker.whatsapp_opt_in ? "Yes" : "No"}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{worker.right_to_work ? "Yes" : "No"}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{worker.contract_signed ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        style={{
          padding: "1rem",
          background: "#ffffff",
          border: "1px solid #dbe1ea",
          borderRadius: 8,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Broadcast Results</h2>
        <p style={{ marginTop: 0 }}>
          Total sent: {resultsSummary.total} | Accepted: {resultsSummary.accepted} | Declined:{" "}
          {resultsSummary.declined} | No response: {resultsSummary.noResponse} | Workers confirmed:{" "}
          {job.workers_confirmed}/{job.workers_required}
        </p>

        {responseResults.length === 0 ? (
          <p>No broadcast results recorded for this job yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "#ffffff",
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>Worker</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>Mobile</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>Channel</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>Response</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>Response Time</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>Booking</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #d1d5db" }}>Mock Response</th>
                </tr>
              </thead>
              <tbody>
                {responseResults.map((row) => (
                  <tr key={row.worker_id}>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{row.full_name}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{row.mobile}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{row.channel}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{row.response_type ?? "-"}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{row.response_time ?? "-"}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{row.booking_status ?? "-"}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button type="button" onClick={() => handleResponseUpdate(row.worker_id, "accepted")}>
                          Mark accepted
                        </button>
                        <button type="button" onClick={() => handleResponseUpdate(row.worker_id, "declined")}>
                          Mark declined
                        </button>
                        <button type="button" onClick={() => handleResponseUpdate(row.worker_id, "no_response")}>
                          Mark no response
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
