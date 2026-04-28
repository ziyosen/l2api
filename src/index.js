export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://drakor.nimegami.id/"
    };

    const BASE_TARGET = "https://drakor.nimegami.id";

    // ENDPOINT UTAMA (Home, Genre, Year, Sedang Tayang)
    if (path === "/" || path === "/home" || path.startsWith("/genre/") || path.startsWith("/year-release/") || path === "/sedang-tayang") {
      let targetPath = path === "/" ? "/" : path;
      const pagePromises = [];

      // Tarik 10 Halaman
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

      const uniqueMovies = Array.from(new Map(allMovies.map(m => [m.link, m])).values());

      return new Response(JSON.stringify({
        status: "success",
        total_data: uniqueMovies.length,
        data: uniqueMovies
      }), {
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*" 
        }
      });
    }

    // ENDPOINT DETAIL (Cari Link Video)
    if (path === "/detail") {
      const targetUrl = params.get("url");
      if (!targetUrl) return new Response(JSON.stringify({ error: "No URL" }), { status: 400 });

      try {
        const res = await fetch(targetUrl, { headers });
        const html = await res.text();
        
        let streams = [];
        
        // 1. Cari IFRAME (Ini yang paling sering ada isinya)
        const iframeMatches = html.match(/<iframe[^>]+src="([^"]+)"/gi);
        if (iframeMatches) {
            iframeMatches.forEach(ifr => {
                const src = ifr.match(/src="([^"]+)"/i);
                if (src && !src[1].includes('facebook') && !src[1].includes('twitter')) {
                    streams.push(src[1]);
                }
            });
        }

        // 2. Cari link mentah (m3u8/mp4)
        const fileMatches = html.match(/https?:\/\/[^"']+\.(?:m3u8|mp4|mkv)[^"']*/g) || [];
        fileMatches.forEach(s => streams.push(s));

        // 3. Cari link player/embed
        const playerMatches = html.match(/https?:\/\/(?:p2p|nyamnyam|stream|player|embed|vipanel)[^"']+/g) || [];
        playerMatches.forEach(s => streams.push(s));

        return new Response(JSON.stringify({
          status: "success",
          streams: [...new Set(streams)]
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Gagal ambil detail" }), { status: 500 });
      }
    }

    return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
  }
};

function parseNimegami(html) {
  const movies = [];
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
