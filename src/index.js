import Fastify from 'fastify'
import cors from '@fastify/cors'
import axios from 'axios'
import * as cheerio from 'cheerio'

const app = Fastify({ logger: false })
await app.register(cors, { origin: '*' })

const TARGET = 'https://otakudesu.blog'
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
}

// FUNGSI UTAMA SCRAPER
async function fetchData(url) {
    try {
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 })
        return cheerio.load(data)
    } catch (error) {
        console.error("Gagal narik data:", error.message)
        return null
    }
}

// 1. ENDPOINT: BERANDA (Sekaligus Daftar Genre dari Foto Bosku)
app.get('/', async (req, reply) => {
    return {
        status: true,
        project: "ZeinthHub Anime API 🔥",
        author: "Fastify Serverless",
        genre_list: [
            "action", "adventure", "comedy", "demons", "drama", "ecchi", 
            "fantasy", "game", "harem", "historical", "horror", "josei", 
            "magic", "martial-arts", "mecha", "military", "music", "mystery", 
            "psychological", "parody", "police", "romance", "samurai", "school", 
            "sci-fi", "seinen", "shoujo", "shoujo-ai", "shounen", "slice-of-life", 
            "sports", "space", "super-power", "thriller", "vampire"
        ],
        endpoints: ["/genres/:genre", "/jadwal-rilis", "/ongoing-anime", "/anime-list"]
    }
})

// 2. ENDPOINT: GENRE (/genres/action)
app.get('/genres/:genre', async (req, reply) => {
    const genre = req.params.genre;
    const $ = await fetchData(`${TARGET}/genres/${genre}/`)
    if (!$) return reply.code(500).send({ status: false, message: "Target down atau diblokir." })

    const results = []
    $('.venz ul li').each((i, el) => {
        results.push({
            title: $(el).find('h2').text().trim(),
            link: $(el).find('h2 a').attr('href'),
            image: $(el).find('img').attr('src'),
            studio: $(el).find('.set').eq(0).text().replace('Studio : ', '').trim(),
            episode: $(el).find('.set').eq(1).text().replace('Episode : ', '').trim(),
            rating: $(el).find('.set').eq(2).text().replace('Rating : ', '').trim(),
        })
    })
    return { status: true, total: results.length, data: results }
})

// 3. ENDPOINT: ONGOING ANIME (/ongoing-anime)
app.get('/ongoing-anime', async (req, reply) => {
    const $ = await fetchData(`${TARGET}/ongoing-anime/`)
    if (!$) return reply.code(500).send({ status: false })

    const results = []
    $('.venz ul li').each((i, el) => {
        results.push({
            title: $(el).find('h2').text().trim(),
            link: $(el).find('h2 a').attr('href'),
            image: $(el).find('img').attr('src'),
            episode: $(el).find('.epz').text().trim(),
            day: $(el).find('.epztipe').text().trim(),
            date: $(el).find('.newnime').text().trim()
        })
    })
    return { status: true, total: results.length, data: results }
})

// 4. ENDPOINT: JADWAL RILIS (/jadwal-rilis)
app.get('/jadwal-rilis', async (req, reply) => {
    const $ = await fetchData(`${TARGET}/jadwal-rilis/`)
    if (!$) return reply.code(500).send({ status: false })

    const results = []
    $('.kgjdwl321').each((i, el) => {
        const day = $(el).find('h2').text().trim()
        const animeList = []
        $(el).find('ul li a').each((j, a) => {
            animeList.push({
                title: $(a).text().trim(),
                link: $(a).attr('href')
            })
        })
        if (animeList.length > 0) results.push({ day, list: animeList })
    })
    return { status: true, data: results }
})

// 5. ENDPOINT: ANIME LIST (/anime-list)
app.get('/anime-list', async (req, reply) => {
    const $ = await fetchData(`${TARGET}/anime-list/`)
    if (!$) return reply.code(500).send({ status: false })

    const results = []
    $('#abtext .barispenz').each((i, el) => {
        const letter = $(el).find('.penzbar').text().trim()
        const animes = []
        $(el).find('.penzbar ~ a, .penzbar ~ div a').each((j, a) => {
            animes.push({
                title: $(a).text().trim(),
                link: $(a).attr('href')
            })
        })
        if (animes.length > 0) results.push({ letter, list: animes })
    })
    return { status: true, data: results }
})

// WAJIB UNTUK VERCEL SERVERLESS
export default async function handler(req, res) {
    await app.ready()
    app.server.emit('request', req, res)
}
