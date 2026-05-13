"use client";

import { divIcon, latLngBounds, Popup as LeafletPopup } from "leaflet";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useSearchParams } from "next/navigation";
import { Cross2Icon, InfoCircledIcon } from "@radix-ui/react-icons";
import { Callout, Checkbox, Flex, IconButton, Select, Skeleton, Text } from "@radix-ui/themes";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import {
  GooglePlacesAutocomplete,
  type GooglePlaceSuggestion,
} from "@/components/forms/GooglePlacesAutocomplete";
import { OperationalMapWorkerCard } from "@/components/dashboard/home/OperationalMapWorkerCard";
import { WorkerProfileModal } from "@/components/workers/WorkerProfileModal";
import { JobDetailModal, type JobOverviewRow } from "@/components/jobs/JobOverviewTable";
import type {
  DashboardMapDataPayload,
  DashboardMapJobPin,
  DashboardMapWorkerPin,
} from "@/lib/dashboard";
import {
  buildProviderAccessSeed,
  getProviderFacingDisplayName,
  getProviderFacingLocationLabel,
} from "@/lib/provider-access";
import { normaliseStringList } from "@/lib/stringLists";
import { loadPlacesLibrary } from "@/lib/googleMapsLoader";
import { CARTO_ATTRIBUTION, CARTO_POSITRON_TILE_URL } from "@/lib/maps/tiles";
import type { WorkerOverviewRow } from "@/lib/workers/types";
import { normaliseWorkforceGrouping } from "@/lib/workforce-grouping";
import {
  getSafeWorkerDisplayName,
  getWorkerCardImage,
  getWorkerDisplayGrouping,
} from "@/lib/worker-display";
import { JOB_CREATED_EVENT, JOB_UPDATED_EVENT, MAP_DATA_REFRESH_EVENT } from "@/lib/jobs/client-events";
import {
  BROADCAST_STATUS_LABELS,
  normaliseBroadcastStatus,
} from "@/lib/dispatch/broadcast-status-constants";
import styles from "./HomeMap.module.css";

const DEFAULT_CENTER: [number, number] = [51.5074, -0.1278];
const DEFAULT_ZOOM = 10;
const RESULTS_PAGE_SIZE = 6;
const MOBILE_ALL_WORKER_GROUP_VALUE = "all";
const LOCATION_FILTER_RADIUS_KM = 30;
const WORKER_GROUP_OPTIONS = [
  { value: "", label: "Select Tradesman or Contractor" },
  { value: "tradesman", label: "Tradesman" },
  { value: "contractor", label: "Contractor" },
  { value: "specialist_contractor", label: "Specialist Contractor" },
] as const;

type MapState =
  | { loading: true; error: string; data: null }
  | { loading: false; error: string; data: DashboardMapDataPayload | null };

type JobPin = DashboardMapJobPin & {
  type: "job";
  label: string;
  searchText: string;
};

type WorkerPin = DashboardMapWorkerPin & {
  type: "worker";
  label: string;
  searchText: string;
};

type Pin = JobPin | WorkerPin;

type ResultItem =
  | { type: "worker"; id: string; worker: WorkerOverviewRow }
  | { type: "job"; id: string; job: JobPin | DashboardMapDataPayload["jobs_needing_location"][number] };

type Cluster = {
  id: string;
  type: Pin["type"];
  latitude: number;
  longitude: number;
  count: number;
  items: Pin[];
};

type GoogleGeocoderResult = {
  place_id?: string;
  formatted_address?: string;
  geometry?: {
    location?: {
      lat?: () => number;
      lng?: () => number;
    };
  };
};

type GoogleWithGeocoder = {
  maps: {
    Geocoder: new () => {
      geocode: (
        request: { address: string; region?: string },
        callback: (results: GoogleGeocoderResult[] | null, status: string) => void,
      ) => void;
    };
  };
};

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).trim());

  return Number.isFinite(parsed) ? parsed : null;
}

function getSafeLatLng(item: any): [number, number] | null {
  const lat =
    toFiniteNumber(item?.lat) ??
    toFiniteNumber(item?.latitude) ??
    toFiniteNumber(item?.location_lat) ??
    toFiniteNumber(item?.locationLat) ??
    toFiniteNumber(item?.geo_lat);

  const lng =
    toFiniteNumber(item?.lng) ??
    toFiniteNumber(item?.lon) ??
    toFiniteNumber(item?.longitude) ??
    toFiniteNumber(item?.location_lng) ??
    toFiniteNumber(item?.locationLng) ??
    toFiniteNumber(item?.geo_lng);

  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  return [lat, lng];
}

function hasSafeLatLng(item: any): boolean {
  return getSafeLatLng(item) !== null;
}

function createPinIcon(type: Pin["type"], active = false) {
  const background = type === "job" ? "#ef4444" : "#2563eb";
  const ring = active ? "0 0 0 6px rgba(15, 23, 42, 0.14)" : "0 10px 24px rgba(15, 23, 42, 0.16)";
  const size = active ? 24 : 18;
  const border = active ? 3 : 2;

  return divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${background};border:${border}px solid #ffffff;box-shadow:${ring};"></div>`,
    iconSize: [size, size],
    iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
  });
}

function makeClusterIcon(type: Pin["type"], count: number) {
  const background = type === "job" ? "#ef4444" : "#2563eb";
  return divIcon({
    className: "",
    html: `<div style="min-width:38px;height:38px;border-radius:999px;background:${background};border:3px solid #ffffff;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 10px 24px rgba(15,23,42,0.2);padding:0 10px;">${count}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

function getClusterCellSize(zoom: number) {
  if (zoom >= 15) return 0;
  if (zoom >= 13) return 0.008;
  if (zoom >= 11) return 0.015;
  if (zoom >= 9) return 0.04;
  if (zoom >= 7) return 0.09;
  return 0.16;
}

function clusterPins(pins: Pin[], zoom: number): Cluster[] {
  const safePins = pins
    .map((pin) => {
      const safeLatLng = getSafeLatLng(pin);
      return safeLatLng ? { ...pin, latitude: safeLatLng[0], longitude: safeLatLng[1] } : null;
    })
    .filter(Boolean) as Pin[];
  const cellSize = getClusterCellSize(zoom);

  if (cellSize === 0) {
    return safePins.map((pin) => ({
      id: `${pin.type}-${pin.id}`,
      type: pin.type,
      latitude: pin.latitude,
      longitude: pin.longitude,
      count: 1,
      items: [pin],
    }));
  }

  const grouped = new Map<string, Pin[]>();
  for (const pin of safePins) {
    const key = [
      pin.type,
      Math.round(pin.latitude / cellSize),
      Math.round(pin.longitude / cellSize),
    ].join(":");
    grouped.set(key, [...(grouped.get(key) ?? []), pin]);
  }

  return [...grouped.entries()].map(([key, items]) => ({
    id: key,
    type: items[0].type,
    latitude: items.reduce((sum, item) => sum + item.latitude, 0) / items.length,
    longitude: items.reduce((sum, item) => sum + item.longitude, 0) / items.length,
    count: items.length,
    items,
  }));
}

function FitMapBounds({ pins }: { pins: Pin[] }) {
  const map = useMap();

  useEffect(() => {
    const boundsLatLngs = pins
      .map((pin) => getSafeLatLng(pin))
      .filter(Boolean) as [number, number][];

    if (boundsLatLngs.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    if (boundsLatLngs.length === 1) {
      map.setView(boundsLatLngs[0], 12);
      return;
    }

    map.fitBounds(latLngBounds(boundsLatLngs), {
      padding: [28, 28],
    });
  }, [map, pins]);

  return null;
}

function MapZoomSync({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  useMapEvents({
    zoomend(event) {
      onZoomChange(event.target.getZoom());
    },
  });

  return null;
}

function FlyToPin({ target }: { target: Pick<Pin, "latitude" | "longitude"> | null }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    const safeLatLng = getSafeLatLng(target);
    if (!safeLatLng) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[OperationalMap] Cannot focus selected pin without valid coordinates", target);
      }
      return;
    }
    const size = map.getSize();
    if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || size.x <= 0 || size.y <= 0) return;
    map.flyTo(safeLatLng, Math.max(map.getZoom(), 13), {
      duration: 0.7,
    });
  }, [map, target]);

  return null;
}

function FlyToPlace({ target }: { target: Pick<GooglePlaceSuggestion, "latitude" | "longitude"> | null }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    const safeLatLng = getSafeLatLng(target);
    if (!safeLatLng) return;

    map.flyTo(safeLatLng, 11, {
      duration: 0.7,
    });
  }, [map, target]);

  return null;
}

function distanceKm(
  left: Pick<Pin, "latitude" | "longitude">,
  right: Pick<GooglePlaceSuggestion, "latitude" | "longitude">,
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(right.latitude - left.latitude);
  const dLng = toRadians(right.longitude - left.longitude);
  const lat1 = toRadians(left.latitude);
  const lat2 = toRadians(right.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchesWorkerGrouping(pin: WorkerPin, grouping: string) {
  const normalizedGrouping = normaliseWorkforceGrouping(pin);
  if (!grouping) return true;
  if (grouping === "tradesman") return normalizedGrouping === "Tradesman";
  if (grouping === "contractor") return normalizedGrouping === "Contractor" && pin.contractorType !== "specialist";
  if (grouping === "specialist_contractor") return normalizedGrouping === "Contractor" && pin.contractorType === "specialist";
  return true;
}

function getWorkerGroupLabel(value: string) {
  return WORKER_GROUP_OPTIONS.find((option) => option.value === value)?.label ?? WORKER_GROUP_OPTIONS[0].label;
}

function AutoOpenPopup({ children }: { children: ReactNode }) {
  const popupRef = useRef<LeafletPopup | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const popup = popupRef.current as (LeafletPopup & {
        _source?: { openPopup?: () => void };
      }) | null;
      popup?._source?.openPopup?.();
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <Popup ref={popupRef}>{children}</Popup>;
}

function getWorkerPinIdentityKey(worker: DashboardMapWorkerPin) {
  return [
    worker.full_name.trim().toLowerCase(),
    worker.workerType ?? "tradesman",
    worker.contractorType ?? "",
    worker.specialistArea?.trim().toLowerCase() ?? "",
    worker.location_display?.trim().toLowerCase() ?? "",
    worker.town?.trim().toLowerCase() ?? "",
    worker.postcode?.trim().toLowerCase() ?? "",
  ].join("|");
}

function JobPopupCard({ job }: { job: JobPin }) {
  return (
    <div style={{ minWidth: 220, display: "grid", gap: "0.35rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
        <strong>{job.title}</strong>
        <span className={styles.popupBadge}>Job</span>
      </div>
      <div>Required role: {job.required_role ?? "-"}</div>
      <div>Location: {job.location_display ?? `${job.area ?? "-"} / ${job.postcode ?? "-"}`}</div>
      <div>Status: {job.job_status}</div>
    </div>
  );
}

function WorkerPopupCard({
  worker,
  onViewProfile,
}: {
  worker: WorkerPin;
  onViewProfile?: () => void;
}) {
  const contractorName = worker.full_name.trim();
  const displayName =
    worker.workerType === "contractor" &&
    contractorName &&
    !["contractor", "contractor contractor"].includes(contractorName.toLowerCase())
      ? contractorName
      : getProviderFacingDisplayName(worker);

  return (
    <div style={{ minWidth: 220, display: "grid", gap: "0.35rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
        <strong>{displayName}</strong>
        <span className={styles.popupBadgeAlt}>Worker</span>
      </div>
      <div>{worker.workerType === "contractor" ? "Contractor" : "Tradesman"}</div>
      <div>
        Area: {getProviderFacingLocationLabel(worker)}
      </div>
      <div>Status: {worker.status}</div>
      {onViewProfile ? (
        <button type="button" onClick={onViewProfile}>
          View Profile
        </button>
      ) : null}
    </div>
  );
}

function JobResultCard({
  job,
  selected,
  onSelect,
}: {
  job: JobPin | DashboardMapDataPayload["jobs_needing_location"][number];
  selected: boolean;
  onSelect: () => void;
}) {
  const location = job.location_display ?? ([job.area, job.postcode].filter(Boolean).join(" ") || "Location TBC");
  const remaining = Math.max(0, Number(job.headcount_required ?? 0) - Number(job.headcount_confirmed ?? 0));
  const broadcastStatusLabel = BROADCAST_STATUS_LABELS[normaliseBroadcastStatus(job.broadcast_status)];

  return (
    <article
      className={`${styles.jobResultCard} ${selected ? styles.workerCardActive : ""}`}
      onClick={onSelect}
    >
      <div className={styles.jobResultHeader}>
        <span className={styles.jobResultBadge}>{"latitude" in job ? "Job pin" : "Needs location"}</span>
        <span className={styles.jobResultStatus}>{broadcastStatusLabel || job.job_status}</span>
      </div>
      <div className={styles.jobResultBody}>
        <h3 className={styles.jobResultTitle}>{job.title}</h3>
        <div className={styles.jobResultMeta}>{job.required_role || "General workforce"}</div>
      </div>
      <div className={styles.jobResultDetails}>
        <span>Location: {location}</span>
        <span>Required: {job.headcount_required ?? "-"}</span>
        <span>Remaining: {remaining}</span>
        <span>Status: {job.job_status}</span>
      </div>
    </article>
  );
}

export function HomeMapClient({
  initialData = null,
  initialError = null,
  jobs = [],
  workers = [],
}: {
  initialData?: DashboardMapDataPayload | null;
  initialError?: string | null;
  jobs?: JobOverviewRow[];
  workers?: WorkerOverviewRow[];
}) {
  const { user } = useAuthSession();
  const [state, setState] = useState<MapState>({
    loading: false,
    error: initialError ?? "",
    data: initialData,
  });
  const [showJobs, setShowJobs] = useState(true);
  const [showWorkers, setShowWorkers] = useState(true);
  const [workerTypeFilter, setWorkerTypeFilter] = useState("");
  const [desktopWhereQuery, setDesktopWhereQuery] = useState("");
  const [appliedDesktopWhereQuery, setAppliedDesktopWhereQuery] = useState("");
  const [selectedDesktopPlace, setSelectedDesktopPlace] = useState<GooglePlaceSuggestion | null>(null);
  const [selectedMobilePlace, setSelectedMobilePlace] = useState<GooglePlaceSuggestion | null>(null);
  const [workerGroupMenuOpen, setWorkerGroupMenuOpen] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [resultsPage, setResultsPage] = useState(1);
  const [activeWorker, setActiveWorker] = useState<WorkerOverviewRow | null>(null);
  const [activeJob, setActiveJob] = useState<JobOverviewRow | null>(null);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [feedback, setFeedback] = useState("");
  const resultRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const workerGroupMenuRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const workerNameQuery = searchParams.get("workerName")?.trim() ?? "";
  const mobileMapQuery = searchParams.get("mapQuery")?.trim() ?? "";

  const isJobProvider = user?.role === "job_provider";
  buildProviderAccessSeed({
    accountTier: user?.accountTier,
    billingStatus: user?.billingStatus,
    paygPackType: user?.paygPackType,
    paygDispatchAllowanceTotal: user?.paygDispatchAllowanceTotal,
    paygDispatchAllowanceRemaining: user?.paygDispatchAllowanceRemaining,
    monthlyRenewalDate: user?.monthlyRenewalDate,
    monthlyActive: user?.monthlyActive,
        trialAccess: user?.trialAccess,
        isTrialMonth: user?.isTrialMonth,
        trialGrantedByAdmin: user?.trialGrantedByAdmin,
        trialStartDate: user?.trialStartDate,
        trialEndDate: user?.trialEndDate,
        trialStatus: user?.trialStatus,
        trialAccessLevel: user?.trialAccessLevel,
        profileOpensThisMonth: user?.profileOpensThisMonth,
        compareActionsThisMonth: user?.compareActionsThisMonth,
        manualDraftsUsed: user?.manualDraftsUsed,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const syncMobileViewport = () => setIsMobileViewport(mediaQuery.matches);

    syncMobileViewport();
    mediaQuery.addEventListener("change", syncMobileViewport);
    return () => mediaQuery.removeEventListener("change", syncMobileViewport);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 901px)");
    const syncDesktopViewport = () => setIsDesktopViewport(mediaQuery.matches);

    syncDesktopViewport();
    mediaQuery.addEventListener("change", syncDesktopViewport);
    return () => mediaQuery.removeEventListener("change", syncDesktopViewport);
  }, []);

  useEffect(() => {
    if (!workerGroupMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!workerGroupMenuRef.current?.contains(event.target as Node)) {
        setWorkerGroupMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [workerGroupMenuOpen]);

  useEffect(() => {
    if (!isMobileViewport || !mobileMapQuery) {
      setSelectedMobilePlace(null);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setSelectedMobilePlace(null);
        return;
      }

      try {
        const { google } = await loadPlacesLibrary(apiKey);
        const geocoder = new (google as unknown as GoogleWithGeocoder).maps.Geocoder();
        geocoder.geocode(
          {
            address: `${mobileMapQuery}, United Kingdom`,
            region: "uk",
          },
          (results, status) => {
            if (cancelled || status !== "OK") {
              return;
            }

            const result = results?.[0];
            const location = result?.geometry?.location;
            const latitude = location?.lat?.();
            const longitude = location?.lng?.();

            if (!result || typeof latitude !== "number" || typeof longitude !== "number") {
              return;
            }

            setSelectedMobilePlace({
              placeId: result.place_id ?? mobileMapQuery,
              display: result.formatted_address ?? mobileMapQuery,
              formattedAddress: result.formatted_address ?? mobileMapQuery,
              locationLabel: result.formatted_address ?? mobileMapQuery,
              latitude,
              longitude,
              postcode: null,
              locality: null,
              administrativeArea: null,
              country: null,
            });
          },
        );
      } catch {
        if (!cancelled) {
          setSelectedMobilePlace(null);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [isMobileViewport, mobileMapQuery]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMapData(signal?: AbortSignal) {
      setState({ loading: true, error: "", data: null });
      try {
        const response = await fetch("/api/dashboard/map-data", {
          signal: signal ?? controller.signal,
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.success) {
          setState({
            loading: false,
            error: payload.error ?? "Map data temporarily unavailable.",
            data: null,
          });
          return;
        }

        setState({
          loading: false,
          error: "",
          data: {
            jobs: Array.isArray(payload.jobs) ? payload.jobs : [],
            jobs_needing_location: Array.isArray(payload.jobs_needing_location) ? payload.jobs_needing_location : [],
            workers: Array.isArray(payload.workers) ? payload.workers : [],
            missing_coordinates: payload.missing_coordinates ?? { jobs: 0, workers: 0 },
            message: typeof payload.message === "string" ? payload.message : "",
          },
        });
      } catch (error) {
        if ((signal ?? controller.signal).aborted) return;
        setState({
          loading: false,
          error: "Map data temporarily unavailable.",
          data: null,
        });
        if (process.env.NODE_ENV !== "production") {
          console.error("[HomeMapClient] failed to load map data", error);
        }
      }
    }

    if (!initialData && !initialError) {
      void loadMapData();
    }

    function handleRefresh() {
      void loadMapData();
    }

    window.addEventListener(JOB_CREATED_EVENT, handleRefresh);
    window.addEventListener(JOB_UPDATED_EVENT, handleRefresh);
    window.addEventListener(MAP_DATA_REFRESH_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(JOB_CREATED_EVENT, handleRefresh);
      window.removeEventListener(JOB_UPDATED_EVENT, handleRefresh);
      window.removeEventListener(MAP_DATA_REFRESH_EVENT, handleRefresh);
      controller.abort();
    };
  }, [initialData, initialError]);

  const workerById = useMemo(
    () => new Map(workers.map((worker) => [worker.worker_id, worker])),
    [workers],
  );
  const jobById = useMemo(
    () => new Map(jobs.map((job) => [job.job_id, job])),
    [jobs],
  );

  const pins = useMemo<Pin[]>(() => {
    if (!state.data) return [];

    const jobPins: JobPin[] = state.data.jobs.map((job) => ({
      ...job,
      type: "job",
      label: job.title,
      searchText: [job.title, job.required_role, job.location_display, job.area, job.postcode, job.job_status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    }));

    const uniqueMapWorkers = Array.from(
      new Map(state.data.workers.map((worker) => [getWorkerPinIdentityKey(worker), worker])).values(),
    );
    const workerPins: WorkerPin[] = uniqueMapWorkers.map((worker) => ({
      ...worker,
      type: "worker",
      label: worker.full_name,
      searchText: [
        worker.full_name,
        worker.workerType === "contractor" ? "contractor" : "tradesman",
        worker.contractorType,
        worker.specialistArea,
        worker.primary_role,
        worker.location_display,
        worker.town,
        worker.postcode,
        worker.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    }));

    return [...jobPins, ...workerPins];
  }, [state.data]);

  const validPins = useMemo(() => {
    const safePins = pins
      .map((pin) => {
        const safeLatLng = getSafeLatLng(pin);
        return safeLatLng ? { ...pin, latitude: safeLatLng[0], longitude: safeLatLng[1] } : null;
      })
      .filter(Boolean) as Pin[];

    if (process.env.NODE_ENV === "development") {
      const invalidPins = pins
        .filter((pin) => !hasSafeLatLng(pin))
        .map((pin) => ({
          id: pin.id,
          name: pin.label,
          lat: (pin as any).lat ?? (pin as any).latitude,
          lng: (pin as any).lng ?? (pin as any).longitude,
        }));

      if (invalidPins.length > 0) {
        console.log("[OperationalMap] pin validation", {
          totalPins: pins.length,
          validPins: safePins.length,
          invalidPins,
        });
      }
    }

    return safePins;
  }, [pins]);

  const filteredPins = useMemo(() => {
    const normalizedWorkerName = isDesktopViewport ? "" : workerNameQuery.toLowerCase();
    const normalizedMobileMapQuery = isMobileViewport ? mobileMapQuery.toLowerCase() : "";
    const normalizedDesktopWhere = isDesktopViewport
      ? appliedDesktopWhereQuery.trim().toLowerCase()
      : "";

    return validPins.filter((pin) => {
      if (pin.type === "job" && !showJobs) return false;
      if (pin.type === "worker" && !showWorkers) return false;
      if (pin.type === "worker" && !matchesWorkerGrouping(pin, workerTypeFilter)) return false;

      if (isDesktopViewport && selectedDesktopPlace) {
        return distanceKm(pin, selectedDesktopPlace) <= LOCATION_FILTER_RADIUS_KM;
      }

      if (normalizedDesktopWhere) {
        return pin.searchText.includes(normalizedDesktopWhere);
      }

      if (normalizedMobileMapQuery) {
        const textMatch = pin.searchText.includes(normalizedMobileMapQuery);
        const placeMatch = selectedMobilePlace
          ? distanceKm(pin, selectedMobilePlace) <= LOCATION_FILTER_RADIUS_KM
          : false;

        if (!textMatch && !placeMatch) {
          return false;
        }
      } else if (pin.type === "worker" && normalizedWorkerName) {
        return pin.full_name.toLowerCase().includes(normalizedWorkerName);
      }

      return true;
    });
  }, [
    appliedDesktopWhereQuery,
    isDesktopViewport,
    isMobileViewport,
    mobileMapQuery,
    selectedDesktopPlace,
    selectedMobilePlace,
    showJobs,
    showWorkers,
    validPins,
    workerNameQuery,
    workerTypeFilter,
  ]);

  const visibleWorkerPins = useMemo(
    () => filteredPins.filter((pin): pin is WorkerPin => pin.type === "worker"),
    [filteredPins],
  );

  const visibleWorkers = useMemo(() => {
    const uniqueWorkers = new Map<string, WorkerOverviewRow>();
    for (const pin of visibleWorkerPins) {
      const worker = workerById.get(pin.id);
      if (worker && !uniqueWorkers.has(worker.worker_id)) {
        uniqueWorkers.set(worker.worker_id, worker);
      }
    }
    return Array.from(uniqueWorkers.values());
  }, [visibleWorkerPins, workerById]);

  const visibleJobPins = useMemo(
    () => filteredPins.filter((pin): pin is JobPin => pin.type === "job"),
    [filteredPins],
  );

  const resultItems = useMemo<ResultItem[]>(
    () => [
      ...visibleWorkers.map((worker) => ({
        type: "worker" as const,
        id: worker.worker_id,
        worker,
      })),
      ...visibleJobPins.map((job) => ({
        type: "job" as const,
        id: job.id,
        job,
      })),
      ...((showJobs ? state.data?.jobs_needing_location ?? [] : []).map((job) => ({
        type: "job" as const,
        id: job.id,
        job,
      }))),
    ],
    [showJobs, state.data?.jobs_needing_location, visibleJobPins, visibleWorkers],
  );

  const totalResultPages = Math.max(1, Math.ceil(resultItems.length / RESULTS_PAGE_SIZE));
  const pagedResults = useMemo(() => {
    const start = (resultsPage - 1) * RESULTS_PAGE_SIZE;
    return resultItems.slice(start, start + RESULTS_PAGE_SIZE);
  }, [resultItems, resultsPage]);

  useEffect(() => {
    setResultsPage(1);
    setSelectedPinId(null);
  }, [
    appliedDesktopWhereQuery,
    mobileMapQuery,
    selectedDesktopPlace,
    selectedMobilePlace,
    showJobs,
    showWorkers,
    workerNameQuery,
    workerTypeFilter,
  ]);

  useEffect(() => {
    setResultsPage((current) => Math.min(current, totalResultPages));
  }, [totalResultPages]);

  const selectedPin = useMemo(
    () => filteredPins.find((pin) => pin.id === selectedPinId) ?? null,
    [filteredPins, selectedPinId],
  );

  const clusters = useMemo(
    () => clusterPins(filteredPins, currentZoom),
    [filteredPins, currentZoom],
  );

  const mobileResultRows = useMemo(
    () => ({
      top: resultItems.filter((_, index) => index % 2 === 0),
      bottom: resultItems.filter((_, index) => index % 2 !== 0),
    }),
    [resultItems],
  );

  function handleDesktopWhereSearch(nextValue?: string) {
    const value = typeof nextValue === "string" ? nextValue : desktopWhereQuery;

    setAppliedDesktopWhereQuery(value.trim());
    setSelectedPinId(null);
    setResultsPage(1);
  }

  function scrollToWorkerCard(workerId: string) {
    resultRefs.current[workerId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function handlePinSelect(pin: Pin) {
    setSelectedPinId(pin.id);
    setFeedback("");

    if (pin.type === "worker") {
      scrollToWorkerCard(pin.id);
    }
  }

  function handleMobileResultSelect(item: ResultItem) {
    setSelectedPinId(item.id);
    setFeedback("");

    const mappedPin = validPins.find((pin) => pin.id === item.id && getSafeLatLng(pin));
    if (mappedPin) {
      setMobileMapOpen(true);
      return;
    }

    if (item.type === "worker") {
      setActiveWorker(item.worker);
      return;
    }

    void openJobModal(item.id);
  }

  async function openJobModal(jobId: string) {
    const fullJob = jobById.get(jobId);
    if (fullJob) {
      setActiveJob(fullJob);
    }

    const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
    const row = await response.json().catch(() => null);
    if (!response.ok || !row) {
      setFeedback("Job details are temporarily unavailable.");
      return;
    }
    if (row.job?.job_id) {
      setActiveJob((current) => ({
        ...(current ?? fullJob ?? row.job),
        ...row.job,
        matchingWorkers:
          (row.job.matchingWorkers?.length ? row.job.matchingWorkers : null) ||
          (row.job.matching_workers?.length ? row.job.matching_workers : null) ||
          (current?.matchingWorkers?.length ? current.matchingWorkers : null) ||
          (current?.matching_workers?.length ? current.matching_workers : null) ||
          (fullJob?.matchingWorkers?.length ? fullJob.matchingWorkers : null) ||
          (fullJob?.matching_workers?.length ? fullJob.matching_workers : null) ||
          [],
        matching_workers:
          (row.job.matching_workers?.length ? row.job.matching_workers : null) ||
          (row.job.matchingWorkers?.length ? row.job.matchingWorkers : null) ||
          (current?.matching_workers?.length ? current.matching_workers : null) ||
          (current?.matchingWorkers?.length ? current.matchingWorkers : null) ||
          (fullJob?.matching_workers?.length ? fullJob.matching_workers : null) ||
          (fullJob?.matchingWorkers?.length ? fullJob.matchingWorkers : null) ||
          [],
        requestedWorkforce:
          row.job.requestedWorkforce ||
          row.job.requestedWorkers ||
          row.job.requested_workers ||
          current?.requestedWorkforce ||
          current?.requestedWorkers ||
          current?.requested_workers ||
          [],
        requestedWorkers:
          row.job.requestedWorkers ||
          row.job.requestedWorkforce ||
          row.job.requested_workers ||
          current?.requestedWorkers ||
          current?.requestedWorkforce ||
          current?.requested_workers ||
          [],
        requested_workers:
          row.job.requested_workers ||
          row.job.requestedWorkforce ||
          row.job.requestedWorkers ||
          current?.requested_workers ||
          current?.requestedWorkforce ||
          current?.requestedWorkers ||
          [],
        client_requested_workforce:
          row.job.client_requested_workforce ||
          row.job.requestedWorkforce ||
          row.job.requestedWorkers ||
          row.job.requested_workers ||
          current?.client_requested_workforce ||
          [],
      }));
      return;
    }
    setActiveJob({
      job_id: String(row.id),
      job_title: String(row.title ?? "Job"),
      company_name: row.provider_name ?? "",
      area: row.area ?? null,
      postcode: row.postcode ?? "",
      start_date: row.starts_at ? String(row.starts_at).slice(0, 10) : "",
      start_time: row.starts_at ? String(row.starts_at).slice(11, 16) : null,
      end_time: null,
      workers_required: Number(row.headcount_required ?? 0),
      workers_confirmed: Number(row.headcount_confirmed ?? 0),
      broadcast_status: normaliseBroadcastStatus(row.broadcast_status ?? row.broadcastStatus ?? row.dispatch_status),
      payment_status: row.payment_status ?? "unpaid",
      job_status: row.job_status ?? "open",
      created_at: row.created_at ?? "",
      trade_type: row.required_role ?? row.core_role ?? null,
      skill_tags: normaliseStringList(row.selected_keywords).length
        ? normaliseStringList(row.selected_keywords)
        : normaliseStringList(row.skills_required),
      certificates_required: normaliseStringList(row.tickets_required),
      fill_status: row.fill_status ?? "Open",
      matching_workers: [],
      requestedWorkforce: row.requestedWorkforce ?? row.requested_workforce ?? row.requestedWorkers ?? row.requested_workers ?? row.client_requested_workforce ?? [],
      requestedWorkerIds: row.requestedWorkerIds ?? [],
      pay_rate: row.pay_rate ?? null,
      job_category: row.alert_type ?? null,
      alert_type: row.alert_type ?? null,
      core_role: row.core_role ?? null,
      duration: row.duration ?? null,
      end_date: row.end_date ?? null,
      pay_rate_display: row.pay_rate ? String(row.pay_rate) : null,
      duties: row.duties ?? null,
      dbs_requirement: row.dbs_requirement ?? null,
      ipaf_required: row.ipaf_required ?? null,
      own_tools_required: row.own_tools_required ?? null,
      ppe_required: row.ppe_required ?? null,
      skills_required: normaliseStringList(row.skills_required),
      shift_pattern: row.shift_pattern ?? null,
      tickets_required: normaliseStringList(row.tickets_required),
      optional_supporting_notes: row.optional_supporting_notes ?? null,
      payment_type: row.payment_type ?? null,
      invoice_status: row.invoice_status ?? "not_ready",
      invoice_send_date: row.invoice_send_date ?? null,
      invoice_due_date: row.invoice_due_date ?? null,
      invoice_last_sent_at: row.invoice_last_sent_at ?? null,
      invoice_notes: row.invoice_notes ?? null,
    });
  }

  function renderMapCanvas() {
    return (
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className={styles.mapRoot}
      >
        <TileLayer
          attribution={CARTO_ATTRIBUTION}
          url={CARTO_POSITRON_TILE_URL}
        />
        <MapZoomSync onZoomChange={setCurrentZoom} />
        <FitMapBounds pins={filteredPins} />
        <FlyToPin target={selectedPin} />
        <FlyToPlace target={isDesktopViewport ? selectedDesktopPlace : selectedMobilePlace} />
        {clusters.map((cluster) => {
          if (cluster.count === 1) {
            const pin = cluster.items[0];
            const active = pin.id === selectedPinId || pin.id === hoveredPinId;
            const workerRecord = pin.type === "worker" ? workerById.get(pin.id) ?? null : null;
            return (
              <Marker
                key={`${pin.type}-${pin.id}`}
                position={[pin.latitude, pin.longitude]}
                icon={createPinIcon(pin.type, active)}
                eventHandlers={{
                  click: (event) => {
                    handlePinSelect(pin);
                    event.target.openPopup?.();
                  },
                }}
              >
                {pin.type === "job" && pin.id === selectedPinId ? (
                  <AutoOpenPopup>
                    <JobPopupCard job={pin} />
                  </AutoOpenPopup>
                ) : pin.type === "job" ? (
                  <Popup>
                    <JobPopupCard job={pin} />
                  </Popup>
                ) : pin.id === selectedPinId ? (
                  <AutoOpenPopup>
                    <WorkerPopupCard
                      worker={pin}
                      onViewProfile={workerRecord ? () => setActiveWorker(workerRecord) : undefined}
                    />
                  </AutoOpenPopup>
                ) : (
                  <Popup>
                    <WorkerPopupCard
                      worker={pin}
                      onViewProfile={workerRecord ? () => setActiveWorker(workerRecord) : undefined}
                    />
                  </Popup>
                )}
              </Marker>
            );
          }

          return (
            <Marker
              key={cluster.id}
              position={[cluster.latitude, cluster.longitude]}
              icon={makeClusterIcon(cluster.type, cluster.count)}
              eventHandlers={{
                click: (event) => {
                  const safeLatLng = getSafeLatLng(cluster);
                  if (!safeLatLng) return;
                  event.target._map.flyTo(safeLatLng, Math.max(currentZoom + 2, 12), {
                    duration: 0.55,
                  });
                  event.target.openPopup?.();
                },
              }}
            >
              <Popup>
                <div style={{ minWidth: 220, display: "grid", gap: "0.5rem" }}>
                  <strong>
                    {cluster.count} {cluster.type === "job" ? "job" : "worker"} pin{cluster.count === 1 ? "" : "s"} in this area
                  </strong>
                  <div style={{ display: "grid", gap: "0.35rem" }}>
                    {cluster.items.slice(0, 6).map((item) => (
                      <button
                        key={`${cluster.id}-${item.id}`}
                        type="button"
                        onClick={() => {
                          handlePinSelect(item);
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    );
  }

  function renderMobileResultCard(item: ResultItem) {
    if (item.type === "job") {
      const location = item.job.location_display ?? ([item.job.area, item.job.postcode].filter(Boolean).join(" ") || "Location TBC");
      const broadcastStatusLabel = BROADCAST_STATUS_LABELS[normaliseBroadcastStatus(item.job.broadcast_status)] || item.job.job_status;
      return (
        <button
          key={`mobile-job-${item.id}`}
          type="button"
          className={styles.mobileResultCard}
          onClick={() => handleMobileResultSelect(item)}
        >
          <div className={`${styles.mobileResultImage} ${styles.mobileJobImage}`}>
            <span>Job</span>
          </div>
          <div className={styles.mobileResultBody}>
            <span className={styles.mobileResultTitle}>{item.job.title}</span>
            <span className={styles.mobileResultMeta}>{item.job.required_role || "General workforce"}</span>
            <span className={styles.mobileResultMeta}>{location}</span>
            <span className={styles.mobileResultTag}>{broadcastStatusLabel}</span>
          </div>
        </button>
      );
    }

    const worker = item.worker;
    const displayName = getSafeWorkerDisplayName(worker, user?.role);
    const grouping = getWorkerDisplayGrouping(worker);
    const locationLabel = getProviderFacingLocationLabel(worker);
    const imageUrl = getWorkerCardImage(worker);
    const completedJobs = worker.statHubMeta.verifiedCompletedJobsCount ?? worker.completed_jobs_count ?? 0;

    return (
      <button
        key={`mobile-worker-${worker.worker_id}`}
        type="button"
        className={styles.mobileResultCard}
        onClick={() => handleMobileResultSelect(item)}
      >
        <img
          src={imageUrl}
          alt={displayName}
          loading="lazy"
          className={styles.mobileResultImage}
        />
        <div className={styles.mobileResultBody}>
          <span className={styles.mobileResultTitle}>{displayName}</span>
          <span className={styles.mobileResultMeta}>{grouping.detailValue}</span>
          <span className={styles.mobileResultMeta}>{locationLabel || "Area withheld"}</span>
          <span className={styles.mobileResultTag}>{completedJobs} completed</span>
        </div>
      </button>
    );
  }

  function renderMobileLoadingState() {
    return (
      <div className={styles.mobileLoadingState} aria-label="Loading operations map">
        <div className={styles.mobileTop}>
          <Skeleton loading height="150px" width="100%">
            <div className={styles.mobileMapPreview} />
          </Skeleton>
          <div className={styles.mobileControls}>
            <Skeleton loading height="64px" width="100%">
              <div className={styles.mobileSelectWrap} />
            </Skeleton>
            <div className={styles.mobileLegend}>
              <Skeleton loading height="28px" width="92px" />
              <Skeleton loading height="28px" width="72px" />
            </div>
          </div>
        </div>
        <div className={styles.mobileResultsGrid}>
          <div className={styles.mobileCarouselRow} aria-label="Loading map results row 1">
            {[0, 1].map((index) => (
              <div key={`mobile-result-skeleton-top-${index}`} className={styles.mobileResultCard}>
                <Skeleton loading height="132px" width="100%" />
                <div className={styles.mobileResultBody}>
                  <Skeleton loading height="16px" width="78%" />
                  <Skeleton loading height="13px" width="62%" />
                  <Skeleton loading height="13px" width="52%" />
                </div>
              </div>
            ))}
          </div>
          <div className={styles.mobileCarouselRow} aria-label="Loading map results row 2">
            {[0, 1].map((index) => (
              <div key={`mobile-result-skeleton-bottom-${index}`} className={styles.mobileResultCard}>
                <Skeleton loading height="132px" width="100%" />
                <div className={styles.mobileResultBody}>
                  <Skeleton loading height="16px" width="72%" />
                  <Skeleton loading height="13px" width="58%" />
                  <Skeleton loading height="13px" width="46%" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className={`${styles.section} rd-operations-section`}>
      <div className={`${styles.header} rd-operations-header`}>
        <div>
          <h2 className={`${styles.title} rd-operations-title`}>Operations Map</h2>
          <p className={`rd-operations-description ${styles.desktopOperationsDescription}`}>
            Provider-scoped workforce discovery with image-led results on one side and a live operational map on the other.
          </p>
          <div className={styles.mobileOperationsDescription}>
            <Callout.Root
              color="gray"
              variant="surface"
              size="2"
              className={`${styles.operationsMapCallout} mobile-info-callout`}
            >
              <Callout.Icon>
                <InfoCircledIcon />
              </Callout.Icon>
              <Callout.Text>
                Provider-scoped workforce discovery with image-led results on one side and a live operational map on the other.
              </Callout.Text>
            </Callout.Root>
          </div>
        </div>
      </div>

      {feedback ? <div className={styles.infoBanner}>{feedback}</div> : null}
      {state.error ? <div className={styles.infoBanner}>{state.error}</div> : null}
      {state.loading ? <div className={styles.infoBanner}>Loading map data…</div> : null}
      {state.data?.message ? <p className={styles.helperText}>{state.data.message}</p> : null}
      {state.loading ? renderMobileLoadingState() : null}

      {!state.loading && !state.error && state.data ? (
        <>
        {!isMobileViewport ? (
        <div className="rd-operations-grid">
          <div className="rd-operations-map-column">
            <div className="rd-operations-map-wrap rd-mini-map-shell">
              <div className={`${styles.mapFrame} rd-home-surface-transparent`}>
                <div className={styles.mapCanvas}>
                  {renderMapCanvas()}
                </div>
              </div>
            </div>
            <div className={styles.mapMetaPanel}>
              <span>Visible pins: {filteredPins.length}</span>
              <span>Missing coordinates: {state.data.missing_coordinates.jobs} job(s), {state.data.missing_coordinates.workers} worker(s)</span>
            </div>
            <div className={styles.desktopToggleRow}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={showWorkers}
                  onChange={(event) => {
                    setShowWorkers(event.target.checked);
                    setResultsPage(1);
                  }}
                  className={styles.toggleInput}
                />
                <span className={`${styles.legendDot} ${styles.workerDot}`} />
                Workers
              </label>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={showJobs}
                  onChange={(event) => {
                    setShowJobs(event.target.checked);
                    setResultsPage(1);
                  }}
                  className={styles.toggleInput}
                />
                <span className={`${styles.legendDot} ${styles.jobDot}`} />
                Jobs
              </label>
            </div>
          </div>

          <div className="rd-operations-controls-column rd-map-controls-shell">
            <div className="rd-desktop-map-controls">
              <div className={`${styles.workerGroupSelect} rd-field`} ref={workerGroupMenuRef}>
                <span className="rd-field-label">Type</span>
                <button
                  type="button"
                  className={styles.workerGroupButton}
                  aria-haspopup="listbox"
                  aria-expanded={workerGroupMenuOpen}
                  onClick={() => setWorkerGroupMenuOpen((current) => !current)}
                >
                  <span>{getWorkerGroupLabel(workerTypeFilter)}</span>
                  <span className={styles.workerGroupChevron} aria-hidden="true" />
                </button>
                {workerGroupMenuOpen ? (
                  <div className={styles.workerGroupMenu} role="listbox">
                    {WORKER_GROUP_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={workerTypeFilter === option.value}
                        className={styles.workerGroupOption}
                        onClick={() => {
                          setWorkerTypeFilter(option.value);
                          setResultsPage(1);
                          setWorkerGroupMenuOpen(false);
                        }}
                      >
                        {workerTypeFilter === option.value ? <span aria-hidden="true">✓</span> : <span />}
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <label className="rd-field rd-desktop-where-field rd-desktop-only">
                <span className="rd-field-label">Where?</span>
                <div className="rd-desktop-where-search">
                  <div className={styles.locationWrap}>
                    <GooglePlacesAutocomplete
                      label="Where"
                      hideLabel
                      value={desktopWhereQuery}
                      placeholder="Town, area, or postcode"
                      onChange={(value) => {
                        setDesktopWhereQuery(value);
                        setSelectedDesktopPlace(null);
                      }}
                      onSelect={(suggestion) => {
                        const nextValue = suggestion.locationLabel || suggestion.display;
                        setSelectedDesktopPlace(suggestion);
                        setDesktopWhereQuery(nextValue);
                        setAppliedDesktopWhereQuery(nextValue);
                        setSelectedPinId(null);
                        setResultsPage(1);
                      }}
                      inputStyle={{
                        width: "100%",
                        minHeight: "2.55rem",
                        border: "none",
                        borderRadius: 0,
                        background: "transparent",
                        color: "var(--rd-input-text)",
                        padding: "0.62rem 0.75rem 0.62rem 2rem",
                        fontSize: "0.88rem",
                        lineHeight: 1.2,
                        boxShadow: "none",
                      }}
                    />
                  </div>

                  <button
                    className="rd-button rd-desktop-where-button"
                    type="button"
                    onClick={() => handleDesktopWhereSearch()}
                  >
                    Search
                  </button>
                </div>
              </label>
            </div>
          </div>
        </div>
        ) : null}

        {isMobileViewport ? (
        <div className={styles.mobileTop}>
          <div className={styles.mobileMapPreview}>
            <div className={styles.mobileMapPreviewInner}>
              {renderMapCanvas()}
            </div>
            <button
              type="button"
              className={styles.mobileShowMapButton}
              onClick={() => setMobileMapOpen(true)}
              aria-label="Show full operations map"
            >
              Show on map
            </button>
          </div>

          <div className={styles.mobileControls}>
            <div className={styles.mobileTypeSelectWrapper}>
              <Select.Root
                value={workerTypeFilter || MOBILE_ALL_WORKER_GROUP_VALUE}
                onValueChange={(value) => {
                  setWorkerTypeFilter(value === MOBILE_ALL_WORKER_GROUP_VALUE ? "" : value);
                  setResultsPage(1);
                }}
              >
                <Select.Trigger
                  aria-label="Filter operations map by workforce type"
                  className={styles.mobileTypeSelectTrigger}
                  placeholder="Select Tradesman or Contractor"
                />
                <Select.Content position="popper">
                  {WORKER_GROUP_OPTIONS.map((option) => (
                    <Select.Item
                      key={option.value || MOBILE_ALL_WORKER_GROUP_VALUE}
                      value={option.value || MOBILE_ALL_WORKER_GROUP_VALUE}
                    >
                      {option.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
            <Flex align="center" gap="4" className={styles.mobileLegend}>
              <Text as="label" size="2" className={styles.legendItem}>
                <Flex as="span" align="center" gap="2">
                  <Checkbox
                    checked={showWorkers}
                    onCheckedChange={(checked) => {
                      setShowWorkers(checked === true);
                      setResultsPage(1);
                    }}
                    color="blue"
                    variant="soft"
                    size="2"
                  />
                  <span className={`${styles.legendDot} ${styles.workerDot}`} />
                  Workers
                </Flex>
              </Text>
              <Text as="label" size="2" className={styles.legendItem}>
                <Flex as="span" align="center" gap="2">
                  <Checkbox
                    checked={showJobs}
                    onCheckedChange={(checked) => {
                      setShowJobs(checked === true);
                      setResultsPage(1);
                    }}
                    color="red"
                    variant="soft"
                    size="2"
                  />
                  <span className={`${styles.legendDot} ${styles.jobDot}`} />
                  Jobs
                </Flex>
              </Text>
            </Flex>
          </div>
        </div>
        ) : null}

        <div className={styles.splitLayout}>
          <div className={`${styles.resultsColumn} rd-map-results-shell`}>
            <div className={styles.resultsHeader}>
              <div>
                <h3 className={styles.resultsTitle}>Map Results</h3>
                <p className={styles.resultSubtitle}>
                  {visibleWorkers.length} worker result{visibleWorkers.length === 1 ? "" : "s"} • {filteredPins.filter((pin) => pin.type === "job").length} job pin{filteredPins.filter((pin) => pin.type === "job").length === 1 ? "" : "s"}
                  {state.data.missing_coordinates.jobs ? ` • ${state.data.missing_coordinates.jobs} need location confirmation` : ""}
                </p>
              </div>
            </div>

            {resultItems.length === 0 ? (
              <div className={styles.emptyState}>
                <strong>No map results match the current filters.</strong>
                <span>Try widening the search or toggling jobs and workforce visibility.</span>
              </div>
            ) : (
              <>
                <div className={styles.mobileResultsGrid}>
                  <div className={styles.mobileCarouselRow} aria-label="Map results row 1">
                    {mobileResultRows.top.map((item) => renderMobileResultCard(item))}
                  </div>
                  {mobileResultRows.bottom.length > 0 ? (
                    <div className={styles.mobileCarouselRow} aria-label="Map results row 2">
                      {mobileResultRows.bottom.map((item) => renderMobileResultCard(item))}
                    </div>
                  ) : null}
                </div>
                <div className={`${styles.resultsGrid} rd-map-results-grid`}>
                  {pagedResults.map((item) =>
                    item.type === "worker" ? (
                      <div
                        key={`worker-${item.worker.worker_id}`}
                        ref={(node) => { resultRefs.current[item.worker.worker_id] = node; }}
                      >
                        <OperationalMapWorkerCard
                          worker={item.worker}
                          role={user?.role}
                          selected={selectedPinId === item.worker.worker_id}
                          onSelect={() => {
                            setSelectedPinId(item.worker.worker_id);
                            setFeedback("");
                          }}
                          onHover={() => setHoveredPinId(item.worker.worker_id)}
                          onLeave={() => setHoveredPinId((current) => (current === item.worker.worker_id ? null : current))}
                        />
                      </div>
                    ) : (
                      <JobResultCard
                        key={`job-${item.job.id}`}
                        job={item.job}
                        selected={selectedPinId === item.job.id}
                        onSelect={() => {
                          setSelectedPinId(item.job.id);
                          setFeedback("");
                          void openJobModal(item.job.id);
                        }}
                      />
                    ),
                  )}
                </div>
                {totalResultPages > 1 ? (
                  <div className={styles.paginationBar} aria-label="Map results pagination">
                    <span>
                      Page {resultsPage} of {totalResultPages}
                    </span>
                    <div className={styles.paginationActions}>
                      <button
                        type="button"
                        onClick={() => setResultsPage((current) => Math.max(1, current - 1))}
                        disabled={resultsPage === 1}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setResultsPage((current) => Math.min(totalResultPages, current + 1))}
                        disabled={resultsPage === totalResultPages}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
        </>
      ) : null}

      {mobileMapOpen && state.data ? (
        <div className={styles.mobileMapOverlay} role="dialog" aria-modal="true" aria-label="Operations map">
          <div className={styles.mobileMapOverlayHeader}>
            <strong>Operations Map</strong>
            <IconButton
              onClick={() => setMobileMapOpen(false)}
              aria-label="Close operations map"
              className={styles.mobileMapCloseButton}
              variant="soft"
              radius="full"
              size="2"
            >
              <Cross2Icon />
            </IconButton>
          </div>
          <div className={styles.mobileMapOverlayBody}>
            {renderMapCanvas()}
          </div>
        </div>
      ) : null}

      <WorkerProfileModal
        open={Boolean(activeWorker)}
        worker={activeWorker}
        onClose={() => setActiveWorker(null)}
        mode={isJobProvider ? "job_provider" : "admin"}
      />
      <JobDetailModal
        open={Boolean(activeJob)}
        job={activeJob}
        onClose={() => setActiveJob(null)}
        mode={isJobProvider ? "job_provider" : "admin"}
      />
    </section>
  );
}
