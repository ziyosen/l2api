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

// 1. ENDPOINT UTAMA & DAFTAR GENRE LENGKAP
app.get('/', async (req, reply) => {
    return {
        status: true,
        project: "ZeinthHub Animeku API 🔥",
        all_genres: [
            "military", "music", "mystery", "mythology", "organized-crime", 
            "otaku-culture", "parody", "performing-arts", "pets", "psychological", 
            "racing", "reincarnation", "reverse-harem", "romance", "samurai", 
            "school", "sci-fi", "seinen", "shoujo", "shounen", "showbiz", 
            "slice-of-life", "space", "sports", "strategy-game", "super-power", 
            "supernatural", "survival", "suspense", "time-travel"
        ],
        endpoints: {
            genre: "/genres/:genre_name",
            anime_list: "/anime",
            top_rating: "/top-rating",
            anime_baru: "/anime-baru",
            jadwal: "/jadwal"
        }
    }
})

// 2. ENDPOINT GENRE (genres/otaku-culture)
app.get('/genres/:genre', async (req, reply) => {
    const { genre } = req.params
    // Mapping URL ke struktur situs: BASE_URL/genres/nama-genre
    const $ = await fetchData(`${BASE_URL}/genres/${genre}/`)
    
    if (!$) return reply.code(500).send({ status: false, message: "Gagal memuat data genre." })

    const results = []
    $('.listupd .bs').each((i, el) => {
        results.push({
            title: $(el).find('.tt h2').text().trim(),
            link: $(el).find('a').attr('href'),
            image: $(el).find('img').attr('src'),
            type: $(el).find('.typez').text().trim(),
            epx: $(el).find('.epx').text().trim()
        })
    })

    return { 
        status: true, 
        genre: genre,
        total: results.length, 
        data: results 
    }
})

// Endpoint lainnya (anime, top-rating, dll) tetap sama seperti sebelumnya...

// EXPORT FOR VERCEL
export default async function handler(req, res) {
    await app.ready()
    app.server.emit('request', req, res)
}
