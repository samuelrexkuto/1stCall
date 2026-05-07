"use client";

import { useState } from "react";
import {
  GooglePlacesAutocomplete,
  type GooglePlaceSuggestion,
  type GooglePlacesStatus,
} from "@/components/forms/GooglePlacesAutocomplete";
import { formatLocationLabel, hasValidCoordinates } from "@/lib/location";

export interface EditableResolvedLocation {
  location_text: string;
  location_display: string;
  location_query: string;
  formatted_address: string;
  place_id: string;
  postcode: string;
  locality: string;
  administrative_area: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export type LocationInputState = "empty" | "typing" | "resolved" | "saved";

export function mapGooglePlaceToEditableLocation(
  suggestion: GooglePlaceSuggestion,
  rawInput?: string,
): EditableResolvedLocation {
  return {
    location_text: rawInput?.trim() || suggestion.display,
    location_display: suggestion.locationLabel || formatLocationLabel({ formatted_address: suggestion.formattedAddress }) || "",
    location_query: suggestion.formattedAddress,
    formatted_address: suggestion.formattedAddress,
    place_id: suggestion.placeId,
    postcode: suggestion.postcode ?? "",
    locality: suggestion.locality ?? "",
    administrative_area: suggestion.administrativeArea ?? "",
    country: suggestion.country ?? "",
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
  };
}

export function createEmptyEditableLocation(rawText = ""): EditableResolvedLocation {
  return {
    location_text: rawText,
    location_display: rawText,
    location_query: "",
    formatted_address: "",
    place_id: "",
    postcode: "",
    locality: "",
    administrative_area: "",
    country: "",
    latitude: null,
    longitude: null,
  };
}

export function LocationAutocompleteInput({
  label,
  value,
  location,
  onInputChange,
  onLocationSelect,
  helperText,
  error,
  state,
}: {
  label: string;
  value: string;
  location: EditableResolvedLocation;
  onInputChange: (value: string) => void;
  onLocationSelect: (next: EditableResolvedLocation) => void;
  helperText?: string;
  error?: string;
  state: LocationInputState;
}) {
  const [googleStatus, setGoogleStatus] = useState<GooglePlacesStatus>({
    state: "idle",
    message: "",
  });
  const confirmed = Boolean(location.place_id) || hasValidCoordinates(location);
  const hasTypedValue = value.trim().length > 0;
  const serviceUnavailable = googleStatus.state === "error" || googleStatus.state === "missing_key";
  const showServiceError =
    serviceUnavailable &&
    state !== "saved" &&
    hasTypedValue &&
    !confirmed;
  const panelAccent = showServiceError
    ? {
        background: "var(--rd-control-bg)",
        border: "1px solid var(--rd-border)",
        color: "var(--rd-text-muted)",
      }
    : state === "saved"
      ? {
          background: "var(--rd-accent-soft)",
          border: "1px solid var(--rd-border)",
          color: "var(--rd-accent-text)",
        }
      : state === "resolved"
        ? {
            background: "var(--rd-accent-soft)",
            border: "1px solid var(--rd-border)",
            color: "var(--rd-accent-text)",
          }
        : hasTypedValue
          ? {
              background: "var(--rd-control-bg)",
              border: "1px solid var(--rd-border)",
              color: "var(--rd-text-muted)",
            }
          : {
              background: "var(--rd-control-bg)",
              border: "1px solid var(--rd-border)",
              color: "var(--rd-text-muted)",
            };

  const heading =
    state === "saved"
      ? "Saved location loaded"
      : showServiceError
        ? "Manual address entry enabled"
        : state === "resolved"
          ? "Location confirmed"
          : state === "typing"
            ? "Location unresolved"
          : "Start typing to confirm a map location";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <GooglePlacesAutocomplete
        label={label}
        value={value}
        onChange={onInputChange}
        onSelect={(suggestion) => onLocationSelect(mapGooglePlaceToEditableLocation(suggestion, value))}
        placeholder="Search by address, postcode, area, town, or place name"
        error={error}
        helperText={helperText}
        onStatusChange={setGoogleStatus}
      />

      <div style={{ ...panelAccent, borderRadius: 16, padding: "14px 16px", fontSize: 14 }}>
        <div style={{ fontWeight: 700 }}>{heading}</div>
        {state === "saved" ? (
          <div style={{ marginTop: 6 }}>Saved coordinates are loaded from this record. They will be preserved unless you change the location.</div>
        ) : null}
        {showServiceError ? <div style={{ marginTop: 6 }}>{googleStatus.message}</div> : null}
        {confirmed ? <div style={{ marginTop: 6 }}>Coordinates captured: {location.latitude?.toFixed(5)}, {location.longitude?.toFixed(5)}</div> : null}
        {location.formatted_address ? <div style={{ marginTop: 6 }}>Formatted address: {location.formatted_address}</div> : null}
        {(location.locality || location.postcode) ? (
          <div style={{ marginTop: 6 }}>
            Area: {location.locality || location.administrative_area || "-"} | Postcode: {location.postcode || "-"}
          </div>
        ) : null}
        {state === "typing" ? (
          <div style={{ marginTop: 6 }}>
            {serviceUnavailable
              ? "Enter the best full address you can. We will save it and verify the map pin separately."
              : "Please select a suggested location to map this correctly."}
          </div>
        ) : null}
        {!confirmed && hasTypedValue ? (
          <div style={{ marginTop: 6 }}>
            {serviceUnavailable
              ? "You can continue without suggestions. This address may need manual review before it appears on the map."
              : "This record will not appear on the map until location is confirmed. Manual text will be saved as unresolved only."}
          </div>
        ) : null}
      </div>
    </div>
  );
}
