export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = url.searchParams;

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    };

    const BASE_TARGET = "https://nontongo.win"; 

    // MAPPING ENDPOINT JOSS
    const routes = {
      "/korea": "/category/drama-korea/",
      "/thailand": "/category/drama-thailand/",
      "/mandarin": "/category/drama-china/",
      "/jepang": "/category/drama-jepang/",
      "/movie": "/category/movie/"
    };

    if (path === "/" || routes[path]) {
      let targetPath = routes[path] || "/";
      const pagePromises = [];

      // Tarik 5-8 halaman
      for (let i = 1; i <= 5; i++) {
        const pagePath = i === 1 ? targetPath : `${targetPath}page/${i}/`;
        pagePromises.push(
          fetch(`${BASE_TARGET}${pagePath}`, { headers }).then(res => res.text()).catch(() => "")
        );
      }

      const pagesHtml = await Promise.all(pagePromises);
      let allMovies = [];
      pagesHtml.forEach(html => { if (html) allMovies = allMovies.concat(parseNontonGo(html)); });

      const uniqueMovies = Array.from(new Map(allMovies.map(m => [m.link, m])).values());

      return new Response(JSON.stringify({
        status: "success",
        total_data: uniqueMovies.length,
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
      // Cari iframe player (Biasanya NontonGo pake player yang 'open')
      const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
      if (iframeMatch) streams.push(iframeMatch[1]);

      const playerMatches = html.match(/https?:\/\/(?:p2p|nyamnyam|embed|player|stream|vipanel)[^"']+/gi) || [];
      playerMatches.forEach(s => streams.push(s));

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

function parseNontonGo(html) {
  const movies = [];
  // Regex khusus NontonGo (biasanya pake class 'item' atau 'box')
  const regex = /<div class="[^"]*item[^"]*">[\s\S]*?<a href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  
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
