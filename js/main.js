(() => {
  'use strict';
  const rules = {
    math: { title: 'Считай & Собирай', text: ['Собирай одинаковые элементы в линии по три и больше.', 'За успешные комбинации получай задания. Правильные ответы открывают магические бонусы.'] },
    russian: { title: 'ОрфоБластер', text: ['Читай задание и выбирай правильный ответ.', 'Попади в нужную мишень и сохрани все жизни. Серия правильных ответов увеличивает количество очков.'] },
    world: { title: 'Большая экспедиция', text: ['Путешествуй по волшебной карте.', 'Открывай станции экспедиции и выполняй задания. Собери все артефакты знаний и доберись до финала.'] }
  };
  const modal = document.querySelector('.rules-modal');
  const modalTitle = modal.querySelector('#modal-title');
  const modalCopy = modal.querySelector('.modal-copy');
  const soundButton = document.querySelector('.sound-toggle');
  let lastTrigger = null;
  let soundOn = localStorage.getItem('magic-library-sound') !== 'off';

  function renderSoundState() {
    soundButton.querySelector('span').textContent = soundOn ? '🔊' : '🔇';
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.setAttribute('aria-label', soundOn ? 'Выключить звуки' : 'Включить звуки');
  }
  function playChime(frequency = 520) {
    if (!soundOn) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, context.currentTime + .12);
      gain.gain.setValueAtTime(.045, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .28);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .3);
      oscillator.addEventListener('ended', () => context.close());
    } catch (_) { /* Audio is an optional enhancement. */ }
  }
  function openRules(game, trigger) {
    const content = rules[game]; if (!content) return;
    lastTrigger = trigger; modalTitle.textContent = content.title;
    modalCopy.replaceChildren(...content.text.map(text => { const p = document.createElement('p'); p.textContent = text; return p; }));
    document.body.classList.add('modal-open'); modal.showModal(); playChime(480);
  }
  function closeRules() { if (!modal.open) return; modal.close(); document.body.classList.remove('modal-open'); lastTrigger?.focus(); }

  document.querySelectorAll('.rules-button').forEach(button => button.addEventListener('click', () => openRules(button.dataset.game, button)));
  modal.querySelector('.modal-close').addEventListener('click', closeRules);
  modal.querySelector('.modal-done').addEventListener('click', closeRules);
  modal.addEventListener('click', event => { if (event.target === modal) closeRules(); });
  modal.addEventListener('cancel', event => { event.preventDefault(); closeRules(); });
  soundButton.addEventListener('click', () => { soundOn = !soundOn; localStorage.setItem('magic-library-sound', soundOn ? 'on' : 'off'); renderSoundState(); playChime(650); });
  document.querySelectorAll('.button--primary').forEach(button => button.addEventListener('pointerdown', () => playChime(620)));
  renderSoundState();

  function initPortalTransition() {
    const overlay = document.querySelector('.portal-transition');
    const portal = overlay?.querySelector('.transition-portal');
    const particleLayer = overlay?.querySelector('.transition-particles');
    const title = overlay?.querySelector('.transition-message strong');
    const subtitle = overlay?.querySelector('.transition-message small');
    const links = [...document.querySelectorAll('.game-card .button--primary[data-game]')];
    if (!overlay || !portal || !particleLayer || !title || !subtitle || !links.length) return;

    const themes = {
      math: {
        title: 'Портал чисел открыт!', subtitle: 'Собери кристаллы знаний',
        particles: ['2', '+', '7', '×', '÷', '◆', '✦', '−']
      },
      russian: {
        title: 'Тайны слов оживают!', subtitle: 'Волшебная академия ждёт тебя',
        particles: ['А', 'Б', 'Я', 'Ж', '▱', '❧', '✦', 'Ь']
      },
      world: {
        title: 'Экспедиция начинается!', subtitle: 'В путь, юный исследователь!',
        particles: ['❧', '✥', '✦', '⌁', '◆', '✧', '❦', '·']
      }
    };
    let transitionRunning = false;
    let soundChecked = false;
    let portalAudio = null;

    async function playPortalSound() {
      if (!soundOn) return;
      if (portalAudio) {
        portalAudio.currentTime = 0;
        await portalAudio.play().catch(() => {});
        return;
      }
      if (soundChecked) return;
      soundChecked = true;
      try {
        const response = await fetch('assets/audio/portal.mp3', { method: 'HEAD', cache: 'force-cache' });
        if (!response.ok) return;
        portalAudio = new Audio('assets/audio/portal.mp3');
        portalAudio.volume = .48;
        await portalAudio.play().catch(() => {});
      } catch (_) { /* The optional transition sound is not available yet. */ }
    }

    function buildParticles(theme, compact) {
      particleLayer.replaceChildren();
      const total = compact ? 9 : 20;
      for (let index = 0; index < total; index += 1) {
        const particle = document.createElement('span');
        const angle = (Math.PI * 2 * index) / total + Math.random() * .4;
        const distance = 105 + Math.random() * (compact ? 85 : 185);
        particle.textContent = theme.particles[index % theme.particles.length];
        particle.style.setProperty('--particle-angle', `${angle}rad`);
        particle.style.setProperty('--particle-distance', `${distance}px`);
        particle.style.setProperty('--particle-delay', `${Math.random() * .28}s`);
        particleLayer.append(particle);
      }
    }

    function beginTransition(event) {
      if (transitionRunning) { event.preventDefault(); return; }
      if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.currentTarget;
      const themeName = link.dataset.game;
      const theme = themes[themeName];
      if (!theme) return;
      event.preventDefault();
      transitionRunning = true;

      const card = link.closest('.game-card');
      const rect = card.getBoundingClientRect();
      const compact = matchMedia('(max-width: 768px)').matches;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = reduced ? 420 : compact ? 1250 : 1650;
      const destination = link.dataset.href || link.href;

      title.textContent = theme.title;
      subtitle.textContent = theme.subtitle;
      overlay.dataset.theme = themeName;
      overlay.style.setProperty('--portal-origin-x', `${rect.left + rect.width / 2}px`);
      overlay.style.setProperty('--portal-origin-y', `${rect.top + rect.height * .42}px`);
      buildParticles(theme, compact || reduced);
      document.body.classList.add('portal-transition-active');
      card.classList.add('is-opening-portal');
      links.forEach(item => item.setAttribute('aria-disabled', 'true'));
      void overlay.offsetWidth;
      overlay.classList.add('is-active');
      playPortalSound();

      window.setTimeout(() => { window.location.href = destination; }, duration);
    }

    links.forEach(link => link.addEventListener('click', beginTransition));
  }

  initPortalTransition();

  function initMagicPointer() {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!finePointer.matches || reducedMotion.matches || window.innerWidth <= 768) return;

    const cursor = document.querySelector('.magic-cursor');
    const cards = [...document.querySelectorAll('.game-card')];
    const interactiveSelector = '.game-card, .button, .nav-link, .sound-toggle, .brand';
    const buttonSelector = '.button, .sound-toggle';
    const pointer = { x: innerWidth / 2, y: innerHeight / 2, renderX: innerWidth / 2, renderY: innerHeight / 2 };
    let pointerVisible = false;
    let frameRequested = false;
    let lastTrailAt = 0;
    let lastAttractAt = 0;
    let activeParticles = 0;
    const particleLimit = 24;

    document.documentElement.classList.add('magic-pointer-enabled');

    function createParticle(className, x, y, options = {}) {
      if (activeParticles >= particleLimit) return;
      const particle = document.createElement('i');
      particle.className = `magic-particle ${className}`;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.setProperty('--dx', `${options.dx || 0}px`);
      particle.style.setProperty('--dy', `${options.dy || 0}px`);
      particle.style.setProperty('--particle-color', options.color || '#ffe79a');
      particle.style.setProperty('--duration', `${options.duration || 480}ms`);
      document.body.append(particle);
      activeParticles += 1;
      particle.addEventListener('animationend', () => {
        particle.remove();
        activeParticles -= 1;
      }, { once: true });
    }

    function spawnTrail(time) {
      if (!pointerVisible || time - lastTrailAt < 58 || activeParticles > 7) return;
      lastTrailAt = time;
      const colors = ['#fff8d2', '#ffd873', '#73ecff', '#c99cff'];
      createParticle('magic-particle--trail', pointer.x + (Math.random() - .5) * 7, pointer.y + (Math.random() - .5) * 7, {
        dx: (Math.random() - .5) * 15,
        dy: 9 + Math.random() * 13,
        duration: 360 + Math.random() * 180,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    function updateCards(time) {
      let nearest = null;
      let nearestDistance = Infinity;
      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const edgeX = Math.max(rect.left, Math.min(pointer.x, rect.right));
        const edgeY = Math.max(rect.top, Math.min(pointer.y, rect.bottom));
        const distance = Math.hypot(pointer.x - edgeX, pointer.y - edgeY);
        const strength = Math.max(0, 1 - distance / 165);
        card.style.setProperty('--portal-proximity', strength.toFixed(3));
        card.classList.toggle('portal-near', strength > 0);

        const inside = pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
        if (inside) {
          const localX = (pointer.x - rect.left) / rect.width;
          const localY = (pointer.y - rect.top) / rect.height;
          card.style.setProperty('--portal-x', `${((localX - .5) * 8).toFixed(2)}px`);
          card.style.setProperty('--portal-y', `${((localY - .5) * 6).toFixed(2)}px`);
          card.style.setProperty('--light-x', `${(localX * 100).toFixed(1)}%`);
          card.style.setProperty('--light-y', `${(localY * 100).toFixed(1)}%`);
        } else {
          card.style.setProperty('--portal-x', '0px');
          card.style.setProperty('--portal-y', '0px');
        }
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = { card, edgeX, edgeY, strength };
        }
      });

      if (nearest && nearest.strength > .08 && time - lastAttractAt > 125 && activeParticles < particleLimit - 3) {
        lastAttractAt = time;
        const startRatio = .25 + Math.random() * .35;
        const startX = pointer.x + (nearest.edgeX - pointer.x) * startRatio;
        const startY = pointer.y + (nearest.edgeY - pointer.y) * startRatio;
        createParticle('magic-particle--attracted', startX, startY, {
          dx: nearest.edgeX - startX,
          dy: nearest.edgeY - startY,
          duration: 390 + Math.random() * 130,
          color: getComputedStyle(nearest.card).getPropertyValue('--portal-primary').trim()
        });
      }
    }

    function render(time) {
      frameRequested = false;
      pointer.renderX += (pointer.x - pointer.renderX) * .42;
      pointer.renderY += (pointer.y - pointer.renderY) * .42;
      cursor.style.transform = `translate3d(${pointer.renderX}px, ${pointer.renderY}px, 0)`;
      spawnTrail(time);
      updateCards(time);
      if (pointerVisible && (Math.abs(pointer.x - pointer.renderX) > .15 || Math.abs(pointer.y - pointer.renderY) > .15)) requestFrame();
    }

    function requestFrame() {
      if (frameRequested) return;
      frameRequested = true;
      requestAnimationFrame(render);
    }

    document.addEventListener('pointermove', event => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointerVisible = true;
      cursor.classList.add('is-visible');
      const target = event.target.closest?.(interactiveSelector);
      cursor.classList.toggle('is-interactive', Boolean(target));
      cursor.classList.toggle('is-button', Boolean(event.target.closest?.(buttonSelector)));
      requestFrame();
    }, { passive: true });

    document.addEventListener('pointerleave', () => {
      pointerVisible = false;
      cursor.classList.remove('is-visible', 'is-interactive', 'is-button');
      cards.forEach(card => {
        card.classList.remove('portal-near');
        card.style.setProperty('--portal-proximity', '0');
      });
    });

    cards.forEach(card => card.addEventListener('pointerleave', () => {
      card.style.setProperty('--portal-x', '0px');
      card.style.setProperty('--portal-y', '0px');
      card.style.setProperty('--light-x', '50%');
      card.style.setProperty('--light-y', '50%');
    }));

    document.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      cursor.classList.remove('is-clicking');
      void cursor.offsetWidth;
      cursor.classList.add('is-clicking');
      const card = event.target.closest?.('.game-card');
      const colors = card
        ? ['#fff9d5', '#ffd86e', getComputedStyle(card).getPropertyValue('--portal-primary').trim()]
        : ['#fff9d5', '#ffd86e', '#7deeff'];
      for (let index = 0; index < 7; index += 1) {
        const angle = (Math.PI * 2 * index) / 7 + Math.random() * .18;
        const distance = 20 + Math.random() * 18;
        createParticle('magic-particle--burst', event.clientX, event.clientY, {
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          duration: 390 + Math.random() * 100,
          color: colors[index % colors.length]
        });
      }
    });
  }

  initMagicPointer();
})();
