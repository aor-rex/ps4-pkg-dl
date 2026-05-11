const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');

puppeteer.use(StealthPlugin());

// Hosts that yt-dlp supports
const YTDLP_SUPPORTED = ['GoFile', 'Mega', 'Google Drive'];

/**
 * Detect file host from a URL
 */
function detectHost(url) {
  // Check for Google Sheets/Docs first to avoid misidentifying as a direct download
  if (/docs\.google\.com\/(spreadsheets|document|presentation)/i.test(url)) {
    return 'google-docs';
  }

  const hosts = {
    'mediafire': /mediafire\.com/i,
    'vikingfile': /vikingfile\.com/i,
    'akiabox': /akiabox\.com/i,
    'akirabox': /akirabox\.com/i,
    'uploadhaven': /uploadhaven\.com/i,
    'gofile': /gofile\.io/i,
    'mega': /mega\.nz/i,
    'googledrive': /drive\.google\.com/i,
    '1fichier': /1fichier\.com/i,
    'filecrypt': /filecrypt\.cc/i,
    'rootz': /rootz\.com/i,
  };
  
  for (const [name, pattern] of Object.entries(hosts)) {
    if (pattern.test(url)) {
      return name;
    }
  }
  
  return 'unknown';
}

/**
 * Resolve a file host URL using Puppeteer
 * This is the PRIMARY method since yt-dlp doesn't support most file hosts
 */
async function resolveWithPuppeteer(url, options = {}) {
  const host = detectHost(url);
  const headless = options.headless !== false; // Default to true
  const timeout = options.timeout || (headless ? 60000 : 600000); // 1m for headless, 10m for interactive
  
  console.error(`[resolver] Resolving with Puppeteer: ${host} - ${url.substring(0, 80)}... (headless: ${headless}, timeout: ${timeout/1000}s)`);
  
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // Host-specific resolution
    let directUrl = null;
    
    switch (host) {
      case 'google-docs':
        return {
          success: false,
          error: 'This is a Google Docs/Sheet page, not a direct download link. It may contain download links in the document itself.',
          host,
        };
      case 'filecrypt':
        directUrl = await resolveFileCrypt(page, url, timeout, headless);
        break;
      case 'googledrive':
        directUrl = await resolveWithYtDlp(url, options).then(r => r.directUrl).catch(() => null);
        if (!directUrl) directUrl = await resolveGeneric(page, url, timeout, headless);
        break;
      case 'mediafire':
        directUrl = await resolveMediaFire(page, url, timeout, headless);
        break;
      case '1fichier':
        directUrl = await resolve1Fichier(page, url, timeout, headless);
        break;
      case 'akiabox':
      case 'akirabox':
        directUrl = await resolveAkirabox(page, url, timeout, headless);
        break;
      case 'vikingfile':
        directUrl = await resolveVikingFile(page, url, timeout, headless);
        break;
      case 'mega':
        directUrl = await resolveMega(page, url, timeout, headless);
        break;
      default:
        directUrl = await resolveGeneric(page, url, timeout, headless);
        break;
    }
    
    if (directUrl) {
      return {
        success: true,
        directUrl,
        host,
        method: 'puppeteer',
      };
    }
    
    return {
      success: false,
      error: `Could not resolve download link from ${host}`,
      host,
    };
  } catch (error) {
    return {
      success: false,
      error: `Puppeteer resolution failed: ${error.message}`,
      host,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Resolve FileCrypt container
 */
async function resolveFileCrypt(page, url, timeout, headless = true) {
  console.error(`[resolver] Resolving FileCrypt: ${url}`);
  
  await page.goto(url, { waitUntil: 'networkidle2', timeout });
  
  // Wait for any initial redirects or loading
  await new Promise(r => setTimeout(r, 2000));

  // Check if it's a captcha page
  const isCaptcha = await page.evaluate(() => {
    const text = document.body.innerText.toLowerCase();
    return text.includes('captcha') || 
           text.includes('security check') ||
           text.includes('enter the correct solution') ||
           !!document.querySelector('.g-recaptcha') ||
           !!document.querySelector('#captcha') ||
           !!document.querySelector('iframe[src*="captcha"]') ||
           !!document.querySelector('img[src*="captcha"]');
  });

  if (isCaptcha) {
    if (headless) {
      console.error(`\n[resolver] ⚠️  FileCrypt requires CAPTCHA - cannot resolve headlessly.`);
      console.error(`[resolver] 💡 Try again with --interactive flag to solve it manually.\n`);
      return null;
    } else {
      console.error(`\n[resolver] 🧩 CAPTCHA detected. Please solve it in the browser window.\n`);
      console.error(`\n[resolver] 💡 Waiting up to 5 minutes for you to solve it...\n`);

      // Wait longer in non-headless mode for manual solving
      try {
        // Wait for the captcha to disappear or links to appear
        await page.waitForFunction(() => {
          const text = document.body.innerText.toLowerCase();
          return !text.includes('captcha') && 
                 !text.includes('security check') &&
                 !text.includes('enter the correct solution') &&
                 !document.querySelector('.g-recaptcha') &&
                 !document.querySelector('#captcha');
        }, { timeout: 300000 }); // 5 minutes
        
        console.error(`[resolver] Captcha solved! Waiting 5s for links to reveal...`);
        await new Promise(r => setTimeout(r, 5000));
      } catch (e) {
        console.error(`[resolver] Timed out waiting for captcha solution.`);
        return null;
      }
    }

  }

  // Look for download links or "Click to show links" button
  const directUrl = await page.evaluate(() => {
    // 1. Try to find links directly (sometimes they are visible)
    const links = Array.from(document.querySelectorAll('a[href]'));
    for (const link of links) {
      const href = link.href;
      if (href.includes('1fichier.com') || href.includes('mediafire.com') || 
          href.includes('vikingfile.com') || href.includes('akirabox.com')) {
        return href;
      }
    }

    // 2. Try to click "Reveal" or "Click to show"
    const revealBtn = Array.from(document.querySelectorAll('button, a')).find(el => {
      const text = (el.textContent || '').toLowerCase();
      return text.includes('reveal') || text.includes('click to show') || text.includes('open container');
    });
    
    if (revealBtn) {
      revealBtn.click();
      return 'REVEAL_CLICKED';
    }

    return null;
  });

  if (directUrl === 'REVEAL_CLICKED') {
    await new Promise(r => setTimeout(r, 3000));
    // Re-evaluate to find links
    return await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      for (const link of links) {
        const href = link.href;
        if (href.includes('1fichier.com') || href.includes('mediafire.com') || 
            href.includes('vikingfile.com') || href.includes('akirabox.com')) {
          return href;
        }
      }
      return null;
    });
  }
  
  return directUrl;
}

/**
 * Resolve MediaFire download using axios + HTML parsing
 * MediaFire doesn't have anti-bot, just needs the right headers
 */
async function resolveMediaFire(page, url, timeout) {
  console.error(`[resolver] Resolving MediaFire: ${url}`);
  
  try {
    // Try axios first (faster than Puppeteer)
    const axios = require('axios');
    const cheerio = require('cheerio');
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 30000,
      maxRedirects: 5,
    });
    
    const $ = cheerio.load(response.data);
    
    // Get the download button URL
    const downloadBtn = $('#downloadButton');
    if (downloadBtn.length) {
      const downloadUrl = downloadBtn.attr('href');
      if (downloadUrl) {
        console.error(`[resolver] MediaFire direct URL found via axios`);
        return downloadUrl;
      }
    }
    
    // Alternative: look for download links
    const links = $('a[href*="download"], a[href*="download.php"]');
    for (let i = 0; i < links.length; i++) {
      const href = $(links[i]).attr('href');
      if (href && !href.includes('mediafire.com')) {
        console.error(`[resolver] MediaFire direct URL found via link`);
        return href;
      }
    }
    
    // Fallback to Puppeteer if axios didn't work
    console.error(`[resolver] Axios failed, trying Puppeteer...`);
    return await resolveMediaFireWithPuppeteer(page, url, timeout);
  } catch (error) {
    console.error(`[resolver] Axios error: ${error.message}, trying Puppeteer...`);
    return await resolveMediaFireWithPuppeteer(page, url, timeout);
  }
}

/**
 * Puppeteer-based MediaFire resolution (fallback)
 */
async function resolveMediaFireWithPuppeteer(page, url, timeout) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  
  // Wait for download button (shorter timeout)
  try {
    await page.waitForSelector('#downloadButton', { timeout: 10000 });
  } catch (e) {
    // Continue anyway
  }
  
  // Get the download URL
  const downloadUrl = await page.evaluate(() => {
    const btn = document.querySelector('#downloadButton');
    if (btn) return btn.href;
    
    const links = Array.from(document.querySelectorAll('a[href]'));
    for (const link of links) {
      const href = link.href;
      if (href.includes('.pkg') || href.includes('.rar') || href.includes('.zip') || href.includes('.7z')) {
        return href;
      }
    }
    return null;
  });
  
  return downloadUrl;
}

/**
 * Resolve 1Fichier download
 */
async function resolve1Fichier(page, url, timeout, headless = true) {
  console.error(`[resolver] Resolving 1Fichier: ${url}`);
  
  await page.goto(url, { waitUntil: 'networkidle2', timeout });
  
  // Check for Cloudflare/Turnstile challenge
  const hasChallenge = await detectCloudflareChallenge(page);
  if (hasChallenge) {
    if (headless) {
      console.error(`[resolver] ⚠️  1Fichier blocked by Cloudflare/Turnstile - requires manual interaction`);
      console.error(`[resolver] 💡 Try again with --interactive flag\n`);
      return null;
    } else {
      console.error(`[resolver] 🛡️  Cloudflare challenge detected. Please complete it in the browser...`);
      try {
        await page.waitForFunction(() => {
          const bodyText = document.body.innerText.toLowerCase();
          return !bodyText.includes('cloudflare') && !bodyText.includes('turnstile');
        }, { timeout: 300000 });
        await new Promise(r => setTimeout(r, 3000));
      } catch (e) {
        console.error(`[resolver] Timed out waiting for challenge completion`);
        return null;
      }
    }
  }
  
  // Wait for initial page load
  await new Promise(r => setTimeout(r, 3000));
  
  // Check for "Click here to download" button (orange button usually)
  const downloadUrl = await page.evaluate(async () => {
    const findLink = () => {
      // 1. Look for obvious download buttons
      const buttons = Array.from(document.querySelectorAll('input[type="submit"], button, a.btn-orange, a.btn-general'));
      for (const btn of buttons) {
        const text = (btn.value || btn.textContent || '').toLowerCase();
        if (text.includes('download') || text.includes('télécharger') || text.includes('click here')) {
          return btn;
        }
      }
      return null;
    };

    const btn = findLink();
    if (btn) {
      if (btn.tagName === 'A' && btn.href && !btn.href.includes('1fichier.com')) {
        return btn.href;
      }
      btn.click();
      return 'CLICKED';
    }

    return null;
  });

  if (downloadUrl === 'CLICKED') {
    console.error(`[resolver] 1Fichier download button clicked, waiting 10s for response/navigation...`);
    // Wait for navigation or new link to appear
    await new Promise(r => setTimeout(r, 10000));
    
    // Check for IP wait timer or other errors
    const errorMessage = await page.evaluate(() => {
      const msg = document.querySelector('.msg-error, .alert-danger, .error');
      return msg ? msg.textContent.trim() : null;
    });

    if (errorMessage) {
      console.error(`[resolver] 1Fichier error: ${errorMessage}`);
      if (errorMessage.includes('Wait') || errorMessage.includes('attendre')) {
        console.error(`[resolver] ⏳ Detected wait timer. You might need to wait or use a different IP.`);
      }
      return null;
    }

    // Check if URL changed (direct download sometimes triggers navigation)
    const currentUrl = page.url();
    console.error(`[resolver] Current URL after wait: ${currentUrl}`);
    if (currentUrl && !currentUrl.includes('1fichier.com')) {
      return currentUrl;
    }

    // Look for the final download link
    const finalLink = await page.evaluate(() => {
      const selectors = ['a.btn-orange', 'a.btn-general', '.ok-btn a', 'a[href*="dl.php"]', 'a[href*="dl-"]'];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.href && !el.href.includes('1fichier.com')) return el.href;
      }
      
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      for (const link of allLinks) {
        const href = link.href;
        // Final direct links usually have dl- or are external
        if ((href.includes('dl-') || href.includes('.pkg')) && !href.includes('1fichier.com')) {
          return href;
        }
      }
      return null;
    });

    if (finalLink) {
      console.error(`[resolver] 1Fichier final link found: ${finalLink.substring(0, 60)}...`);
      return finalLink;
    }

    console.error(`[resolver] 1Fichier: No final link found after click.`);
    return null;
  }
  
  return downloadUrl;
}

/**
 * Check for Cloudflare/Turnstile challenge
 */
async function detectCloudflareChallenge(page) {
  return await page.evaluate(() => {
    const bodyText = document.body.innerText.toLowerCase();
    const hasCloudflare = bodyText.includes('cloudflare') || bodyText.includes('turnstile');
    const hasChallenge = !!document.querySelector('#challenge-form, .cf-challenge, input[name="cf-turnstile-response"]');
    const hasIframe = !!document.querySelector('iframe[src*="challenges"]');
    return hasCloudflare || hasChallenge || hasIframe;
  });
}

/**
 * Resolve Akirabox download
 */
async function resolveAkirabox(page, url, timeout, headless = true) {
  console.error(`[resolver] Resolving Akirabox: ${url}`);
  
  await page.goto(url, { waitUntil: 'networkidle2', timeout });
  
  // Check for Cloudflare Turnstile challenge
  const hasChallenge = await detectCloudflareChallenge(page);
  if (hasChallenge) {
    if (headless) {
      console.error(`[resolver] ⚠️  Akirabox blocked by Cloudflare Turnstile - requires manual interaction`);
      console.error(`[resolver] 💡 Try again with --interactive flag to solve the challenge in browser\n`);
      return null;
    } else {
      console.error(`[resolver] 🛡️  Cloudflare Turnstile detected. Please complete the challenge in the browser...`);
      try {
        await page.waitForFunction(() => {
          const bodyText = document.body.innerText.toLowerCase();
          return !bodyText.includes('cloudflare') && !bodyText.includes('turnstile');
        }, { timeout: 300000 });
        console.error(`[resolver] Challenge completed! Waiting for download page...`);
        await new Promise(r => setTimeout(r, 3000));
      } catch (e) {
        console.error(`[resolver] Timed out waiting for Turnstile completion`);
        return null;
      }
    }
  }
  
  if (!headless) {
    console.error(`[resolver] 💡 Manual interaction mode: Waiting for you to click through and get the final link...`);
    // Wait for the URL to change to something other than akirabox.com/id/file
    try {
      await page.waitForFunction(() => {
        // Look for common final link patterns or download start
        const links = Array.from(document.querySelectorAll('a[href]'));
        for (const link of links) {
          const href = link.href;
          if (href.includes('dl-') || href.includes('.pkg') || href.includes('.rar')) return true;
        }
        return false;
      }, { timeout: 300000 }); // 5 minutes for manual
    } catch (e) {
      // Continue and try to find link anyway
    }
  } else {
    // Automatic attempt
    await new Promise(r => setTimeout(r, 5000));
    
    // Try to click "Slow Download" if it exists
    await page.evaluate(() => {
      const slowBtn = Array.from(document.querySelectorAll('button, a')).find(el => {
        const text = (el.textContent || '').toLowerCase();
        return text.includes('slow download') || text.includes('free download');
      });
      if (slowBtn) slowBtn.click();
    });

    await new Promise(r => setTimeout(r, 5000));
  }
  
  const downloadUrl = await page.evaluate(() => {
    // Look for the final direct link
    const selectors = [
      'a.btn-download', 'a[href*="download"]', 'a[href*="file"]',
      '#download-link', '.download-btn a'
    ];
    
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.href && !el.href.includes('akirabox.com') && el.href.startsWith('http')) return el.href;
    }

    // Check all links for common file extensions
    const allLinks = Array.from(document.querySelectorAll('a[href]'));
    for (const link of allLinks) {
      const href = link.href;
      if (href.includes('.pkg') || href.includes('.rar') || href.includes('.zip') || href.includes('.7z')) {
        if (!href.includes('akirabox.com')) return href;
      }
    }
    
    return null;
  });
  
  return downloadUrl;
}

/**
 * Resolve Viking File download
 */
async function resolveVikingFile(page, url, timeout, headless = true) {
  console.error(`[resolver] Resolving Viking File: ${url}`);
  
  await page.goto(url, { waitUntil: 'networkidle2', timeout });
  
  // Check for Cloudflare/Turnstile challenge
  const hasChallenge = await detectCloudflareChallenge(page);
  if (hasChallenge) {
    if (headless) {
      console.error(`[resolver] ⚠️  Viking File blocked by Cloudflare/Turnstile - requires manual interaction`);
      console.error(`[resolver] 💡 Try again with --interactive flag\n`);
      return null;
    } else {
      console.error(`[resolver] 🛡️  Cloudflare challenge detected. Please complete it in the browser...`);
      try {
        await page.waitForFunction(() => {
          const bodyText = document.body.innerText.toLowerCase();
          return !bodyText.includes('cloudflare') && !bodyText.includes('turnstile');
        }, { timeout: 300000 });
        await new Promise(r => setTimeout(r, 3000));
      } catch (e) {
        console.error(`[resolver] Timed out waiting for challenge completion`);
        return null;
      }
    }
  }
  
  // Wait for timer/ads
  await new Promise(r => setTimeout(r, 3000));
  
  const downloadUrl = await page.evaluate(() => {
    const selectors = [
      'a[href*="download"], a.btn-primary',
      '.download-link a',
      '#download',
    ];
    
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.href && el.href.startsWith('http')) return el.href;
    }
    
    return null;
  });
  
  return downloadUrl;
}

/**
 * Resolve Mega download
 */
async function resolveMega(page, url, timeout) {
  console.error(`[resolver] Resolving Mega: ${url}`);
  
  await page.goto(url, { waitUntil: 'networkidle2', timeout });
  
  // Mega links are usually direct - just need to get the actual download URL
  const downloadUrl = await page.evaluate(() => {
    const downloadBtn = document.querySelector('#download, .download-button, a[href*="download"]');
    return downloadBtn ? downloadBtn.href : null;
  });
  
  return downloadUrl || url; // Mega links often work directly
}

/**
 * Generic fallback resolver
 */
async function resolveGeneric(page, url, timeout) {
  console.error(`[resolver] Generic resolve: ${url}`);
  
  await page.goto(url, { waitUntil: 'networkidle2', timeout });
  
  // Wait a bit
  await new Promise(r => setTimeout(r, 2000));
  
  const downloadUrl = await page.evaluate(() => {
    // Try to find any download-related link
    const allLinks = Array.from(document.querySelectorAll('a[href]'));
    for (const link of allLinks) {
      const text = (link.textContent || '').toLowerCase();
      const href = link.href;
      
      if (text.includes('download') || text.includes('save') || text.includes('get file')) {
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          return href;
        }
      }
    }
    
    // Last resort: first external link
    for (const link of allLinks) {
      const href = link.href;
      if (href && href.startsWith('http') && !href.includes(document.location.hostname)) {
        return href;
      }
    }
    
    return null;
  });
  
  return downloadUrl;
}

/**
 * Main resolve function - tries Puppeteer directly since yt-dlp doesn't support most hosts
 */
async function resolveMirror(url, options = {}) {
  console.error(`[resolver] Resolving mirror: ${url}`);
  
  const host = detectHost(url);
  
  // For hosts yt-dlp supports, try yt-dlp first
  if (YTDLP_SUPPORTED.includes(host)) {
    const ytdlpResult = await resolveWithYtDlp(url, options);
    if (ytdlpResult.success) {
      return ytdlpResult;
    }
  }
  
  // Use Puppeteer for all hosts
  return await resolveWithPuppeteer(url, options);
}

/**
 * Resolve using yt-dlp (for supported hosts only)
 */
function resolveWithYtDlp(url, options = {}) {
  const { execFile } = require('child_process');
  const ytdlpPath = options.ytdlpPath || 'yt-dlp';
  
  return new Promise((resolve) => {
    const args = ['--get-url', '--no-warnings', '--socket-timeout', '30', url];
    
    const proc = execFile(ytdlpPath, args, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: `yt-dlp error: ${stderr || error.message}` });
        return;
      }
      
      const directUrl = stdout.trim();
      if (directUrl && directUrl.startsWith('http')) {
        resolve({ success: true, directUrl, method: 'yt-dlp' });
      } else {
        resolve({ success: false, error: 'yt-dlp returned invalid URL' });
      }
    });
  });
}

/**
 * Check yt-dlp availability
 */
function checkYtDlp(ytdlpPath = 'yt-dlp') {
  const { execFile } = require('child_process');
  
  return new Promise((resolve) => {
    execFile(ytdlpPath, ['--version'], (error, stdout) => {
      if (error) {
        resolve({ available: false, error: error.message });
      } else {
        resolve({ available: true, version: stdout.trim() });
      }
    });
  });
}

module.exports = {
  resolveMirror,
  resolveWithPuppeteer,
  resolveWithYtDlp,
  checkYtDlp,
  detectHost,
};
