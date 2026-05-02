import { Hono } from 'hono'
import { load } from 'cheerio'
import { cors } from 'hono/cors'
import { handle } from '@hono/node-server/vercel'

const app = new Hono()
app.use('/*', cors())

const TARGET = 'https://drakorkita.mywap.in'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

// Fungsi Scraper List
async function scrapeList(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': TARGET } })
    const html = await res.text()
    const $ = load(html)
    const data = []

    $('a').each((i, el) => {
      const link = $(el).attr('href')
      const title = $(el).text().trim()
      const img = $(el).find('img').attr('src') || $(el).parent().find('img').attr('src')

      if (link && !/home|page=|paged=|search|contact|login|register|forum|rules|dmca/i.test(link)) {
        if (title.length > 3 || img) {
          data.push({
            title: title.replace(/Nonton|Movie|Subtitle|Indonesia|Drakor/gi, '').trim(),
            link: link.startsWith('http') ? link : TARGET + (link.startsWith('/') ? '' : '/') + link,
            img: img ? (img.startsWith('http') ? img : TARGET + (img.startsWith('/') ? '' : '/') + img) : ''
          })
        }
      }
    })
    return data.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i)
  } catch { return [] }
}

app.get('/', async (c) => c.json({ status: true, data: await scrapeList(TARGET) }))

app.get('/search', async (c) => {
  const q = c.req.query('q')
  return c.json({ status: true, data: await scrapeList(`${TARGET}/search?q=${q}`) })
})

// INI BAGIAN YANG PALING PENTING (DIPERBAIKI)
app.get('/detail', async (c) => {
  try {
    const url = c.req.query('url')
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': TARGET } })
    const html = await res.text()
    const $ = load(html)
    let streams = []
    
    // 1. Cari SEMUA iframe (biasanya player ada di sini)
    $('iframe').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src')
      if (src && !/ads|facebook|twitter/i.test(src)) {
        if (src.startsWith('//')) src = 'https:' + src
        streams.push(src)
      }
    })

    // 2. Cari link di tombol "Player", "Server", atau "Streaming"
    $('a').each((i, el) => {
      const txt = $(el).text().toLowerCase()
      const href = $(el).attr('href')
      if (href && (txt.includes('player') || txt.includes('server') || txt.includes('stream') || txt.includes('embed') || txt.includes('fast'))) {
        let fullLink = href.startsWith('http') ? href : TARGET + (href.startsWith('/') ? '' : '/') + href
        if (!fullLink.includes('search')) streams.push(fullLink)
      }
    })

    // 3. Cari link MP4/M3U8 mentah di dalam script
    const scripts = $('script').text()
    const videoRegex = /(https?:\/\/[^\s'"]+\.(mp4|m3u8|mov))/gi
    const found = scripts.match(videoRegex)
    if (found) streams.push(...found)

    return c.json({ 
      status: streams.length > 0, 
      streams: [...new Set(streams)] 
    })
  } catch { return c.json({ status: false, streams: [] }) }
})

export default handle(app)
