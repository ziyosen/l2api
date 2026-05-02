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
    const res = await fetch(url, { 
      headers: { 
        'User-Agent': UA,
        'Referer': TARGET,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      } 
    })
    const html = await res.text()
    const $ = load(html)
    const data = []

    // Selektor khusus untuk struktur grid DutaFilm (ul.item-list atau .item)
    $('.item-list li, .item, [class*="item"]').each((i, el) => {
      const link = $(el).find('a').attr('href')
      const title = $(el).find('img').attr('alt') || $(el).find('.title, h2, h3').text().trim()
      const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src')

      if (link && title && !link.includes('javascript')) {
        data.push({
          title: title,
          link: link.startsWith('http') ? link : TARGET + (link.startsWith('/') ? '' : '/') + link,
          img: img ? (img.startsWith('http') ? img : TARGET + (img.startsWith('/') ? '' : '/') + img) : ''
        })
      }
    })
    return data
  } catch (err) {
    return []
  }
}

app.get('/', async (c) => {
  // Langsung tembak ke kategori Korea TV (Drakor)
  const url = `${TARGET}/explore?country=korea&media_type=tv`
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
    
    // Cari iframe atau link player
    $('iframe, #player-embed iframe').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src')
      if (src && !src.includes('ads')) {
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
