export default {
  async fetch(request) {
    const BASE_TARGET = "https://s2.animekuindo.life";
    const url = new URL(request.url);
    let path = url.pathname;
    let finalUrl = "";

    // 1. MAPPING ENDPOINT INTI
    const endpointMap = {
      "/home": "/",
      "/schedule": "/jadwal-rilis/",
      "/latest": "/anime-terbaru/",
      "/popular": "/populer/",
      "/movie": "/movie/",
      "/batch": "/batch/"
    };

    // 2. LOGIKA PENENTUAN URL TUJUAN
    if (endpointMap[path]) {
      finalUrl = BASE_TARGET + endpointMap[path] + url.search;
    } else if (path.startsWith("/genres/")) {
      // Menangani 67 genre (Action, Adventure, dll)
      finalUrl = BASE_TARGET + path + url.search;
    } else if (path.startsWith("/season/")) {
      // Menangani Season (Winter 2026, dll)
      finalUrl = BASE_TARGET + path + url.search;
    } else if (path.startsWith("/anime/")) {
      // Menangani detail anime & streaming
      finalUrl = BASE_TARGET + path + url.search;
    } else {
      // Default fallback
      finalUrl = BASE_TARGET + path + url.search;
    }

    // 3. EKSEKUSI FETCH KE TARGET
    try {
      const response = await fetch(finalUrl, {
        method: request.method,
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile",
          "Referer": BASE_TARGET,
          "Accept": "application/json"
        }
      });

      // 4. HANDLING RESPONSE & CORS
      const results = await response.text();
      
      return new Response(results, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*", // Izinkan akses dari Web App Anda
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Cache-Control": "s-maxage=1800" // Cache 30 menit agar cepat
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({ 
        status: "error", 
        message: "Gagal terhubung ke server SankaVollerei" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};
