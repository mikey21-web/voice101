const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const WEBSITE = 'https://ncd-eight.vercel.app';
const MAIN = 'https://nikhilaconstructions.com/royal-pavilion';
const NCD = 'https://nikhilaconstructions.com';
const OUT = path.join(__dirname, 'screenshots-royal-pavilion');
const DEEP = path.join(OUT, 'deep-dive');
fs.mkdirSync(DEEP, { recursive: true });

const log = [];
function note(msg) { console.log(msg); log.push(msg); }

async function snap(page, name) {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(DEEP, `${name}.png`) });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  try {
    // ========= MAIN SITE =========
    note('--- MAIN NCD SITE: ROYAL PAVILION ---');
    await page.goto(MAIN, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(5000);
    await snap(page, '01-main-loaded');

    // Scroll through entire page and screenshot each section
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    note(`Main page total height: ${scrollHeight}px`);

    // Find all sections
    const sections = await page.evaluate(() => {
      const els = [];
      document.querySelectorAll('section, .section, [id], .wp-block-group, .gb-container, .wp-block-cover').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 100 && r.height > 100 && el.innerText.trim().length > 20) {
          els.push({
            tag: el.tagName,
            id: el.id,
            class: el.className?.slice(0, 60),
            text: el.innerText.trim().slice(0, 100),
            top: Math.round(r.top + window.scrollY),
            height: Math.round(r.height)
          });
        }
      });
      return els;
    });
    fs.writeFileSync(path.join(DEEP, 'main-sections.json'), JSON.stringify(sections, null, 2));
    note(`Found ${sections.length} sections on main page`);

    // Screenshot each visible section by scrolling
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      await page.evaluate(y => window.scrollTo(0, y), s.top - 50);
      await page.waitForTimeout(800);
      await snap(page, `02-main-section-${i}-${s.id?.slice(0,20) || s.class?.slice(0,20) || i}`);
      note(`Scrolled to section ${i}: ${s.text.slice(0,50)}`);
    }

    // Try clicking any interactive tabs/toggles
    const toggles = await page.$$('[class*="tab"], [class*="toggle"], [class*="accordion"], [data-tab], button');
    note(`Found ${toggles.length} potential interactive elements`);
    
    // Click tab/block selectors (floor plan tabs, etc)
    const tabs = await page.$$('[class*="tab"], [data-tab], [class*="block-"]:not([class*="container"])');
    for (let i = 0; i < Math.min(tabs.length, 15); i++) {
      try {
        const t = tabs[i];
        const text = await t.evaluate(el => el.innerText.trim().slice(0, 30));
        const rect = await t.evaluate(el => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        });
        if (rect.w > 0 && rect.h > 0 && text) {
          await t.click();
          await page.waitForTimeout(1200);
          await snap(page, `03-main-tab-${i}-${text.replace(/[^a-zA-Z0-9]/g, '_')}`);
          note(`Clicked tab ${i}: "${text}"`);
        }
      } catch(e) {
        note(`Tab ${i} click error: ${e.message?.slice(0,60)}`);
      }
    }

    // Click carousel/slider arrows
    const arrows = await page.$$('[class*="arrow"], [class*="carousel"] button, [class*="slide"] button, [aria-label*="Next"], [aria-label*="Previous"]');
    for (let i = 0; i < Math.min(arrows.length, 5); i++) {
      try {
        await arrows[i].click();
        await page.waitForTimeout(1000);
        await snap(page, `04-main-carousel-${i}`);
        note(`Clicked carousel arrow ${i}`);
      } catch(e) {}
    }

    // Check for "Webverse Experience" section and try clicking its link
    const webverseLinks = await page.$$('a[href*="spim"], a[href*="webverse"], a[href*="web"]');
    for (let i = 0; i < webverseLinks.length; i++) {
      try {
        const href = await webverseLinks[i].evaluate(el => el.href);
        note(`WebVerse link found: ${href}`);
        await snap(page, `05-main-webverse-link-${i}`);
      } catch(e) {}
    }

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // ========= VERCEl SITE - FULL INTERACTION =========
    note('\n--- VERCEl SITE ---');
    await page.goto(WEBSITE, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);
    await snap(page, '10-vercel-loaded');

    // Get page structure
    const vHeight = await page.evaluate(() => document.body.scrollHeight);
    note(`Vercel page height: ${vHeight}px`);

    // Find sections
    const vSections = await page.evaluate(() => {
      const els = [];
      document.querySelectorAll('section, div[class*="container"], div[class*="section"], div[class*="wrapper"], [id]').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 200 && r.height > 100 && el.innerText.trim().length > 20) {
          els.push({
            tag: el.tagName,
            id: el.id,
            class: el.className?.slice(0, 60),
            text: el.innerText.trim().slice(0, 150),
            top: Math.round(r.top + window.scrollY),
            height: Math.round(r.height)
          });
        }
      });
      return els;
    });
    fs.writeFileSync(path.join(DEEP, 'vercel-sections.json'), JSON.stringify(vSections, null, 2));
    note(`Found ${vSections.length} sections on vercel page`);

    // Scroll to each section
    for (let i = 0; i < vSections.length; i++) {
      const s = vSections[i];
      await page.evaluate(y => window.scrollTo(0, y - 50), s.top);
      await page.waitForTimeout(1000);
      await snap(page, `11-vercel-section-${i}-${s.id?.slice(0,20) || i}`);
      note(`Scrolled to vercel section ${i}`);
    }

    // Try clicking navigation
    const navLinks = await page.$$('nav a, header a, [class*="nav"] a');
    for (let i = 0; i < navLinks.length; i++) {
      try {
        const text = await navLinks[i].evaluate(el => el.innerText.trim().slice(0, 30));
        const href = await navLinks[i].evaluate(el => el.href);
        note(`Nav link ${i}: "${text}" -> ${href}`);
      } catch(e) {}
    }

    // Click Previous/Next carousel buttons
    const prevBtns = await page.$$('button:has-text("Previous")');
    const nextBtns = await page.$$('button:has-text("Next")');
    note(`Carousel: ${prevBtns.length} Previous, ${nextBtns.length} Next buttons`);

    for (let i = 0; i < Math.min(nextBtns.length, 3); i++) {
      try {
        await nextBtns[i].click();
        await page.waitForTimeout(1000);
        await snap(page, `12-vercel-carousel-next-${i}`);
        note(`Clicked carousel Next ${i}`);
      } catch(e) {}
    }

    // Check if there are any expandable/collapsible elements
    const expandables = await page.$$('[class*="expand"], [class*="collapse"], [class*="accordion"], details');
    note(`Expandable elements: ${expandables.length}`);

    // Try clicking floor plan blocks
    const floorPlanTabs = await page.$$('button:has-text("Block"), [class*="block"] button, [class*="floor"] button, [class*="plan"] button');
    for (let i = 0; i < floorPlanTabs.length; i++) {
      try {
        const text = await floorPlanTabs[i].evaluate(el => el.innerText.trim().slice(0, 30));
        await floorPlanTabs[i].click();
        await page.waitForTimeout(1000);
        await snap(page, `13-vercel-floorplan-${i}-${text.replace(/[^a-zA-Z0-9]/g, '_')}`);
        note(`Clicked floor plan tab: "${text}"`);
      } catch(e) {}
    }

    // Check for links to "Floor Plan Mode" or "Layout Mode" (SPIM WebVerse features)
    const externalLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="spim"], a[href*="webverse"], a[target="_blank"]')).map(a => ({
        text: a.innerText.trim().slice(0, 50),
        href: a.href
      }));
    });
    fs.writeFileSync(path.join(DEEP, 'vercel-external-links.json'), JSON.stringify(externalLinks, null, 2));
    note(`External/SPIM links: ${externalLinks.length}`);

    // Check for form fields
    const forms = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('form, input, textarea, select')).map(f => ({
        tag: f.tagName,
        name: f.name,
        type: f.type,
        placeholder: f.placeholder,
        action: f.action
      }));
    });
    fs.writeFileSync(path.join(DEEP, 'vercel-forms.json'), JSON.stringify(forms, null, 2));
    note(`Form elements: ${forms.length}`);

    // Scroll to bottom for footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await snap(page, '14-vercel-footer');
    note('Scrolled to footer');

    // ========= NCD MAIN SITE =========
    note('\n--- NCD MAIN SITE ---');
    await page.goto(NCD, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);
    await snap(page, '20-ncd-main-loaded');

    // Scroll through
    const ncdSections = await page.evaluate(() => {
      const els = [];
      document.querySelectorAll('section, [id], div[class*="container"]').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 100 && r.height > 100 && el.innerText.trim().length > 30) {
          els.push({
            id: el.id,
            class: el.className?.slice(0, 60),
            text: el.innerText.trim().slice(0, 100),
            top: Math.round(r.top + window.scrollY)
          });
        }
      });
      return els;
    });
    fs.writeFileSync(path.join(DEEP, 'ncd-sections.json'), JSON.stringify(ncdSections, null, 2));
    note(`NCD main site sections: ${ncdSections.length}`);

    // Find project links
    const projectLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="royal"], a[href*="pavilion"], a[href*="project"]')).map(a => ({
        text: a.innerText.trim().slice(0, 50),
        href: a.href
      }));
    });
    fs.writeFileSync(path.join(DEEP, 'ncd-project-links.json'), JSON.stringify(projectLinks, null, 2));
    note(`NCD project links: ${projectLinks.length}`);

    // Click "Explore More" or similar CTAs
    const ctaBtns = await page.$$('a:has-text("Explore"), a:has-text("More"), button:has-text("Explore"), button:has-text("More")');
    for (let i = 0; i < ctaBtns.length; i++) {
      try {
        const text = await ctaBtns[i].evaluate(el => el.innerText.trim().slice(0, 30));
        note(`CTA found: "${text}" -> ${await ctaBtns[i].evaluate(el => el.href || '')}`);
      } catch(e) {}
    }

    // Check testimonials carousel
    const testimonialNav = await page.$$('[class*="testimonial"] button, [class*="review"] button, .slick-arrow, .swiper-button');
    note(`Testimonial nav buttons: ${testimonialNav.length}`);

    // ========= CHECK FOR SPIM WEBVERSE LINK ON ALL SITES =========
    note('\n--- CHECKING SPIM WEBVERSE INTEGRATION ---');
    const spimRefs = await page.evaluate(() => {
      const body = document.body.innerText.toLowerCase();
      return {
        hasSpim: body.includes('spim'),
        hasWebverse: body.includes('webverse'),
        hasRoyalPavilion: body.includes('royal pavilion')
      };
    });
    fs.writeFileSync(path.join(DEEP, 'spim-references.json'), JSON.stringify(spimRefs, null, 2));
    note(`SPIM references on NCD site: ${JSON.stringify(spimRefs)}`);

    // Save action log
    fs.writeFileSync(path.join(DEEP, 'action-log.txt'), log.join('\n'));
    note('\n========== ROYAL PAVILION 100% EXPLORATION COMPLETE ==========');

  } catch (err) {
    console.error('FATAL:', err.message);
    await snap(page, '99-error');
  }

  await browser.close();
  console.log(log.join('\n'));
}

main();
