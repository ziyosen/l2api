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
        return { $, raw: data };
    } catch (error) {
        return null;
    }
}

// 1. DASHBOARD
app.get('/', async (req, reply) => {
    return {
        status: true,
        project: "ZeinthHub Animeku API 🔥",
        usage: "Gunakan /get-video?url=[LINK_EPISODE] untuk ambil video",
        endpoints: {
            anime_list: "/anime-list",
            baru_dirilis: "/anime-baru-dirilis",
            get_video: "/get-video?url="
        }
    }
})

// 2. ENDPOINT: ANIME LIST
app.get('/anime-list', async (req, reply) => {
    try {
        const { data } = await axios.get(`${BASE_URL}/anime/`, { headers: HEADERS });
        const $ = cheerio.load(data);
        const results = [];
        $('.listupd .bs').each((i, el) => {
            results.push({
                title: $(el).find('.tt h2').text().trim(),
                link: $(el).find('a').attr('href'),
                image: $(el).find('img').attr('src')
            });
        });
        return { status: true, data: results };
    } catch (e) { return { status: false } }
})

// 3. ENDPOINT: ANIME BARU DIRILIS
app.get('/anime-baru-dirilis', async (req, reply) => {
    try {
        const { data } = await axios.get(`${BASE_URL}/anime-baru-dirilis/`, { headers: HEADERS });
        const $ = cheerio.load(data);
        const results = [];
        $('.listupd .bs').each((i, el) => {
            results.push({
                title: $(el).find('.tt h2').text().trim(),
                link: $(el).find('a').attr('href'),
                image: $(el).find('img').attr('src'),
                episode: $(el).find('.epx').text().trim()
            });
        });
        return { status: true, data: results };
    } catch (e) { return { status: false } }
})

// 4. ENDPOINT: GET VIDEO (VERSI BRUTE-FORCE)
app.get('/get-video', async (req, reply) => {
    const { url } = req.query;
    if (!url) return reply.code(400).send({ status: false, message: "Linknya mana bos?" });

    try {
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 9000 });
        const $ = cheerio.load(data);

        // Cari Iframe dengan Selector Normal
        let streamUrl = $('.video-content iframe').attr('src') || 
                        $('.player-embed iframe').attr('src') || 
                        $('#pembed iframe').attr('src');

        // Jika Gagal, Cari Paksa pakai Regex di seluruh kode HTML (Brute Force)
        if (!streamUrl) {
            const regexIframe = /<iframe.*?src=['"](.*?)['"]/gi;
            let match;
            while ((match = regexIframe.exec(data)) !== null) {
                const link = match[1];
                if (link.includes('player') || link.includes('embed') || link.includes('stream')) {
                    streamUrl = link;
                    break;
                }
            }
        }

        // Cari Link Mirror
        const mirrors = [];
        $('.mirror option').each((i, el) => {
            const val = $(el).attr('value');
            if (val) mirrors.push({ server: $(el).text().trim(), link: val });
        });

        return {
            status: true,
            title: $('.entry-title').first().text().trim(),
            video_url: streamUrl || "Video disembunyikan web target bos!",
            mirrors: mirrors
        };
    } catch (error) {
        return { status: false, message: error.message };
    }
})

// 5. ENDPOINT: GENRE
app.get('/genres/:genre', async (req, reply) => {
    const { genre } = req.params;
    try {
        const { data } = await axios.get(`${BASE_URL}/genres/${genre}/`, { headers: HEADERS });
        const $ = cheerio.load(data);
        const results = [];
        $('.listupd .bs').each((i, el) => {
            results.push({
                title: $(el).find('.tt h2').text().trim(),
                link: $(el).find('a').attr('href'),
                image: $(el).find('img').attr('src')
            });
        });
        return { status: true, genre, data: results };
    } catch (e) { return { status: false } }
})

export default async function handler(req, res) {
    await app.ready();
    app.server.emit('request', req, res);
}
