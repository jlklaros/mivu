/**
 * Pharmiitalia — Glycolic Acid Pads 20%
 * Scroll-driven canvas animation — preloaded WebP frames (smooth scrubbing)
 * Video fallback on mobile (autoplay loop)
 */

/* ─── Visible error reporting ─────────────────────── */
window.addEventListener('error', ev => {
  const el = document.getElementById('loader-percent');
  if (el) el.textContent = 'Error: ' + ev.message;
  console.error('JS Error:', ev.message, ev.filename, ev.lineno);
});
window.addEventListener('unhandledrejection', ev => {
  const el = document.getElementById('loader-percent');
  if (el) el.textContent = 'Error: ' + (ev.reason?.message || ev.reason);
  console.error('Unhandled rejection:', ev.reason);
});

/* ─────────────────────────────────────────────────────
   Config
───────────────────────────────────────────────────── */
const FRAME_COUNT  = 300;   /* total extracted frames — update if different */
const IMAGE_SCALE  = 1.0;   /* 1.0 = native canvas size                     */

/*
 * Section-to-frame mapping for 0315.mp4 (~10 s, 300 frames @ 30 fps)
 * Adjust the frame numbers once you've verified the new video content.
 *
 * 001 Formula           → frames   1– 60  (0 s – 2 s)
 * 002 Anti-Ageing       → frames  61–120  (2 s – 4 s)
 * 003 Targets           → frames 121–180  (4 s – 6 s)
 * 004 Active Ingredients→ frames 181–240  (6 s – 8 s)
 * 005 The Ritual        → frames 241–300  (8 s –10 s)
 */
const FRAME_KEYFRAMES = [
  [0.00,   1],   // page load — first frame
  [0.08,   1],   // hold while hero is visible
  [0.23,  85],   // end of 001 / Formula — approaching pad scene
  [0.25,  90],   // 002 ENTERS = frame 90 / second 3 (pad cleaning)
  [0.38, 110],   // 002 LEAVES — still near pad scene
  [0.53, 180],   // end of 003 / Targets
  [0.67, 240],   // end of 004 / Active Ingredients
  [0.80, 300],   // end of 005 / The Ritual
  [1.00, 300],   // hold last frame through CTA
];

const MARQUEE_ENTER = 0.54;
const MARQUEE_LEAVE = 0.68;
const DARK_ENTER    = 0.82;
const DARK_LEAVE    = 0.99;

/* ─────────────────────────────────────────────────────
   Device detection
───────────────────────────────────────────────────── */
const IS_TOUCH  = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const IS_MOBILE = IS_TOUCH || window.innerWidth < 768;

if (IS_MOBILE) document.documentElement.classList.add('is-mobile');

/* ─────────────────────────────────────────────────────
   DOM refs
───────────────────────────────────────────────────── */
const loader      = document.getElementById('loader');
const loaderBar   = document.getElementById('loader-bar');
const loaderPct   = document.getElementById('loader-percent');
const hero        = document.getElementById('hero');
const heroBg      = document.getElementById('hero-bg');
const darkOverlay = document.getElementById('dark-overlay');
const marqueeWrap = document.getElementById('marquee-1');
const scrollCont  = document.getElementById('scroll-container');
const canvasWrap  = document.getElementById('canvas-wrap');
const canvas      = document.getElementById('canvas');
const ctx         = canvas ? canvas.getContext('2d') : null;
const video       = document.getElementById('product-video');

/* ─────────────────────────────────────────────────────
   GSAP plugin registration
───────────────────────────────────────────────────── */
gsap.registerPlugin(ScrollTrigger);

/* ─────────────────────────────────────────────────────
   Frame interpolation
───────────────────────────────────────────────────── */
function progressToFrame(p) {
  for (let i = 1; i < FRAME_KEYFRAMES.length; i++) {
    const [p0, f0] = FRAME_KEYFRAMES[i - 1];
    const [p1, f1] = FRAME_KEYFRAMES[i];
    if (p <= p1) {
      const t = (p1 === p0) ? 1 : (p - p0) / (p1 - p0);
      return Math.round(f0 + t * (f1 - f0));
    }
  }
  return FRAME_COUNT;
}

/* ─────────────────────────────────────────────────────
   Canvas — resize to fill viewport
───────────────────────────────────────────────────── */
let frames = [];
let currentFrame = 0;

function resizeCanvas() {
  if (!canvas) return;
  canvas.width  = Math.round(window.innerWidth  * IMAGE_SCALE * devicePixelRatio);
  canvas.height = Math.round(window.innerHeight * IMAGE_SCALE * devicePixelRatio);
  canvas.style.width  = window.innerWidth  + 'px';
  canvas.style.height = window.innerHeight + 'px';
  if (frames[currentFrame]) drawFrame(currentFrame);
}
window.addEventListener('resize', resizeCanvas);

/* ─────────────────────────────────────────────────────
   Draw a single frame with white vignette
───────────────────────────────────────────────────── */
function drawFrame(index) {
  if (!ctx) return;
  const cw  = canvas.width;
  const ch  = canvas.height;
  const img = frames[index];

  /* No valid frame — clear canvas so video shows through */
  if (!img || img.naturalWidth === 0) {
    ctx.clearRect(0, 0, cw, ch);
    return;
  }

  /* fit image inside canvas (contain) */
  const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
  const dw = img.naturalWidth  * scale;
  const dh = img.naturalHeight * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;

  /* white background */
  ctx.fillStyle = '#fbfbfd';
  ctx.fillRect(0, 0, cw, ch);

  ctx.drawImage(img, dx, dy, dw, dh);

  /* radial vignette to blend edges into white */
  const gx = cw / 2, gy = ch / 2;
  const gr = Math.max(cw, ch) * 0.72;
  const grad = ctx.createRadialGradient(gx, gy, gr * 0.28, gx, gy, gr);
  grad.addColorStop(0,   'rgba(251,251,253,0)');
  grad.addColorStop(0.6, 'rgba(251,251,253,0.45)');
  grad.addColorStop(1,   'rgba(251,251,253,0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);
}

/* ─────────────────────────────────────────────────────
   Preload all frames
───────────────────────────────────────────────────── */
function preloadFrames(onProgress) {
  return new Promise(resolve => {
    frames = new Array(FRAME_COUNT + 1);
    let loaded = 0;

    /* Safety timeout — show page after 12 s even if frames are slow */
    const timeout = setTimeout(resolve, 12000);

    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img  = new Image();
      const idx  = i;
      img.onload = img.onerror = () => {
        loaded++;
        onProgress(loaded / FRAME_COUNT);
        if (loaded === FRAME_COUNT) { clearTimeout(timeout); resolve(); }
      };
      img.src = `frames/frame_${String(idx).padStart(4, '0')}.webp`;
      frames[idx] = img;
    }
  });
}

/* ─────────────────────────────────────────────────────
   Canvas scroll binding
───────────────────────────────────────────────────── */
function setupFrameBinding() {
  if (!canvas) return;
  resizeCanvas();

  ScrollTrigger.create({
    trigger : scrollCont,
    start   : 'top top',
    end     : 'bottom bottom',
    scrub   : true,
    onUpdate: self => {
      const p = self.progress;

      /* Hero phase — keep canvas transparent so hero-bg flat lay shows through */
      if (p < 0.08) {
        if (currentFrame !== 0) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          currentFrame = 0;
        }
        return;
      }

      const target = progressToFrame(p);
      if (target !== currentFrame) {
        currentFrame = target;
        drawFrame(currentFrame);
      }
    }
  });

  /* Start with transparent canvas — hero-bg image shows through */
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/* ─────────────────────────────────────────────────────
   Hero entrance
───────────────────────────────────────────────────── */
function animateHeroIn() {
  const eyebrow   = hero.querySelector('.hero-eyebrow');
  const words     = hero.querySelectorAll('.hero-word');
  const tagline   = hero.querySelector('.hero-tagline');
  const indicator = hero.querySelector('.scroll-indicator');

  gsap.to(eyebrow,   { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out', delay: 0.3  });
  gsap.to(words,     { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', stagger: 0.18, delay: 0.55 });
  gsap.to(tagline,   { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out', delay: 1.2  });
  gsap.to(indicator, { opacity: 1,       duration: 0.9, ease: 'power2.out', delay: 1.85 });
}

/* ─────────────────────────────────────────────────────
   Section positioning
───────────────────────────────────────────────────── */
function positionSections() {
  const totalH = scrollCont.offsetHeight;
  document.querySelectorAll('.scroll-section').forEach(sec => {
    const enter = parseFloat(sec.dataset.enter) / 100;
    const leave = parseFloat(sec.dataset.leave) / 100;
    const mid   = (enter + leave) / 2;
    sec.style.top       = (mid * totalH) + 'px';
    sec.style.transform = 'translateY(-50%)';
  });
}

/* ─────────────────────────────────────────────────────
   Section animations
───────────────────────────────────────────────────── */
function buildTimeline(section) {
  const type = section.dataset.animation;
  const children = section.querySelectorAll(
    '.section-label, .section-heading, .section-body, .section-note, ' +
    '.cta-button, .cta-buttons, .cta-inner > *'
  );
  if (!children.length) return null;

  const tl = gsap.timeline({ paused: true });

  switch (type) {
    case 'slide-left':
      tl.from(children, { x: -32, opacity: 0, stagger: 0.1, duration: 1.0, ease: 'power2.out' });
      break;
    case 'slide-right':
      tl.from(children, { x: 32,  opacity: 0, stagger: 0.1, duration: 1.0, ease: 'power2.out' });
      break;
    case 'rotate-in':
      tl.from(children, { y: 28, rotation: 1.5, opacity: 0, stagger: 0.1, duration: 1.0, ease: 'power2.out' });
      break;
    case 'clip-reveal':
      tl.from(children, { clipPath: 'inset(100% 0 0 0)', opacity: 0, stagger: 0.12, duration: 1.3, ease: 'power4.inOut' });
      break;
    default:
      tl.from(children, { y: 28, opacity: 0, stagger: 0.1, duration: 1.0, ease: 'power2.out' });
  }
  return tl;
}

function setupSections() {
  document.querySelectorAll('.scroll-section').forEach(sec => {
    const enter   = parseFloat(sec.dataset.enter) / 100;
    const leave   = parseFloat(sec.dataset.leave) / 100;
    const persist = sec.dataset.persist === 'true';
    const tl      = buildTimeline(sec);
    const inner   = sec.querySelector('.section-inner');

    let visible = false;

    ScrollTrigger.create({
      trigger : scrollCont,
      start   : 'top top',
      end     : 'bottom bottom',
      onUpdate: self => {
        const p = self.progress;

        /* ── Visibility ── */
        if (p >= enter && p <= leave && !visible) {
          visible = true;
          if (tl) tl.play();
        } else if ((p < enter || p > leave) && visible && !persist) {
          visible = false;
          if (tl) tl.reverse();
        }

        /* ── Liquid glass stretch ──
           t = 0 at section centre (full size)
           t = 1 at section edges (compressed + tighter radius) */
        if (inner && p >= enter && p <= leave) {
          const mid       = (enter + leave) / 2;
          const halfRange = (leave - enter) / 2;
          const t         = Math.abs(p - mid) / halfRange;
          const scaleY    = 1 - t * 0.045;
          const radius    = 20 - t * 10;
          inner.style.transform    = `scaleY(${scaleY.toFixed(4)})`;
          inner.style.borderRadius = `${radius.toFixed(1)}px`;
        }
      }
    });
  });
}

/* ─────────────────────────────────────────────────────
   Marquee
───────────────────────────────────────────────────── */
function setupMarquee() {
  const text     = marqueeWrap.querySelector('.marquee-text');
  const fadeSpan = 0.04;

  gsap.to(text, {
    xPercent : -18,
    ease     : 'none',
    scrollTrigger: {
      trigger : scrollCont,
      start   : 'top top',
      end     : 'bottom bottom',
      scrub   : true
    }
  });

  ScrollTrigger.create({
    trigger : scrollCont,
    start   : 'top top',
    end     : 'bottom bottom',
    onUpdate: self => {
      const p = self.progress;
      let o = 0;
      if      (p >= MARQUEE_ENTER - fadeSpan && p < MARQUEE_ENTER)
        o = (p - (MARQUEE_ENTER - fadeSpan)) / fadeSpan;
      else if (p >= MARQUEE_ENTER && p <= MARQUEE_LEAVE)
        o = 1;
      else if (p > MARQUEE_LEAVE && p <= MARQUEE_LEAVE + fadeSpan)
        o = 1 - (p - MARQUEE_LEAVE) / fadeSpan;
      marqueeWrap.style.opacity = o;
    }
  });
}

/* ─────────────────────────────────────────────────────
   White overlay (fades out product for CTA)
───────────────────────────────────────────────────── */
function setupDarkOverlay() {
  const fadeSpan = 0.04;

  ScrollTrigger.create({
    trigger : scrollCont,
    start   : 'top top',
    end     : 'bottom bottom',
    onUpdate: self => {
      const p = self.progress;
      let o = 0;
      if      (p >= DARK_ENTER - fadeSpan && p < DARK_ENTER)
        o = (p - (DARK_ENTER - fadeSpan)) / fadeSpan;
      else if (p >= DARK_ENTER && p <= DARK_LEAVE)
        o = 0.97;
      else if (p > DARK_LEAVE && p <= DARK_LEAVE + fadeSpan)
        o = 0.97 * (1 - (p - DARK_LEAVE) / fadeSpan);
      darkOverlay.style.opacity = o;
    }
  });
}

/* ─────────────────────────────────────────────────────
   Hero transition
───────────────────────────────────────────────────── */
function setupHeroTransition() {
  ScrollTrigger.create({
    trigger : scrollCont,
    start   : 'top top',
    end     : 'bottom bottom',
    onUpdate: self => {
      const p = self.progress;
      const fade = Math.max(0, 1 - p * 14);
      hero.style.opacity = fade;
      if (heroBg) heroBg.style.opacity = fade;
    }
  });
}

/* ─────────────────────────────────────────────────────
   Reviews — staggered card entrance on scroll into view
───────────────────────────────────────────────────── */
function setupFloatingCTA() {
  const btn = document.getElementById('floating-cta');
  if (!btn) return;

  /* Show after hero leaves viewport */
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      btn.classList.toggle('visible', !entry.isIntersecting);
    });
  }, { threshold: 0 });

  const heroEl = document.getElementById('hero');
  if (heroEl) observer.observe(heroEl);

  /* Click handled by setupShopify() */
}

function setupPurchaseCard() {
  const card = document.querySelector('.purchase-card');
  if (!card) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        card.classList.add('visible');
        observer.unobserve(card);
      }
    });
  }, { threshold: 0.2 });

  observer.observe(card);
}

function setupRitual() {
  const steps = document.querySelectorAll('.ritual-step');
  if (!steps.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = [...steps].indexOf(entry.target);
        setTimeout(() => entry.target.classList.add('visible'), index * 140);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  steps.forEach(step => observer.observe(step));
}

/* ─────────────────────────────────────────────────────
   Mobile video scrubbing — controls currentTime via scroll
   (replaces autoplay loop on mobile)
───────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────
   Shopify — pack selector + buy buttons
───────────────────────────────────────────────────── */
function setupShopify() {
  const SHOP  = 'j3mvdc-fd.myshopify.com';
  const TOKEN = 'b9e55c0869752ceea51dd930664222e8';

  const PACKS = {
    '1pack': { variantId: 'gid://shopify/ProductVariant/45061957058607', price: '$50.00', per: '$0.83' },
    '2pack': { variantId: 'gid://shopify/ProductVariant/45078396436527', price: '$90.00', per: '$0.75' },
  };

  let selectedVariantId = PACKS['2pack'].variantId;  // default: 2-pack
  let checkoutUrl       = null;                       // cached for current selection

  /* ── Pack selector interaction ── */
  document.querySelectorAll('.pack-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pack-option').forEach(b => b.classList.remove('pack-option--selected'));
      btn.classList.add('pack-option--selected');
      const newVariant = btn.dataset.variant;
      if (newVariant !== selectedVariantId) {
        selectedVariantId = newVariant;
        checkoutUrl = null;  // invalidate cached URL for old selection
        const packLabel = btn.querySelector('.pack-qty')?.textContent || '';
        document.querySelectorAll('.purchase-price').forEach(el => el.textContent = btn.dataset.price);
        document.querySelectorAll('.purchase-per').forEach(el => el.textContent = `· ${btn.dataset.per} per pad`);
        document.querySelectorAll('.purchase-pack-label').forEach(el => el.textContent = packLabel);
        document.querySelectorAll('.floating-price').forEach(el => el.textContent = btn.dataset.price);
        document.querySelectorAll('.floating-pack').forEach(el => el.textContent = packLabel);
      }
    });
  });

  const allBtns = [
    document.getElementById('floating-cta'),
    ...document.querySelectorAll('.cta-primary, .purchase-btn'),
  ].filter(Boolean);

  /* ── On click: use pre-built URL or build on demand ── */
  async function handleBuyClick(e) {
    e.preventDefault();

    if (checkoutUrl) { window.location.href = checkoutUrl; return; }

    const btn = e.currentTarget;
    const origText = btn.textContent;
    btn.textContent = 'Loading…';
    btn.disabled = true;

    try {
      const r = await fetch(`https://${SHOP}/api/2023-10/graphql.json`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
        body   : JSON.stringify({ query: `mutation { cartCreate(input:{ lines:[{ merchandiseId:"${selectedVariantId}", quantity:1 }] }) { cart{ checkoutUrl } userErrors{ message } } }` }),
      });
      const d   = await r.json();
      console.log('cartCreate response:', JSON.stringify(d));
      const url = d?.data?.cartCreate?.cart?.checkoutUrl;
      if (url) { window.location.href = url; return; }
      console.error('cartCreate userErrors:', d?.data?.cartCreate?.userErrors);
    } catch (err) {
      console.error('Shopify checkout error:', err);
    }

    btn.textContent = origText;
    btn.disabled    = false;
    alert('Could not reach checkout. Please visit mivu-uv.com directly or try again.');
  }

  allBtns.forEach(btn => btn.addEventListener('click', handleBuyClick));

  /* ── Background: pre-build cart URL for default selection (2-pack) ── */
  fetch(`https://${SHOP}/api/2023-10/graphql.json`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
    body   : JSON.stringify({ query: `mutation {
      cartCreate(input: { lines: [{ merchandiseId: "${selectedVariantId}", quantity: 1 }] }) {
        cart { checkoutUrl }
        userErrors { message }
      }
    }` }),
  })
  .then(r => r.json())
  .then(data => {
    console.log('Background cartCreate:', JSON.stringify(data));
    const url = data?.data?.cartCreate?.cart?.checkoutUrl;
    if (url) checkoutUrl = url;
  })
  .catch(err => console.warn('Shopify background setup failed:', err));
}

function setupMobileVideoScrub() {
  const videoEl = document.getElementById('product-video');
  if (!videoEl) return;

  /* Pause immediately — autoplay unlocked it for seeking on iOS */
  const doPause = () => { videoEl.pause(); videoEl.loop = false; };
  if (videoEl.readyState >= 1) {
    doPause();
  } else {
    videoEl.addEventListener('loadedmetadata', doPause, { once: true });
  }

  ScrollTrigger.create({
    trigger : scrollCont,
    start   : 'top top',
    end     : 'bottom bottom',
    onUpdate: self => {
      const dur = videoEl.duration;
      if (!dur || !isFinite(dur)) return;
      const frame      = progressToFrame(self.progress);
      const targetTime = (frame / FRAME_COUNT) * dur;
      if (Math.abs(videoEl.currentTime - targetTime) > 0.05) {
        videoEl.currentTime = targetTime;
      }
    }
  });
}

/* ─────────────────────────────────────────────────────
   Scroll snap — one wheel tick = one section
   Intercepts wheel events in the scroll-container zone,
   pauses Lenis, animates with rAF, resumes Lenis after.
───────────────────────────────────────────────────── */
const SNAP_POINTS = [
  0,       // hero top
  0.165,   // 001 Formula
  0.315,   // 002 Anti-Ageing
  0.465,   // 003 Targets
  0.610,   // 004 Ingredients
  0.745,   // 005 The Ritual
  0.915,   // CTA
];

function setupScrollSnap() {
  if (IS_MOBILE || !lenis) return;

  let currentIdx = 0;
  let isAnimating = false;
  let animRAF = null;

  function snapY(progress) {
    const contTop    = scrollCont.offsetTop;
    const scrollable = scrollCont.offsetHeight - window.innerHeight;
    return contTop + progress * scrollable;
  }

  function inZone() {
    const top = scrollCont.offsetTop;
    const bot = top + scrollCont.offsetHeight - window.innerHeight;
    return window.scrollY >= top - 20 && window.scrollY <= bot + 20;
  }

  /* Sync currentIdx to actual scroll position */
  function syncIndex() {
    const contTop    = scrollCont.offsetTop;
    const scrollable = scrollCont.offsetHeight - window.innerHeight;
    const p = (window.scrollY - contTop) / scrollable;
    let best = 0, bestDist = Infinity;
    SNAP_POINTS.forEach((pt, i) => {
      const d = Math.abs(pt - p);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    currentIdx = best;
  }

  function animateTo(targetY, done) {
    cancelAnimationFrame(animRAF);
    const startY   = window.scrollY;
    const dist     = targetY - startY;
    const duration = 900;
    const t0       = performance.now();

    lenis.stop();

    function tick(now) {
      const raw    = Math.min((now - t0) / duration, 1);
      const eased  = raw < 0.5
        ? 4 * raw * raw * raw
        : 1 - Math.pow(-2 * raw + 2, 3) / 2;

      window.scrollTo(0, startY + dist * eased);
      ScrollTrigger.update();

      if (raw < 1) {
        animRAF = requestAnimationFrame(tick);
      } else {
        lenis.scrollTo(targetY, { immediate: true });
        lenis.start();
        done();
      }
    }
    animRAF = requestAnimationFrame(tick);
  }

  function goTo(idx) {
    idx = Math.max(0, Math.min(SNAP_POINTS.length - 1, idx));
    currentIdx  = idx;
    isAnimating = true;
    animateTo(snapY(SNAP_POINTS[idx]), () => { isAnimating = false; });
  }

  window.addEventListener('wheel', e => {
    if (!inZone()) return;
    e.preventDefault();
    if (isAnimating) return;
    syncIndex();
    goTo(currentIdx + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });
}

function setupFaq() {
  document.querySelectorAll('.faq-item').forEach(item => {
    const btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  });
}

function setupResults() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.stat-card').forEach((el, i) => {
    el.style.transitionDelay = `${i * 80}ms`;
    observer.observe(el);
  });

  document.querySelectorAll('.timeline-item').forEach((el, i) => {
    el.style.transitionDelay = `${i * 120}ms`;
    observer.observe(el);
  });

  const compTable = document.querySelector('.comp-table');
  if (compTable) observer.observe(compTable);
}

function setupReviews() {
  const cards = document.querySelectorAll('.review-card');
  if (!cards.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card  = entry.target;
        const index = [...cards].indexOf(card);
        setTimeout(() => card.classList.add('visible'), index * 100);
        observer.unobserve(card);
      }
    });
  }, { threshold: 0.15 });

  cards.forEach(card => observer.observe(card));
}

/* ─────────────────────────────────────────────────────
   Main initialisation
───────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────
   Module-level Lenis ref (needed by nav)
───────────────────────────────────────────────────── */
let lenis = null;

/* ─────────────────────────────────────────────────────
   Nav — scroll to section on click
───────────────────────────────────────────────────── */
function scrollToProgress(progress) {
  const totalH = scrollCont.offsetHeight;
  const targetY = scrollCont.offsetTop + progress * (totalH - window.innerHeight);
  if (lenis) {
    lenis.scrollTo(targetY, { duration: 1.5 });
  } else {
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }
}

function setupNav() {
  /* Header background on scroll — Lenis on desktop, window scroll on mobile */
  const header = document.querySelector('.site-header');
  if (header) {
    if (lenis) {
      lenis.on('scroll', ({ scroll }) => {
        header.classList.toggle('scrolled', scroll > 60);
      });
    } else {
      window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 60);
      }, { passive: true });
    }
  }

  document.querySelectorAll('.nav-links a').forEach(link => {
    const text = link.textContent.trim().toLowerCase();
    link.addEventListener('click', e => {
      e.preventDefault();
      if (text === 'formula') {
        scrollToProgress(0.10); // section 001 enter
      } else if (text === 'results') {
        const reviews = document.getElementById('reviews');
        if (reviews) {
          lenis ? lenis.scrollTo(reviews, { duration: 1.5 }) : reviews.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (text === 'shop') {
        scrollToProgress(0.83); // CTA section enter
      }
    });
  });
}

function initExperience() {
  if (!IS_MOBILE) {
    lenis = new Lenis({
      duration    : 1.2,
      easing      : t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel : true,
      smoothTouch : false,
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  positionSections();
  setupSections();
  setupHeroTransition();

  if (IS_MOBILE) {
    setupMobileVideoScrub();
  } else {
    setupFrameBinding();
  }

  setupDarkOverlay();
  setupMarquee();
  setupRitual();
  setupReviews();
  setupResults();
  setupFaq();
  setupFloatingCTA();
  setupPurchaseCard();
  setupNav();
  setupShopify();
  animateHeroIn();
}

/* ─────────────────────────────────────────────────────
   Boot — desktop preloads frames, mobile uses video
───────────────────────────────────────────────────── */
async function boot() {
  try {
    if (IS_MOBILE) {
      /* Mobile: skip frame preload, use video autoplay */
      loaderPct.textContent = '100%';
      loaderBar.style.width = '100%';
      await new Promise(r => setTimeout(r, 400));
      loader.classList.add('hidden');
      initExperience();
      return;
    }

    /* Desktop: preload all frames */
    canvasWrap.style.display = 'block';

    await preloadFrames(progress => {
      const pct = Math.round(progress * 100);
      loaderBar.style.width = pct + '%';
      loaderPct.textContent = pct + '%';
    });

    await new Promise(r => setTimeout(r, 400));
    loader.classList.add('hidden');
    initExperience();

  } catch (err) {
    console.error('Boot failed:', err);
    loaderPct.textContent = 'Error: ' + err.message;
  }
}

/* ─────────────────────────────────────────────────────
   Promo banner — 4-day countdown, persisted via localStorage
───────────────────────────────────────────────────── */
(function initPromoBanner() {
  const banner    = document.getElementById('promo-banner');
  const closeBtn  = document.getElementById('promo-close');
  const DURATION  = 4 * 24 * 60 * 60 * 1000; // 4 days in ms
  const KEY_END   = 'pharmi_promo_end';
  const KEY_GONE  = 'pharmi_promo_gone';

  function dismissBanner() {
    banner.classList.add('hidden');
    localStorage.setItem(KEY_GONE, '1');
    setTimeout(() => {
      banner.style.display = 'none';
      document.body.classList.add('banner-gone');
    }, 420);
  }

  /* Already dismissed or expired previously */
  if (localStorage.getItem(KEY_GONE)) {
    banner.style.display = 'none';
    document.body.classList.add('banner-gone');
    return;
  }

  /* Set end time on first visit */
  let endTime = parseInt(localStorage.getItem(KEY_END), 10);
  if (!endTime) {
    endTime = Date.now() + DURATION;
    localStorage.setItem(KEY_END, endTime);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    const diff = endTime - Date.now();
    if (diff <= 0) { dismissBanner(); return; }

    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000)  / 60000);
    const secs  = Math.floor((diff % 60000)    / 1000);

    document.getElementById('cd-days').textContent  = pad(days);
    document.getElementById('cd-hours').textContent = pad(hours);
    document.getElementById('cd-mins').textContent  = pad(mins);
    document.getElementById('cd-secs').textContent  = pad(secs);
  }

  tick();
  setInterval(tick, 1000);
  closeBtn.addEventListener('click', dismissBanner);
})();

boot();
