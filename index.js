import { Hono } from 'hono'
import { load } from 'cheerio'
import { cors } from 'hono/cors'
import { handle } from '@hono/node-server/vercel'

const app = new Hono()
app.use('/*', cors())

const TARGET = 'https://serial-drakor.com'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

async function scrapeSerial(path) {
  try {
    // Pastikan path diawali slash jika tidak kosong
    const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''
    const url = `${TARGET}${cleanPath}`
    
    const res = await fetch(url, { 
      headers: { 'User-Agent': UA, 'Referer': TARGET } 
    })
    const html = await res.text()
    const $ = load(html)
    const data = []

    // Selektor mli-item biasanya sangat akurat di situs drakor
    $('.ml-item, .item, article').each((i, el) => {
      const title = $(el).find('h2, h3, .mli-info h2').text().trim() || $(el).find('img').attr('alt')
      const link = $(el).find('a').attr('href')
      let img = $(el).find('img').attr('data-original') || $(el).find('img').attr('src')

      if (title && link) {
        if (img && img.startsWith('//')) img = 'https:' + img
        data.push({
          title: title.replace(/Nonton|Movie|Subtitle|Indonesia/gi, '').trim(),
          link: link,
          img: img || ''
        })
      }
    })
    return data.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i)
  } catch { return [] }
}

// --- ENDPOINTS SESUAI REQUEST BOS ---

// 1. Home (/)
app.get('/', async (c) => {
  const data = await scrapeSerial('')
  return c.json({ status: data.length > 0, data })
})

// 2. DrakorIndo (/drakorindo/)
app.get('/drakorindo', async (c) => {
  const data = await scrapeSerial('/drakorindo/')
  return c.json({ status: data.length > 0, data })
})

// 3. K-Movie (/category/k-movie/)
app.get('/k-movie', async (c) => {
  const data = await scrapeSerial('/category/k-movie/')
  return c.json({ status: data.length > 0, data })
})

// Endpoint Detail Player
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
    return c.json({ status: streams.length > 0, streams })
  } catch { return c.json({ status: false, streams: [] }) }
})

export default handle(app)
