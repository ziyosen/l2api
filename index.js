import { Hono } from 'hono'
import { load } from 'cheerio'
import { cors } from 'hono/cors'
import { handle } from '@hono/node-server/vercel'

const app = new Hono()
app.use('/*', cors())

// URL Target Baru
const TARGET = 'https://serial-drakor.com'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

async function scrapeList(url) {
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': UA, 'Referer': TARGET },
      signal: AbortSignal.timeout(8000) 
    })
    const html = await res.text()
    const $ = load(html)
    const data = []

    // Selektor universal untuk Serial-Drakor
    $('.ml-item, article, .item, .post-item, .v-item').each((i, el) => {
      const title = $(el).find('h2, h3, .entry-title, .mli-info h2, a.title, img').first().attr('alt') || $(el).find('h2, h3, .title').text().trim()
      const link = $(el).find('a').attr('href')
      let img = $(el).find('img').attr('data-original') || $(el).find('img').attr('data-src') || $(el).find('img').attr('src')
      
      // Syarat: Ada judul dan link
      if (title && link) {
        if (img && img.startsWith('//')) img = 'https:' + img
        
        data.push({ 
          title: title.replace(/Nonton|Movie|Subtitle|Indonesia|Drakor/gi, '').trim(), 
          link: link.startsWith('http') ? link : `${TARGET}${link.startsWith('/') ? '' : '/'}${link}`, 
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
    // Penyesuaian paging Serial-Drakor
    let url = j === 1 ? baseUrl : `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}page/${j}/`
    const results = await scrapeList(url)
    if (results.length === 0) break 
    combined = [...combined, ...results]
  }
  return combined.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i);
}

// --- ENDPOINTS SESUAI PERMINTAAN ---

// 1. Home (/)
app.get('/', async (c) => {
    return c.json({ status: true, data: await scrapeInfinite(TARGET, 2) })
})

// 2. DrakorIndo (/drakorindo/)
app.get('/drakorindo', async (c) => {
    return c.json({ status: true, data: await scrapeInfinite(`${TARGET}/drakorindo/`, 3) })
})

// 3. K-Movie (/category/k-movie/)
app.get('/k-movie', async (c) => {
    return c.json({ status: true, data: await scrapeInfinite(`${TARGET}/category/k-movie/`, 3) })
})

// Search
app.get('/search', async (c) => {
  const q = c.req.query('q')
  return c.json({ status: true, data: await scrapeList(`${TARGET}/?s=${q}`) })
})

// Detail Player
app.get('/detail', async (c) => {
  try {
    const url = c.req.query('url')
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': TARGET } })
    const html = await res.text()
    const $ = load(html)
    const streams = []
    $('iframe').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src')
      if (src && !/ads|facebook|twitter/i.test(src)) {
        if (src.startsWith('//')) src = 'https:' + src
        streams.push(src)
      }
    })
    return c.json({ status: true, streams })
  } catch { return c.json({ status: false, streams: [] }) }
})

export default handle(app)
