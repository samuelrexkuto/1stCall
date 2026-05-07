import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  buildJobFallbackQueries,
  buildWorkerFallbackQueries,
  resolveSavedCoordinates,
} from "@/lib/maps/geocode";
import { normalizeLocationPayload } from "@/lib/location";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type WorkerBackfillRow = {
  id: string;
  town: string | null;
  postcode: string | null;
  location_text: string | null;
  location_display: string | null;
  location_query: string | null;
  formatted_address: string | null;
  place_id: string | null;
  locality: string | null;
  administrative_area: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

type JobBackfillRow = {
  id: string;
  area: string | null;
  postcode: string | null;
  location_text: string | null;
  location_display: string | null;
  location_query: string | null;
  formatted_address: string | null;
  place_id: string | null;
  locality: string | null;
  administrative_area: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";
    const dryRun = searchParams.get("dry_run") === "true";
    const failures: Array<{ type: "worker" | "job"; id: string; reason: string }> = [];

    const [{ data: workersData, error: workersError }, { data: jobsData, error: jobsError }] =
      await Promise.all([
        force
          ? supabase.from("workers").select("id, town, postcode, location_text, location_display, location_query, formatted_address, place_id, locality, administrative_area, country, latitude, longitude")
          : supabase
              .from("workers")
              .select("id, town, postcode, location_text, location_display, location_query, formatted_address, place_id, locality, administrative_area, country, latitude, longitude")
              .or("latitude.is.null,longitude.is.null"),
        force
          ? supabase.from("jobs").select("id, area, postcode, location_text, location_display, location_query, formatted_address, place_id, locality, administrative_area, country, latitude, longitude")
          : supabase
              .from("jobs")
              .select("id, area, postcode, location_text, location_display, location_query, formatted_address, place_id, locality, administrative_area, country, latitude, longitude")
              .or("latitude.is.null,longitude.is.null"),
      ]);

    if (workersError) {
      return NextResponse.json({ success: false, error: workersError.message }, { status: 500 });
    }

    if (jobsError) {
      return NextResponse.json({ success: false, error: jobsError.message }, { status: 500 });
    }

    const workers = (workersData ?? []) as WorkerBackfillRow[];
    const jobs = (jobsData ?? []) as JobBackfillRow[];

    let workersUpdated = 0;
    let workersSkipped = 0;

    for (const worker of workers) {
      const location = normalizeLocationPayload({
        location_text: worker.location_text,
        location_display: worker.location_display,
        location_query: worker.location_query,
        formatted_address: worker.formatted_address,
        place_id: worker.place_id,
        postcode: worker.postcode,
        locality: worker.locality ?? worker.town,
        administrative_area: worker.administrative_area,
        country: worker.country,
      });
      const fallbackQueries = buildWorkerFallbackQueries(location.locality ?? worker.town, location.postcode ?? worker.postcode);
      const geocoded = await resolveSavedCoordinates({
        placeId: location.place_id,
        formattedAddress: location.formatted_address,
        locationQuery: location.location_query,
        fallbackQueries,
      });

      if (!geocoded) {
        workersSkipped += 1;
        failures.push({
          type: "worker",
          id: worker.id,
          reason: "No trustworthy coordinate match returned.",
        });
        continue;
      }

      const { error } = dryRun
        ? { error: null }
        : await supabase
            .from("workers")
            .update({
              location_text: location.location_text,
              location_display: location.location_display,
              location_query: location.location_query,
              formatted_address: location.formatted_address,
              place_id: location.place_id,
              locality: location.locality,
              administrative_area: location.administrative_area,
              country: location.country,
              town: location.locality ?? worker.town,
              postcode: location.postcode ?? worker.postcode,
              latitude: geocoded.latitude,
              longitude: geocoded.longitude,
            })
            .eq("id", worker.id);

      if (error) {
        workersSkipped += 1;
        failures.push({
          type: "worker",
          id: worker.id,
          reason: error.message,
        });
        continue;
      }

      workersUpdated += 1;
    }

    let jobsUpdated = 0;
    let jobsSkipped = 0;

    for (const job of jobs) {
      const location = normalizeLocationPayload({
        location_text: job.location_text,
        location_display: job.location_display,
        location_query: job.location_query,
        formatted_address: job.formatted_address,
        place_id: job.place_id,
        postcode: job.postcode,
        locality: job.locality ?? job.area,
        administrative_area: job.administrative_area,
        country: job.country,
      });
      const fallbackQueries = buildJobFallbackQueries(location.locality ?? job.area, location.postcode ?? job.postcode);
      const geocoded = await resolveSavedCoordinates({
        placeId: location.place_id,
        formattedAddress: location.formatted_address,
        locationQuery: location.location_query,
        fallbackQueries,
      });

      if (!geocoded) {
        jobsSkipped += 1;
        failures.push({
          type: "job",
          id: job.id,
          reason: "No trustworthy coordinate match returned.",
        });
        continue;
      }

      const { error } = dryRun
        ? { error: null }
        : await supabase
            .from("jobs")
            .update({
              location_text: location.location_text,
              location_display: location.location_display,
              location_query: location.location_query,
              formatted_address: location.formatted_address,
              place_id: location.place_id,
              locality: location.locality,
              administrative_area: location.administrative_area,
              country: location.country,
              area: location.locality ?? job.area,
              postcode: location.postcode ?? job.postcode,
              latitude: geocoded.latitude,
              longitude: geocoded.longitude,
            })
            .eq("id", job.id);

      if (error) {
        jobsSkipped += 1;
        failures.push({
          type: "job",
          id: job.id,
          reason: error.message,
        });
        continue;
      }

      jobsUpdated += 1;
    }

    return NextResponse.json({
      success: true,
      force,
      dry_run: dryRun,
      workers: {
        checked: workers.length,
        updated: workersUpdated,
        skipped: workersSkipped,
      },
      jobs: {
        checked: jobs.length,
        updated: jobsUpdated,
        skipped: jobsSkipped,
      },
      failures,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to backfill coordinates.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
