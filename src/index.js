export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;
    const cache = caches.default;

    // Kunci Cache berdasarkan URL (biar genre romance gak ketuker sama thriller)
    const cacheKey = new Request(url.toString(), request);

    // 1. Cek lemari simpenan (Cache) dulu bos
    let response = await cache.match(cacheKey);
    if (response) {
      console.log("Ambil dari lemari simpenan (Cache Hit)");
      return response;
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://drakor.nimegami.id/"
    };

    const BASE_TARGET = "https://drakor.nimegami.id";

    if (path === "/" || path === "/home" || path.startsWith("/genre/") || path.startsWith("/year-release/") || path === "/sedang-tayang") {
      
      let targetPath = path === "/" ? "/" : path;
      const pagePromises = [];

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

      pagesHtml.forEach(html => {
        if (html) {
          const movies = parseNimegami(html);
          allMovies = allMovies.concat(movies);
        }
      });

      const uniqueMovies = Array.from(new Map(allMovies.map(m => [m.link, m])).values());

      const result = {
        status: "success",
        total_data: uniqueMovies.length,
        pages_fetched: 10,
        cached_at: new Date().toISOString(),
        data: uniqueMovies
      };

      // 2. Bungkus hasilnya jadi Response
      response = new Response(JSON.stringify(result), {
        headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600" // Simpen di browser & edge selama 1 jam
        }
      });

      // 3. Masukin ke lemari simpenan biar akses berikutnya secepat kilat
      // Kita pake waitUntil supaya proses nyimpen gak nahan response ke user
      ctx.waitUntil(cache.put(cacheKey, response.clone()));

      return response;
    }

    // Endpoint Detail (Khusus detail link streaming)
    if (path === "/detail") {
      const targetUrl = params.get("url");
      if (!targetUrl) return new Response(JSON.stringify({ error: "No URL" }), { status: 400 });

      const res = await fetch(targetUrl, { headers });
      const html = await res.text();
      const videoMatches = html.match(/https?:\/\/[^"']+\.(?:m3u8|mp4|mkv)[^"']*/g) || [];
      
      return new Response(JSON.stringify({
        status: "success",
        streams: [...new Set(videoMatches)]
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    return new Response(JSON.stringify({ message: "Gak ada jalan bos!" }), { status: 404 });
  }
};

function parseNimegami(html) {
  const movies = [];
  const regex = /<article[^>]*>[\s\S]*?<a href="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/g;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    let title = match[3].replace(/<[^>]+>/g, '').trim();
    movies.push({
      title: title,
      link: match[1],
      img: match[2]
    });
  }
  return movies;
}
