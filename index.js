import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = 3000;
const DOMAIN = "https://drakor.kita.mobi";

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

// 1. Endpoint Utama (Home)
app.get("/", async (req, res) => {
    try {
        const { data } = await axios.get(DOMAIN, { headers });
        const $ = cheerio.load(data);
        const results = [];

        $(".listupd .animepost").each((i, el) => {
            results.push({
                title: $(el).find("h2").text().trim(),
                id: $(el).find("a").attr("href")?.split("/").filter(Boolean).pop(),
                poster: $(el).find("img").attr("src"),
                type: $(el).find(".type").text().trim()
            });
        });
        res.json({ status: "success", data: results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Endpoint All TV / Filtered
// Menangani: /all?media_type=tv 
// Dan: /all?page=3&country=Korea&year=2024&genre=action&media_type=tv
app.get("/all", async (req, res) => {
    try {
        const { page, country, year, genre, media_type } = req.query;
        
        // Membangun URL filter
        let url = `${DOMAIN}/all/?page=${page || 1}`;
        if (country) url += `&country=${country}`;
        if (year) url += `&year=${year}`;
        if (genre) url += `&genre=${genre}`;
        if (media_type) url += `&media_type=${media_type}`;

        const { data } = await axios.get(url, { headers });
        const $ = cheerio.load(data);
        const results = [];

        $(".listupd .animepost").each((i, el) => {
            results.push({
                title: $(el).find("h2").text().trim(),
                id: $(el).find("a").attr("href")?.split("/").filter(Boolean).pop(),
                poster: $(el).find("img").attr("src"),
                rating: $(el).find(".rating i").text().trim()
            });
        });

        res.json({
            status: "success",
            endpoint: url,
            data: results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server jalan di http://localhost:${PORT}`);
});
