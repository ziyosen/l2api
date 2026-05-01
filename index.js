import Fastify from 'fastify'
import cors from '@fastify/cors'
import { load } from 'cheerio'

const app = Fastify({ logger: false }) // Matiin logger biar enteng di Vercel

// Register CORS
await app.register(cors)

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const TARGET = 'https://pafipasarmuarabungo.org'

// --- HELPER SCANNERS ---
async function deepSearch(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': TARGET } })
    const html = await res.text()
    const $ = load(html)
    
    let streams = []
    
    // Scan Iframe
    $('iframe').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src')
      if (src && !src.includes('ads')) {
        if (src.startsWith('//')) src = 'https:' + src
        streams.push(src)
      }
    })

    // Scan Link Sakti (.m3u8 / .mp4)
    const pattern = /https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*/g
    const matches = html.match(pattern)
    if (matches) {
      matches.forEach(m => {
        const clean = m.replace(/\\/g, '')
        if (!streams.includes(clean)) streams.unshift(clean)
      })
    }
    return streams
  } catch { return [] }
}

// --- ENDPOINTS ---
app.get('/', async () => ({ status: true, msg: "API Heker Jitu Ready" }))

app.get('/detail', async (req) => {
  const url = req.query.url
  if (!url) return { status: false, msg: "Link mana bos?" }
  const data = await deepSearch(url)
  return { status: true, streams: data, engine: "Deep-Scan-V3" }
})

// --- JURUS ANTI-CRASH VERCEL ---
export default async (req, res) => {
  await app.ready()
  app.server.emit('request', req, res)
}
