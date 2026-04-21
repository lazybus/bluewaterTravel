export function registerServiceWorker() {
  if (typeof window === "undefined") {
    return;
  }

  if (!("serviceWorker" in navigator)) {
    return;
  }

  void navigator.serviceWorker.register("/sw.js");
}