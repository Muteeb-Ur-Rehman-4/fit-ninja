// Optional Cloudflare Worker: forwards text search to Open Food Facts and adds CORS headers.
// Deploy:  npx wrangler deploy worker/off-search-proxy.js --name fit-ninja-off --compatibility-date 2025-01-01
// Then set NEXT_PUBLIC_OFF_SEARCH_PROXY to the worker URL.
const worker = {
  async fetch(request) {
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const q = new URL(request.url).searchParams.get("q");
    if (!q || q.length < 2 || q.length > 80) return new Response('{"products":[]}', { headers: cors });
    const url =
      "https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=20" +
      "&fields=code,product_name,brands,serving_size,serving_quantity,nutriments&search_terms=" +
      encodeURIComponent(q);
    const r = await fetch(url, { headers: { "user-agent": "FitNinja/1.0 (open source calorie tracker)" } });
    return new Response(await r.text(), { status: r.status, headers: cors });
  },
};

export default worker;
