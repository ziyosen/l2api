export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    };

    const BASE_TARGET = "http://45.11.57.16"; 

    // ENDPOINT ROUTER
    if (path === "/" || path === "/korea" || path === "/jepang" || path === "/thailand" || path === "/netflix") {
      
      let targetUrl = "";
      if (path === "/" || path === "/korea") {
        targetUrl = `${BASE_TARGET}/series/?country%5B%5D=south-korea&status=&type=Drama&order=update`;
      } else if (path === "/jepang") {
        targetUrl = `${BASE_TARGET}/series/?country%5B%5D=japan&type=Drama&order=update`;
      } else if (path === "/thailand") {
        targetUrl = `${BASE_TARGET}/series/?country%5B%5D=thailand&status=&type=Drama&order=update`;
      } else if (path === "/netflix") {
        targetUrl = `${BASE_TARGET}/network/netflix/`;
      }

      const pagePromises = [];
      // Kita ambil 5-10 halaman
      for (let i = 1; i <= 5; i++) {
        const pagedUrl = i === 1 ? targetUrl : `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}page=${i}`;
        pagePromises.push(
          fetch(pagedUrl, { headers }).then(res => res.text()).catch(() => "")
        );
      }

      const pagesHtml = await Promise.all(pagePromises);
      let allMovies = [];
      pagesHtml.forEach(html => { if (html) allMovies = allMovies.concat(parseIPWeb(html, BASE_TARGET)); });

      const uniqueMovies = Array.from(new Map(allMovies.map(m => [m.link, m])).values());

      return new Response(JSON.stringify({
        status: "success",
        total_data: uniqueMovies.length,
        category: path.replace('/', ''),
        data: uniqueMovies
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // ENDPOINT DETAIL
    if (path === "/detail") {
      const targetUrl = params.get("url");
      if (!targetUrl) return new Response("{}", { status: 400 });

      const res = await fetch(targetUrl, { headers });
      const html = await res.text();
      
      let streams = [];
      // Cari Iframe Player
      const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
      if (iframeMatch) streams.push(iframeMatch[1]);
      
      // Cari link embed lainnya
      const playerMatches = html.match(/https?:\/\/(?:p2p|nyamnyam|embed|player|stream|vipanel)[^"']+/gi) || [];
      playerMatches.forEach(s => streams.push(s));

      return new Response(JSON.stringify({
        status: "success",
        streams: [...new Set(streams)]
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    return new Response("Endpoint Not Found", { status: 404 });
  }
};

function parseIPWeb(html, base) {
  const movies = [];
  // Regex khusus struktur IP 45.11.57.16
  // Biasanya judul ada di class "title" atau tag <h4>/<h2> dalam class "article"
  const regex = /<article[^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<h2 class="entry-title"[^>]*>([\s\S]*?)<\/h2>/gi;
  
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
