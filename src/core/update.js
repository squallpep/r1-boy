// Auto-update: the R1 web view caches index.html aggressively. Compare our build id with
// the server's version.json and reload on a fresh URL (?v=build) when a newer build exists.
export const BUILD = __BUILD__;

export async function checkUpdate() {
  if (import.meta.env.DEV) return;
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    const { build } = await r.json();
    if (build && build !== BUILD) {
      const url = new URL(location.href);
      if (url.searchParams.get('v') === build) return; // already tried, avoid a reload loop
      url.searchParams.set('v', build);
      location.replace(url.toString());
    }
  } catch {}
}
