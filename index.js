import Fastify from 'fastify'
import cors from '@fastify/cors'
import { load } from 'cheerio'

const app = Fastify({ logger: true })
await app.register(cors)

const TARGET = 'https://pafipasarmuarabungo.org'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Helper Scraper
async function scrapeList(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': TARGET } })
    const html = await res.text()
    const $ = load(html)
    const data = []
    $('.ml-item, article, .item, .post-item').each((i, el) => {
      const title = $(el).find('h2, h3, .entry-title, .title').first().text().trim()
      const link = $(el).find('a').attr('href')
      let img = $(el).find('img').attr('data-original') || $(el).find('img').attr('data-src') || $(el).find('img').attr('src')
      if (title && link && link.includes(TARGET)) {
        if (img && img.startsWith('//')) img = 'https:' + img
        data.push({ title: title.replace(/Nonton|Movie|Subtitle|Indonesia/gi, '').trim(), link, img: img || '' })
      }
    })
    return data
  } catch { return [] }
}

// Endpoints
app.get('/', async () => ({ status: true, data: await scrapeList(TARGET) }))

app.get('/search', async (req) => {
  const q = req.query.q
  return { status: true, data: await scrapeList(`${TARGET}/?s=${q}`) }
})

app.get('/detail', async (req, reply) => {
  try {
    const url = req.query.url
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': TARGET } })
    const html = await res.text()
    const $ = load(html)
    
    const iframes = []
    $('iframe').each((i, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src')
      if (src && !src.includes('ads')) {
        if (src.startsWith('//')) src = 'https:' + src
        iframes.push(src)
      }
    })

    const streams = []
    for (const embedUrl of iframes) {
      try {
        const embedRes = await fetch(embedUrl, { headers: { 'User-Agent': UA, 'Referer': url } })
        const embedHtml = await embedRes.text()
        const videoMatch = embedHtml.match(/"file":"([^"]+)"/) || embedHtml.match(/src:\s*'([^']+)'/)
        if (videoMatch) {
          streams.unshift(videoMatch[1].replace(/\\/g, ''))
        } else {
          streams.push(embedUrl)
        }
      } catch { streams.push(embedUrl) }
    }
    return { status: true, streams: [...new Set(streams)] }
  } catch { return { status: false, streams: [] } }
})

// PENTING: Export untuk Vercel
export default async (req, res) => {
  await app.ready()
  app.server.emit('request', req, res)
}
