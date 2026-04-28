export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://drakor.nimegami.id/"
    };

    // Base URL Target
    const BASE_TARGET = "https://drakor.nimegami.id";

    // ENDPOINT UTAMA
    if (path === "/" || path === "/home" || path.startsWith("/genre/") || path.startsWith("/year-release/") || path === "/sedang-tayang") {
      
      // Tentukan target path berdasarkan endpoint yang dipanggil
      let targetPath = path === "/" ? "/" : path;
      
      const pagePromises = [];
      // Ambil 5 halaman koleksi
      for (let i = 1; i <= 5; i++) {
        // Nimegami biasanya pakai format /page/2/ atau ?page=2
        const separator = targetPath.includes('?') ? '&' : '/';
        const pagePath = i === 1 ? targetPath : `${targetPath}${separator}page/${i}/`.replace(/\/+/g, '/');
        
        pagePromises.push(
          fetch(`${BASE_TARGET}${pagePath}`, { headers })
            .then(res => res.text())
            .catch(() => "")
        );
      }

      const pagesHtml = await Promise.all(pagePromises);
      let allMovies = [];

      pagesHtml.forEach(html => {
        if (html) {
          const movies = parseNimegami(html, BASE_TARGET);
          allMovies = allMovies.concat(movies);
        }
      });

      return new Response(JSON.stringify({
        status: "success",
        total_data: allMovies.length,
        endpoint: path,
        data: allMovies
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // ENDPOINT DETAIL (Ambil Link Video)
    if (path === "/detail") {
      const targetUrl = params.get("url");
      if (!targetUrl) return new Response(JSON.stringify({ error: "No URL" }), { status: 400 });

      const res = await fetch(targetUrl, { headers });
      const html = await res.text();
      
      // Scraper link video (m3u8/mp4)
      const videoMatches = html.match(/https?:\/\/[^"']+\.(?:m3u8|mp4|mkv)[^"']*/g) || [];
      
      return new Response(JSON.stringify({
        status: "success",
        streams: [...new Set(videoMatches)]
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    return new Response(JSON.stringify({ message: "Gak ada endpoint itu bos!" }), { status: 404 });
  }
};

// FUNGSI SCRAPER KHUSUS NIMEGAMI
function parseNimegami(html, base) {
  const movies = [];
  // Struktur Nimegami biasanya pakai article atau div class 'archive-post'
  // Regex ini mencari link, gambar, dan judul
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
