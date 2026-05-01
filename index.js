const express = require('express');
const axios = require('axios');
const { load } = require('cheerio');
const app = express();

const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const TARGET = 'https://pafipasarmuarabungo.org';

app.get('/detail', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.json({ status: false, msg: "Mana url-nya bos?" });

        // 1. Ambil HTML dari target
        const response = await axios.get(url, { 
            headers: { 'User-Agent': UA, 'Referer': TARGET } 
        });
        const html = response.data;
        const $ = load(html);
        
        let streams = [];

        // 2. JURUS HEKER 1: Scan mentahan teks buat nyari link .m3u8 atau .mp4 (Bypass Iklan)
        // Ini nyari link video murni yang biasanya disembunyiin di balik script
        const deepScanPattern = /https?:\/\/[^"']+\.(?:m3u8|mp4|mkv)[^"']*/g;
        const matches = html.match(deepScanPattern);

        if (matches) {
            matches.forEach(link => {
                // Bersihin link dari karakter sampah kayak backslash (\/)
                const cleanLink = link.replace(/\\/g, '');
                if (!streams.includes(cleanLink)) streams.push(cleanLink);
            });
        }

        // 3. JURUS HEKER 2: Ambil Iframe buat cadangan kalau deep scan gagal
        $('iframe').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src');
            if (src) {
                if (src.startsWith('//')) src = 'https:' + src;
                // Filter biar nggak ambil iframe iklan
                if (!src.includes('ads') && !src.includes('pop') && !streams.includes(src)) {
                    streams.push(src);
                }
            }
        });

        // 4. Kasih tanda buat link Doodstream (biar kita tau itu sarang iklan)
        const finalStreams = streams.map(s => s.includes('dood') ? `${s}#is_dood` : s);

        res.json({
            status: true,
            results: finalStreams.length,
            streams: finalStreams,
            engine: "Deep-Extraction-Heker-V2"
        });

    } catch (e) {
        res.json({ status: false, error: e.message });
    }
});

module.exports = app;
