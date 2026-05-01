import { Hono } from 'hono'
import { load } from 'cheerio'
import { cors } from 'hono/cors'
import { handle } from '@hono/node-server/vercel'

const app = new Hono()
app.use('/*', cors())

const TARGET = 'https://pafipasarmuarabungo.org'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function scrapeList(url) {
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': UA, 'Referer': TARGET },
      signal: AbortSignal.timeout(7000) 
    })
    const html = await res.text()
    const $ = load(html)
    const data = []

    $('.ml-item, article, .item, .post-item, .v-item').each((i, el) => {
      const title = $(el).find('h2, h3, .entry-title, .mli-info h2, a.title').first().text().trim()
      const link = $(el).find('a').attr('href')
      let img = $(el).find('img').attr('data-original') || $(el).find('img').attr('data-src') || $(el).find('img').attr('src')
      
      if (title && link && link.includes(TARGET)) {
        if (img && img.startsWith('//')) img = 'https:' + img
        data.push({ 
          title: title.replace(/Nonton|Movie|Subtitle|Indonesia/gi, '').trim(), 
          link, 
          img: img || '' 
        })
      }
    })
    return data
  } catch { return [] }
}

async function scrapeInfinite(baseUrl, limitPage = 15) {
  let combined = []
  for (let i = 1; i <= limitPage; i += 5) {
    const batch = []
    for (let j = i; j < i + 5 && j <= limitPage; j++) {
      let url = j === 1 ? baseUrl : (baseUrl.includes('?') ? `${baseUrl}&paged=${j}` : `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}page/${j}/`)
      batch.push(scrapeList(url))
    }
    const results = await Promise.all(batch)
    const flatRes = results.flat()
    if (flatRes.length === 0) break 
    combined = [...combined, ...flatRes]
  }
  return combined.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i);
}

// --- ENDPOINTS ---
app.get('/', async (c) => c.json({ status: true, data: await scrapeInfinite(TARGET, 3) }))

// Genres
const genres = ['action', 'adventure', 'animation', 'comedy', 'crime', 'drama', 'fantasy', 'family', 'horror', 'mystery', 'romance', 'sci-fi', 'thriller', 'war', 'western']
genres.forEach(g => {
  app.get(`/genre/${g}`, async (c) => c.json({ status: true, data: await scrapeInfinite(`${TARGET}/genre/${g}/`, 10) }))
})

// Countries
const countries = [
  { slug: 'korea', id: 'korea' },
  { slug: 'japan', id: 'japan' },
  { slug: 'thailand', id: 'thailand' },
  { slug: 'hong-kong', id: 'hong-kong' }
]
countries.forEach(cn => {
  app.get(`/country/${cn.slug}`, async (c) => {
    const searchUrl = `${TARGET}/?s=&search=advanced&country=${cn.id}`
    const data = await scrapeInfinite(searchUrl, 15)
    return c.json({ status: true, data })
  })
})

app.get('/semi-jepang', async (c) => c.json({ status: true, data: await scrapeInfinite(`${TARGET}/genre/semi-jepang/`, 15) }))
app.get('/semi-korea', async (c) => c.json({ status: true, data: await scrapeInfinite(`${TARGET}/genre/semi-korea/`, 15) }))
app.get('/semi-philippines', async (c) => c.json({ status: true, data: await scrapeInfinite(`${TARGET}/genre/semi-philippines/`, 15) }))
app.get('/search', async (c) => {
  const q = c.req.query('q')
  return c.json({ status: true, data: await scrapeList(`${TARGET}/?s=${q}`) })
})

app.get('/detail', async (c) => {
  try {
    const url = c.req.query('url')
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': TARGET } })
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
  } catch { return c.json({ status: false, streams: [] }) }
})

export default handle(app)
