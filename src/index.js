export default {
  async fetch(request, ctx) { // Tambah ctx buat fitur cache
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);

    // Header biar gak dianggap bot
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://drakor.nimegami.id/"
    };

    const BASE_TARGET = "https://drakor.nimegami.id";

    // 1. CEK CACHE (Biar cepet & anti-limit)
    if (path !== "/detail") {
      let cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) return cachedResponse;
    }

    // ENDPOINT UTAMA ( / )
    if (path === "/" || path === "/home" || path.startsWith("/genre/") || path.startsWith("/year-release/") || path === "/sedang-tayang") {
      let targetPath = path === "/" ? "/" : path;
      const pagePromises = [];

      // Tarik 10 HALAMAN sekaligus
      for (let i = 1; i <= 10; i++) {
        const cleanPath = targetPath.endsWith('/') ? targetPath : `${targetPath}/`;
        const pagePath = i === 1 ? cleanPath : `${cleanPath}page/${i}/`;
        pagePromises.push(
          fetch(`${BASE_TARGET}${pagePath}`, { headers })
            .then(res => res.ok ? res.text() : "")
            .catch(() => "")
        );
      }

      const pagesHtml = await Promise.all(pagePromises);
      let allMovies = [];
      pagesHtml.forEach(html => { if (html) allMovies = allMovies.concat(parseNimegami(html)); });

      // Buang duplikat
      const uniqueMovies = Array.from(new Map(allMovies.map(m => [m.link, m])).values());

      const result = new Response(JSON.stringify({
        status: "success",
        total_data: uniqueMovies.length,
        data: uniqueMovies
      }), {
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600" 
        }
      });

      ctx.waitUntil(cache.put(cacheKey, result.clone()));
      return result;
    }

    // ENDPOINT DETAIL (INI KUNCINYA)
    if (path === "/detail") {
      const targetUrl = params.get("url");
      if (!targetUrl) return new Response("No URL", { status: 400 });

      try {
        const res = await fetch(targetUrl, { headers });
        const html = await res.text();
        
        let streams = [];
        
        // 1. Cari iframe player (Biasanya drakor nimegami pake ini)
        const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
        if (iframeMatch) streams.push(iframeMatch[1]);

        // 2. Cari link provider (nyamnyam, p2p, dll)
        const providerMatches = html.match(/https?:\/\/(?:p2p|nyamnyam|stream|player|embed)[^"']+/g) || [];
        providerMatches.forEach(s => streams.push(s));

        // 3. Cari file mentah
        const fileMatches = html.match(/https?:\/\/[^"']+\.(?:m3u8|mp4|mkv)[^"']*/g) || [];
        fileMatches.forEach(s => streams.push(s));

        return new Response(JSON.stringify({
          status: "success",
          streams: [...new Set(streams.filter(s => !s.includes('google-analytics') && !s.includes('facebook')))]
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response("Error", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};

function parseNimegami(html) {
  const movies = [];
  // Regex yang lebih akurat buat nangkep article Nimegami
  const regex = /<article[^>]*>[\s\S]*?<a href="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    movies.push({
      title: match[3].replace(/<[^>]+>/g, '').trim(),
      link: match[1],
      img: match[2]
    });
  }
  return movies;
}
