window.CARPARTS_CATALOG_CONFIG = {
  // Set this to your own secure backend endpoint, e.g. "https://api.example.com/catalog".
  // Do NOT put TecDoc/API keys in this file or in frontend JavaScript.
  baseUrl: "", // Set after deploying backend/ (Cloudflare Worker URL)
  provider: "TecDoc",
  timeoutMs: 12000
};

window.CarPartsCatalog = {
  async search(payload) {
    const cfg = window.CARPARTS_CATALOG_CONFIG || {};
    if (!cfg.baseUrl) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs || 12000);
    try {
      const response = await fetch(cfg.baseUrl.replace(/\/$/, "") + "/search", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!response.ok) throw new Error("catalog-http-" + response.status);
      const data = await response.json();
      return Array.isArray(data) ? data : (data.results || []);
    } finally {
      clearTimeout(timer);
    }
  }
};