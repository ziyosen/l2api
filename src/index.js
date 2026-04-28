import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()
app.use('*', cors())

// Helper untuk scraping per halaman
async function scrapePage(params) {
  const { page, media_type, genre, year, country } = params
  
  // Membangun URL sesuai format target
  // Default 'c2d0de' digunakan jika parameter tidak diisi
  const baseUrl = 'https://drakor.kita.mobi/all'
  const query = new URLSearchParams({
    page: page || '1',
    genre: genre || 'c2d0de',
    year: year || 'c2d0de',
    country: country || 'c2d0de',
    media_type: media_type || 'c2d0de'
  })

  const response = await fetch(`${baseUrl}?${query.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  
  const html = await response.text()
  const results = []
  
  // Regex untuk mengambil data (Sesuaikan dengan struktur HTML drakor.kita.mobi)
  // Ini contoh untuk mengambil Link, Judul, dan Gambar Poster
  const regex = /<div class="video-item">[\s\S]*?href="([^"]+)" title="([^"]+)"[\s\S]*?src="([^"]+)"/g
  let match
  while ((match = regex.exec(html)) !== null) {
    results.push({
      title: match[2],
      link: match[1],
      poster: match[3],
      id: match[1].split('/').pop()
    })
  }
  return results
}

app.get('/all', async (c) => {
  const media_type = c.req.query('media_type')
  const genre = c.req.query('genre')
  const year = c.req.query('year')
  const country = c.req.query('country')

  try {
    // Membuat array promise untuk 5 halaman (page 1 sampai 5)
    const pagesToFetch = [1, 2, 3, 4, 5]
    
    const allPagesResults = await Promise.all(
      pagesToFetch.map(p => scrapePage({ 
        page: p, 
        media_type, 
        genre, 
        year, 
        country 
      }))
    )

    // Menggabungkan semua hasil (flatten array)
    const finalData = allPagesResults.flat()

    return c.json({
      success: true,
      total_items: finalData.length,
      pages_scraped: pagesToFetch.length,
      data: finalData
    })

  } catch (error) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

export default app
