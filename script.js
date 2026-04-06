/* ========================================
   MathX Landing — JavaScript
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* --- Header scroll effect --- */
  const header = document.getElementById('header');
  const heroSection = document.getElementById('hero');

  function updateHeader() {
    if (window.scrollY > 60) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  /* --- Burger menu --- */
  const burger = document.getElementById('burger');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileLinks = mobileMenu.querySelectorAll('.mobile-nav-link, .mobile-nav-btn');

  burger.addEventListener('click', () => {
    burger.classList.toggle('active');
    mobileMenu.classList.toggle('open');
    document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
  });

  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      burger.classList.remove('active');
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  /* --- Reveal on scroll --- */
  const reveals = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger siblings
        const parent = entry.target.parentElement;
        const siblings = parent ? Array.from(parent.querySelectorAll('.reveal')) : [];
        const index = siblings.indexOf(entry.target);
        const delay = Math.min(index * 80, 400);

        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);

        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  reveals.forEach(el => revealObserver.observe(el));

  /* --- Counter animation --- */
  const counters = document.querySelectorAll('.result-value[data-target]');

  function animateCounter(el) {
    const target = parseInt(el.dataset.target, 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const duration = 2000;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);

      el.textContent = prefix + current.toLocaleString('ru-RU') + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => counterObserver.observe(el));

  /* --- FAQ accordion --- */
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('active');

      // Close all
      faqItems.forEach(other => {
        if (other !== item) {
          other.classList.remove('active');
          const otherAnswer = other.querySelector('.faq-answer');
          otherAnswer.style.maxHeight = '0';
          other.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        }
      });

      // Toggle current
      if (isOpen) {
        item.classList.remove('active');
        answer.style.maxHeight = '0';
        question.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* --- Sticky CTA (mobile) --- */
  const stickyCta = document.getElementById('sticky-cta');

  if (stickyCta && heroSection) {
    const stickyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          stickyCta.classList.add('visible');
        } else {
          stickyCta.classList.remove('visible');
        }
      });
    }, { threshold: 0 });

    stickyObserver.observe(heroSection);
  }

  /* --- Smooth scroll for anchor links --- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const headerHeight = header.offsetHeight;
        const top = targetEl.getBoundingClientRect().top + window.scrollY - headerHeight - 16;

        window.scrollTo({
          top: top,
          behavior: 'smooth'
        });
      }
    });
  });

  /* --- Form handling --- */
  const form = document.getElementById('contact-form');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      // Basic validation
      if (!data.name || !data.phone) {
        return;
      }

      // Show success state
      form.innerHTML = `
        <div class="form-success">
          <div class="form-success-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#00E676" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3>Заявка отправлена!</h3>
          <p>Свяжусь с вами в течение 2 часов для записи на бесплатный пробный урок.</p>
        </div>
      `;
    });
  }

  /* --- Active nav link highlight --- */
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }, {
    threshold: 0.3,
    rootMargin: '-100px 0px -60% 0px'
  });

  sections.forEach(section => navObserver.observe(section));

  /* --- Math Canvas Background --- */
  const mathCanvas = document.getElementById('math-canvas');
  if (mathCanvas) {
    const ctx = mathCanvas.getContext('2d');
    let W, H;
    let lastFrame = 0;
    const FPS = 1000 / 18; // ~18fps for performance

    function resizeCanvas() {
      W = window.innerWidth;
      H = document.documentElement.scrollHeight;
      mathCanvas.width = W;
      mathCanvas.height = H;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    // Re-measure after fonts/images load in case page grows
    window.addEventListener('load', resizeCanvas);

    const formulas = [
      'y = ax² + bx + c', '∫₀¹ f(x)dx', 'lim x→∞', 'Σ aₙ',
      'sin²α + cos²α = 1', 'e^(iπ) + 1 = 0', 'dy/dx', 'a² + b² = c²',
      'log₂ n', 'f\'(x₀)', 'S = πr²', 'Δ = b² − 4ac',
      'tg α', 'P(A∩B)', 'n!/(n−k)!', '∀ε > 0', '∃x ∈ ℝ',
      'φ = (1+√5)/2', 'x = −b±√D / 2a', 'V = 4/3·πr³',
      '∇·F = 0', 'det(A)', 'tr(M)', 'i² = −1', '|z| = r',
      'C(n,k)', 'P = nRT/V', 'F = ma', 'E = mc²', '∮ E·dl'
    ];

    const symbols = ['∫', 'Σ', '∂', '∞', '√', 'π', 'Δ', '∇', 'θ', 'λ', 'α', 'β', 'φ', 'ω', '∀', '∃', 'ℝ', 'ℂ', 'ℕ', 'ζ', 'μ', 'σ', 'ε', 'γ'];

    const particles = [];
    const COUNT = 70; // увеличено вдвое

    function createParticle(yOverride) {
      const isFormula = Math.random() < 0.4;
      const isShape = !isFormula && Math.random() < 0.35;
      const y = yOverride !== undefined ? yOverride : Math.random() * H;

      if (isFormula) {
        return {
          type: 'formula',
          text: formulas[Math.floor(Math.random() * formulas.length)],
          x: Math.random() * W,
          y,
          vx: (Math.random() - 0.5) * 0.25,
          vy: -(Math.random() * 0.15 + 0.05),
          size: Math.random() * 5 + 13,
          opacity: Math.random() * 0.05 + 0.04,
          rot: (Math.random() - 0.5) * 0.3,
          vr: (Math.random() - 0.5) * 0.0006,
          purple: Math.random() > 0.5
        };
      } else if (isShape) {
        const shapeType = Math.random();
        return {
          type: shapeType < 0.4 ? 'circle' : shapeType < 0.7 ? 'axes' : 'wave',
          x: Math.random() * W,
          y,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.1,
          size: Math.random() * 35 + 18,
          amplitude: Math.random() * 12 + 6,
          opacity: Math.random() * 0.04 + 0.03,
          phase: Math.random() * Math.PI * 2,
          phaseV: Math.random() * 0.008 + 0.003,
          rot: (Math.random() - 0.5) * 0.3,
          vr: (Math.random() - 0.5) * 0.0004,
          purple: Math.random() > 0.4
        };
      } else {
        return {
          type: 'symbol',
          text: symbols[Math.floor(Math.random() * symbols.length)],
          x: Math.random() * W,
          y,
          vx: (Math.random() - 0.5) * 0.2,
          vy: -(Math.random() * 0.12 + 0.03),
          size: Math.random() * 16 + 20,
          opacity: Math.random() * 0.06 + 0.05,
          rot: (Math.random() - 0.5) * 0.4,
          vr: (Math.random() - 0.5) * 0.0008,
          purple: Math.random() > 0.5
        };
      }
    }

    for (let i = 0; i < COUNT; i++) {
      particles.push(createParticle());
    }

    function drawParticles(ts) {
      requestAnimationFrame(drawParticles);
      if (ts - lastFrame < FPS) return;
      lastFrame = ts;

      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;

        // Wrap horizontally
        if (p.x < -160) p.x += W + 320;
        if (p.x > W + 160) p.x -= W + 320;
        // Wrap vertically within full document height
        if (p.y < -160) p.y += H + 320;
        if (p.y > H + 160) p.y -= H + 320;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);

        const color = p.purple
          ? `rgba(142, 45, 226, ${p.opacity})`
          : `rgba(0, 210, 255, ${p.opacity})`;

        if (p.type === 'formula' || p.type === 'symbol') {
          ctx.font = p.size + 'px "Golos Text", sans-serif';
          ctx.fillStyle = color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.text, 0, 0);
        } else if (p.type === 'circle') {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.type === 'axes') {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          const s = p.size;
          ctx.beginPath();
          ctx.moveTo(-s, 0); ctx.lineTo(s, 0);
          ctx.moveTo(0, -s); ctx.lineTo(0, s);
          ctx.moveTo(s - 4, -3); ctx.lineTo(s, 0); ctx.lineTo(s - 4, 3);
          ctx.moveTo(-3, -s + 4); ctx.lineTo(0, -s); ctx.lineTo(3, -s + 4);
          for (let t = -s + 10; t < s; t += 10) {
            ctx.moveTo(t, -2); ctx.lineTo(t, 2);
            ctx.moveTo(-2, t); ctx.lineTo(2, t);
          }
          ctx.stroke();
        } else if (p.type === 'wave') {
          p.phase += p.phaseV;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 0; i <= 40; i++) {
            const x = -p.size + (i / 40) * p.size * 2;
            const y = Math.sin((x / p.size) * Math.PI * 2 + p.phase) * p.amplitude;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        ctx.restore();
      }
    }

    requestAnimationFrame(drawParticles);
  }
});
