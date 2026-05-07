"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CARTO_ATTRIBUTION, CARTO_POSITRON_TILE_URL } from "@/lib/maps/tiles";
import styles from "./HomeMap.module.css";

type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  subtitle?: string;
  type: "job" | "worker";
};

type MarkerGroup = {
  id: string;
  lat: number;
  lng: number;
  pins: MapPin[];
  types: Array<"job" | "worker">;
};

type Props = {
  markerGroups: MarkerGroup[];
  selectedPinId: string | null;
  onSelectPin: (pinId: string | null) => void;
};

type LeafletModule = typeof import("leaflet");
type LeafletMap = import("leaflet").Map;
type LeafletMarker = import("leaflet").Marker;
type LeafletLayerGroup = import("leaflet").LayerGroup;
type LeafletLayerWithPopup = import("leaflet").Layer & {
  openPopup: () => void;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createGroupIcon(L: LeafletModule, group: MarkerGroup) {
  const background =
    group.types.length === 1
      ? group.types[0] === "job"
        ? "#ef4444"
        : "#2563eb"
      : "#0f172a";

  return L.divIcon({
    className: "custom-map-cluster",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:9999px;background:${background};color:white;border:4px solid white;box-shadow:0 10px 25px rgba(15,23,42,0.28);font-weight:700;font-size:20px;line-height:1;">${group.pins.length}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function buildPopupHtml(group: MarkerGroup) {
  const heading =
    group.pins.length > 1
      ? `<div class="${styles.popupHeading}">${group.pins.length} records at this location</div>`
      : "";

  const body = group.pins
    .map(
      (pin) => `
        <div class="${styles.popupItem}">
          <div class="${styles.popupTitle}">${escapeHtml(pin.label)}</div>
          ${
            pin.subtitle
              ? `<div class="${styles.popupSubtitle}">${escapeHtml(pin.subtitle)}</div>`
              : ""
          }
          <div class="${styles.popupType}">${escapeHtml(pin.type)}</div>
        </div>
      `,
    )
    .join("");

  return `<div class="${styles.popupBody}">${heading}<div class="${styles.popupList}">${body}</div></div>`;
}

export default function LeafletMapInner({
  markerGroups,
  selectedPinId,
  onSelectPin,
}: Props) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const layerGroupRef = useRef<LeafletLayerGroup | null>(null);
  const markerRefs = useRef<Record<string, LeafletLayerWithPopup>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [debugStage, setDebugStage] = useState("idle");
  const [mapReadyVersion, setMapReadyVersion] = useState(0);

  const safeMarkerGroups = useMemo(
    () =>
      markerGroups.filter(
        (group) =>
          typeof group.lat === "number" &&
          !Number.isNaN(group.lat) &&
          typeof group.lng === "number" &&
          !Number.isNaN(group.lng),
      ),
    [markerGroups],
  );

  useEffect(() => {
    let disposed = false;
    let timeoutId: number | null = null;

    async function initializeMap() {
      if (!mapElementRef.current || mapRef.current) return;

      try {
        setDebugStage("starting-leaflet-import");
        timeoutId = window.setTimeout(() => {
          if (disposed || mapRef.current) return;
          setStatus("error");
          setErrorMessage("Leaflet initialization timed out before the map widget mounted.");
          setDebugStage("timeout-waiting-for-leaflet");
        }, 6000);

        const L = await import("leaflet");
        if (disposed || !mapElementRef.current) return;

        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }

        setDebugStage("leaflet-imported");
        leafletRef.current = L;
        const map = L.map(mapElementRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        });

        setDebugStage("leaflet-map-created");
        L.tileLayer(CARTO_POSITRON_TILE_URL, {
          attribution: CARTO_ATTRIBUTION,
        }).addTo(map);

        setDebugStage("tile-layer-added");
        layerGroupRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        map.setView([51.5074, -0.1278], 11);

        window.setTimeout(() => {
          map.invalidateSize();
        }, 0);

        setStatus("ready");
        setErrorMessage(null);
        setDebugStage("ready");
        setMapReadyVersion((value) => value + 1);
      } catch (error) {
        if (disposed) return;
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        console.error("[LeafletMapInner] failed to initialize map", error);
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to initialize Leaflet.");
        setDebugStage("error");
      }
    }

    initializeMap();

    return () => {
      disposed = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      layerGroupRef.current?.clearLayers();
      layerGroupRef.current = null;
      markerRefs.current = {};
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !L || !layerGroup) return;

    setDebugStage("rendering-markers");
    layerGroup.clearLayers();
    markerRefs.current = {};

    if (!safeMarkerGroups.length) {
      map.setView([51.5074, -0.1278], 11);
      return;
    }

    const bounds = L.latLngBounds([]);

    for (const group of safeMarkerGroups) {
      const marker =
        group.pins.length === 1
          ? L.circleMarker([group.lat, group.lng], {
              radius: 10,
              color: "#ffffff",
              weight: 3,
              fillOpacity: 1,
              fillColor: group.pins[0].type === "job" ? "#ef4444" : "#2563eb",
            })
          : L.marker([group.lat, group.lng], {
              icon: createGroupIcon(L, group),
            });

      marker.bindPopup(buildPopupHtml(group));
      marker.on("click", () => {
        onSelectPin(group.pins[0]?.id ?? null);
      });

      marker.addTo(layerGroup);
      markerRefs.current[group.id] = marker as LeafletLayerWithPopup;
      bounds.extend([group.lat, group.lng]);
    }

    map.invalidateSize();

    const selectedGroup = selectedPinId
      ? safeMarkerGroups.find((group) => group.pins.some((pin) => pin.id === selectedPinId))
      : null;

    if (selectedGroup) {
      setDebugStage("opening-selected-marker");
      map.flyTo([selectedGroup.lat, selectedGroup.lng], Math.max(map.getZoom(), 13), {
        animate: true,
        duration: 0.45,
      });
      markerRefs.current[selectedGroup.id]?.openPopup();
      return;
    }

    if (safeMarkerGroups.length === 1) {
      setDebugStage("single-marker-view");
      map.setView([safeMarkerGroups[0].lat, safeMarkerGroups[0].lng], 13);
      markerRefs.current[safeMarkerGroups[0].id]?.openPopup();
    } else {
      setDebugStage("fitting-bounds");
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 11 });
      markerRefs.current[safeMarkerGroups[0].id]?.openPopup();
    }
  }, [mapReadyVersion, onSelectPin, safeMarkerGroups, selectedPinId]);

  return (
    <div className={styles.mapRoot}>
      <div ref={mapElementRef} className={styles.mapInnerCanvas} />
      {status === "loading" ? <div className={styles.mapLoading}>Loading map…</div> : null}
      {status === "error" ? (
        <div className={styles.mapError}>Map failed to load: {errorMessage}</div>
      ) : null}
      {process.env.NODE_ENV === "development" && status !== "ready" ? (
        <div className={styles.mapDebug}>
          <strong>Map debug</strong>
          <span>Status: {status}</span>
          <span>Stage: {debugStage}</span>
          <span>Groups: {safeMarkerGroups.length}</span>
          {errorMessage ? <span>Error: {errorMessage}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
