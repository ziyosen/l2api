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

// Helper Scraper Handal
async function fetchData(url) {
    try {
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 9000 })
        return cheerio.load(data)
    } catch (error) {
        console.error(`Gagal akses ${url}:`, error.message)
        return null
    }
}

// 1. DASHBOARD & PETUNJUK
app.get('/', async (req, reply) => {
    return {
        status: true,
        project: "ZeinthHub Animeku API 🔥",
        usage: "Gunakan /get-video?url=LINK_EPISODE untuk ambil video",
        endpoints: {
            anime_list: "/anime-list",
            baru_dirilis: "/anime-baru-dirilis",
            top_rating: "/top-rating",
            get_video: "/get-video?url="
        }
    }
})

// 2. ENDPOINT: ANIME LIST
app.get('/anime-list', async (req, reply) => {
    const $ = await fetchData(`${BASE_URL}/anime/`)
    if (!$) return reply.code(500).send({ status: false })

    const results = []
    $('.listupd .bs').each((i, el) => {
        results.push({
            title: $(el).find('.tt h2').text().trim(),
            link: $(el).find('a').attr('href'),
            image: $(el).find('img').attr('src'),
            type: $(el).find('.typez').text().trim()
        })
    })
    return { status: true, data: results }
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
            episode: $(el).find('.epx').text().trim()
        })
    })
    return { status: true, data: results }
})

// 4. ENDPOINT: GET VIDEO (LOGIKA DIPERKUAT)
app.get('/get-video', async (req, reply) => {
    const { url } = req.query
    if (!url) return reply.code(400).send({ status: false, message: "Linknya mana bos?" })

    const $ = await fetchData(url)
    if (!$) return reply.code(500).send({ status: false })

    // Target area player secara spesifik agar tidak nyasar ke berita/artikel
    let streamUrl = $('.video-content iframe').attr('src') || 
                    $('.player-embed iframe').attr('src') || 
                    $('#pembed iframe').attr('src');

    // Jika tidak ada di area standar, cari iframe manapun yang mengandung kata 'player' atau 'embed'
    if (!streamUrl) {
        $('iframe').each((i, el) => {
            const src = $(el).attr('src');
            if (src && (src.includes('player') || src.includes('embed') || src.includes('stream'))) {
                streamUrl = src;
            }
        });
    }

    const mirrors = []
    $('.mirror option').each((i, el) => {
        const val = $(el).attr('value')
        if (val) {
            mirrors.push({
                server: $(el).text().trim(),
                link: val
            })
        }
    })

    return {
        status: true,
        title: $('.entry-title').text().trim() || "Anime Episode",
        video_url: streamUrl || "Video tidak ditemukan di halaman ini",
        mirrors: mirrors.length > 0 ? mirrors : "Server cadangan kosong"
    }
})

// 5. ENDPOINT: GENRE
app.get('/genres/:genre', async (req, reply) => {
    const { genre } = req.params
    const $ = await fetchData(`${BASE_URL}/genres/${genre}/`)
    if (!$) return reply.code(500).send({ status: false })

    const results = []
    $('.listupd .bs').each((i, el) => {
        results.push({
            title: $(el).find('.tt h2').text().trim(),
            link: $(el).find('a').attr('href'),
            image: $(el).find('img').attr('src')
        })
    })
    return { status: true, genre, data: results }
})

// EXPORT UNTUK VERCEL
export default async function handler(req, res) {
    await app.ready()
    app.server.emit('request', req, res)
}
