export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    // Header biar gak disangka bot
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };

    // Endpoint Utama
    if (path === "/all") {
      const media_type = params.get("media_type") || "c2d0de";
      const genre = params.get("genre") || "c2d0de";
      const country = params.get("country") || "c2d0de";
      const year = params.get("year") || "c2d0de";

      // Kita tarik 5 halaman sekaligus secara paralel
      const pagePromises = [];
      for (let i = 1; i <= 5; i++) {
        const targetUrl = `https://drakor.kita.mobi/all?page=${i}&genre=${genre}&year=${year}&country=${country}&media_type=${media_type}`;
        pagePromises.push(fetch(targetUrl, { headers }).then(res => res.text()));
      }

      const pagesHtml = await Promise.all(pagePromises);
      let allMovies = [];

      pagesHtml.forEach(html => {
        const movies = parseMovies(html);
        allMovies = allMovies.concat(movies);
      });

      return new Response(JSON.stringify({
        status: "success",
        total_data: allMovies.length,
        data: allMovies
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // Endpoint Detail untuk ambil link Video/M3U8
    if (path === "/detail") {
      const targetUrl = params.get("url");
      if (!targetUrl) return new Response("Missing URL", { status: 400 });

      const res = await fetch(targetUrl, { headers });
      const html = await res.text();
      
      // Scraper link video (biasanya ada di dalam tag source atau script)
      const streams = [...html.matchAll(/file:\s*"(https?:\/\/[^"]+)"/g)].map(m => m[1]);
      const m3u8 = [...html.matchAll(/src:\s*"(https?:\/\/[^"]+\.m3u8)"/g)].map(m => m[1]);

      return new Response(JSON.stringify({
        title: "Streaming Link",
        streams: [...new Set([...streams, ...m3u8])]
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    return new Response("API Movie Ready Bosku!", { status: 200 });
  }
};

// Fungsi Scraper List Film
function parseMovies(html) {
  const movies = [];
  // Regex untuk ambil gambar, link, dan judul
  // Pola web drakor.kita.mobi biasanya pakai div class tertentu
  const regex = /<a\s+href="([^"]+)"\s+class="movie-item">[\s\S]*?<img\s+src="([^"]+)"[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/g;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    movies.push({
      title: match[3].trim(),
      link: match[1].startsWith('http') ? match[1] : `https://drakor.kita.mobi${match[1]}`,
      img: match[2]
    });
  }
  return movies;
}
