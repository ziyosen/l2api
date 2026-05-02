import { Hono } from 'hono'
import { load } from 'cheerio'
import { cors } from 'hono/cors'
import { handle } from '@hono/node-server/vercel'

const app = new Hono()
app.use('/*', cors())

const TARGET = 'https://drakorkita.mywap.in'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function scrapeList(url) {
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': UA, 'Referer': TARGET },
      signal: AbortSignal.timeout(8000) 
    })
    const html = await res.text()
    const $ = load(html)
    const data = []

    // Selector disesuaikan dengan struktur umum site drakorkita
    $('.item, .post-item, .list-item, div[class*="item"]').each((i, el) => {
      const title = $(el).find('h2, h3, .title, a').first().text().trim()
      let link = $(el).find('a').attr('href')
      let img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src')

      if (title && link) {
        // Pastikan link absolut
        if (link.startsWith('/')) link = TARGET + link
        if (img && img.startsWith('//')) img = 'https:' + img
        
        data.push({ 
          title: title.replace(/Nonton|Movie|Subtitle|Indonesia/gi, '').trim(), 
          link, 
          img: img || '' 
        })
      }
    })
    return data
  } catch (err) { 
    console.error('Scrape error:', err.message)
    return [] 
  }
}

async function scrapeInfinite(baseUrl, limitPage = 20) {
  let combined = []
  // Kita ambil batch per 5 page agar tidak terkena rate limit/timeout
  for (let i = 1; i <= limitPage; i += 5) {
    const batch = []
    for (let j = i; j < i + 5 && j <= limitPage; j++) {
      // Logic URL Baru: Menggunakan query parameter ?page=
      const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${j}&year=c2d0de&genre=c2d0de&country=c2d0de&media_type=c2d0de`
      batch.push(scrapeList(url))
    }
    const results = await Promise.all(batch)
    const flatRes = results.flat()
    if (flatRes.length === 0) break 
    combined = [...combined, ...flatRes]
  }
  // Menghapus duplikat berdasarkan link
  return combined.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i)
}

// --- ENDPOINTS ---

// 1. Endpoint Home (Ambil 1-2 page saja agar cepat)
app.get('/', async (c) => {
  const data = await scrapeInfinite(TARGET, 2)
  return c.json({ status: true, source: TARGET, data })
})

// 2. Endpoint All (Ambil 20 page sesuai request)
app.get('/all', async (c) => {
  const data = await scrapeInfinite(`${TARGET}/all`, 20)
  return c.json({ 
    status: true, 
    total_results: data.length,
    data 
  })
})

// Endpoint Search
app.get('/search', async (c) => {
  const q = c.req.query('q')
  const data = await scrapeList(`${TARGET}/search?q=${q}`)
  return c.json({ status: true, data })
})

// Endpoint Detail (Untuk ambil link stream/iframe)
app.get('/detail', async (c) => {
  try {
    const url = c.req.query('url')
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    const html = await res.text()
    const $ = load(html)
    const streams = []
    
    $('iframe').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src')
      if (src && !src.includes('ads')) {
        if (src.startsWith('//')) src = 'https:' + src
        streams.push(src)
      }
    })
    return c.json({ status: true, streams })
  } catch { 
    return c.json({ status: false, streams: [] }) 
  }
})

export default handle(app)
