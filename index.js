import { Hono } from 'hono'
import { load } from 'cheerio'
import { cors } from 'hono/cors'
import { handle } from '@hono/node-server/vercel'

const app = new Hono()
app.use('/*', cors())

const TARGET = 'https://serial-drakor.com'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

async function scrapeList(url) {
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': UA, 'Referer': TARGET },
      signal: AbortSignal.timeout(9000) 
    })
    const html = await res.text()
    const $ = load(html)
    const data = []

    // Pakai selektor yang lebih luas supaya tidak luput
    $('.ml-item, article, .item, .post-item, [class*="item"]').each((i, el) => {
      const link = $(el).find('a').attr('href')
      // Cari judul di semua tempat yang mungkin
      const title = $(el).find('img').attr('alt') || $(el).find('h2, h3, .title').text().trim()
      // Cari gambar di semua jenis atribut lazy load
      let img = $(el).find('img').attr('data-original') || 
                $(el).find('img').attr('data-src') || 
                $(el).find('img').attr('src') ||
                $(el).find('img').attr('data-lazy-src')
      
      if (link && title) {
        if (img && img.startsWith('//')) img = 'https:' + img
        
        data.push({ 
          title: title.replace(/Nonton|Movie|Subtitle|Indonesia|Drakor/gi, '').trim(), 
          link: link.startsWith('http') ? link : `${TARGET}${link.startsWith('/') ? '' : '/'}${link}`, 
          img: img || '' 
        })
      }
    })
    return data
  } catch { return [] }
}

async function scrapeInfinite(baseUrl, limitPage = 2) {
  let combined = []
  for (let j = 1; j <= limitPage; j++) {
    let url = j === 1 ? baseUrl : `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}page/${j}/`
    const results = await scrapeList(url)
    if (results.length === 0) break 
    combined = [...combined, ...results]
  }
  return combined.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i);
}

app.get('/', async (c) => c.json({ status: true, data: await scrapeInfinite(TARGET, 2) }))

app.get('/drakorindo', async (c) => {
    const data = await scrapeInfinite(`${TARGET}/drakorindo/`, 2)
    return c.json({ status: data.length > 0, data })
})

app.get('/k-movie', async (c) => {
    const data = await scrapeInfinite(`${TARGET}/category/k-movie/`, 2)
    return c.json({ status: data.length > 0, data })
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
    return c.json({ status: streams.length > 0, streams })
  } catch { return c.json({ status: false, streams: [] }) }
})

export default handle(app)
