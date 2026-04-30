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
async function fetchPage(url) {
    try {
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        return { $, html: data, load: cheerio.load(data) };
    } catch (error) {
        return null;
    }
}

// 1. DASHBOARD
app.get('/', async (req, reply) => {
    return {
        status: true,
        project: "ZeinthHub Ultimate API 🔥",
        usage: "Gunakan /get-video?url=[LINK_EPISODE]",
        endpoints: {
            list: "/anime-list",
            recent: "/anime-baru-dirilis",
            video: "/get-video?url="
        }
    }
})

// 2. ENDPOINT: ANIME LIST
app.get('/anime-list', async (req, reply) => {
    const page = await fetchPage(`${BASE_URL}/anime/`);
    if (!page) return { status: false };
    const $ = page.load;
    const results = [];
    $('.listupd .bs').each((i, el) => {
        results.push({
            title: $(el).find('.tt h2').text().trim(),
            link: $(el).find('a').attr('href'),
            image: $(el).find('img').attr('src')
        });
    });
    return { status: true, data: results };
})

// 3. ENDPOINT: ANIME BARU DIRILIS
app.get('/anime-baru-dirilis', async (req, reply) => {
    const page = await fetchPage(`${BASE_URL}/anime-baru-dirilis/`);
    if (!page) return { status: false };
    const $ = page.load;
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
})

// 4. ENDPOINT: GET VIDEO (SUPER SCANNER VERSION)
app.get('/get-video', async (req, reply) => {
    const { url } = req.query;
    if (!url) return { status: false, message: "URL kosong bos!" };

    try {
        const response = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        const html = response.data;
        const $ = cheerio.load(html);

        // A. Cari di Iframe Player (Standard)
        let videoUrl = $('.video-content iframe').attr('src') || 
                       $('.player-embed iframe').attr('src') || 
                       $('#pembed iframe').attr('src');

        // B. Deep Script Scanning (Cari link tersembunyi di JS)
        if (!videoUrl) {
            const scripts = $('script').text();
            const regexLink = /(https?:\/\/[^\s'"]+(?:player|embed|stream|m3u8|mp4)[^\s'"]*)/gi;
            const matches = scripts.match(regexLink);
            if (matches) {
                videoUrl = matches.find(link => !link.includes('animekuindo') && !link.includes('google-analytics'));
            }
        }

        // C. Mirror Scanning & Base64 Decoding
        const mirrors = [];
        $('.mirror option').each((i, el) => {
            const val = $(el).attr('value');
            if (val && val !== "") {
                let linkFinal = val;
                // Coba decode jika isinya base64
                if (!val.startsWith('http')) {
                    try { linkFinal = Buffer.from(val, 'base64').toString('utf-8'); } catch(e) {}
                }
                mirrors.push({
                    server: $(el).text().trim(),
                    link: linkFinal.startsWith('http') ? linkFinal : `https:${linkFinal}`
                });
            }
        });

        // D. Final Brute Force Regex (Jika Iframe masih null)
        if (!videoUrl && mirrors.length > 0) videoUrl = mirrors[0].link;

        return {
            status: true,
            title: $('.entry-title').first().text().trim().split('\n')[0],
            video_url: videoUrl || "Pelindung web terlalu kuat, butuh browser beneran bos!",
            mirrors: mirrors
        };
    } catch (error) {
        return { status: false, error: error.message };
    }
})

// 5. ENDPOINT: GENRE
app.get('/genres/:genre', async (req, reply) => {
    const { genre } = req.params;
    const page = await fetchPage(`${BASE_URL}/genres/${genre}/`);
    if (!page) return { status: false };
    const $ = page.load;
    const results = [];
    $('.listupd .bs').each((i, el) => {
        results.push({
            title: $(el).find('.tt h2').text().trim(),
            link: $(el).find('a').attr('href'),
            image: $(el).find('img').attr('src')
        });
    });
    return { status: true, data: results };
})

export default async function handler(req, res) {
    await app.ready();
    app.server.emit('request', req, res);
}
