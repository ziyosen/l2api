import { Hono } from 'hono'
import { load } from 'cheerio'
import { cors } from 'hono/cors'
import { handle } from '@hono/node-server/vercel'

const app = new Hono()
app.use('/*', cors())

const TARGET = 'https://drakorkita.mywap.in'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

async function scrapeList(url) {
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': UA, 'Referer': TARGET },
      signal: AbortSignal.timeout(10000) 
    })
    const html = await res.text()
    const $ = load(html)
    const data = []

    $('a').each((i, el) => {
      const link = $(el).attr('href')
      const title = $(el).text().trim()
      const img = $(el).find('img').attr('src') || $(el).parent().find('img').attr('src')

      if (link && !link.includes('whatsapp') && !link.includes('facebook')) {
        const isMenu = /home|page=|paged=|search|contact|login|register|forum|rules|dmca/i.test(link)
        if (!isMenu && (title.length > 3 || img)) {
          let fullLink = link.startsWith('http') ? link : TARGET + (link.startsWith('/') ? '' : '/') + link
          let fullImg = img ? (img.startsWith('http') ? img : TARGET + (img.startsWith('/') ? '' : '/') + img) : ''
          data.push({
            title: title.replace(/Nonton|Movie|Subtitle|Indonesia|Drakor/gi, '').trim(),
            link: fullLink,
            img: fullImg
          })
        }
      }
    })
    return data.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i)
  } catch { return [] }
}

app.get('/', async (c) => c.json({ status: true, data: await scrapeList(TARGET) }))

app.get('/all', async (c) => {
  let combined = []
  for (let j = 1; j <= 20; j++) {
    const url = `${TARGET}/all?page=${j}&year=c2d0de&genre=c2d0de&country=c2d0de&media_type=c2d0de`
    combined = [...combined, ...(await scrapeList(url))]
  }
  return c.json({ status: true, data: combined.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i) })
})

app.get('/search', async (c) => {
  const q = c.req.query('q')
  return c.json({ status: true, data: await scrapeList(`${TARGET}/search?q=${q}`) })
})

app.get('/detail', async (c) => {
  try {
    const url = c.req.query('url')
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': TARGET } })
    const html = await res.text()
    const $ = load(html)
    let streams = []
    
    // 1. Cari iframe langsung
    $('iframe').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src')
      if (src && !src.includes('ads')) {
        if (src.startsWith('//')) src = 'https:' + src
        streams.push(src)
      }
    })

    // 2. Cari tombol player/server kalau iframe gak ada
    if (streams.length === 0) {
      $('a').each((i, el) => {
        const txt = $(el).text().toLowerCase()
        const href = $(el).attr('href')
        if (href && (txt.includes('player') || txt.includes('server') || txt.includes('stream') || txt.includes('embed'))) {
           let fullLink = href.startsWith('http') ? href : TARGET + (href.startsWith('/') ? '' : '/') + href
           if (!fullLink.includes('search')) streams.push(fullLink)
        }
      })
    }

    return c.json({ status: streams.length > 0, streams: [...new Set(streams)] })
  } catch { return c.json({ status: false, streams: [] }) }
})

export default handle(app)
