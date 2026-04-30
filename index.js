import Fastify from 'fastify'
import cors from '@fastify/cors'
import axios from 'axios'
import * as cheerio from 'cheerio'

const app = Fastify({ logger: false })
await app.register(cors, { origin: '*' })

const BASE_URL = 'https://s2.animekuindo.life'
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://s2.animekuindo.life/',
}

// Helper Scraper
async function fetchData(url) {
    try {
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 9000 })
        return cheerio.load(data)
    } catch (error) {
        console.error(`Gagal akses ${url}:`, error.message)
        return null
    }
}

// 1. ENDPOINT: DASHBOARD
app.get('/', async (req, reply) => {
    return {
        status: true,
        project: "ZeinthHub Animeku API 🔥",
        endpoints: {
            anime_list: "/anime-list",
            baru_dirilis: "/anime-baru-dirilis",
            top_rating: "/top-rating",
            jadwal: "/jadwal",
            get_video: "/get-video?url=LINK_DARI_API"
        }
    }
})

// 2. ENDPOINT: ANIME LIST (Tampilan awal dari /anime/)
app.get('/anime-list', async (req, reply) => {
    const $ = await fetchData(`${BASE_URL}/anime/`)
    if (!$) return reply.code(500).send({ status: false })

    const results = []
    $('.listupd .bs').each((i, el) => {
        results.push({
            title: $(el).find('.tt h2').text().trim(),
            link: $(el).find('a').attr('href'),
            image: $(el).find('img').attr('src'),
            type: $(el).find('.typez').text().trim(),
            status: $(el).find('.bt .epx').text().trim()
        })
    })
    return { status: true, total: results.length, data: results }
})

// 3. ENDPOINT: ANIME BARU DIRILIS
app.get('/anime-baru-dirilis', async (req, reply) => {
    const $ = await fetchData(`${BASE_URL}/anime-baru-dirilis/`)
    if (!$) return reply.code(500).send({ status: false })

    const results = []
    $('.listupd .bs').each((i, el) => {
        results.push({
            title: $(el).find('.tt h2').text().trim(),
            link: $(el).find('a').attr('href'),
            image: $(el).find('img').attr('src'),
            episode: $(el).find('.epx').text().trim(),
            type: $(el).find('.typez').text().trim()
        })
    })
    return { status: true, total: results.length, data: results }
})

// 4. ENDPOINT: GENRE
app.get('/genres/:genre', async (req, reply) => {
    const { genre } = req.params
    const $ = await fetchData(`${BASE_URL}/genres/${genre}/`)
    if (!$) return reply.code(500).send({ status: false })

    const results = []
    $('.listupd .bs').each((i, el) => {
        results.push({
            title: $(el).find('.tt h2').text().trim(),
            link: $(el).find('a').attr('href'),
            image: $(el).find('img').attr('src'),
            rating: $(el).find('.rating i').text().trim()
        })
    })
    return { status: true, genre, data: results }
})

// 5. ENDPOINT: GET VIDEO (TAMBAHAN UNTUK PLAYER)
app.get('/get-video', async (req, reply) => {
    const { url } = req.query
    if (!url) return reply.code(400).send({ status: false, message: "Masukan url anime bosku" })

    const $ = await fetchData(url)
    if (!$) return reply.code(500).send({ status: false })

    // Mencari link video utama di iframe
    const streamUrl = $('iframe').attr('src') || $('video source').attr('src')
    
    // Mencari link mirror/server alternatif
    const mirrors = []
    $('.mirror option').each((i, el) => {
        const value = $(el).attr('value')
        if (value) {
            mirrors.push({
                server: $(el).text().trim(),
                link: value
            })
        }
    })

    return {
        status: true,
        title: $('.entry-title').text().trim(),
        video_url: streamUrl || "Link video tidak ditemukan",
        mirrors: mirrors
    }
})

// 6. ENDPOINT: TOP RATING & JADWAL (Opsional jika ingin diaktifkan)
app.get('/top-rating', async (req, reply) => {
    const $ = await fetchData(`${BASE_URL}/top-rating/`)
    if (!$) return reply.code(500).send({ status: false })
    const results = []
    $('.listupd .bs').each((i, el) => {
        results.push({
            title: $(el).find('.tt h2').text().trim(),
            link: $(el).find('a').attr('href'),
            image: $(el).find('img').attr('src'),
            rating: $(el).find('.rating i').text().trim()
        })
    })
    return { status: true, data: results }
})

// EXPORT FOR VERCEL
export default async function handler(req, res) {
    await app.ready()
    app.server.emit('request', req, res)
}
