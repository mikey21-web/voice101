import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://royalpavilion.spim-webverse.com/';
const OUT = './docs/spim-analysis/deep2';
fs.mkdirSync(OUT, { recursive: true });

const report = { features: {}, views: {}, transitions: [], errors: [] };

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Helper to navigate to a section
  async function goToSection(sectionId) {
    // Click the appropriate nav button
    const navMap = {
      'home': '#homeBtn',
      'webverse': null, // via feature panel
      'interior': null,
      'floorPlans': null,
      'amenities': null,
      'about': null,
      'exterior': null,
      'gallery': null,
      'brochure': null,
      'contact': null,
      'features': '#featurePanelBtn',
    };
    
    const sel = navMap[sectionId];
    if (sel) {
      await page.click(sel).catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  // Try direct section navigation via JS
  async function jsNav(section) {
    await page.evaluate((s) => {
      const el = document.getElementById(s);
      if (el) {
        // Toggle visibility: hide all, show this
        document.querySelectorAll('body > [id]').forEach(v => {
          if (['logoWrapper', 'commonBtnsWrapper', s].includes(v.id)) return;
          v.style.display = 'none';
        });
        el.style.display = '';
      }
    }, section);
    await page.waitForTimeout(300);
  }

  // Screenshot each view
  const views = ['home', 'webverse', 'interior', 'floorPlans', 'amenities', 'about', 'exterior', 'gallery', 'brochure', 'contact', 'features', 'clubhouse'];
  
  for (const view of views) {
    await jsNav(view);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${view}.png`, fullPage: false });
    
    const info = await page.evaluate((v) => {
      const el = document.getElementById(v);
      if (!el) return { exists: false };
      return {
        exists: true,
        visible: el.style.display !== 'none' && el.offsetParent !== null,
        width: el.offsetWidth,
        height: el.offsetHeight,
        childCount: el.children.length,
        buttons: [...el.querySelectorAll('button, [role="button"], [onclick], [class*="btn"], li.cursor-pointer')]
          .map(b => ({ id: b.id, text: (b.textContent || '').trim().substring(0, 60), tag: b.tagName, classes: ((b.className && typeof b.className === 'string') ? b.className.substring(0, 100) : '') }))
          .filter(b => b.text || b.id),
        images: [...el.querySelectorAll('img')].map(i => ({ src: (i.src || '').split('?')[0].substring(0, 120), alt: i.alt })),
        svgs: [...el.querySelectorAll('svg')].map(s => ({ id: s.id, viewBox: (s.getAttribute('viewBox') || '').substring(0, 50) })),
      };
    }, view);
    
    report.views[view] = info;
  }

  // Test 360 spin on webverse
  await jsNav('webverse');
  await page.waitForTimeout(500);
  
  report.features.spin360 = await page.evaluate(() => {
    const layoutImg = document.getElementById('layoutImage');
    const layoutState = layoutImg ? { src: layoutImg.src?.substring(0, 150), currentFrame: window.LAYOUT_CURRENT_FRAME, totalFrames: window.LAYOUT_TOTAL_FRAMES } : null;
    
    const blockImg = document.getElementById('blockImage');
    const blockState = blockImg ? { src: blockImg.src?.substring(0, 150) } : null;
    
    return { layoutState, blockState };
  });

  // Test D3 SVG elements
  report.features.d3 = await page.evaluate(() => {
    const layoutSvgEl = document.getElementById('layoutSvg');
    const svgElements = layoutSvgEl ? layoutSvgEl.querySelectorAll('svg *').length : 0;
    const hasD3 = typeof window.d3 !== 'undefined';
    return { hasD3, svgElements, layoutSvgHTML: layoutSvgEl?.innerHTML?.substring(0, 500) };
  });

  // Test audio
  report.features.audio = await page.evaluate(() => {
    const audio = document.getElementById('bgAudio');
    return {
      exists: !!audio,
      src: audio?.querySelector('source')?.src?.substring(0, 150) || audio?.src?.substring(0, 150),
      paused: audio?.paused,
      autoplay: audio?.autoplay,
      loop: audio?.loop,
    };
  });

  // Test Leaflet map
  await jsNav('contact'); // Map is in contact or googlemap
  await page.waitForTimeout(1000);
  
  report.features.map = await page.evaluate(() => {
    const mapEl = document.getElementById('map');
    const googleMap = document.getElementById('googlemap');
    const leafletContainers = document.querySelectorAll('.leaflet-container');
    return {
      mapExists: !!mapEl,
      googleMapExists: !!googleMap,
      leafletContainers: leafletContainers.length,
      hasLeaflet: typeof window.L !== 'undefined',
      leafletVersion: window.L?.version,
    };
  });

  // Shepherd tour
  report.features.tour = await page.evaluate(() => {
    return {
      hasShepherd: typeof window.Shepherd !== 'undefined',
      tourInstance: typeof window.tourInstance !== 'undefined' && window.tourInstance !== null,
    };
  });

  // Filter dropdowns
  report.features.filters = await page.evaluate(() => {
    const filterEls = {
      webverseFilters: document.getElementById('webverseFilters')?.style.display,
      orientation: document.getElementById('orientation'),
      type: document.getElementById('type'),
      unit: document.getElementById('unit'),
      note: document.getElementById('note'),
    };
    return filterEls;
  });

  // Day/Night toggle
  report.features.dayNight = await page.evaluate(() => {
    const toggle = document.getElementById('themeToggleInput');
    return {
      exists: !!toggle,
      checked: toggle?.checked,
      timeOfDay: typeof window.timeOfDay !== 'undefined' ? window.timeOfDay : null,
    };
  });

  // Contact form
  report.features.contact = await page.evaluate(() => {
    const form = document.querySelector('#contact form');
    if (!form) return { exists: false };
    return {
      exists: true,
      inputs: [...form.querySelectorAll('input, textarea')].map(i => ({ name: i.name, id: i.id, type: i.type, placeholder: i.placeholder, required: i.required })),
    };
  });

  // RERA
  report.features.rera = await page.evaluate(() => {
    const rera = document.getElementById('aboutReraNumber');
    return { exists: !!rera, text: rera?.textContent?.trim() };
  });

  // Gallery
  report.features.gallery = await page.evaluate(() => {
    const img = document.getElementById('galleryImage');
    return {
      exists: !!img,
      currentSrc: img?.src?.substring(0, 120),
      totalItems: typeof window.CURRENT_INDEX !== 'undefined' ? window.CURRENT_INDEX : null,
    };
  });

  // Panzoom
  report.features.panzoom = await page.evaluate(() => {
    return {
      hasPanzoom: typeof window.Panzoom !== 'undefined' || typeof window.panzoom !== 'undefined',
    };
  });

  // Clubhouse
  await jsNav('clubhouse');
  await page.waitForTimeout(500);
  report.features.clubhouse = await page.evaluate(() => {
    const ch = document.getElementById('clubhouse');
    return {
      exists: !!ch,
      image: ch?.querySelector('img')?.src?.substring(0, 120),
      images: [...ch.querySelectorAll('img')].map(i => i.src?.substring(0, 120)),
      floors: [...ch.querySelectorAll('[id*="Floor_"]')].map(f => f.id),
    };
  });

  // Reset to home
  await jsNav('home');

  // Brochure link
  report.features.brochure = await page.evaluate(() => {
    const b = document.getElementById('brochure');
    return { exists: !!b, pdfLink: b?.querySelector('[href*=".pdf"]')?.getAttribute('href') };
  });

  // Exterior virtual tour
  report.features.exterior = await page.evaluate(() => {
    const e = document.getElementById('exterior');
    return { exists: !!e, virtualTourBtn: !!e?.querySelector('#exteriorVirtualTourBtn') };
  });

  fs.writeFileSync(`${OUT}/deep-analysis.json`, JSON.stringify(report, null, 2));
  console.log('Done! Report at', `${OUT}/deep-analysis.json`);

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
