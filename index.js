import { Hono } from 'hono'
import { load } from 'cheerio'
import { cors } from 'hono/cors'
import { handle } from '@hono/node-server/vercel'

const app = new Hono()
app.use('/*', cors())

const TARGET = 'https://dutafilm.in'
// Pakai User Agent HP yang sangat spesifik
const UA = 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

app.get('/', async (c) => {
  try {
    const url = `${TARGET}/explore/country/korea`
    const res = await fetch(url, { 
      headers: { 
        'User-Agent': UA,
        'Accept': 'text/html',
        'Referer': TARGET 
      }
    })
    const html = await res.text()
    const $ = load(html)
    const data = []

    // Cari SEMUA link yang punya gambar di dalamnya (cara paling aman)
    $('a').each((i, el) => {
      const link = $(el).attr('href')
      const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src')
      const title = $(el).find('img').attr('alt') || $(el).text().trim()

      if (link && img && title && (link.includes('/movie/') || link.includes('/tv/'))) {
        data.push({
          title: title.split('Subtitle')[0].trim(),
          link: link.startsWith('http') ? link : TARGET + (link.startsWith('/') ? '' : '/') + link,
          img: img.startsWith('http') ? img : TARGET + (img.startsWith('/') ? '' : '/') + img
        })
      }
    })

    // Filter biar gak double
    const cleanData = data.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i)
    return c.json({ status: cleanData.length > 0, data: cleanData })
  } catch (err) {
    return c.json({ status: false, data: [], error: err.message })
  }
})

// Endpoint detail tetep sama tapi lebih simpel
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
