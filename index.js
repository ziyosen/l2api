import { Hono } from 'hono'
import { load } from 'cheerio'
import { cors } from 'hono/cors'
import { handle } from '@hono/node-server/vercel'

const app = new Hono()
app.use('/*', cors())

// TARGET disesuaikan ke DutaFilm
const TARGET = 'https://dutafilm.in'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

async function scrapeList(url) {
  try {
    const res = await fetch(url, { 
      headers: { 
        'User-Agent': UA, 
        'Referer': TARGET,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(8000) 
    })
    const html = await res.text()
    const $ = load(html)
    const data = []

    // Selector disesuaikan untuk struktur item DutaFilm
    $('.item, [class*="item-list"] li, article').each((i, el) => {
      const title = $(el).find('h2, h3, .title, img').first().attr('alt') || $(el).find('h2, h3, .title').text().trim()
      let link = $(el).find('a').attr('href')
      let img = $(el).find('img').attr('data-src') || $(el).find('img').attr('data-original') || $(el).find('img').attr('src')
      
      if (link && title) {
        // Pastikan link lengkap
        const fullLink = link.startsWith('http') ? link : `${TARGET}${link.startsWith('/') ? '' : '/'}${link}`
        
        if (img && img.startsWith('//')) img = 'https:' + img
        
        data.push({ 
          title: title.replace(/Nonton|Movie|Subtitle|Indonesia|Drakor/gi, '').trim(), 
          link: fullLink, 
          img: img || '' 
        })
      }
    })
    return data
  } catch { return [] }
}

async function scrapeInfinite(baseUrl, limitPage = 3) {
  let combined = []
  for (let j = 1; j <= limitPage; j++) {
    // Penyesuaian format paging DutaFilm (?page=X atau /page/X)
    let url = j === 1 ? baseUrl : (baseUrl.includes('?') ? `${baseUrl}&page=${j}` : `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}page/${j}/`)
    const results = await scrapeList(url)
    if (results.length === 0) break 
    combined = [...combined, ...results]
  }
  // Filter duplikat berdasarkan link
  return combined.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i);
}

// --- ENDPOINTS ---

// Home langsung nembak ke Explore Korea TV sesuai permintaan
app.get('/', async (c) => {
    const url = `${TARGET}/explore/country/korea`
    return c.json({ status: true, data: await scrapeInfinite(url, 2) })
})

// Endpoint Search
app.get('/search', async (c) => {
  const q = c.req.query('q')
  return c.json({ status: true, data: await scrapeList(`${TARGET}/search?q=${encodeURIComponent(q)}`) })
})

// Endpoint Detail (Ambil Iframe Player)
app.get('/detail', async (c) => {
  try {
    const url = c.req.query('url')
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': TARGET } })
    const html = await res.text()
    const $ = load(html)
    const streams = []
    
    $('iframe, #player-embed iframe').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src')
      if (src && !/ads|facebook|twitter/i.test(src)) {
        if (src.startsWith('//')) src = 'https:' + src
        streams.push(src)
      }
    })
    
    return c.json({ status: streams.length > 0, streams })
  } catch { return c.json({ status: false, streams: [] }) }
})

export default handle(app)
