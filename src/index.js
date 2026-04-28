export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    };

    const BASE_TARGET = "https://tv44.juragan.film"; 

    // MAPPING ENDPOINT TERBARU (Thailand Included)
    const routes = {
      "/korea": "/kategori-film/drama-serial-korea/",
      "/barat": "/kategori-film/drama-serial-barat/",
      "/mandarin": "/kategori-film/drama-serial-mandarin/",
      "/thailand": "/kategori-film/drama-serial-thailand/", // Ganti Anime jadi Thailand
      "/jepang": "/kategori-film/drama-serial-jepang/"
    };

    if (path === "/" || routes[path]) {
      let targetPath = routes[path] || "/";
      const pagePromises = [];

      // Tarik 8 halaman
      for (let i = 1; i <= 8; i++) {
        const pagePath = i === 1 ? targetPath : `${targetPath}page/${i}/`;
        pagePromises.push(
          fetch(`${BASE_TARGET}${pagePath}`, { headers })
            .then(res => res.ok ? res.text() : "")
            .catch(() => "")
        );
      }

      const pagesHtml = await Promise.all(pagePromises);
      let allMovies = [];
      pagesHtml.forEach(html => { 
        if (html) allMovies = allMovies.concat(parseJuragan(html)); 
      });

      const uniqueMovies = Array.from(new Map(allMovies.map(m => [m.link, m])).values());

      return new Response(JSON.stringify({
        status: "success",
        total_data: uniqueMovies.length,
        category: path.replace('/', '') || "home",
        data: uniqueMovies
      }), {
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*" 
        }
      });
    }

    // ENDPOINT DETAIL
    if (path === "/detail") {
      const targetUrl = params.get("url");
      if (!targetUrl) return new Response("{}", { status: 400 });

      try {
        const res = await fetch(targetUrl, { headers });
        const html = await res.text();
        
        let streams = [];
        // Cari iframe player
        const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
        if (iframeMatch) streams.push(iframeMatch[1]);

        // Cari link alternatif
        const playerMatches = html.match(/https?:\/\/(?:embed|player|stream|gdrive|xyz|vipanel)[^"']+/gi) || [];
        playerMatches.forEach(s => streams.push(s));

        return new Response(JSON.stringify({
          status: "success",
          streams: [...new Set(streams.filter(s => !s.includes('google')))]
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

function parseJuragan(html) {
  const movies = [];
  // Regex yang lebih santai (Flexible) buat nangkep konten Juragan Film
  const regex = /<div class="ml-item">[\s\S]*?<a href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<span class="mli-info">[\s\S]*?<h2>([\s\S]*?)<\/h2>/gi;
  
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
