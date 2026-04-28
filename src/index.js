export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://drakor.kita.mobi/"
    };

    // ENDPOINT UTAMA ( / )
    if (path === "/" || path === "/all") {
      const media_type = params.get("media_type") || "c2d0de";
      const genre = params.get("genre") || "c2d0de";
      const country = params.get("country") || "c2d0de";
      const year = params.get("year") || "c2d0de";

      const pagePromises = [];
      // Ambil 5 halaman sekaligus
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
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*" 
        }
      });
    }

    // ENDPOINT DETAIL ( /detail )
    if (path === "/detail") {
      const targetUrl = params.get("url");
      if (!targetUrl) return new Response(JSON.stringify({ error: "No URL provided" }), { status: 400 });

      try {
        const res = await fetch(targetUrl, { headers });
        const html = await res.text();
        
        // Cari link video M3U8 atau MP4 di dalam script
        const videoMatches = html.match(/https?:\/\/[^"']+\.(?:m3u8|mp4|mkv)[^"']*/g) || [];
        
        return new Response(JSON.stringify({
          status: "success",
          streams: [...new Set(videoMatches)] // Buang link duplikat
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

    return new Response(JSON.stringify({ message: "Endpoint tidak ditemukan" }), { status: 404 });
  }
};

// FUNGSI SCRAPER LIST FILM
function parseMovies(html) {
  const movies = [];
  
  // Regex disesuaikan dengan struktur: <div class="item"> <a href="..."> <img src="..."> <h3>Judul</h3>
  // Menggunakan regex yang lebih fleksibel karena spasi/newline di HTML sering beda-beda
  const regex = /<div class="item">[\s\S]*?<a href="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h3>([\s\S]*?)<\/h3>/g;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    let rawTitle = match[3].replace(/<[^>]+>/g, '').trim();
    let rawLink = match[1];
    let rawImg = match[2];

    movies.push({
      title: rawTitle,
      link: rawLink.startsWith('http') ? rawLink : `https://drakor.kita.mobi${rawLink}`,
      img: rawImg.startsWith('http') ? rawImg : `https://drakor.kita.mobi${rawImg}`
    });
  }
  return movies;
}
