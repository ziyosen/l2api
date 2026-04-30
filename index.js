import Fastify from 'fastify'
import cors from '@fastify/cors'
import axios from 'axios'
import * as cheerio from 'cheerio'

const app = Fastify({ logger: false })
await app.register(cors, { origin: '*' })

const TARGET = 'https://otakudesu.blog'
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://otakudesu.blog/',
    'Cache-Control': 'no-cache'
}

// Helper Scraper
async function fetchData(url) {
    try {
        const { data } = await axios.get(url, { 
            headers: HEADERS, 
            timeout: 9000 // Di bawah limit Vercel (10s)
        })
        return cheerio.load(data)
    } catch (error) {
        console.error(`Gagal akses ${url}:`, error.message)
        return null
    }
}

// 1. HOME & GENRE LIST (Daftar dari foto bosku)
app.get('/', async (req, reply) => {
    return {
        status: true,
        message: "ZeinthHub Anime API Online 🔥",
        genres: [
            "action", "adventure", "comedy", "demons", "drama", "ecchi", 
            "fantasy", "game", "harem", "historical", "horror", "josei", 
            "magic", "martial-arts", "mecha", "military", "music", "mystery", 
            "psychological", "parody", "police", "romance", "samurai", "school", 
            "sci-fi", "seinen", "shoujo", "shoujo-ai", "shounen", "slice-of-life", 
            "sports", "space", "super-power", "thriller", "vampire"
        ],
        endpoints: {
            ongoing: "/ongoing-anime",
            schedule: "/jadwal-rilis",
            list: "/anime-list",
            genre: "/genres/action"
        }
    }
})

// 2. ONGOING ANIME
app.get('/ongoing-anime', async (req, reply) => {
    const $ = await fetchData(`${TARGET}/ongoing-anime/`)
    if (!$) return reply.code(500).send({ status: false, msg: "Target Timeout/Block" })

    const results = []
    $('.venz ul li').each((i, el) => {
        results.push({
            title: $(el).find('h2').text().trim(),
            link: $(el).find('h2 a').attr('href'),
            image: $(el).find('img').attr('src'),
            episode: $(el).find('.epz').text().trim(),
            date: $(el).find('.newnime').text().trim()
        })
    })
    return { status: true, data: results }
})

// 3. GENRE SCRAPER
app.get('/genres/:genre', async (req, reply) => {
    const { genre } = req.params
    const $ = await fetchData(`${TARGET}/genres/${genre}/`)
    if (!$) return reply.code(500).send({ status: false })

    const results = []
    $('.venz ul li').each((i, el) => {
        results.push({
            title: $(el).find('h2').text().trim(),
            link: $(el).find('h2 a').attr('href'),
            image: $(el).find('img').attr('src'),
            studio: $(el).find('.set').eq(0).text().replace('Studio : ', '').trim(),
            episode: $(el).find('.set').eq(1).text().replace('Episode : ', '').trim(),
            rating: $(el).find('.set').eq(2).text().replace('Rating : ', '').trim()
        })
    })
    return { status: true, genre, data: results }
})

// 4. JADWAL RILIS
app.get('/jadwal-rilis', async (req, reply) => {
    const $ = await fetchData(`${TARGET}/jadwal-rilis/`)
    if (!$) return reply.code(500).send({ status: false })

    const results = []
    $('.kgjdwl321').each((i, el) => {
        const day = $(el).find('h2').text().trim()
        const list = []
        $(el).find('ul li a').each((j, a) => {
            list.push({ title: $(a).text().trim(), link: $(a).attr('href') })
        })
        if(day) results.push({ day, list })
    })
    return { status: true, data: results }
})

// 5. ANIME LIST (A-Z)
app.get('/anime-list', async (req, reply) => {
    const $ = await fetchData(`${TARGET}/anime-list/`)
    if (!$) return reply.code(500).send({ status: false })

    const results = []
    $('#abtext .barispenz').each((i, el) => {
        const letter = $(el).find('.penzbar').text().trim()
        const list = []
        $(el).find('a').each((j, a) => {
            const t = $(a).text().trim()
            if(t && t !== letter) list.push({ title: t, link: $(a).attr('href') })
        })
        if(letter) results.push({ letter, list })
    })
    return { status: true, data: results }
})

// EXPORT UNTUK VERCEL
export default async function handler(req, res) {
    await app.ready()
    app.server.emit('request', req, res)
}
