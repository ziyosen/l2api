import { Hono } from 'hono'
import { load } from 'cheerio'
import { cors } from 'hono/cors'
import { handle } from '@hono/node-server/vercel'

const app = new Hono()
app.use('/*', cors())

const TARGET = 'https://dutafilm.in'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function scrapeDuta(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': TARGET } })
    const html = await res.text()
    const $ = load(html)
    const data = []

    // Selektor disesuaikan untuk grid film DutaFilm
    $('.item').each((i, el) => {
      const link = $(el).find('a').attr('href')
      const title = $(el).find('img').attr('alt') || $(el).find('.title').text().trim()
      const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src')

      if (link && title) {
        data.push({
          title: title,
          link: link.startsWith('http') ? link : TARGET + link,
          img: img ? (img.startsWith('http') ? img : TARGET + img) : ''
        })
      }
    })
    return data
  } catch { return [] }
}

// Endpoint khusus drakor sesuai permintaan kamu
app.get('/', async (c) => {
  const url = `${TARGET}/explore?country=korea&media_type=tv`
  return c.json({ status: true, data: await scrapeDuta(url) })
})

app.get('/search', async (c) => {
  const q = c.req.query('q')
  return c.json({ status: true, data: await scrapeDuta(`${TARGET}/search?q=${q}`) })
})

app.get('/detail', async (c) => {
  try {
    const url = c.req.query('url')
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': TARGET } })
    const html = await res.text()
    const $ = load(html)
    let streams = []
    
    // Cari iframe player DutaFilm
    $('iframe').each((i, el) => {
      let src = $(el).attr('src')
      if (src && !src.includes('ads')) streams.push(src)
    })

    return c.json({ status: streams.length > 0, streams: streams })
  } catch { return c.json({ status: false, streams: [] }) }
})

export default handle(app)
