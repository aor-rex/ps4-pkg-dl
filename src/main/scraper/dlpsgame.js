const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const BASE_URL = 'https://dlpsgame.com';
const CATEGORY_URL = `${BASE_URL}/category/ps4/`;

// Cache puppeteer browser instance
let _browser = null;

/**
 * Get or create puppeteer browser
 */
async function getBrowser() {
  if (!_browser || !_browser.isConnected()) {
    _browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return _browser;
}

/**
 * Fetch HTML using Puppeteer (for pages with anti-bot protection)
 */
async function fetchWithPuppeteer(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    console.error(`[scraper] Using Puppeteer for: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const html = await page.content();
    return html;
  } finally {
    await page.close();
  }
}

/**
 * Fetch HTML from a URL with retry and error handling
 */
async function fetchHtml(url, retries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.error(`[scraper] Fetch attempt ${attempt}/${retries}: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
        },
        timeout: 20000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500, // Accept any non-5xx status
      });
      
      if (response.status === 403) {
        throw new Error(`Access denied (403) - site may have anti-bot protection`);
      }
      
      if (response.status === 429) {
        throw new Error(`Rate limited (429) - too many requests`);
      }
      
      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.data;
    } catch (error) {
      lastError = error;
      console.error(`[scraper] Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < retries) {
        const delay = attempt * 2000; // Exponential backoff
        console.error(`[scraper] Waiting ${delay}ms before retry...`);
        await sleep(delay);
      }
    }
  }
  
  throw new Error(`Failed after ${retries} attempts: ${lastError?.message}`);
}

/**
 * Check if a slug indicates a PS4 game
 */
function isPS4(slug) {
  return slug.toLowerCase().includes('ps4');
}

/**
 * Scrape the PS4 category page and return list of games
 * @param {number} page - Page number to scrape (default: 1)
 * @returns {Promise<{games: Array, hasMore: boolean, currentPage: number}>}
 */
async function scrapeCategory(page = 1) {
  const url = page > 1 ? `${CATEGORY_URL}page/${page}/` : CATEGORY_URL;
  
  console.error(`[scraper] Fetching category page: ${url}`);
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  
  const games = [];
  
  // dlpsgame.com uses WordPress structure
  // Games are typically in article/post elements
  $('article, .post, .type-post').each((i, element) => {
    try {
      // Get the link and title
      const $link = $(element).find('a[href]').first();
      const $title = $(element).find('h2, h3, .entry-title, .post-title').first();
      const $img = $(element).find('img').first();
      
      const href = $link.attr('href') || '';
      const slug = extractSlug(href);
      
      // Only include PS4 games
      if (!isPS4(slug) && !isPS4(href)) {
        return; // skip
      }
      
      const title = $title.text().trim() || $link.text().trim();
      const cover = $img.attr('src') || $img.attr('data-src') || '';
      
      if (!title || !href) {
        return; // skip incomplete entries
      }
      
      games.push({
        title,
        slug,
        url: href,
        cover: cover.startsWith('http') ? cover : `${BASE_URL}${cover}`,
        size: null, // Will be extracted from game detail page
        date: null, // Will be extracted from game detail page
      });
    } catch (err) {
      console.error(`[scraper] Error parsing game card: ${err.message}`);
    }
  });
  
  // Check if there's a next page
  const hasNext = $('a.next, .nextpostslink, nav a:contains("Next")').length > 0;
  
  console.error(`[scraper] Found ${games.length} PS4 games on page ${page}`);
  
  return {
    games,
    hasMore: hasNext,
    currentPage: page,
  };
}

/**
 * Scrape multiple pages of the category
 * @param {number} maxPages - Maximum pages to scrape
 * @returns {Promise<Array>}
 */
async function scrapeCategoryMulti(maxPages = 3) {
  const allGames = [];
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      const result = await scrapeCategory(page);
      allGames.push(...result.games);
      
      if (!result.hasMore) {
        break;
      }
    } catch (err) {
      console.error(`[scraper] Failed to scrape page ${page}: ${err.message}`);
      break;
    }
    
    // Be polite: small delay between pages
    await sleep(1000);
  }
  
  return allGames;
}

/**
 * Extract slug from URL
 */
function extractSlug(url) {
  try {
    const parsed = new URL(url, BASE_URL);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts.join('/') || '';
  } catch {
    return url;
  }
}

/**
 * Scrape a single game's detail page
 * @param {string} gameUrl - Full URL or slug of the game page
 * @returns {Promise<Object>}
 */
async function scrapeGameDetail(gameUrl) {
  const url = gameUrl.startsWith('http') ? gameUrl : `${BASE_URL}/${gameUrl}/`;
  
  console.error(`[scraper] Fetching game page: ${url}`);
  
  let html;
  try {
    // Try axios first
    html = await fetchHtml(url);
  } catch (error) {
    const errorMsg = error.message || '';
    if (errorMsg.includes('403') || errorMsg.includes('anti-bot') || errorMsg.includes('429') || errorMsg.includes('Rate limited') || errorMsg === '') {
      // Fall back to Puppeteer
      console.error(`[scraper] Falling back to Puppeteer due to: ${errorMsg || 'empty error (likely blocked)'}`);
      html = await fetchWithPuppeteer(url);
    } else {
      throw error;
    }
  }
  
  const $ = cheerio.load(html);
  
  // Extract title
  const title = $('h1.entry-title, h1.post-title, h1').first().text().trim() || 
                $('title').text().trim().split('|')[0].trim();
  
  // Extract cover/featured image
  let cover = '';
  const $featuredImg = $('article img').first();
  if ($featuredImg.length) {
    cover = $featuredImg.attr('src') || $featuredImg.attr('data-src') || '';
  }
  // Fallback: og:image
  if (!cover) {
    cover = $('meta[property="og:image"]').attr('content') || '';
  }
  
  // Extract gallery images (images in post content, excluding icons/ads)
  const gallery = [];
  $('.entry-content img, .post-content img, article img').each((i, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src') || '';
    if (src && !src.includes('emoji') && !src.includes('icon') && src !== cover) {
      gallery.push(src.startsWith('http') ? src : `${BASE_URL}${src}`);
    }
  });
  
  // Deduplicate gallery
  const uniqueGallery = [...new Set(gallery)];
  
  // Extract YouTube videos
  const videos = [];
  $('iframe').each((i, iframe) => {
    const src = $(iframe).attr('src') || '';
    if (src.includes('youtube') || src.includes('youtu.be')) {
      const videoId = extractYouTubeId(src);
      if (videoId) {
        videos.push({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          title: `Video ${i + 1}`,
        });
      }
    }
  });
  
  // Also check for YouTube links in text
  const contentHtml = $('.entry-content, .post-content').html() || '';
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  let match;
  while ((match = youtubeRegex.exec(contentHtml)) !== null) {
    const videoId = match[1];
    if (!videos.some(v => v.url.includes(videoId))) {
      videos.push({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        title: `Video ${videos.length + 1}`,
      });
    }
  }
  
  // Extract description (post content text)
  const description = $('.entry-content, .post-content').text().trim()
    .replace(/\s+/g, ' ')
    .substring(0, 2000); // Limit length
  
  // Extract metadata from text patterns
  const fullText = $('.entry-content, .post-content').text() || '';
  const size = extractPattern(fullText, /(?:size|file\s*size)[:\s]+(\d+(?:\.\d+)?\s*(?:GB|MB))/i);
  const region = extractPattern(fullText, /(?:region)[:\s]+(\w+)/i);
  const version = extractPattern(fullText, /(?:version|v)[:\s]+(v?\d+(?:\.\d+)?)/i);
  
  // Extract date
  const date = $('time, .entry-date, .post-date, .published').attr('datetime') ||
               $('time, .entry-date, .post-date').text().trim() ||
               null;
  
  // Extract download links (async - may need to scrape additional pages)
  const downloads = await extractDownloadLinksAsync($, fullText);
  
  const result = {
    title,
    url,
    slug: extractSlug(url),
    cover: cover.startsWith('http') ? cover : `${BASE_URL}${cover}`,
    gallery: uniqueGallery,
    videos,
    description,
    size: size || null,
    region: region || null,
    version: version || null,
    date: date || null,
    downloads,
  };
  
  console.error(`[scraper] Scraped game: ${title} (${downloads.length} download groups)`);
  
  return result;
}

/**
 * Extract a pattern match from text
 */
function extractPattern(text, regex) {
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/**
 * Known file hosts and their patterns
 */
const FILE_HOSTS = [
  { name: 'MediaFire', patterns: [/mediafire\.com/i, /downloadgameps3\.net/i, /downloadgameps\.com/i] },
  { name: 'Viking File', patterns: [/vikingfile\.com/i, /viking-file\.com/i] },
  { name: 'Akirabox', patterns: [/akirabox\.com/i, /akiabox\.com/i] },
  { name: 'UploadHaven', patterns: [/uploadhaven\.com/i] },
  { name: 'GoFile', patterns: [/gofile\.io/i] },
  { name: 'Mega', patterns: [/mega\.nz/i, /mega\.co\.nz/i] },
  { name: 'Google Sheet', patterns: [/docs\.google\.com\/spreadsheets/i] },
  { name: 'Google Doc', patterns: [/docs\.google\.com\/document/i] },
  { name: 'Google Drive', patterns: [/drive\.google\.com/i] },
  { name: '1Fichier', patterns: [/1fichier\.com/i] },
  { name: 'FileCrypt', patterns: [/filecrypt\.cc/i, /filecryp\.t/i] },
  { name: 'Rootz', patterns: [/rootz\.com/i] },
];

/**
 * Decode a shrinkearn.com ad-link URL to get the actual destination
 */
function decodeAdLink(url) {
  try {
    const parsed = new URL(url);
    const encodedUrl = parsed.searchParams.get('url');
    
    if (encodedUrl) {
      const decoded = Buffer.from(encodedUrl, 'base64').toString('utf8');
      return decoded;
    }
  } catch {
    // Not a valid shrinkearn URL
  }
  
  return url;
}

/**
 * Extract download links from the page
 * For links pointing to downloadgameps3.net, scrape those pages to get actual file host URLs
 */
async function extractDownloadLinksAsync($, fullText) {
  const downloads = [];
  const seen = new Set();
  
  // Get all links on the page
  const links = [];
  $('a[href]').each((i, a) => {
    const href = $(a).attr('href');
    const text = $(a).text().trim();
    if (href && href.startsWith('http')) {
      links.push({ href, text });
    }
  });
  
  // Group links by detecting file hosts
  // Also decode shrinkearn/clk.sh links to find actual hosts
  const hostGroups = {};
  const downloadPs3Urls = [];
  
  for (const link of links) {
    // First try to decode any ad-link service
    const decodedUrl = decodeAdLink(link.href);
    
    // Check if it's a downloadgameps3.net link
    if (decodedUrl.includes('downloadgameps3.net/archives/')) {
      const key = decodedUrl;
      if (!seen.has(key)) {
        seen.add(key);
        downloadPs3Urls.push(decodedUrl);
      }
      continue;
    }
    
    for (const host of FILE_HOSTS) {
      // Check both original and decoded URL
      const matchesHost = host.patterns.some(p => p.test(link.href)) ||
                          host.patterns.some(p => p.test(decodedUrl));
      
      if (matchesHost) {
        if (!hostGroups[host.name]) {
          hostGroups[host.name] = [];
        }
        
        // Avoid duplicates
        const key = `${host.name}:${decodedUrl}`;
        if (!seen.has(key)) {
          seen.add(key);
          hostGroups[host.name].push({
            host: host.name,
            url: decodedUrl,
            originalUrl: link.href,
            label: link.text || host.name,
          });
        }
        break;
      }
    }
  }
  
  // Scrape downloadgameps3.net pages to get actual file host URLs
  const seenPs3Urls = new Set();
  for (const ps3Url of downloadPs3Urls) {
    if (seenPs3Urls.has(ps3Url)) continue;
    seenPs3Urls.add(ps3Url);
    
    try {
      console.error(`[scraper] Scraping downloadgameps3.net for mirrors: ${ps3Url}`);
      const mirrors = await scrapeDownloadGamePs3Full(ps3Url);
      
      for (const mirror of mirrors) {
        const key = `${mirror.host}:${mirror.url}`;
        if (!seen.has(key)) {
          seen.add(key);
          if (!hostGroups[mirror.host]) {
            hostGroups[mirror.host] = [];
          }
          hostGroups[mirror.host].push(mirror);
        }
      }
    } catch (err) {
      console.error(`[scraper] Failed to scrape ${ps3Url}: ${err.message}`);
    }
    
    // Delay between pages
    await sleep(1500);
  }
  
  // Group all mirrors together
  const allMirrors = [];
  for (const [hostName, mirrorLinks] of Object.entries(hostGroups)) {
    allMirrors.push(...mirrorLinks);
  }
  
  if (allMirrors.length > 0) {
    downloads.push({
      type: 'Base Game',
      size: null,
      mirrors: allMirrors,
    });
  }
  
  return downloads;
}

/**
 * Scrape downloadgameps3.net page for plain text URLs and mirror sub-pages
 * These pages have:
 * - Plain text URLs in body (e.g., https://www.mediafire.com/file/...)
 * - Links to sub-pages per mirror (e.g., /archives/32238 for MediaFire)
 */
async function scrapeDownloadGamePs3(url) {
  let html;
  try {
    html = await fetchHtml(url);
  } catch (error) {
    if (error.message.includes('403') || error.message.includes('anti-bot')) {
      console.error(`[scraper] Using Puppeteer for downloadgameps3.net: ${url}`);
      html = await fetchWithPuppeteer(url);
    } else {
      throw error;
    }
  }
  
  const $ = cheerio.load(html);
  
  // Extract plain text URLs from body
  const bodyText = $('body').text() || '';
  
  // Find direct file host URLs using regex
  const urlRegex = /(https?:\/\/(?:www\.)?(?:mediafire\.com\/file\/[^\s]+|1fichier\.com\/\?[^\s]+|mega\.nz\/[^\s#]+|vikingfile\.com\/[^\s]+|akirabox\.com\/[^\s]+|rootz\.com\/[^\s]+))/gi;
  const foundUrls = [];
  let match;
  
  while ((match = urlRegex.exec(bodyText)) !== null) {
    foundUrls.push(match[1]);
  }
  
  // Also find links to sub-pages on downloadgameps3.net
  const subPages = [];
  $('a[href]').each((i, a) => {
    const href = $(a).attr('href');
    const text = $(a).text().trim();
    // Match links to other downloadgameps3.net sub-pages
    if (href.includes('downloadgameps3.net/archives/') && !href.endsWith(url.split('/archives/')[1]?.split('/')[0])) {
      subPages.push({
        url: href,
        mirrorLabel: text || 'Unknown',
      });
    }
  });
  
  // Deduplicate URLs
  const uniqueUrls = [...new Set(foundUrls)];
  
  return {
    urls: uniqueUrls,
    subPages,
    url,
  };
}

/**
 * Follow sub-pages on downloadgameps3.net and extract URLs from each
 */
async function scrapeDownloadGamePs3Full(url) {
  console.error(`[scraper] Scraping downloadgameps3.net: ${url}`);
  const result = await scrapeDownloadGamePs3(url);
  
  const allMirrors = [];
  
  // Add direct URLs found on main page
  for (const fileUrl of result.urls) {
    allMirrors.push({
      url: fileUrl,
      host: detectHostFromUrl(fileUrl),
      label: extractFilenameFromUrl(fileUrl) || 'File',
    });
  }
  
  // Follow sub-pages
  for (const subPage of result.subPages) {
    try {
      console.error(`[scraper] Following sub-page: ${subPage.url} (${subPage.mirrorLabel})`);
      const subResult = await scrapeDownloadGamePs3(subPage.url);
      
      for (const fileUrl of subResult.urls) {
        allMirrors.push({
          url: fileUrl,
          host: detectHostFromUrl(fileUrl),
          label: subPage.mirrorLabel,
        });
      }
      
      // Delay between sub-pages (generous to avoid 429)
      await sleep(3000);
    } catch (err) {
      console.error(`[scraper] Failed to scrape sub-page ${subPage.url}: ${err.message}`);
    }
  }
  
  return allMirrors;
}

/**
 * Detect file host from a URL
 */
function detectHostFromUrl(url) {
  for (const host of FILE_HOSTS) {
    if (host.patterns.some(p => p.test(url))) {
      return host.name;
    }
  }
  return 'Unknown';
}

/**
 * Extract filename from URL
 */
function extractFilenameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/');
    const filename = parts[parts.length - 1] || parts[parts.length - 2];
    return decodeURIComponent(filename) || null;
  } catch {
    return null;
  }
}

/**
 * Search games using the site's built-in search
 * Uses WordPress search: https://dlpsgame.com/?s=query
 */
async function searchGames(query, maxPages = 3) {
  const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  
  console.error(`[scraper] Searching site: ${searchUrl}`);
  let html;
  try {
    html = await fetchHtml(searchUrl);
  } catch (error) {
    const errorMsg = error.message || '';
    if (errorMsg.includes('403') || errorMsg.includes('anti-bot') || errorMsg.includes('429') || errorMsg === '') {
      html = await fetchWithPuppeteer(searchUrl);
    } else {
      throw error;
    }
  }
  
  let $ = cheerio.load(html);
  const games = [];
  
  // Parse search results (same structure as category page)
  $('article, .post, .type-post').each((i, element) => {
    try {
      const $link = $(element).find('a[href]').first();
      const $title = $(element).find('h2, h3, .entry-title, .post-title').first();
      const $img = $(element).find('img').first();
      
      const href = $link.attr('href') || '';
      const slug = extractSlug(href);
      
      // Only include PS4 games
      if (!isPS4(slug) && !isPS4(href)) {
        return;
      }
      
      const title = $title.text().trim() || $link.text().trim();
      const cover = $img.attr('src') || $img.attr('data-src') || '';
      
      if (!title || !href) return;
      
      games.push({
        title,
        slug,
        url: href,
        cover: cover.startsWith('http') ? cover : `${BASE_URL}${cover}`,
        size: null,
        date: null,
      });
    } catch (err) {
      console.error(`[scraper] Error parsing search result: ${err.message}`);
    }
  });
  
  // Check for next page of search results
  const hasNext = $('a.next, .nextpostslink, nav a:contains("Next")').length > 0;
  
  console.error(`[scraper] Found ${games.length} PS4 games in search results (page 1)`);
  
  // Follow pagination if needed
  if (hasNext && maxPages > 1) {
    let currentPage = 2;
    let nextUrl = `${searchUrl}&paged=${currentPage}`;
    
    while (currentPage <= maxPages) {
      try {
        console.error(`[scraper] Fetching search page ${currentPage}: ${nextUrl}`);
        let pageHtml;
        try {
          pageHtml = await fetchHtml(nextUrl);
        } catch (error) {
          const errorMsg = error.message || '';
          if (errorMsg.includes('403') || errorMsg.includes('anti-bot') || errorMsg.includes('429') || errorMsg === '') {
            pageHtml = await fetchWithPuppeteer(nextUrl);
          } else {
            throw error;
          }
        }
        
        const page$ = cheerio.load(pageHtml);
        let pageCount = 0;
        
        page$('article, .post, .type-post').each((i, element) => {
          try {
            const $link = page$(element).find('a[href]').first();
            const $title = page$(element).find('h2, h3, .entry-title, .post-title').first();
            const $img = page$(element).find('img').first();
            
            const href = $link.attr('href') || '';
            const slug = extractSlug(href);
            
            if (!isPS4(slug) && !isPS4(href)) return;
            
            const title = $title.text().trim() || $link.text().trim();
            const cover = $img.attr('src') || $img.attr('data-src') || '';
            
            if (!title || !href) return;
            
            // Avoid duplicates
            if (games.some(g => g.slug === slug)) return;
            
            games.push({
              title,
              slug,
              url: href,
              cover: cover.startsWith('http') ? cover : `${BASE_URL}${cover}`,
              size: null,
              date: null,
            });
            pageCount++;
          } catch (err) {
            // skip
          }
        });
        
        console.error(`[scraper] Found ${pageCount} more games on page ${currentPage}`);
        
        const pageHasNext = page$('a.next, .nextpostslink, nav a:contains("Next")').length > 0;
        if (!pageHasNext) break;
        
        currentPage++;
        nextUrl = `${searchUrl}&paged=${currentPage}`;
        
        await sleep(2000);
      } catch (err) {
        console.error(`[scraper] Failed to fetch search page ${currentPage}: ${err.message}`);
        break;
      }
    }
  }
  
  return games;
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  scrapeCategory,
  scrapeCategoryMulti,
  scrapeGameDetail,
  scrapeDownloadGamePs3,
  scrapeDownloadGamePs3Full,
  searchGames,
  isPS4,
  extractSlug,
  decodeAdLink,
  detectHostFromUrl,
  extractFilenameFromUrl,
  BASE_URL,
};
