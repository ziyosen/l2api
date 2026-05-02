import { Hono } from 'hono'
import { load } from 'cheerio'
import { cors } from 'hono/cors'
import { handle } from '@hono/node-server/vercel'

const app = new Hono()
app.use('/*', cors())

const TARGET = 'https://dutafilm.in'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

app.get('/', async (c) => {
  try {
    // Kita tembak lewat sistem search dengan filter Korea + TV (Drakor)
    // Cara ini seringkali lolos dari proteksi 'Explore' yang ketat
    const url = `${TARGET}/search?country=korea&media_type=tv`
    
    const res = await fetch(url, { 
      headers: { 
        'User-Agent': UA,
        'Referer': TARGET,
        'Accept': 'text/html'
      }
    })
    
    const html = await res.text()
    const $ = load(html)
    const data = []

    // Selektor super umum: cari semua link yang membungkus gambar
    $('a:has(img)').each((i, el) => {
      const link = $(el).attr('href')
      const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src')
      const title = $(el).find('img').attr('alt') || $(el).attr('title')

      if (link && img && (link.includes('/movie/') || link.includes('/tv/'))) {
        data.push({
          title: title ? title.replace(/Nonton|Movie|Subtitle|Indonesia/gi, '').trim() : 'No Title',
          link: link.startsWith('http') ? link : TARGET + (link.startsWith('/') ? '' : '/') + link,
          img: img.startsWith('http') ? img : TARGET + (img.startsWith('/') ? '' : '/') + img
        })
      }
    })

    const finalData = data.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i)
    return c.json({ status: finalData.length > 0, data: finalData })
  } catch (err) {
    return c.json({ status: false, data: [] })
  }
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
      if (src && !/ads|facebook|twitter/i.test(src)) {
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
