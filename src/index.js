export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    const headers = {
      // Pake User-Agent iPhone biar server Dracinema gak curiga
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      "Referer": "https://www.dracinema.com/",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
    };

    const BASE_TARGET = "https://www.dracinema.com";

    // ROUTING ENDPOINT
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
      
      try {
        const res = await fetch(`${BASE_TARGET}${targetPath}`, { headers });
        const html = await res.text();
        
        // Panggil fungsi scraper
        const allMovies = parseDracinema(html, BASE_TARGET);

        return new Response(JSON.stringify({
          status: "success",
          total_data: allMovies.length,
          endpoint: path,
          data: allMovies
        }), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*" 
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // ENDPOINT DETAIL (Cari Link Video)
    if (path === "/detail") {
      const targetUrl = params.get("url");
      if (!targetUrl) return new Response("{}", { status: 400 });

      try {
        const res = await fetch(targetUrl, { headers });
        const html = await res.text();
        
        let streams = [];
        // Cari iframe player & link streaming
        const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
        if (iframeMatch) streams.push(iframeMatch[1]);

        const rawMatches = html.match(/https?:\/\/(?:p2p|nyamnyam|embed|player|stream|cdn|m3u8|vipanel)[^"']+/gi) || [];
        rawMatches.forEach(s => {
          if(!s.includes('.js') && !s.includes('.css')) streams.push(s);
        });

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

function parseDracinema(html, base) {
  const movies = [];
  // Regex yang lebih "rakus" buat nangkep konten Dracinema
  // Mencari link, gambar, dan judul di dalam card
  const regex = /<a\s+[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img\s+[^>]*src="([^"]+)"[^>]*>[\s\S]*?<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    let title = match[3].replace(/<[^>]+>/g, '').trim();
    let link = match[1];
    let img = match[2];

    // Filter biar gak ambil link sampah (hanya ambil link drama/video)
    if (title && (link.includes('/video/') || link.includes('/drama/') || link.includes('/movie/'))) {
      movies.push({
        title: title,
        link: link.startsWith('http') ? link : `${base}${link}`,
        img: img.startsWith('http') ? img : `${base}${img}`
      });
    }
  }
  return movies;
}
