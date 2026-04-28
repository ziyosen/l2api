import { Hono } from 'hono'
import { load } from 'cheerio'
import { cors } from 'hono/cors'

const app = new Hono()
app.use('/*', cors())

const TARGET = 'https://tv10.lk21official.cc'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Fungsi utama buat scrape satu halaman
async function scrapePage(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': TARGET } })
    if (!res.ok) return []
    const html = await res.text()
    const $ = load(html)
    const data = []

    $('.grid-main .box, .article, .movie-wrapper').each((i, el) => {
      const title = $(el).find('h2, h3, a.title').text().trim()
      const link = $(el).find('a').first().attr('href')
      let img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src')
      
      if (title && link) {
        if (img && img.startsWith('//')) img = 'https:' + img
        data.push({ title, link, img: img || '' })
      }
    })
    return data
  } catch { return [] }
}

// Fungsi buat ambil 5 halaman sekaligus secara paralel
async function scrapeFivePages(baseUrl) {
  const pages = [1, 2, 3, 4, 5]
  const tasks = pages.map(p => {
    // Jalur paginasi lk21 biasanya /page/2 atau ?page=2
    const url = p === 1 ? baseUrl : `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}page/${p}/`
    return scrapePage(url)
  })
  
  const results = await Promise.all(tasks)
  return results.flat() // Gabungin semua hasil jadi satu array
}

// --- ENDPOINTS ---

app.get('/', async (c) => c.json({ status: true, data: await scrapePage(TARGET) }))

// TOP MOVIE TODAY
app.get('/top-movie-today', async (c) => c.json({ status: true, data: await scrapePage(`${TARGET}/top-movie-today`) }))

// GENRE (Ambil 5 Halaman)
const genres = ['animation', 'action', 'adventure', 'comedy', 'crime', 'fantasy', 'family', 'horror', 'romance', 'thriller']
genres.forEach(g => {
  app.get(`/genre/${g}`, async (c) => c.json({ status: true, data: await scrapeFivePages(`${TARGET}/genre/${g}`) }))
})

// COUNTRY (Ambil 5 Halaman)
const countries = ['usa', 'japan', 'south-korea', 'china', 'thailand']
countries.forEach(ct => {
  app.get(`/country/${ct}`, async (c) => c.json({ status: true, data: await scrapeFivePages(`${TARGET}/country/${ct}`) }))
})

// YEAR (Ambil 5 Halaman)
const years = ['2017', '2018', '2019', '2020']
years.forEach(y => {
  app.get(`/year/${y}`, async (c) => c.json({ status: true, data: await scrapeFivePages(`${TARGET}/year/${y}`) }))
})

// SEARCH
app.get('/search', async (c) => {
  const q = c.req.query('q')
  return c.json({ status: true, data: await scrapePage(`${TARGET}/?s=${q}`) })
})

// DETAIL (STREAMING)
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

export default app
