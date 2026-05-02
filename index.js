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
    // Kita pakai URL paling dasar yang seringkali lolos dari proteksi ketat
    const url = `${TARGET}/explore?country=korea&media_type=tv`
    
    const res = await fetch(url, { 
      headers: { 
        'User-Agent': UA,
        'Referer': 'https://www.google.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'max-age=0',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site'
      }
    })
    
    const html = await res.text()
    const $ = load(html)
    const data = []

    // Selektor 'sapu jagat' untuk mencari link film
    $('a').each((i, el) => {
      const link = $(el).attr('href')
      const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src')
      const title = $(el).find('img').attr('alt') || $(el).text().trim()

      if (link && (link.includes('/movie/') || link.includes('/tv/'))) {
        if (img && title && title.length > 2) {
          data.push({
            title: title.replace(/Nonton|Movie|Subtitle|Indonesia/gi, '').trim(),
            link: link.startsWith('http') ? link : TARGET + (link.startsWith('/') ? '' : '/') + link,
            img: img.startsWith('http') ? img : TARGET + (img.startsWith('/') ? '' : '/') + img
          })
        }
      }
    })

    const finalData = data.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i)
    
    // Jika masih kosong, kita kirim status true tapi data kosong agar HTML tidak error
    return c.json({ 
      status: finalData.length > 0, 
      count: finalData.length,
      data: finalData 
    })
  } catch (err) {
    return c.json({ status: false, data: [], error: "Server Timeout" })
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
