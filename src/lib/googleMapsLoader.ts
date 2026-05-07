type GoogleMapsGlobal = {
  maps?: {
    importLibrary?: (library: string) => Promise<any>;
  };
};

let googleMapsPromise: Promise<GoogleMapsGlobal> | null = null;

declare global {
  interface Window {
    google?: GoogleMapsGlobal;
    __googleMapsInitPromise?: Promise<GoogleMapsGlobal>;
  }
}

type LoadGoogleMapsOptions = {
  apiKey: string;
  version?: string;
};

export function loadGoogleMaps({
  apiKey,
  version = "weekly",
}: LoadGoogleMapsOptions): Promise<GoogleMapsGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only be loaded in the browser."));
  }

  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google);
  }

  if (window.__googleMapsInitPromise) {
    return window.__googleMapsInitPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-google-maps-loader="true"]',
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => {
        if (window.google?.maps?.importLibrary) {
          resolve(window.google);
        } else {
          reject(new Error("Google Maps loaded but importLibrary is unavailable."));
        }
      });
      existing.addEventListener("error", () => {
        reject(new Error("Existing Google Maps script failed to load."));
      });
      return;
    }

    const callbackName = "__rdGoogleMapsLoaded";
    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      if (window.google?.maps?.importLibrary) {
        resolve(window.google);
        return;
      }

      reject(new Error("Address suggestions are unavailable right now."));
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&v=${encodeURIComponent(version)}&libraries=places&callback=${callbackName}&loading=async`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = "true";
    script.onerror = () => {
      reject(new Error("Address suggestions are unavailable right now."));
    };

    document.head.appendChild(script);
  });

  window.__googleMapsInitPromise = googleMapsPromise;
  return googleMapsPromise;
}

export async function loadPlacesLibrary(apiKey: string) {
  const googleRef = await loadGoogleMaps({ apiKey });
  if (!googleRef.maps?.importLibrary) {
    throw new Error("Address suggestions are unavailable right now.");
  }
  const placesLib = (await googleRef.maps.importLibrary("places")) as any;
  return { google: googleRef, placesLib };
}
