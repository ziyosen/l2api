import { Hono } from 'hono'
import { load } from 'cheerio'
import { cors } from 'hono/cors'
import { handle } from '@hono/node-server/vercel'

const app = new Hono()
app.use('/*', cors())

const TARGET = 'https://dutafilm.in'
// User Agent asli supaya tidak dianggap bot oleh server mereka
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

async function scrapeDuta(url) {
  try {
    const res = await fetch(url, { 
      headers: { 
        'User-Agent': UA,
        'Referer': TARGET,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1'
      } 
    })
    const html = await res.text()
    const $ = load(html)
    const data = []

    // Selektor baru yang lebih umum untuk DutaFilm
    $('a').each((i, el) => {
      const link = $(el).attr('href')
      const title = $(el).find('img').attr('alt') || $(el).attr('title') || $(el).text().trim()
      const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src')

      // Filter: Hanya ambil yang punya link ke film dan punya gambar/judul
      if (link && link.includes('/movie/') || link && link.includes('/tv/')) {
        if (title && title.length > 2) {
          data.push({
            title: title,
            link: link.startsWith('http') ? link : TARGET + (link.startsWith('/') ? '' : '/') + link,
            img: img ? (img.startsWith('http') ? img : TARGET + (img.startsWith('/') ? '' : '/') + img) : ''
          })
        }
      }
    })

    // Hapus duplikat berdasarkan link
    return data.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i)
  } catch (err) {
    return []
  }
}

app.get('/', async (c) => {
  // Pakai endpoint explore yang kamu berikan sebagai default
  const url = `${TARGET}/explore?page=1&media_type=tv&year=d7d9db&genre=d7d9db&country=d7d9db`
  const results = await scrapeDuta(url)
  return c.json({ status: results.length > 0, data: results })
})

app.get('/search', async (c) => {
  const q = c.req.query('q')
  const results = await scrapeDuta(`${TARGET}/search?q=${encodeURIComponent(q)}`)
  return c.json({ status: results.length > 0, data: results })
})

app.get('/detail', async (c) => {
  try {
    const url = c.req.query('url')
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': TARGET } })
    const html = await res.text()
    const $ = load(html)
    let streams = []
    
    // Cari semua iframe yang mungkin jadi player
    $('iframe').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src')
      if (src && !src.includes('ads') && !src.includes('facebook')) {
        if (src.startsWith('//')) src = 'https:' + src
        streams.push(src)
      }
    })

    return c.json({ status: streams.length > 0, streams: [...new Set(streams)] })
  } catch {
    return c.json({ status: false, streams: [] })
  }
})

export default handle(app)
