"use client";

import type { CSSProperties } from "react";
import LocationAutocomplete, { type ResolvedLocation } from "@/components/LocationAutocomplete";

export interface GooglePlaceSuggestion {
  placeId: string;
  display: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  locationLabel: string;
  postcode: string | null;
  locality: string | null;
  administrativeArea: string | null;
  country: string | null;
}

export type GooglePlacesStatus =
  | { state: "idle"; message: string }
  | { state: "loading"; message: string }
  | { state: "ready"; message: string }
  | { state: "missing_key"; message: string; code?: string }
  | { state: "error"; message: string; code?: string };

interface GooglePlacesAutocompleteProps {
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  helperText?: string;
  hideLabel?: boolean;
  inputStyle?: CSSProperties;
  labelStyle?: CSSProperties;
  onChange: (value: string) => void;
  onSelect: (suggestion: GooglePlaceSuggestion) => void;
  onStatusChange?: (status: GooglePlacesStatus) => void;
}

function toSuggestion(location: ResolvedLocation): GooglePlaceSuggestion | null {
  if (!location.resolved || !location.placeId || location.latitude == null || location.longitude == null) {
    return null;
  }

  return {
    placeId: location.placeId,
    display: location.formattedAddress || location.locationText,
    formattedAddress: location.formattedAddress || location.locationText,
    locationLabel: [location.locality, location.postcode].filter(Boolean).join(" ") || location.locationText,
    latitude: location.latitude,
    longitude: location.longitude,
    postcode: location.postcode ?? null,
    locality: location.locality ?? null,
    administrativeArea: location.administrativeArea ?? null,
    country: location.country ?? null,
  };
}

export function GooglePlacesAutocomplete({
  label,
  value,
  placeholder,
  error,
  helperText,
  hideLabel = false,
  inputStyle,
  labelStyle,
  onChange,
  onSelect,
  onStatusChange,
}: GooglePlacesAutocompleteProps) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      {!hideLabel ? (
        <span style={{ color: "var(--rd-text)", fontSize: 14, fontWeight: 600, ...labelStyle }}>{label}</span>
      ) : null}
      <LocationAutocomplete
        value={value}
        placeholder={placeholder}
        className=""
        inputStyle={{
          width: "100%",
          border: "1px solid var(--rd-border)",
          borderRadius: 14,
          background: "var(--rd-input-bg)",
          color: "var(--rd-input-text)",
          padding: "15px 16px",
          fontSize: 15,
          boxShadow: "none",
          ...inputStyle,
        }}
        showStatusMessages={false}
        onStatusChange={(status) => {
          if (status.state === "error") {
            const missingKey = !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
            onStatusChange?.({
              state: missingKey ? "missing_key" : "error",
              message: "Address suggestions are unavailable right now. You can still enter the full address manually.",
              code: missingKey ? "MISSING_API_KEY" : "GOOGLE_PLACES_ERROR",
            });
            return;
          }

          onStatusChange?.(status);
        }}
        onChange={(location) => {
          onChange(location.locationText);

          if (location.resolved) {
            const suggestion = toSuggestion(location);
            if (suggestion) {
              onStatusChange?.({
                state: "ready",
                message: "Location confirmed from Google suggestions.",
              });
              onSelect(suggestion);
            }
          }
        }}
      />
      {helperText ? (
        <span style={{ display: "block", color: "var(--rd-text-muted)", fontSize: 13 }}>{helperText}</span>
      ) : null}
      {error ? (
        <span style={{ display: "block", color: "#dc2626", fontSize: 13 }}>{error}</span>
      ) : null}
    </label>
  );
}
