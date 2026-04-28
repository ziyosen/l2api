export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    const headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      "Referer": "https://drakor.kita.mobi/"
    };

    if (path === "/all") {
      const media_type = params.get("media_type") || "c2d0de";
      const genre = params.get("genre") || "c2d0de";
      const country = params.get("country") || "c2d0de";
      const year = params.get("year") || "c2d0de";

      const pagePromises = [];
      // Kita ambil 5 halaman
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

    return new Response("API Aktif Bosku!", { status: 200 });
  }
};

function parseMovies(html) {
  const movies = [];
  
  // Regex baru: Mencari link, gambar, dan judul di dalam class 'item'
  // Web ini biasanya strukturnya: <div class="item"> ... <a href="..."> ... <img src="..."> ... <h3> Judul </h3>
  const regex = /<div class="item">[\s\S]*?<a href="([^"]+)"[\s\S]*?<img src="([^"]+)"[\s\S]*?<h3>([\s\S]*?)<\/h3>/g;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    let title = match[3].replace(/<[^>]+>/g, '').trim(); // Bersihin tag HTML di judul
    let link = match[1];
    let img = match[2];

    movies.push({
      title: title,
      link: link.startsWith('http') ? link : `https://drakor.kita.mobi${link}`,
      img: img.startsWith('http') ? img : `https://drakor.kita.mobi${img}`
    });
  }
  return movies;
}
