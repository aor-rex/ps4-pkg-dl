const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const BASE_URL = 'https://www.pkgps4.click';

let _browser = null;

async function getBrowser() {
  if (!_browser || !_browser.isConnected()) {
    _browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return _browser;
}

async function fetchHtml(url, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 20000,
        maxRedirects: 5,
      });
      return response.data;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(attempt * 2000);
    }
  }
  throw new Error(`Failed after ${retries} attempts: ${lastError?.message}`);
}

async function fetchWithPuppeteer(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    return await page.content();
  } finally {
    await page.close();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchGames(query, maxPages = 3) {
  const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  console.error(`[pkgps4] Searching: ${searchUrl}`);

  let html;
  try {
    html = await fetchHtml(searchUrl);
  } catch (error) {
    if (error.message.includes('403') || error.message.includes('429')) {
      html = await fetchWithPuppeteer(searchUrl);
    } else {
      throw error;
    }
  }

  const $ = cheerio.load(html);
  const games = [];

  $('.post, .entry').each((i, el) => {
    try {
      const $el = $(el);
      const $link = $el.find('a').first();
      const $img = $el.find('img').first();
      const $title = $el.find('h2, h3, .entry-title').first();

      const href = $link.attr('href') || '';
      const title = $title.text().trim() || $link.text().trim();
      const cover = $img.attr('src') || $img.attr('data-src') || '';

      if (!title || !href || !href.includes('pkgps4.click')) return;

      const slug = href.replace(BASE_URL, '').replace(/\/$/, '').replace(/^\//, '');

      games.push({
        title,
        slug,
        url: href,
        cover: cover.startsWith('http') ? cover : '',
        size: null,
        date: null,
      });
    } catch (err) {
      // skip
    }
  });

  console.error(`[pkgps4] Found ${games.length} games for "${query}"`);
  return games;
}

async function scrapeGameDetail(gameUrl) {
  console.error(`[pkgps4] Fetching: ${gameUrl}`);

  let html;
  try {
    html = await fetchHtml(gameUrl);
  } catch (error) {
    if (error.message.includes('403') || error.message.includes('429')) {
      html = await fetchWithPuppeteer(gameUrl);
    } else {
      throw error;
    }
  }

  const $ = cheerio.load(html);

  const title = $('h1, .entry-title').first().text().trim() || $('title').text().split('|')[0].trim();

  let cover = '';
  const $featured = $('article img, .post img').first();
  if ($featured.length) {
    cover = $featured.attr('src') || $featured.attr('data-src') || '';
  }
  if (!cover) {
    cover = $('meta[property="og:image"]').attr('content') || '';
  }

  const gallery = [];
  $('.entry-content img, .post-content img').each((i, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src') || '';
    if (src && !src.includes('emoji') && src !== cover && src.startsWith('http')) {
      gallery.push(src);
    }
  });

  const videos = [];
  $('iframe[src*="youtube"], iframe[src*="youtu.be"]').each((i, iframe) => {
    const src = $(iframe).attr('src') || '';
    const match = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) {
      videos.push({
        url: `https://www.youtube.com/watch?v=${match[1]}`,
        embedUrl: `https://www.youtube.com/embed/${match[1]}`,
        title: `Video ${i + 1}`,
      });
    }
  });

  const description = $('.entry-content, .post-content').text().trim().substring(0, 2000);

  const downloads = [];

  const fileHosts = [
    { name: '1Fichier', pattern: /1fichier\.com/i },
    { name: 'MediaFire', pattern: /mediafire\.com/i },
    { name: 'Google Drive', pattern: /drive\.google\.com/i },
    { name: 'Mega', pattern: /mega\.nz/i },
    { name: 'Uptobox', pattern: /uptobox\.com/i },
    { name: 'ZippyShare', pattern: /zippyshare\.com/i },
    { name: 'TeraBox', pattern: /terabox\.com/i },
  ];

  const mirrors = [];

  $('a[href]').each((i, a) => {
    const href = $(a).attr('href') || '';
    const text = $(a).text().trim();

    for (const host of fileHosts) {
      if (host.pattern.test(href) && href.startsWith('http')) {
        const existing = mirrors.find(m => m.url === href);
        if (!existing) {
          mirrors.push({
            host: host.name,
            url: href,
            label: text || host.name,
          });
        }
        break;
      }
    }
  });

  if (mirrors.length > 0) {
    downloads.push({
      type: 'Base Game',
      size: null,
      mirrors: mirrors,
    });
  }

  const result = {
    title,
    url: gameUrl,
    slug: gameUrl.replace(BASE_URL, '').replace(/\/$/, '').replace(/^\//, ''),
    cover: cover.startsWith('http') ? cover : '',
    gallery: [...new Set(gallery)],
    videos,
    description,
    size: null,
    region: null,
    version: null,
    date: null,
    downloads,
  };

  console.error(`[pkgps4] Scraped: ${title} (${mirrors.length} mirrors)`);
  return result;
}

module.exports = {
  searchGames,
  scrapeGameDetail,
  BASE_URL,
};