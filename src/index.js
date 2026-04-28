export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    const headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      "Referer": "https://drakor.nimegami.id/"
    };

    const BASE_TARGET = "https://drakor.nimegami.id";

    if (path === "/" || path === "/home" || path.startsWith("/genre/") || path.startsWith("/year-release/") || path === "/sedang-tayang") {
      let targetPath = path === "/" ? "/" : path;
      const pagePromises = [];

      for (let i = 1; i <= 10; i++) {
        const cleanPath = targetPath.endsWith('/') ? targetPath : `${targetPath}/`;
        const pagePath = i === 1 ? cleanPath : `${cleanPath}page/${i}/`;
        pagePromises.push(
          fetch(`${BASE_TARGET}${pagePath}`, { headers }).then(res => res.text()).catch(() => "")
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
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    if (path === "/detail") {
      const targetUrl = params.get("url");
      if (!targetUrl) return new Response("{}", { status: 400 });

      const res = await fetch(targetUrl, { headers });
      const html = await res.text();
      
      let streams = [];
      // Cari semua link iframe dan link player
      const rawStreams = html.match(/https?:\/\/(?:p2p|nyamnyam|stream|player|embed|vipanel|nimegami)[^"']+/gi) || [];
      rawStreams.forEach(s => {
          if (!s.includes('.js') && !s.includes('.css') && !s.includes('.png')) {
              streams.push(s);
          }
      });

      return new Response(JSON.stringify({
        status: "success",
        streams: [...new Set(streams)]
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
};

function parseNimegami(html) {
  const movies = [];
  // Regex Baru: Lebih agresif nangkep pola link post di Nimegami
  const regex = /<h2[^>]*>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>[\s\S]*?<img[^>]+src="([^"]+)"/gi;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    movies.push({
      title: match[2].replace(/<[^>]+>/g, '').trim(),
      link: match[1],
      img: match[3]
    });
  }
  return movies;
}
