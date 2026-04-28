export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://www.dracinema.com/"
    };

    const BASE_TARGET = "https://www.dracinema.com";

    // ROUTING ENDPOINT BERDASARKAN REQUEST LU
    const routes = {
      "/collections": "/collections",
      "/romantis": "/genre/romantis",
      "/balas-dendam": "/genre/balas-dendam",
      "/aksi": "/genre/aksi",
      "/miliarder": "/genre/miliarder",
      "/18plus": "/genre/18+",
      "/ceo": "/genre/ceo",
      "/kuno": "/genre/kuno"
    };

    if (path === "/" || routes[path]) {
      let targetPath = routes[path] || "/";
      const pagePromises = [];

      // Tarik 5 halaman
      for (let i = 1; i <= 5; i++) {
        const pagePath = i === 1 ? targetPath : `${targetPath}?page=${i}`;
        pagePromises.push(
          fetch(`${BASE_TARGET}${pagePath}`, { headers }).then(res => res.text()).catch(() => "")
        );
      }

      const pagesHtml = await Promise.all(pagePromises);
      let allMovies = [];
      pagesHtml.forEach(html => { if (html) allMovies = allMovies.concat(parseDracinema(html)); });

      const uniqueMovies = Array.from(new Map(allMovies.map(m => [m.link, m])).values());

      return new Response(JSON.stringify({
        status: "success",
        total_data: uniqueMovies.length,
        data: uniqueMovies
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // ENDPOINT DETAIL (Mencoba Bypass Player)
    if (path === "/detail") {
      const targetUrl = params.get("url");
      if (!targetUrl) return new Response("{}", { status: 400 });

      try {
        const res = await fetch(targetUrl, { headers });
        const html = await res.text();
        
        let streams = [];
        // 1. Cari jalur iframe player
        const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
        if (iframeMatch) streams.push(iframeMatch[1]);

        // 2. Cari link video tersembunyi
        const rawMatches = html.match(/https?:\/\/(?:p2p|nyamnyam|embed|player|stream|vipanel|cdn|m3u8)[^"']+/gi) || [];
        rawMatches.forEach(s => streams.push(s));

        return new Response(JSON.stringify({
          status: "success",
          streams: [...new Set(streams)]
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

function parseDracinema(html) {
  const movies = [];
  // Regex untuk struktur Dracinema (biasanya menggunakan card-item atau link post)
  const regex = /<a href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  
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
