import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const URL = 'https://royalpavilion.spim-webverse.com/';
const OUTPUT = './docs/spim-analysis';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

fs.mkdirSync(OUTPUT, { recursive: true });
fs.mkdirSync(`${OUTPUT}/screenshots`, { recursive: true });

const report = {
  url: URL,
  timestamp: new Date().toISOString(),
  techStack: { fonts: [], libraries: [], jsFiles: [], cssFiles: [] },
  views: {},
  interactions: [],
  assets: { images: [], videos: [], svgs: [] },
  responsive: {},
};

async function explore() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    // ===== 1. INITIAL LOAD & NETWORK CAPTURE =====
    console.log('[1/7] Loading page and capturing network...');
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    
    // Track all network requests
    const networkResources = [];
    page.on('request', req => {
      const type = req.resourceType();
      if (['script', 'stylesheet', 'font', 'image', 'media', 'document', 'other'].includes(type)) {
        networkResources.push({ url: req.url(), type });
      }
    });

    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // Wait for any lazy loads

    // ===== 2. FULL PAGE SCREENSHOTS =====
    console.log('[2/7] Taking screenshots at all viewports...');
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUTPUT}/screenshots/fullpage-${vp.name}.png`, fullPage: true });
      await page.screenshot({ path: `${OUTPUT}/screenshots/above-fold-${vp.name}.png`, fullPage: false });
    }

    // ===== 3. EXTRACT TECH STACK =====
    console.log('[3/7] Extracting tech stack...');
    
    // Fonts
    report.techStack.fonts = await page.evaluate(() => {
      const fonts = new Set();
      document.querySelectorAll('*').forEach(el => {
        const f = getComputedStyle(el).fontFamily;
        if (f) f.split(',').forEach(fn => fonts.add(fn.trim().replace(/["']/g, '')));
      });
      return [...fonts].filter(f => f && f !== 'sans-serif' && f !== 'serif' && f !== 'monospace');
    });

    // Libraries from script tags
    report.techStack.libraries = await page.evaluate(() => {
      const libs = [];
      document.querySelectorAll('script[src]').forEach(s => libs.push({ src: s.src, async: s.async, defer: s.defer }));
      return libs;
    });

    // CSS files
    report.techStack.cssFiles = await page.evaluate(() => {
      return [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => ({ href: l.href }));
    });

    // JS files
    report.techStack.jsFiles = await page.evaluate(() => {
      return [...document.querySelectorAll('script[src]')].map(s => ({ src: s.src }));
    });

    // Check for frameworks
    report.techStack.frameworks = await page.evaluate(() => {
      const checks = {
        react: !!(window.React || document.querySelector('[data-reactroot]') || document.querySelector('[data-reactid]')),
        vue: !!(window.Vue),
        angular: !!(window.ng),
        nextjs: !!(window.__NEXT_DATA__),
        jquery: !!window.jQuery,
        d3: !!window.d3,
        tailwind: !!(document.querySelector('[href*="tailwind"]') || document.querySelector('style')?.textContent?.includes('tailwind')),
      };
      return checks;
    });

    // ===== 4. MAP ALL VIEWS/SECTIONS =====
    console.log('[4/7] Mapping all views and sections...');
    report.views = await page.evaluate(() => {
      const views = {};
      // Find all main view containers (divs with id that gets shown/hidden)
      const mainViews = document.querySelectorAll('body > div[id]');
      mainViews.forEach(v => {
        const id = v.id;
        const isVisible = v.style.display !== 'none' && !v.classList.contains('hidden');
        views[id] = {
          visible: isVisible,
          display: getComputedStyle(v).display,
          classes: v.className,
          children: v.children.length,
          html: v.innerHTML.substring(0, 300) + '...',
        };
      });

      // Also find sections with scroll behavior
      const sections = document.querySelectorAll('section, [id$="Section"], [class*="section"]');
      const sectionData = {};
      sections.forEach((s, i) => {
        sectionData[`section_${i}`] = {
          id: s.id || 'none',
          classes: s.className,
          tag: s.tagName,
        };
      });

      return { mainViews, sections: sectionData };
    });

    // ===== 5. EXPLORE ALL INTERACTIONS =====
    console.log('[5/7] Testing all interactive elements...');

    // Click all nav items/buttons and capture view transitions
    const interactives = await page.evaluate(() => {
      const buttons = [];
      document.querySelectorAll('button, [role="button"], a[href], .cursor-pointer, [data-type]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          buttons.push({
            tag: el.tagName,
            id: el.id,
            text: el.textContent?.trim()?.substring(0, 80),
            'data-type': el.getAttribute('data-type') || '',
            classes: el.className?.substring(0, 80),
            visible: rect.top < window.innerHeight && rect.bottom > 0,
            position: { x: rect.left + rect.width/2, y: rect.top + rect.height/2 },
            href: el.getAttribute('href') || '',
          });
        }
      });
      return buttons;
    });

    // Try clicking each visible interactive element
    for (const btn of interactives) {
      if (!btn.visible || btn.href || btn.tag === 'A') continue;
      try {
        await page.mouse.click(btn.position.x, btn.position.y);
        await page.waitForTimeout(300);
        // Check what changed
        const state = await page.evaluate(() => {
          return {
            url: window.location.href,
            visibleViews: [...document.querySelectorAll('body > div[id]')]
              .filter(v => v.style.display !== 'none' && !v.classList.contains('hidden'))
              .map(v => v.id),
          };
        });
        report.interactions.push({ element: btn.id || btn.text, viewChanged: state.visibleViews });
      } catch (e) {
        // skip
      }
    }

    // ===== 6. EXTRACT ALL ASSETS =====
    console.log('[6/7] Extracting all assets...');
    
    report.assets.images = await page.evaluate(() => {
      return [...document.querySelectorAll('img')].map(img => ({
        src: img.src || img.currentSrc,
        alt: img.alt,
        width: img.naturalWidth,
        height: img.naturalHeight,
        loading: img.loading,
      })).filter(i => i.src);
    });

    report.assets.videos = await page.evaluate(() => {
      return [...document.querySelectorAll('video')].map(v => ({
        src: v.src || v.querySelector('source')?.src,
        poster: v.poster,
        autoplay: v.autoplay,
        loop: v.loop,
        muted: v.muted,
      })).filter(v => v.src);
    });

    report.assets.svgs = await page.evaluate(() => {
      return [...document.querySelectorAll('svg')].map(s => {
        let cls = '';
        try { cls = (typeof s.className === 'string') ? s.className : (s.className?.baseVal || ''); } catch(e) {}
        return {
          id: s.id,
          classes: cls.substring(0, 100),
          viewBox: s.getAttribute('viewBox') || '',
          width: s.getAttribute('width') || '',
          height: s.getAttribute('height') || '',
        };
      });
    });

    // Background images
    report.assets.backgroundImages = await page.evaluate(() => {
      const bgImages = new Set();
      document.querySelectorAll('*').forEach(el => {
        const bg = getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none') {
          const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
          if (match) bgImages.add(match[1]);
        }
      });
      return [...bgImages];
    });

    // ===== 7. STRUCTURAL ANALYSIS =====
    console.log('[7/7] Deep structural analysis...');

    // Get the main JS architecture (how views are managed)
    report.architecture = await page.evaluate(() => {
      // Check for any JS frameworks/patterns
      const scripts = [...document.querySelectorAll('script')].filter(s => !s.src).map(s => s.textContent?.substring(0, 500));
      
      // Find the view management pattern
      const allText = scripts.join(' ');
      const viewManagerPatterns = {
        hasViewShowHide: allText.includes('.style.display'),
        hasJQuery: !!window.jQuery,
        hasGSAP: !!window.gsap,
        hasThreeJS: !!window.THREE,
        scriptCount: document.querySelectorAll('script').length,
        inlineScripts: scripts.length,
      };

      // Check if SPA router exists
      const hasRouter = !!(allText.includes('routes') || allText.includes('navigate'));

      return { viewManagerPatterns, hasRouter, globalVars: Object.keys(window).filter(k => k.startsWith('__') || k.startsWith('app') || k.startsWith('App')).slice(0, 20) };
    });

    // Count total unique resources loaded
    report.networkSummary = {};
    for (const r of networkResources) {
      if (!report.networkSummary[r.type]) report.networkSummary[r.type] = 0;
      report.networkSummary[r.type]++;
    }

    // Save the report
    fs.writeFileSync(`${OUTPUT}/full-analysis.json`, JSON.stringify(report, null, 2));
    
    // Also save network log
    fs.writeFileSync(`${OUTPUT}/network-resources.json`, JSON.stringify(networkResources, null, 2));

    console.log(`\n✅ Complete! Report saved to ${OUTPUT}/full-analysis.json`);
    console.log(`   Screenshots: ${OUTPUT}/screenshots/`);
    console.log(`   Network resources captured: ${networkResources.length}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

explore();
