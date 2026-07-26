import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const URL = 'https://royalpavilion.spim-webverse.com/';
const OUT = './docs/spim-analysis/deep';
fs.mkdirSync(OUT, { recursive: true });

const report = {
  url: URL,
  timestamp: new Date().toISOString(),
  dom: {},
  views: {},
  viewTransitions: [],
  features: {},
  buttonMap: [],
  spinAnalysis: {},
  d3Analysis: {},
  tourAnalysis: {},
  audio: {},
  errors: [],
  responsive: {},
};

let logFile;

function log(msg) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

async function deepExplore() {
  logFile = path.join(OUT, 'explore.log');
  fs.writeFileSync(logFile, '=== DEEP EXPLORE LOG ===\n' + new Date().toISOString() + '\n\n');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Track console errors
  page.on('pageerror', err => report.errors.push({ type: 'page', msg: err.message }));
  page.on('console', msg => {
    if (msg.type() === 'error') report.errors.push({ type: 'console', msg: msg.text() });
  });

  // =========== 1. CAPTURE HTML + DOWNLOAD RAW FILES ===========
  log('[1/9] Capturing HTML and downloading JS/CSS...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

  // Download the main JS file
  const jsContent = await page.evaluate(async () => {
    const resp = await fetch('/js/script.js');
    return resp.text();
  });
  fs.writeFileSync(path.join(OUT, 'script.js'), jsContent);
  log(`  script.js: ${jsContent.length} bytes`);

  // Download the CSS
  const cssContent = await page.evaluate(async () => {
    const resp = await fetch('/css/styles.css');
    return resp.text();
  });
  fs.writeFileSync(path.join(OUT, 'styles.css'), cssContent);
  log(`  styles.css: ${cssContent.length} bytes`);

  // Get full HTML
  const html = await page.content();
  fs.writeFileSync(path.join(OUT, 'page.html'), html);
  log(`  HTML: ${html.length} bytes`);

  // Extract data.json if exists
  const dataJson = await page.evaluate(async () => {
    const links = document.querySelectorAll('link[href*=".json"], a[href*=".json"], script[src*=".json"]');
    // Also try fetching common paths
    for (const p of ['/data.json', '/js/data.json', '/assets/data.json']) {
      try {
        const resp = await fetch(p);
        if (resp.ok) return { path: p, data: await resp.json() };
      } catch(e) {}
    }
    return null;
  });
  if (dataJson) {
    report.dataJson = dataJson;
    fs.writeFileSync(path.join(OUT, 'data.json'), JSON.stringify(dataJson.data, null, 2));
    log(`  data.json found at ${dataJson.path}`);
  }

  // Also check for inline data
  const inlineData = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll('script:not([src])')];
    return scripts.map(s => ({ index: scripts.indexOf(s), content: (s.textContent || '').substring(0, 2000) })).filter(s => s.content.length > 50);
  });
  report.inlineScripts = inlineData;
  fs.writeFileSync(path.join(OUT, 'inline-scripts.json'), JSON.stringify(inlineData, null, 2));

  // =========== 2. FULL DOM MAP ===========
  log('[2/9] Mapping full DOM structure...');

  report.dom = await page.evaluate(() => {
    function mapNode(el, depth = 0) {
      if (depth > 5) return { tag: el.tagName, id: el.id || '', truncated: true };
      const node = {
        tag: el.tagName,
        id: el.id || '',
        classes: (el.className && typeof el.className === 'string') ? el.className.substring(0, 200) : '',
        visible: el.offsetParent !== null,
        display: getComputedStyle(el).display,
        position: getComputedStyle(el).position,
        rect: el.getBoundingClientRect(),
        children: [],
      };
      for (const child of el.children) {
        if (child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE') {
          node.children.push(mapNode(child, depth + 1));
        }
      }
      return node;
    }
    return mapNode(document.body);
  });
  fs.writeFileSync(path.join(OUT, 'dom-tree.json'), JSON.stringify(report.dom, null, 2));

  // =========== 3. ALL VIEWS AND THEIR STATE ===========
  log('[3/9] Identifying all views/screens...');

  report.views = await page.evaluate(() => {
    const views = {};
    // Find all id'd containers at root level
    document.querySelectorAll('body > [id]').forEach(el => {
      const id = el.id;
      if (!id || id === '') return;
      views[id] = {
        tag: el.tagName,
        visible: el.style.display !== 'none' && !el.classList.contains('hidden') && el.offsetParent !== null,
        display: el.style.display || getComputedStyle(el).display,
        zIndex: getComputedStyle(el).zIndex,
        opacity: getComputedStyle(el).opacity,
        transform: getComputedStyle(el).transform,
        width: el.offsetWidth,
        height: el.offsetHeight,
        children: el.children.length,
        classes: (el.className && typeof el.className === 'string') ? el.className : '',
        innerHTML: el.innerHTML.substring(0, 500),
      };
    });
    return views;
  });

  log(`  Found ${Object.keys(report.views).length} top-level views`);

  // =========== 4. ENUMERATE ALL BUTTONS & INTERACTIVE ELEMENTS ===========
  log('[4/9] Enumerating all interactive elements...');

  report.buttonMap = await page.evaluate(() => {
    const allEls = document.querySelectorAll(
      'button, [role="button"], a, [onclick], [data-view], [data-section], ' +
      '[data-type], [data-action], .cursor-pointer, input, select, textarea, ' +
      '[tabindex]:not([tabindex="-1"]), label, .nav-item, .menu-item, ' +
      '[class*="btn"], [class*="button"], [class*="tab"], [class*="nav"], ' +
      '[class*="menu"], [class*="toggle"], [class*="switch"], ' +
      'area, details, summary'
    );
    const results = [];
    const seen = new Set();
    const pageScroll = { x: window.scrollX, y: window.scrollY };
    
    allEls.forEach(el => {
      const rect = el.getBoundingClientRect();
      const id = el.id || '';
      const text = (el.textContent || '').trim().substring(0, 120);
      const key = id + '|' + text + '|' + el.tagName;
      if (seen.has(key)) return;
      seen.add(key);
      
      const isVisible = rect.width > 0 && rect.height > 0 &&
        rect.top < window.innerHeight && rect.bottom > 0 &&
        rect.left < window.innerWidth && rect.right > 0;
      
      results.push({
        id,
        tag: el.tagName,
        type: el.getAttribute('type') || '',
        text,
        title: el.getAttribute('title') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        href: el.getAttribute('href') || '',
        dataAttrs: {
          view: el.getAttribute('data-view') || '',
          section: el.getAttribute('data-section') || '',
          type: el.getAttribute('data-type') || '',
          action: el.getAttribute('data-action') || '',
        },
        classes: (el.className && typeof el.className === 'string') ? el.className.substring(0, 150) : '',
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right },
        visible: isVisible,
        parent: el.parentElement ? (el.parentElement.id || el.parentElement.tagName) : '',
        parentClasses: el.parentElement && typeof el.parentElement.className === 'string' ? el.parentElement.className.substring(0, 100) : '',
      });
    });
    return results.filter(b => b.visible).sort((a, b) => a.rect.top - b.rect.top);
  });

  log(`  Found ${report.buttonMap.length} visible interactive elements`);

  // =========== 5. SYSTEMATIC INTERACTION TESTING ===========
  log('[5/9] Testing all interactive elements systematically...');

  // First get baseline state
  let prevViews = await page.evaluate(() => {
    return [...document.querySelectorAll('body > [id]')].map(el => ({
      id: el.id,
      visible: el.style.display !== 'none' && !el.classList.contains('hidden') && el.offsetParent !== null,
      display: el.style.display || getComputedStyle(el).display,
      opacity: getComputedStyle(el).opacity,
      transform: getComputedStyle(el).transform,
    }));
  });

  for (const btn of report.buttonMap) {
    try {
      // Skip links to external sites
      if (btn.href && (btn.href.startsWith('http') || btn.href.startsWith('//')) && !btn.href.includes('spim-webverse')) continue;

      // Find the element again
      const el = await page.$(`#${btn.id}, button:text("${btn.text}"), [aria-label="${btn.ariaLabel}"]`);
      if (!el) continue;

      const isEnabled = await el.isEnabled().catch(() => false);
      if (!isEnabled) continue;

      await el.click();
      await page.waitForTimeout(400);

      // Check what changed
      const currViews = await page.evaluate(() => {
        return [...document.querySelectorAll('body > [id]')].map(el => ({
          id: el.id,
          visible: el.style.display !== 'none' && !el.classList.contains('hidden') && el.offsetParent !== null,
          display: el.style.display || getComputedStyle(el).display,
          opacity: getComputedStyle(el).opacity,
        }));
      });

      const changes = [];
      for (let i = 0; i < currViews.length; i++) {
        const pv = prevViews.find(v => v.id === currViews[i].id);
        if (pv && pv.visible !== currViews[i].visible) {
          changes.push({ view: currViews[i].id, was: pv.visible ? 'visible' : 'hidden', now: currViews[i].visible ? 'visible' : 'hidden' });
        }
      }

      if (changes.length > 0) {
        report.viewTransitions.push({ trigger: btn.text || btn.id || btn.ariaLabel, changes });
      }

      prevViews = currViews;

    } catch (e) {
      // Skip elements that error on click
    }
  }

  log(`  Recorded ${report.viewTransitions.length} view transitions`);

  // =========== 6. SPIN/360° ANALYSIS ===========
  log('[6/9] Analyzing 360° spin mechanism...');

  report.spinAnalysis = await page.evaluate(() => {
    // Find all containers that might be 360 viewers
    const spinContainers = [];
    document.querySelectorAll('[id*="spin"], [class*="spin"], [id*="viewer"], [class*="viewer"], ' +
      '[id*="panorama"], [class*="panorama"], [id*="rotate"], [class*="rotate"]').forEach(el => {
      spinContainers.push({
        id: el.id,
        classes: (el.className && typeof el.className === 'string') ? el.className.substring(0, 200) : '',
        tag: el.tagName,
        images: [...el.querySelectorAll('img')].map(i => ({ src: i.src.substring(0, 150), alt: i.alt })),
      });
    });

    // Check event listeners on viewer elements
    const viewers = document.querySelectorAll('.viewer-container, [id*="viewer"], [class*="viewer"]');
    
    return {
      spinContainers,
      viewerCount: viewers.length,
      // Check for all day/night frame patterns
      dayFrames: (() => {
        const imgs = [...document.querySelectorAll('img')];
        const dayFrames = imgs.filter(i => i.src.includes('day_frame') || i.src.includes('day_frames'));
        const nightFrames = imgs.filter(i => i.src.includes('night_frame') || i.src.includes('night_frames'));
        return {
          day: [...new Set(dayFrames.map(i => i.src.split('?')[0]))],
          night: [...new Set(nightFrames.map(i => i.src.split('?')[0]))],
          total: dayFrames.length + nightFrames.length,
        };
      })(),
    };
  });

  // Try to understand the 360 spin mechanism by analyzing script.js
  if (jsContent) {
    // Extract spin/viewer related code
    const spinLines = jsContent.split('\n').filter((l, i) => {
      const ln = l.toLowerCase();
      return ln.includes('spin') || ln.includes('360') || ln.includes('rotate') || 
             ln.includes('drag') || ln.includes('frame') || ln.includes('day_') || 
             ln.includes('night_') || ln.includes('mousemove') || ln.includes('touchmove') ||
             ln.includes('mousedown') || ln.includes('touchstart');
    });
    report.spinAnalysis.codeSnippets = spinLines.slice(0, 50);
  }

  // =========== 7. D3 & SVG FLOOR PLAN ANALYSIS ===========
  log('[7/9] Analyzing D3 floor plan system...');

  report.d3Analysis = await page.evaluate(() => {
    // Find all SVGs and D3-managed elements
    const svgs = [...document.querySelectorAll('svg')].map(s => ({
      id: s.id,
      classes: (typeof s.className === 'string') ? s.className : '',
      viewBox: s.getAttribute('viewBox'),
      width: s.getAttribute('width') || s.style.width,
      height: s.getAttribute('height') || s.style.height,
    }));

    // Check which view/section has large SVGs (floor plans)
    const floorPlanSVGs = svgs.filter(s => {
      const vb = s.viewBox || '';
      const [w, h] = vb.split(' ').slice(2).map(Number);
      return w > 1000 || h > 1000;
    });

    // Check for D3 interactivity
    const hasD3 = typeof window.d3 !== 'undefined';
    const d3Elements = hasD3 ? window.d3.selectAll('svg *').nodes().length : 0;

    return { svgCount: svgs.length, floorPlanSVGs, hasD3, d3Elements, allSvgs: svgs };
  });

  // =========== 8. FEATURE-SPECIFIC ANALYSIS ===========
  log('[8/9] Analyzing individual features...');

  // Zone IQ
  report.features.zoneIQ = await page.evaluate(() => {
    const zoneBtn = [...document.querySelectorAll('*')].find(el => 
      (el.textContent || '').trim().toLowerCase().includes('zone') && 
      (el.textContent || '').trim().toLowerCase().includes('iq')
    );
    return { found: !!zoneBtn, html: zoneBtn?.outerHTML?.substring(0, 500) };
  });

  // Shepherd tour
  report.features.shepherdTour = await page.evaluate(() => {
    const tourBtn = document.getElementById('tourBtn') || 
      [...document.querySelectorAll('*')].find(el => 
        (el.textContent || '').trim().toLowerCase().includes('tour')
      );
    
    // Check if Shepherd is loaded
    const hasShepherd = typeof window.Shepherd !== 'undefined';
    const shepherdVersion = hasShepherd ? window.Shepherd.version : null;
    
    // Check for shepherd elements
    const shepherdEls = document.querySelectorAll('.shepherd-element, .shepherd-step, [data-shepherd]');
    
    return {
      tourBtnFound: !!tourBtn,
      tourBtnHTML: tourBtn?.outerHTML?.substring(0, 500),
      hasShepherd,
      shepherdVersion,
      shepherdElements: shepherdEls.length,
    };
  });

  // Audio
  report.features.audio = await page.evaluate(() => {
    const audioEls = document.querySelectorAll('audio');
    const audioSources = [];
    audioEls.forEach(a => {
      audioSources.push({
        src: a.src || a.querySelector('source')?.src,
        autoplay: a.autoplay,
        loop: a.loop,
        muted: a.muted,
        volume: a.volume,
        paused: a.paused,
      });
    });
    // Also check for audio controls in the UI
    const muteBtns = [...document.querySelectorAll('*')].filter(el => 
      (el.textContent || '').toLowerCase().includes('mute') || 
      (el.textContent || '').toLowerCase().includes('music') ||
      el.id?.toLowerCase().includes('mute') ||
      el.id?.toLowerCase().includes('audio') ||
      el.id?.toLowerCase().includes('sound') ||
      el.className?.toLowerCase?.()?.includes('mute') ||
      el.className?.toLowerCase?.()?.includes('audio')
    );
    return { audioElements: audioSources, audioControls: muteBtns.map(b => ({ id: b.id, text: (b.textContent || '').trim().substring(0, 50) })) };
  });

  // Leaflet / Maps
  report.features.maps = await page.evaluate(() => {
    const leafletContainers = document.querySelectorAll('.leaflet-container, [id*="map"], .leaflet-map');
    const hasLeaflet = typeof window.L !== 'undefined';
    return { leafletContainers: leafletContainers.length, hasLeaflet, version: window.L?.version };
  });

  // Panzoom
  report.features.panzoom = await page.evaluate(() => {
    const hasPanzoom = typeof window.Panzoom !== 'undefined';
    return { hasPanzoom };
  });

  // Day/Night toggle  
  report.features.dayNight = await page.evaluate(() => {
    const toggles = [...document.querySelectorAll('*')].filter(el => 
      el.id?.toLowerCase().includes('day') || el.id?.toLowerCase().includes('night') ||
      el.id?.toLowerCase().includes('toggle') ||
      (el.textContent || '').toLowerCase().includes('day') && 
      (el.textContent || '').toLowerCase().includes('night')
    );
    return { toggles: toggles.map(t => ({ id: t.id, text: (t.textContent || '').trim().substring(0, 50), classes: (typeof t.className === 'string') ? t.className.substring(0, 100) : '' })) };
  });

  // Amenities Gallery
  report.features.amenities = await page.evaluate(() => {
    const amenityItems = [...document.querySelectorAll('*')].filter(el => 
      el.id?.toLowerCase().includes('amenity') || 
      el.className?.toLowerCase?.()?.includes('amenity') ||
      (el.closest?.('[id*="amenity"], [class*="amenity"]'))
    );
    
    // Get all amenity images
    const amenityImgs = [...document.querySelectorAll('img')].filter(i => 
      i.src.includes('amenities') || i.alt?.toLowerCase().includes('amenity')
    ).map(i => ({ src: i.src.split('?')[0], alt: i.alt }));

    // Check for prev/next navigation in gallery
    const galleryNav = [...document.querySelectorAll('*')].filter(el =>
      el.id?.toLowerCase().includes('gallery') ||
      (el.textContent || '').trim().match(/^(prev|next|back|forward|‹|›|«|»|<|>)$/i)
    ).map(el => ({ id: el.id, text: (el.textContent || '').trim().substring(0, 30) }));

    return { amenityImages: amenityImgs, galleryNav };
  });

  // Contact/Enquiry Form
  report.features.contact = await page.evaluate(() => {
    const forms = document.querySelectorAll('form');
    const formInputs = [...document.querySelectorAll('input, textarea, select')].map(el => ({
      id: el.id,
      name: el.getAttribute('name') || '',
      type: el.getAttribute('type') || el.tagName,
      placeholder: el.getAttribute('placeholder') || '',
      required: el.required,
    }));
    return { formCount: forms.length, inputs: formInputs };
  });

  // Full-screen button
  report.features.fullscreen = await page.evaluate(() => {
    const fsBtns = [...document.querySelectorAll('*')].filter(el => 
      el.id?.toLowerCase().includes('full') || el.id?.toLowerCase().includes('screen') ||
      (el.textContent || '').toLowerCase().includes('fullscreen') ||
      el.className?.toLowerCase?.()?.includes('fullscreen')
    );
    return { buttons: fsBtns.map(b => ({ id: b.id, text: (b.textContent || '').trim().substring(0, 50) })) };
  });

  // =========== 9. RESPONSIVE ANALYSIS ===========
  log('[9/9] Responsive analysis at different viewports...');

  const viewports = [
    { name: 'desktop-1920', width: 1920, height: 1080 },
    { name: 'desktop-1440', width: 1440, height: 900 },
    { name: 'desktop-1280', width: 1280, height: 800 },
    { name: 'tablet-1024', width: 1024, height: 768 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'mobile-430', width: 430, height: 932 },
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'mobile-360', width: 360, height: 800 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);
    
    const state = await page.evaluate(() => {
      const visibleViews = [...document.querySelectorAll('body > [id]')]
        .filter(el => el.style.display !== 'none' && !el.classList.contains('hidden') && el.offsetParent !== null)
        .map(el => el.id);
      
      // Check hamburger menu
      const hamburger = document.querySelector('.hamburger, [class*="hamburger"], [class*="menu-btn"], button[class*="menu"]');
      
      // Check what's actually visible
      const visibleElements = [...document.querySelectorAll('*')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top >= 0 && r.top < window.innerHeight;
      });
      
      const buttons = [...document.querySelectorAll('button, [role="button"]')]
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .map(el => ({ id: el.id, text: (el.textContent || '').trim().substring(0, 50), top: el.getBoundingClientRect().top }))
        .sort((a, b) => a.top - b.top);

      return { viewport: { width: window.innerWidth, height: window.innerHeight }, visibleViews, hasHamburger: !!hamburger, hamburgerHTML: hamburger?.outerHTML?.substring(0, 300), visibleButtonCount: buttons.length, buttons };
    });

    report.responsive[vp.name] = state;

    await page.screenshot({ path: path.join(OUT, `screenshot-${vp.name}.png`), fullPage: true });
  }

  // Write the full report
  fs.writeFileSync(path.join(OUT, 'deep-analysis.json'), JSON.stringify(report, null, 2));
  log('\n✅ DEEP EXPLORE COMPLETE');
  log(`Report: ${OUT}/deep-analysis.json`);
  log(`HTML: ${OUT}/page.html`);
  log(`JS: ${OUT}/script.js`);
  log(`CSS: ${OUT}/styles.css`);

  await browser.close();
}

deepExplore().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
