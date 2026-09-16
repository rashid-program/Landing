function initMathXSite() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.getElementById('header');
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileLinks = mobileMenu?.querySelectorAll('a') || [];
  const menuBackground = [
    document.getElementById('main-content'),
    document.querySelector('.site-footer'),
    document.getElementById('sticky-contact'),
  ].filter(Boolean);

  const updateHeader = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 28);
  };

  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  const setMenuState = (open, returnFocus = false) => {
    if (!menuToggle || !mobileMenu) return;

    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    mobileMenu.toggleAttribute('inert', !open);
    header?.classList.toggle('is-menu-open', open);
    document.body.classList.toggle('menu-open', open);
    document.documentElement.classList.toggle('menu-open', open);
    menuBackground.forEach((element) => {
      element.toggleAttribute('inert', open);
      if (open) {
        element.setAttribute('aria-hidden', 'true');
      } else {
        element.removeAttribute('aria-hidden');
      }
    });

    if (open) {
      window.setTimeout(() => mobileLinks[0]?.focus(), 30);
    } else if (returnFocus) {
      menuToggle.focus();
    }
  };

  menuToggle?.addEventListener('click', () => {
    setMenuState(menuToggle.getAttribute('aria-expanded') !== 'true');
  });

  mobileLinks.forEach((link) => {
    link.addEventListener('click', () => setMenuState(false));
  });

  document.addEventListener('keydown', (event) => {
    const menuOpen = menuToggle?.getAttribute('aria-expanded') === 'true';

    if (event.key === 'Escape' && menuOpen) {
      setMenuState(false, true);
    }

    if (event.key === 'Tab' && menuOpen && mobileLinks.length) {
      const firstLink = mobileLinks[0];
      const lastLink = mobileLinks[mobileLinks.length - 1];

      if (event.shiftKey && document.activeElement === firstLink) {
        event.preventDefault();
        lastLink.focus();
      } else if (!event.shiftKey && document.activeElement === lastLink) {
        event.preventDefault();
        firstLink.focus();
      }
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024 && menuToggle?.getAttribute('aria-expanded') === 'true') {
      setMenuState(false);
    }
  });

  const revealItems = document.querySelectorAll('.reveal');

  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -36px',
      },
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  }

  const faqItems = document.querySelectorAll('.faq-item');

  const closeFaq = (item, immediate = false) => {
    const button = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!button || !answer) return;

    button.setAttribute('aria-expanded', 'false');
    answer.setAttribute('aria-hidden', 'true');
    answer.setAttribute('inert', '');

    if (immediate || reducedMotion) {
      answer.style.maxHeight = '0px';
      answer.hidden = true;
      return;
    }

    answer.style.maxHeight = `${answer.scrollHeight}px`;
    window.requestAnimationFrame(() => {
      answer.style.maxHeight = '0px';
    });

    const finish = () => {
      if (button.getAttribute('aria-expanded') === 'false') answer.hidden = true;
    };

    answer.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, 380);
  };

  const openFaq = (item) => {
    const button = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!button || !answer) return;

    faqItems.forEach((other) => {
      if (other !== item) closeFaq(other);
    });

    button.setAttribute('aria-expanded', 'true');
    answer.hidden = false;
    answer.removeAttribute('inert');
    answer.setAttribute('aria-hidden', 'false');

    if (reducedMotion) {
      answer.style.maxHeight = 'none';
      return;
    }

    answer.style.maxHeight = '0px';
    window.requestAnimationFrame(() => {
      answer.style.maxHeight = `${answer.scrollHeight}px`;
    });
  };

  faqItems.forEach((item) => {
    closeFaq(item, true);
    const button = item.querySelector('.faq-question');

    button?.addEventListener('click', () => {
      if (button.getAttribute('aria-expanded') === 'true') {
        closeFaq(item);
      } else {
        openFaq(item);
      }
    });
  });

  const reviewItems = Array.from(document.querySelectorAll('[data-review-id]'));
  const reviewButtons = document.querySelectorAll('[data-review-filter]');
  const reviewStatus = document.getElementById('review-status');
  const reviewMore = document.getElementById('review-more');
  const reviewMoreLabel = document.getElementById('review-more-label');
  const reviewShowcase = document.getElementById('review-showcase');
  const reviewGrid = document.getElementById('review-grid');
  const reviewSwipeHint = document.querySelector('.review-swipe-hint');
  const compactReviews = window.matchMedia('(max-width: 600px)');
  const tabletReviews = window.matchMedia('(max-width: 980px)');
  let activeReviewFilter = 'all';
  let reviewsExpanded = false;

  const initialReviewCount = () => {
    if (compactReviews.matches) return 5;
    if (tabletReviews.matches) return 7;
    return 8;
  };

  const renderReviews = () => {
    const matching = reviewItems.filter((item) => {
      const categories = (item.dataset.reviewCategory || '').split(/\s+/);
      return activeReviewFilter === 'all' || categories.includes(activeReviewFilter);
    });

    const allReviews = activeReviewFilter === 'all';
    const visibleLimit = allReviews && !reviewsExpanded
      ? initialReviewCount()
      : Number.POSITIVE_INFINITY;
    let visibleCount = 0;

    reviewItems.forEach((item) => {
      const matchingIndex = matching.indexOf(item);
      const shouldShow = matchingIndex !== -1 && matchingIndex < visibleLimit;
      item.hidden = !shouldShow;
      if (shouldShow) visibleCount += 1;
    });

    reviewButtons.forEach((button) => {
      const active = button.dataset.reviewFilter === activeReviewFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    if (reviewShowcase) {
      reviewShowcase.hidden = !Array.from(
        reviewShowcase.querySelectorAll('[data-review-id]'),
      ).some((item) => !item.hidden);
      if (reviewSwipeHint) reviewSwipeHint.hidden = reviewShowcase.hidden;
    }

    if (reviewGrid) {
      reviewGrid.hidden = !Array.from(
        reviewGrid.querySelectorAll('[data-review-id]'),
      ).some((item) => !item.hidden);
    }

    if (reviewMore) {
      const canToggle = allReviews && matching.length > initialReviewCount();
      reviewMore.hidden = !canToggle;
      reviewMore.setAttribute('aria-expanded', String(reviewsExpanded));
      if (reviewMoreLabel) {
        reviewMoreLabel.textContent = reviewsExpanded
          ? 'Свернуть отзывы'
          : `Показать ещё ${matching.length - initialReviewCount()} отзывов`;
      }
    }

    if (reviewStatus) {
      if (activeReviewFilter === 'all') {
        reviewStatus.textContent =
          visibleCount === reviewItems.length
            ? 'Показаны все опубликованные отзывы'
            : `Показано ${visibleCount} отзывов`;
      } else {
        reviewStatus.textContent = `Отзывов по фильтру: ${matching.length}`;
      }
    }
  };

  reviewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeReviewFilter = button.dataset.reviewFilter || 'all';
      reviewsExpanded = false;
      renderReviews();
    });
  });

  reviewMore?.addEventListener('click', () => {
    reviewsExpanded = !reviewsExpanded;
    renderReviews();
  });

  compactReviews.addEventListener('change', renderReviews);
  tabletReviews.addEventListener('change', renderReviews);
  renderReviews();

  const stickyContact = document.getElementById('sticky-contact');
  const hero = document.getElementById('hero');
  const contact = document.getElementById('contact');
  let heroVisible = true;
  let contactVisible = false;

  const updateStickyContact = () => {
    if (!stickyContact) return;
    const show = window.innerWidth <= 780 && !heroVisible && !contactVisible;
    stickyContact.classList.toggle('is-visible', show);
    stickyContact.setAttribute('aria-hidden', String(!show));
    stickyContact.toggleAttribute('inert', !show);
  };

  if ('IntersectionObserver' in window && stickyContact) {
    const stickyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === hero) heroVisible = entry.isIntersecting;
          if (entry.target === contact) contactVisible = entry.isIntersecting;
        });
        updateStickyContact();
      },
      { threshold: 0 },
    );

    if (hero) stickyObserver.observe(hero);
    if (contact) stickyObserver.observe(contact);
  }

  window.addEventListener('resize', updateStickyContact);
  updateStickyContact();

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const targetSelector = anchor.getAttribute('href');
      if (!targetSelector || targetSelector === '#') return;

      const target = document.querySelector(targetSelector);
      if (!target) return;

      event.preventDefault();
      const headerHeight = header?.offsetHeight || 0;
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 14;

      window.scrollTo({
        top,
        behavior: reducedMotion ? 'auto' : 'smooth',
      });

      if (anchor.classList.contains('skip-link')) {
        target.focus({ preventScroll: true });
      }

      if (window.location.hash !== targetSelector) {
        window.history.replaceState(null, '', targetSelector);
      }
    });
  });

  const navLinks = document.querySelectorAll('.desktop-nav a');
  const sections = document.querySelectorAll('main section[id]');

  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        const current = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!current) return;

        navLinks.forEach((link) => {
          link.classList.toggle('is-active', link.getAttribute('href') === `#${current.target.id}`);
        });
      },
      {
        threshold: [0.18, 0.35],
        rootMargin: '-92px 0px -55%',
      },
    );

    sections.forEach((section) => navObserver.observe(section));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMathXSite, { once: true });
} else {
  initMathXSite();
}
