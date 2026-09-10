/* ==========================================================================
   Planalto Ferramental - Full Site & Cinema Motion Script (index5.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Registers GSAP Plugins
  gsap.registerPlugin(ScrollTrigger);

  // 1. Lenis Smooth Scroll Setup
  const lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo out
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
    infinite: false,
  });
  window.lenis = lenis;

  // RAF Loop for Lenis
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Sync ScrollTrigger with Lenis
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.lagSmoothing(0);

  // 2. Preloading Frames Setup (Updated to 188 frames for Hero)
  const frameCount = 188;
  const images = [];
  const imageSeq = { frame: 1 };
  const currentFrame = (index) => `midia/frames/ezgif-frame-${index.toString().padStart(3, '0')}.jpg`;

  const canvas = document.getElementById('hero-canvas');
  const context = canvas.getContext('2d');
  let loadedImagesCount = 0;

  // Preload Images
  function preloadImages(callback) {
    const loadingProgress = document.querySelector('.loading-bar-progress');
    const loadingText = document.querySelector('.loading-text');
    const loadingScreen = document.getElementById('loading-screen');

    const firstImg = new Image();
    firstImg.src = currentFrame(1);
    firstImg.onload = () => {
      images[0] = firstImg;
      loadedImagesCount++;
      drawFrame(0);

      for (let i = 2; i <= frameCount; i++) {
        const img = new Image();
        img.src = currentFrame(i);
        img.onload = onImageLoad;
        img.onerror = onImageError;
        images[i - 1] = img;
      }
    };

    function onImageLoad() {
      loadedImagesCount++;
      const progress = Math.round((loadedImagesCount / frameCount) * 100);

      if (loadingProgress) loadingProgress.style.width = `${progress}%`;
      if (loadingText) loadingText.textContent = `Carregando Modelagem... ${progress}%`;

      if (loadedImagesCount === frameCount) {
        setTimeout(() => {
          if (loadingScreen) loadingScreen.classList.add('loaded');
          startHeroAnimations();
        }, 600);
        if (callback) callback();
      }
    }

    function onImageError() {
      onImageLoad();
    }
  }

  // 3. Canvas Cover Sizing Algorithm
  function resizeCanvas() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    const activeIndex = Math.round(imageSeq.frame) - 1;
    drawFrame(activeIndex);
  }

  function drawFrame(index) {
    const img = images[index];
    if (!img || !canvas) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imgWidth = img.width;
    const imgHeight = img.height;

    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let drawWidth, drawHeight, drawX, drawY;

    if (canvasRatio > imgRatio) {
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / imgRatio;
      drawX = 0;
      drawY = (canvasHeight - drawHeight) / 2;
    } else {
      drawWidth = canvasHeight * imgRatio;
      drawHeight = canvasHeight;
      drawX = (canvasWidth - drawWidth) / 2;
      drawY = 0;
    }

    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  }

  // 4. GSAP Scroll Scrubbing Timeline for Hero
  function initScrollTimeline() {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.hero-pin',
        start: 'top top',
        end: '+=250%', 
        scrub: true,
        pin: true,
        anticipatePin: 1
      }
    });

    tl.to(imageSeq, {
      frame: frameCount,
      snap: 'frame',
      ease: 'none',
      onUpdate: () => {
        const index = Math.min(Math.max(Math.round(imageSeq.frame) - 1, 0), frameCount - 1);
        drawFrame(index);
      }
    }, 0);

    tl.to('#hero-canvas', { scale: 1.0, ease: 'none' }, 0);
    tl.to('.hero-text-col', { opacity: 0, y: -60, ease: 'power1.inOut' }, 0.2);
    tl.to('.scroll-indicator', { opacity: 0, y: -15, ease: 'power2.out' }, 0);
  }

  // 5. Entry Animations on Load Complete for Hero
  function startHeroAnimations() {
    const tl = gsap.timeline();

    tl.to('.hero-tagline', { opacity: 1, y: 0, duration: 1.2, ease: 'power4.out' });
    tl.to('.text-clip-anim span', { y: '0%', opacity: 1, duration: 1.4, ease: 'power4.out', stagger: 0.08 }, '-=1.0');
    tl.to('.hero-subtext', { opacity: 1, y: 0, duration: 1.2, ease: 'power4.out' }, '-=1.1');
    tl.to('.hero-actions', { opacity: 1, y: 0, duration: 1.2, ease: 'power4.out' }, '-=1.1');
    tl.to('.scroll-indicator', { opacity: 1, duration: 1.0, ease: 'power2.out' }, '-=0.6');
  }

  // 6. Intersection Observer for standard scroll reveals
  function initInViewAnimations() {
    const once = true;
    if (!window.__inViewIO) {
      window.__inViewIO = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate");
            if (entry.target.classList.contains("text-clip-anim")) {
              const spans = entry.target.querySelectorAll("span");
              spans.forEach(span => span.classList.add("animate"));
            }
            if (once) window.__inViewIO.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
    }

    document.querySelectorAll('.animate-on-scroll').forEach((el) => {
      window.__inViewIO.observe(el);
    });
  }

  // 7. Interactive Flashlight Glow Effects
  function initHoverEffects() {
    const flashElements = document.querySelectorAll('.btn-flashlight, .flashlight-card');
    flashElements.forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.setProperty('--mouse-x', `${x}px`);
        el.style.setProperty('--mouse-y', `${y}px`);
      });
    });
  }

  // 8. Animated Counter Statistics
  function initMetricCounters() {
    const metrics = document.querySelectorAll('.metric-number');
    metrics.forEach(metric => {
      const targetVal = parseInt(metric.getAttribute('data-target'));
      const prefix = metric.getAttribute('data-prefix') || '';
      const suffix = metric.getAttribute('data-suffix') || '';
      const countObj = { val: 0 };

      gsap.to(countObj, {
        val: targetVal,
        duration: 2.5,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: metric,
          start: 'top 92%',
          toggleActions: 'play none none none',
        },
        onUpdate: () => {
          metric.textContent = prefix + Math.floor(countObj.val) + suffix;
        }
      });
    });
  }

  // 9. GSAP Horizontal Scroll Setup for Section 3
  function initHorizontalScroll() {
    const wrapper = document.querySelector('.horizontal-scroll-wrapper');
    if (!wrapper) return;

    // Enable horizontal scroll pinning on all viewports
    gsap.to(wrapper, {
      x: () => -(wrapper.scrollWidth - window.innerWidth),
      ease: 'none',
      scrollTrigger: {
        trigger: '.horizontal-scroll-container',
        pin: true,
        scrub: true,
        start: 'top top',
        end: () => `+=${wrapper.scrollWidth - window.innerWidth}`,
        invalidateOnRefresh: true,
      }
    });
  }

  // 10. GSAP FAQ Accordion Behavior
  function initFAQAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
      const trigger = item.querySelector('.faq-trigger');
      const content = item.querySelector('.faq-content');

      trigger.addEventListener('click', () => {
        const isActive = item.classList.contains('active');

        // Close all items
        faqItems.forEach(otherItem => {
          otherItem.classList.remove('active');
          const otherContent = otherItem.querySelector('.faq-content');
          gsap.to(otherContent, { height: 0, opacity: 0, duration: 0.4, ease: 'power2.out' });
        });

        if (!isActive) {
          item.classList.add('active');
          // Temporarily set height to auto to fetch height value
          content.style.height = 'auto';
          const height = content.clientHeight;
          content.style.height = 0;

          gsap.to(content, { height: height, opacity: 1, duration: 0.4, ease: 'power2.out' });
        }
      });
    });
  }

  // 11. Swiper.js Testimonials Slider Setup
  function initTestimonialsSlider() {
    if (typeof Swiper !== 'undefined') {
      new Swiper('.testimonials-slider', {
        slidesPerView: 1,
        spaceBetween: 30,
        loop: true,
        autoplay: {
          delay: 6000,
          disableOnInteraction: false,
        },
        pagination: {
          el: '.swiper-pagination',
          clickable: true,
        },
        navigation: {
          nextEl: '.swiper-btn-next',
          prevEl: '.swiper-btn-prev',
        },
        breakpoints: {
          768: {
            slidesPerView: 2,
            spaceBetween: 30,
          },
          1024: {
            slidesPerView: 2,
            spaceBetween: 40,
          }
        }
      });
    }
  }

  // Initialize all sections
  preloadImages(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    initScrollTimeline();
    initInViewAnimations();
    initHoverEffects();
    initMetricCounters();
    initHorizontalScroll();
    initFAQAccordion();
    initTestimonialsSlider();
    initMobileMenu();
    initWhatsAppButton();
    init3DTiltCards();
  });

  // 12. Mobile Navigation Menu Toggle and Behavior
  function initMobileMenu() {
    const toggleBtn = document.querySelector('.mobile-nav-toggle');
    const menuOverlay = document.querySelector('.mobile-menu-overlay');
    const menuLinks = document.querySelectorAll('.mobile-nav-link-item, .mobile-cta-btn');

    if (!toggleBtn || !menuOverlay) return;

    toggleBtn.addEventListener('click', () => {
      const isOpen = menuOverlay.classList.contains('active');
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    function openMenu() {
      toggleBtn.classList.add('active');
      menuOverlay.classList.add('active');
      if (window.lenis) window.lenis.stop();
    }

    function closeMenu() {
      toggleBtn.classList.remove('active');
      menuOverlay.classList.remove('active');
      if (window.lenis) window.lenis.start();
    }

    menuLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        closeMenu();

        if (targetId && targetId.startsWith('#')) {
          e.preventDefault();
          const targetEl = document.querySelector(targetId);
          if (targetEl && window.lenis) {
            setTimeout(() => {
              window.lenis.scrollTo(targetEl);
            }, 300);
          }
        }
      });
    });
  }

  // 13. WhatsApp Button Visibility ScrollTrigger Setup
  function initWhatsAppButton() {
    const whatsappBtn = document.querySelector('.whatsapp-btn');
    const headerCta = document.querySelector('.header-cta');

    ScrollTrigger.create({
      trigger: '#tradicao',
      start: 'top 80%', // triggers when the top of the second fold (#tradicao) is 80% down the viewport
      onEnter: () => {
        if (whatsappBtn) {
          whatsappBtn.classList.add('visible');
          
          // Show tooltip briefly after appearance to prompt action
          setTimeout(() => {
            const tooltip = whatsappBtn.querySelector('.whatsapp-tooltip');
            if (tooltip) {
              tooltip.classList.add('active');
              setTimeout(() => {
                tooltip.classList.remove('active');
              }, 4000);
            }
          }, 1500);
        }

        if (headerCta) {
          headerCta.classList.add('cta-hidden');
        }
      },
      onLeaveBack: () => {
        if (whatsappBtn) {
          whatsappBtn.classList.remove('visible');
        }

        if (headerCta) {
          headerCta.classList.remove('cta-hidden');
        }
      }
    });
  }

  // 14. 3D Tilt & Parallax Card Interactions (Awwwards Style)
  function init3DTiltCards() {
    // Check for touch device or prefers-reduced-motion
    if (window.matchMedia('(hover: none)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const cards = document.querySelectorAll('.service-slide');
    if (!cards.length) return;

    cards.forEach(card => {
      const content = card.querySelector('.service-content');
      const bg = card.querySelector('.service-bg');
      const icon = card.querySelector('.service-icon-wrapper');

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        
        // Relative mouse position within card
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Normalized coordinates relative to card's center (from -0.5 to 0.5)
        const relativeX = (x / rect.width) - 0.5;
        const relativeY = (y / rect.height) - 0.5;
        
        // Calculate rotation angles (max 15 degrees)
        const angleY = relativeX * 15;
        const angleX = -relativeY * 15; // Invert X rotation so card tips towards cursor

        // Buttery-smooth GSAP tilt interpolation
        gsap.to(card, {
          rotateX: angleX,
          rotateY: angleY,
          transformPerspective: 1000,
          ease: 'power2.out',
          duration: 0.5,
          overwrite: 'auto'
        });

        // Layered Parallax translations (translateZ)
        if (content) {
          gsap.to(content, {
            z: 35,
            ease: 'power2.out',
            duration: 0.5,
            overwrite: 'auto'
          });
        }
        if (bg) {
          gsap.to(bg, {
            z: -10,
            scale: 1.12, // slightly upscale so boundaries are clean
            ease: 'power2.out',
            duration: 0.5,
            overwrite: 'auto'
          });
        }
        if (icon) {
          gsap.to(icon, {
            z: 55,
            ease: 'power2.out',
            duration: 0.5,
            overwrite: 'auto'
          });
        }
      });

      card.addEventListener('mouseleave', () => {
        // Return card to center with a smooth spring-like ease
        gsap.to(card, {
          rotateX: 0,
          rotateY: 0,
          ease: 'power3.out',
          duration: 0.8,
          overwrite: 'auto'
        });

        // Reset elements back to flat alignment
        if (content) {
          gsap.to(content, {
            z: 0,
            ease: 'power3.out',
            duration: 0.8,
            overwrite: 'auto'
          });
        }
        if (bg) {
          gsap.to(bg, {
            z: 0,
            scale: 1.0,
            ease: 'power3.out',
            duration: 0.8,
            overwrite: 'auto'
          });
        }
        if (icon) {
          gsap.to(icon, {
            z: 0,
            ease: 'power3.out',
            duration: 0.8,
            overwrite: 'auto'
          });
        }
      });
    });
  }
});
