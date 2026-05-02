import { Hono } from 'hono'
import { load } from 'cheerio'
import { cors } from 'hono/cors'
import { handle } from '@hono/node-server/vercel'

const app = new Hono()
app.use('/*', cors())

const TARGET = 'https://drakorkita.mywap.in'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function scrapeList(url) {
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': UA, 'Referer': TARGET },
      signal: AbortSignal.timeout(10000) 
    })
    const html = await res.text()
    const $ = load(html)
    const data = []

    // Mencari elemen link yang kemungkinan besar adalah item film/drama
    $('a').each((i, el) => {
      const link = $(el).attr('href')
      const title = $(el).text().trim()
      const img = $(el).find('img').attr('src') || $(el).closest('div').find('img').attr('src')

      if (link && title && title.length > 3) {
        // Abaikan link navigasi umum agar tidak masuk daftar film
        const isNav = /login|register|forum|blog|contact|home|page=|search|forgot/i.test(link)
        
        if (!isNav) {
          let fullLink = link.startsWith('http') ? link : TARGET + (link.startsWith('/') ? '' : '/') + link
          
          // Pastikan link mengarah ke konten (bukan external link sosial media)
          if (fullLink.includes(TARGET.replace('https://', ''))) {
            data.push({ 
              title: title.replace(/Nonton|Movie|Subtitle|Indonesia/gi, '').trim(), 
              link: fullLink, 
              img: img ? (img.startsWith('http') ? img : TARGET + (img.startsWith('/') ? '' : '/') + img) : '' 
            })
          }
        }
      }
    })

    // Filter unik berdasarkan link
    return data.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i)
  } catch (err) { 
    console.error('Fetch error:', err.message)
    return [] 
  }
}

async function scrapeInfinite(baseUrl, limitPage = 20) {
  let combined = []
  // Batch processing (Ambil 5 halaman sekaligus per putaran)
  for (let i = 1; i <= limitPage; i += 5) {
    const batch = []
    for (let j = i; j < i + 5 && j <= limitPage; j++) {
      // Format URL sesuai keinginanmu: ?page=J&year=...
      const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${j}&year=c2d0de&genre=c2d0de&country=c2d0de&media_type=c2d0de`
      batch.push(scrapeList(url))
    }
    const results = await Promise.all(batch)
    const flatRes = results.flat()
    
    if (flatRes.length === 0) break 
    combined = [...combined, ...flatRes]
  }
  return combined.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i)
}

// --- ENDPOINTS ---

// Home - Ambil 2 halaman saja supaya cepat
app.get('/', async (c) => {
  const data = await scrapeInfinite(TARGET, 2)
  return c.json({ status: true, data })
})

// All - Ambil 20 halaman sesuai request
app.get('/all', async (c) => {
  const data = await scrapeInfinite(`${TARGET}/all`, 20)
  return c.json({ 
    status: true, 
    total: data.length,
    data 
  })
})

// Search
app.get('/search', async (c) => {
  const q = c.req.query('q')
  if (!q) return c.json({ status: false, message: 'Query q is required' })
  const data = await scrapeList(`${TARGET}/search?q=${q}`)
  return c.json({ status: true, data })
})

// Detail (Ambil Player/Iframe)
app.get('/detail', async (c) => {
  try {
    const url = c.req.query('url')
    if (!url) return c.json({ status: false, message: 'URL is required' })
    
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    const html = await res.text()
    const $ = load(html)
    const streams = []
    
    $('iframe, video, source').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src')
      if (src && !src.includes('ads')) {
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
