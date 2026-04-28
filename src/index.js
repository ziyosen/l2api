export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://drakor.nimegami.id/"
    };

    const BASE_TARGET = "https://drakor.nimegami.id";

    // ENDPOINT UTAMA (Support Home, Genre, Year, Sedang Tayang)
    if (path === "/" || path === "/home" || path.startsWith("/genre/") || path.startsWith("/year-release/") || path === "/sedang-tayang") {
      
      let targetPath = path === "/" ? "/" : path;
      const pagePromises = [];

      // SEKARANG TARIK 10 HALAMAN BOS!
      for (let i = 1; i <= 10; i++) {
        // Logika penanganan slash agar tidak double (//)
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

      // Buang data duplikat kalau ada link yang sama antar page
      const uniqueMovies = Array.from(new Map(allMovies.map(m => [m.link, m])).values());

      return new Response(JSON.stringify({
        status: "success",
        total_data: uniqueMovies.length,
        pages_fetched: 10,
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
      if (!targetUrl) return new Response(JSON.stringify({ error: "No URL" }), { status: 400 });

      try {
        const res = await fetch(targetUrl, { headers });
        const html = await res.text();
        const videoMatches = html.match(/https?:\/\/[^"']+\.(?:m3u8|mp4|mkv)[^"']*/g) || [];
        
        return new Response(JSON.stringify({
          status: "success",
          streams: [...new Set(videoMatches)]
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Gagal ambil detail" }), { status: 500 });
      }
    }

    return new Response(JSON.stringify({ message: "Gak ada jalan bos!" }), { status: 404 });
  }
};

function parseNimegami(html) {
  const movies = [];
  // Regex untuk Nimegami (Link, Image, Title)
  // Mencari pola article atau div yang membungkus post
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
