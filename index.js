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
      headers: { 
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Referer': TARGET
      },
      signal: AbortSignal.timeout(10000) 
    })
    const html = await res.text()
    const $ = load(html)
    const data = []

    // TARGET: Mencari link yang membungkus gambar atau berada di samping gambar
    // Biasanya di WAP site strukturnya: <div><a><img></a> <br> <a>Judul</a></div>
    $('a').each((i, el) => {
      const link = $(el).attr('href')
      const title = $(el).text().trim()
      const img = $(el).find('img').attr('src') || $(el).parent().find('img').attr('src')

      if (link && !link.includes('whatsapp://') && !link.includes('facebook.com')) {
        // Filter: Hanya ambil link yang punya judul lumayan panjang (asumsi judul film)
        // Dan bukan link menu navigasi
        const isMenu = /home|paged=|page=|search|contact|login|register|forum|rules|dmca/i.test(link)
        
        if (!isMenu && (title.length > 3 || img)) {
          let fullLink = link.startsWith('http') ? link : TARGET + (link.startsWith('/') ? '' : '/') + link
          let fullImg = img ? (img.startsWith('http') ? img : TARGET + (img.startsWith('/') ? '' : '/') + img) : ''

          data.push({
            title: title || 'No Title',
            link: fullLink,
            img: fullImg
          })
        }
      }
    })

    // Jika hasil masih dikit, coba cari di tag <b> atau strong (sering buat judul di WAP)
    if (data.length < 3) {
        $('b, strong').each((i, el) => {
            const parentA = $(el).closest('a')
            if (parentA.length) {
                data.push({
                    title: $(el).text().trim(),
                    link: TARGET + parentA.attr('href'),
                    img: ''
                })
            }
        })
    }

    // Menghapus data sampah (judul yang terlalu pendek atau duplikat)
    return data
      .filter(i => i.title.length > 2 && i.link.includes(TARGET.replace('https://', '')))
      .filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i)
  } catch (err) { 
    return [] 
  }
}

async function scrapeInfinite(baseUrl, limitPage = 20) {
  let combined = []
  // Kita ambil batch per 5 agar tidak lambat
  for (let i = 1; i <= limitPage; i += 5) {
    const batch = []
    for (let j = i; j < i + 5 && j <= limitPage; j++) {
      // Logic URL sesuai request: ?page=J&year=...
      const connector = baseUrl.includes('?') ? '&' : '?'
      const url = `${baseUrl}${connector}page=${j}&year=c2d0de&genre=c2d0de&country=c2d0de&media_type=c2d0de`
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

// 1. Endpoint Utama (Home)
app.get('/', async (c) => {
  const data = await scrapeList(TARGET)
  return c.json({ status: true, data })
})

// 2. Endpoint All (Ambil 20 Halaman)
app.get('/all', async (c) => {
  const data = await scrapeInfinite(`${TARGET}/all`, 20)
  return c.json({ 
    status: true, 
    total: data.length,
    data 
  })
})

// 3. Search
app.get('/search', async (c) => {
  const q = c.req.query('q')
  if (!q) return c.json({ status: false, message: 'Masukkan parameter q' })
  const data = await scrapeList(`${TARGET}/search?q=${q}`)
  return c.json({ status: true, data })
})

// 4. Detail (Ambil Iframe)
app.get('/detail', async (c) => {
  try {
    const url = c.req.query('url')
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    const html = await res.text()
    const $ = load(html)
    const streams = []
    
    // Cari semua iframe atau link yang mengandung kata "stream" atau "embed"
    $('iframe, a').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('href')
      if (src && (src.includes('embed') || src.includes('stream') || src.includes('player'))) {
         if (src.startsWith('//')) src = 'https:' + src
         if (src.startsWith('http')) streams.push(src)
      }
    })
    
    return c.json({ status: true, streams: [...new Set(streams)] })
  } catch { 
    return c.json({ status: false, streams: [] }) 
  }
})

export default handle(app)
