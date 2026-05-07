"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { loadPlacesLibrary } from "@/lib/googleMapsLoader";

export type ResolvedLocation = {
  locationText: string;
  formattedAddress?: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  postcode?: string | null;
  locality?: string | null;
  administrativeArea?: string | null;
  country?: string | null;
  resolved: boolean;
};

type Props = {
  value: string;
  onChange: (value: ResolvedLocation) => void;
  placeholder?: string;
  className?: string;
  inputStyle?: CSSProperties;
  showStatusMessages?: boolean;
  onStatusChange?: (status: { state: "idle" | "loading" | "ready" | "error"; message: string }) => void;
};

function getAddressComponent(
  components:
    | Array<{
        long_name?: string;
        types?: string[];
      }>
    | undefined,
  type: string,
) {
  return components?.find((component) => component.types?.includes(type))?.long_name ?? null;
}

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder = "Enter job location",
  className,
  inputStyle,
  showStatusMessages = true,
  onStatusChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  const listenerRef = useRef<{ remove: () => void } | null>(null);
  const onChangeRef = useRef(onChange);
  const onStatusChangeRef = useRef(onStatusChange);
  const suppressNextManualChangeRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorText, setErrorText] = useState<string>("");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        setStatus("error");
        setErrorText("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
        onStatusChangeRef.current?.({
          state: "error",
          message: "Google location search is unavailable right now.",
        });
        return;
      }

      if (!inputRef.current) return;

      try {
        setStatus("loading");
        onStatusChangeRef.current?.({ state: "loading", message: "Loading address suggestions…" });
        const { google } = await loadPlacesLibrary(apiKey);

        if (!mounted || !inputRef.current) return;

        autocompleteRef.current = new (google as any).maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "geometry", "name", "place_id", "address_components"],
          types: ["geocode"],
        });

        listenerRef.current?.remove();
        listenerRef.current = autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current?.getPlace();
          const formatted =
            place?.formatted_address ||
            place?.name ||
            inputRef.current?.value ||
            "";

          const lat = place?.geometry?.location?.lat?.() ?? null;
          const lng = place?.geometry?.location?.lng?.() ?? null;
          const placeId = place?.place_id ?? null;
          const resolved = Boolean(placeId && lat != null && lng != null);
          const components = place?.address_components;
          const postcode =
            getAddressComponent(components, "postal_code") ??
            getAddressComponent(components, "postal_code_prefix");
          const locality =
            getAddressComponent(components, "postal_town") ??
            getAddressComponent(components, "locality") ??
            getAddressComponent(components, "administrative_area_level_2");
          const administrativeArea =
            getAddressComponent(components, "administrative_area_level_2") ??
            getAddressComponent(components, "administrative_area_level_1") ??
            locality;
          const country = getAddressComponent(components, "country");

          suppressNextManualChangeRef.current = true;
          onChangeRef.current({
            locationText: formatted,
            formattedAddress: place?.formatted_address ?? formatted,
            placeId,
            latitude: lat,
            longitude: lng,
            postcode,
            locality,
            administrativeArea,
            country,
            resolved,
          });
        });

        setStatus("ready");
        onStatusChangeRef.current?.({
          state: "ready",
          message: "Search and select a real place suggestion to confirm this location.",
        });
      } catch (err) {
        setStatus("error");
        const nextMessage = err instanceof Error
          ? err.message
          : "Google location search is unavailable right now.";
        setErrorText(nextMessage);
        onStatusChangeRef.current?.({ state: "error", message: nextMessage });
      }
    }

    void init();

    return () => {
      mounted = false;
      listenerRef.current?.remove();
      onStatusChangeRef.current?.({ state: "idle", message: "" });
    };
  }, []);

  return (
    <div>
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        className={className}
        style={inputStyle}
        autoComplete="off"
        onChange={(e) => {
          if (suppressNextManualChangeRef.current) {
            suppressNextManualChangeRef.current = false;
            return;
          }

          onChange({
            locationText: e.target.value,
            formattedAddress: null,
            placeId: null,
            latitude: null,
            longitude: null,
            postcode: null,
            locality: null,
            administrativeArea: null,
            country: null,
            resolved: false,
          });
        }}
      />

      {showStatusMessages && status === "loading" ? (
        <p className="text-sm text-neutral-500 mt-1">Loading address suggestions…</p>
      ) : null}

      {showStatusMessages && status === "error" ? (
        <p className="text-sm text-red-600 mt-1">{errorText}</p>
      ) : null}

      {showStatusMessages && status === "ready" ? (
        <p className="text-sm text-neutral-500 mt-1">
          Search and select a real place suggestion. The selected place becomes the saved map location.
        </p>
      ) : null}
    </div>
  );
}
