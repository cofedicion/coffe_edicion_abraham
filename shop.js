import { validMessage, validName } from './form-fields.js';

(function () {
  // Configuration constants
  const WHATSAPP_NUMBER = "593967777185";
  const REVIEWS_EMAIL = "cofedicion@gmail.com";
  const stock = window.stock;

  // Treat form values as text, and tolerate unavailable browser storage.
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const readSaved = key => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
  const saveLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const field = (id) => document.getElementById(id);
  const valueOf = (id) => field(id).value.trim();

  function showFormError(form, message) {
    const notice = field(`${form.id}Error`);
    notice.textContent = message;
    notice.hidden = !message;
  }
  const menuButton = document.querySelector('button[aria-label="Abrir menú móvil"]');
  const mobileNav = document.getElementById('mobileNav');
  menuButton.setAttribute('aria-controls', 'mobileNav');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('hidden') === false;
    menuButton.setAttribute('aria-expanded', String(open));
  });
  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobileNav.classList.add('hidden'); menuButton.setAttribute('aria-expanded', 'false');
  }));

  // 1. Subtle Web Audio API sound feedback
  let audioEnabled = false;
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playChime(type = 'click') {
    if (!audioEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === 'add') {
        // Dual tone ascending chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'order') {
        // Celebratory triad chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } else {
        // Gentle tactile wood click
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.05);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
      }
    } catch (e) {
      // Fail gracefully if web audio is unavailable
    }
  }

  // Hook sound button from global header if available
  const soundBtn = document.querySelector('button[aria-label="Alternar efectos de sonido"]');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      audioEnabled = !audioEnabled;
      const textSpan = soundBtn.querySelector('span:nth-child(2)');
      const dotSpan = soundBtn.querySelector('span:last-child');
      if (textSpan) textSpan.textContent = audioEnabled ? 'Sonido On' : 'Sonido Off';
      if (dotSpan) {
        dotSpan.className = audioEnabled ? 'w-1.5 h-1.5 rounded-full bg-secondary' : 'w-1.5 h-1.5 rounded-full bg-surface-variant';
      }
      if (audioEnabled) {
        initAudio();
        playChime('add');
      }
    });
  }

  // 2. Shopping Cart Store & Management
  class CartManager {
    constructor() {
      const saved = readSaved('filterCoffeeCart');
      this.items = [];
      if (Array.isArray(saved)) saved.forEach(entry => {
        if (typeof entry?.id !== 'string') return;
        const savedId = entry.id === 'filtro-5' + 'cm' ? 'filtro-artesanal' : entry.id;
        const card = [...document.querySelectorAll('[data-product-id]')].find(c => c.dataset.productId === savedId);
        if (card && Number.isInteger(entry.quantity) && entry.quantity > 0) {
          const price = Number.parseFloat(card.dataset.productPrice);
          const existing = this.items.find(item => item.id === savedId);
          if (existing) existing.quantity = Math.min(10, existing.quantity + entry.quantity);
          else this.items.push({id:card.dataset.productId, name:card.dataset.productName, price:Number.isFinite(price) ? price : null, quantity:Math.min(10, entry.quantity), type:card.dataset.productType});
        }
      });
      this.initListeners();
      document.addEventListener('stockchange', () => this.updateUI(false));
      this.updateUI();
    }

    initListeners() {
      // Connect all quantity steppers in products & coffee
      document.querySelectorAll('[data-product-id]').forEach(card => {
        const decBtn = card.querySelector('.stepper-dec');
        const incBtn = card.querySelector('.stepper-inc');
        const valSpan = card.querySelector('.stepper-val');
        const addBtn = card.querySelector('.btn-add-cart');

        let qty = 1;

        if (decBtn && incBtn && valSpan) {
          decBtn.addEventListener('click', () => {
            if (qty > 1) {
              qty--;
              valSpan.textContent = qty;
              playChime('click');
            }
          });

          incBtn.addEventListener('click', () => {
            if (qty < 10) {
              qty++;
              valSpan.textContent = qty;
              playChime('click');
            }
          });
        }

        if (addBtn) {
          addBtn.addEventListener('click', async () => {
            const id = card.dataset.productId;
            if (!(await stock.refresh()) || stock.isSoldOut(id)) return;
            const name = card.dataset.productName;
            const parsedPrice = parseFloat(card.dataset.productPrice);
            const price = Number.isFinite(parsedPrice) ? parsedPrice : null;
            const type = card.dataset.productType || 'Producto';
            this.addItem(id, name, price, qty, type);
            playChime('add');

            stock.showAdded(id);
          });
        }
      });

      // Connect header cart button
      const headerCartBtn = document.querySelector('button[aria-label="Ver carrito de compras"]');
      if (headerCartBtn) {
        headerCartBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.toggleCart(true);
        });
      }
    }

    addItem(id, name, price, quantity = 1, type = '') {
      const existing = this.items.find(item => item.id === id);
      if (existing) {
        existing.quantity += quantity;
        if (existing.quantity > 10) existing.quantity = 10;
      } else {
        this.items.push({ id, name, price, quantity, type });
      }
      this.updateUI();
    }

    removeItem(id) {
      this.items = this.items.filter(item => item.id !== id);
      playChime('click');
      this.updateUI();
    }

    changeItemQty(id, delta) {
      if (delta > 0 && stock.isSoldOut(id)) return;
      const item = this.items.find(item => item.id === id);
      if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
          this.removeItem(id);
          return;
        }
        if (item.quantity > 10) item.quantity = 10;
        playChime('click');
        this.updateUI();
      }
    }

    getTotal() {
      return this.items.reduce((acc, curr) => acc + ((curr.price ?? 0) * curr.quantity), 0);
    }

    getTotalUnits() {
      return this.items.reduce((acc, curr) => acc + curr.quantity, 0);
    }

    hasSoldOutItems() {
      return this.items.some(item => stock.isSoldOut(item.id));
    }

    updateUI(persist = true) {
      const count = this.getTotalUnits();
      const total = this.getTotal();
      if (persist) saveLocal('filterCoffeeCart', this.items.map(({id,quantity}) => ({id,quantity})));
      const totalText = `$${total.toFixed(2)}`;

      // Header cart counter & total
      const headerCartBtn = document.querySelector('button[aria-label="Ver carrito de compras"]');
      if (headerCartBtn) {
        const badge = document.getElementById('headerCartCount');
        if (badge) badge.textContent = count;
        const priceText = document.getElementById('headerCartTotal');
        if (priceText) {
          priceText.textContent = totalText;
          priceText.title = 'Total de café y filtros, sin envío';
        }
        headerCartBtn.setAttribute('title', `${count} unidades en el carrito`);
      }

      // Drawer Summary
      const countSummary = document.getElementById('cartCountSummary');
      const totalSummary = document.getElementById('cartTotalSummary');
      if (countSummary) countSummary.textContent = count;
      if (totalSummary) totalSummary.textContent = totalText;

      // Customer Modal Summary
      const custTotalUnits = document.getElementById('custTotalUnits');
      const custOrderTotal = document.getElementById('custOrderTotal');
      if (custTotalUnits) custTotalUnits.textContent = count;
      if (custOrderTotal) custOrderTotal.textContent = totalText;

      // Checkout button state
      const checkoutBtn = document.getElementById('btnContinueCheckout');
      const hasSoldOut = this.hasSoldOutItems();
      const stockNotice = document.getElementById('cartStockNotice');
      stockNotice.textContent = hasSoldOut
        ? 'Retira los productos agotados para continuar.'
        : 'No se pudo verificar el stock. Recarga la página e inténtalo de nuevo.';
      stockNotice.hidden = this.items.length === 0 || (!hasSoldOut && stock.isLoaded());
      checkoutBtn.disabled = this.items.length === 0 || hasSoldOut || !stock.isLoaded();

      // Render Drawer Items List
      const listContainer = document.getElementById('cartItemsList');
      if (listContainer) {
        if (this.items.length === 0) {
          listContainer.innerHTML = `
            <div class="h-64 flex flex-col items-center justify-center text-center p-space-md text-on-surface-variant">
              <span class="material-symbols-outlined text-[44px] text-surface-variant mb-2">shopping_bag</span>
              <p class="font-headline-sm text-headline-sm text-on-surface mb-1">Tu pedido está vacío</p>
              <p class="font-body-sm text-body-sm">Selecciona tus filtros de pasar o tu presentación de café favorita.</p>
            </div>
          `;
        } else {
          listContainer.innerHTML = this.items.map(item => `
            <div class="flex items-center justify-between p-space-sm bg-surface-container-low rounded-xl gap-space-sm">
              <div class="flex flex-col flex-1 min-w-0">
                <span class="font-title-md text-title-md font-semibold text-on-surface truncate">${escapeHTML(item.name)}</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant">${item.price === null ? 'Café: cotización por WhatsApp' : '$' + item.price.toFixed(2) + ' c/u'}</span>
                ${stock.isSoldOut(item.id) ? '<span class="font-body-sm text-body-sm text-error">Agotado</span>' : ''}
              </div>

              <div class="flex items-center gap-2">
                <button type="button" data-cart-action="decrease" data-product="${item.id}" aria-label="Disminuir cantidad" class="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface text-sm">
                  <span class="material-symbols-outlined text-[14px]" aria-hidden="true">remove</span>
                </button>
                <span class="font-title-md text-title-md font-bold text-on-surface min-w-[16px] text-center">${item.quantity}</span>
                <button type="button" data-cart-action="increase" data-product="${item.id}" aria-label="Aumentar cantidad" ${stock.isSoldOut(item.id) ? 'disabled' : ''} class="disabled:opacity-40 w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface text-sm">
                  <span class="material-symbols-outlined text-[14px]" aria-hidden="true">add</span>
                </button>
              </div>

              <div class="flex items-center gap-2">
                <span class="font-title-md text-title-md font-bold text-secondary min-w-[50px] text-right">
                  ${item.price === null ? 'Cotización' : '$' + (item.price * item.quantity).toFixed(2)}
                </span>
                <button type="button" data-cart-action="remove" data-product="${item.id}" class="p-1 rounded text-on-surface-variant hover:text-error transition-colors" aria-label="Eliminar producto">
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                </button>
              </div>
            </div>
          `).join('');
        }
      }
    }

    toggleCart(show) {
      const drawer = document.getElementById('cartDrawer');
      const backdrop = document.getElementById('cartDrawerBackdrop');
      if (drawer && backdrop) {
        drawer.inert = !show;
        if (show) {
          backdrop.classList.remove('hidden');
          drawer.classList.remove('translate-x-full');
          playChime('click');
        } else {
          drawer.classList.add('translate-x-full');
          backdrop.classList.add('hidden');
        }
      }
    }

    async openCustomerModal() {
      if (!(await stock.refresh()) || this.items.length === 0 || this.hasSoldOutItems()) {
        this.toggleCart(true);
        return;
      }

      this.toggleCart(false);
      const modal = document.getElementById('customerModal');
      if (modal) {
        modal.classList.remove('hidden');
        field('custNombre').focus();
        playChime('click');
      }
    }

    closeCustomerModal() {
      const modal = document.getElementById('customerModal');
      if (modal) {
        modal.classList.add('hidden');
      }
    }

    openSpecsModal(title, price) {
      const modal = document.getElementById('productSpecsModal');
      const titleEl = document.getElementById('modalProductTitle');
      if (modal && titleEl) {
        titleEl.textContent = `${title} • ${price}`;
        modal.classList.remove('hidden');
        playChime('click');
      }
    }

    closeSpecsModal() {
      const modal = document.getElementById('productSpecsModal');
      if (modal) {
        modal.classList.add('hidden');
      }
    }

    async confirmWhatsAppOrder(e) {
      e.preventDefault();
      const form = e.currentTarget;
      showFormError(form, '');
      const nombre = valueOf('custNombre');
      const apellido = valueOf('custApellido');
      const email = valueOf('custEmail');
      const observaciones = valueOf('custObservaciones');
      const website = valueOf('websiteOrder');

      if (!form.reportValidity()) return;
      if (website || !validName(nombre) || !validName(apellido) || !validMessage(observaciones)) {
        showFormError(form, 'Revisa el nombre, el apellido y las observaciones.');
        return;
      }

      if (this.items.length === 0) {
        showFormError(form, 'Agrega al menos un producto disponible al carrito.');
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton.disabled) return;
      submitButton.disabled = true;
      const whatsappTab = window.open('about:blank', '_blank');
      if (whatsappTab) whatsappTab.opener = null;
      try {
        if (location.origin === 'https://coffe-edicion-abraham.vercel.app') {
          const items = this.items.map(({ id, quantity }) => ({ id, quantity }));
          const verified = await fetch('/api/order-check', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, website }),
          });
          if (!verified.ok) {
            if (verified.status === 409) void stock.refresh();
            const data = await verified.json().catch(() => ({}));
            throw new Error(data.error || 'No pudimos verificar tu pedido. Intenta de nuevo.');
          }
        } else if (!(await stock.refresh()) || this.hasSoldOutItems()) {
          throw new Error('Hay productos agotados o no se pudo consultar su disponibilidad.');
        }

        this.openWhatsApp({ nombre, apellido, email, observaciones }, whatsappTab);
      } catch (error) {
        whatsappTab?.close();
        showFormError(form, error instanceof TypeError ? 'No pudimos verificar el pedido. Intenta de nuevo.' : error.message);
      } finally {
        submitButton.disabled = false;
      }
    }

    openWhatsApp({ nombre, apellido, email, observaciones }, whatsappTab) {
      const productosTexto = this.items
        .map(item => `• ${item.name} (Cant: ${item.quantity}) - ${item.price === null ? 'Cotización' : '$' + (item.price * item.quantity).toFixed(2)}`)
        .join('\n');

      const totalUnidades = this.getTotalUnits();
      const totalValor = this.getTotal().toFixed(2);

      const message = 
`Hola, Filter Coffee. Quiero realizar el siguiente pedido:
Nombre: ${nombre}
Apellido: ${apellido}
Producto:
${productosTexto}
Cantidad: ${totalUnidades} unidades
Total de productos: $${totalValor}
Solicito información del costo de envío.
Correo: ${email || 'No especificado'}
Observaciones: ${observaciones || 'Ninguna'}
Gracias.`;

      playChime('order');

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

      this.closeCustomerModal();
      if (whatsappTab) whatsappTab.location.replace(whatsappUrl);
      else window.location.assign(whatsappUrl);
    }
  }

  // 3. Reviews System Management (with email integration)
  class ReviewManager {
    constructor() {
      this.initStarListeners();
      const saved = readSaved('filterCoffeeReviews');
      this.reviews = Array.isArray(saved) ? saved.filter(r => r && typeof r.nombre === 'string' && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5).slice(-30) : [];
      this.reviews.forEach(r => this.renderReview(r));
      this.paintStars(5);
    }

    initStarListeners() {
      const container = document.getElementById('starRatingContainer');
      const input = document.getElementById('revRatingInput');
      if (!container || !input) return;

      const stars = container.querySelectorAll('.star-btn');
      stars.forEach(btn => {
        btn.addEventListener('click', () => {
          const val = parseInt(btn.dataset.star, 10);
          input.value = val;
          this.paintStars(val);
          playChime('click');
        });
      });
    }

    paintStars(val) {
      const container = document.getElementById('starRatingContainer');
      if (!container) return;
      const stars = container.querySelectorAll('.star-btn');
      stars.forEach(btn => {
        const sVal = parseInt(btn.dataset.star, 10);
        btn.setAttribute('aria-pressed', String(sVal === val));
        const icon = btn.querySelector('.material-symbols-outlined');
        if (sVal <= val) {
          btn.className = 'star-btn text-secondary focus:outline-none transition-transform hover:scale-110';
          if (icon) icon.style.fontVariationSettings = "'FILL' 1";
        } else {
          btn.className = 'star-btn text-surface-variant hover:text-secondary focus:outline-none transition-transform hover:scale-110';
          if (icon) icon.style.fontVariationSettings = "'FILL' 0";
        }
      });
    }

    renderReview({nombre, rating, cafeOpin, degustacion, atencion}) {
      const reviewsContainer = document.getElementById('reviewsContainer');
      if (reviewsContainer) {
        const initials = nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'FC';
        const starIcons = Array.from({ length: rating }).map(() => `
          <span class="material-symbols-outlined text-[18px]" style="font-variation-settings: 'FILL' 1;">star</span>
        `).join('');

        const reviewCard = document.createElement('div');
        reviewCard.className = 'bg-surface p-space-lg rounded-2xl shadow-sm border-l-4 border-secondary transition-all';
        reviewCard.innerHTML = `
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-title-md">
                ${escapeHTML(initials)}
              </div>
              <div>
                <h4 class="font-title-md text-title-md text-on-surface font-semibold leading-tight">${escapeHTML(nombre)}</h4>
                <span class="font-body-sm text-body-sm text-secondary font-medium">Reseña local • Sin verificar</span>
              </div>
            </div>
            <div class="flex text-secondary">
              ${starIcons}
            </div>
          </div>
          <p class="font-body-md text-body-md text-on-surface mb-2">
            "${escapeHTML(degustacion !== 'No especificada' ? degustacion : (cafeOpin !== 'No especificada' ? cafeOpin : 'Excelente experiencia y sabor de café inigualable con filtro tradicional.'))}"
          </p>
          <div class="flex flex-wrap gap-2 text-on-surface-variant font-body-sm text-body-sm pt-2">
            ${atencion !== 'No especificada' ? `<span class="px-2 py-0.5 rounded bg-surface-container-low">Atención: ${escapeHTML(atencion)}</span>` : ''}
            ${cafeOpin !== 'No especificada' ? `<span class="px-2 py-0.5 rounded bg-surface-container-low">Café: ${escapeHTML(cafeOpin)}</span>` : ''}
          </div>
        `;

        reviewsContainer.insertBefore(reviewCard, reviewsContainer.children[1]);
      }

    }

    submitReview(e) {
      e.preventDefault();
      const form = e.currentTarget;
      showFormError(form, '');
      const nombre = valueOf('revNombre');
      const rating = Number(valueOf('revRatingInput'));
      const fields = [valueOf('revCafe'), valueOf('revDegustacion'), valueOf('revAtencion')];
      if (!form.reportValidity()) return;
      if (valueOf('websiteReview') || !validName(nombre, 90) || !Number.isInteger(rating) || rating < 1 || rating > 5 ||
          !fields.some(Boolean) || !fields.every((item) => validMessage(item))) {
        showFormError(form, 'Escribe tu nombre, selecciona una calificación y añade al menos un comentario.');
        return;
      }
      if (Date.now() - (this.lastReviewAt ?? 0) < 5000) {
        showFormError(form, 'Espera unos segundos antes de guardar otra reseña.');
        return;
      }
      this.lastReviewAt = Date.now();
      const [cafeOpin, degustacion, atencion] = fields.map((item) => item || 'No especificada');

      const review = {nombre, rating, cafeOpin, degustacion, atencion};
      this.renderReview(review);
      this.reviews.push(review);
      this.reviews = this.reviews.slice(-30);
      saveLocal('filterCoffeeReviews', this.reviews);

      // Build email dispatch link
      const emailSubject = encodeURIComponent(`Nueva Reseña Filter Coffee - ${nombre} (${rating}/5 estrellas)`);
      const emailBody = encodeURIComponent(
`Nueva reseña recibida en Filter Coffee:

• Nombre y Apellido: ${nombre}
• Calificación: ${rating} / 5 estrellas
• Opinión sobre el café: ${cafeOpin}
• Opinión sobre degustación y filtro: ${degustacion}
• Opinión sobre la atención: ${atencion}

Fecha: ${new Date().toLocaleString()}`
      );

      // Open mail client
      const mailtoUrl = `mailto:${REVIEWS_EMAIL}?subject=${emailSubject}&body=${emailBody}`;
      const mailLink = document.createElement('a');
      mailLink.href = mailtoUrl;
      mailLink.style.display = 'none';
      document.body.appendChild(mailLink);
      mailLink.click();
      setTimeout(() => document.body.removeChild(mailLink), 1000);

      playChime('order');

      // Reset form & show notification
      document.getElementById('reviewForm').reset();
      this.paintStars(5);
      const banner = document.getElementById('reviewSuccessBanner');
      if (banner) {
        banner.classList.remove('hidden');
        setTimeout(() => banner.classList.add('hidden'), 7000);
      }
    }
  }

  const cart = new CartManager();
  const reviews = new ReviewManager();
  field('orderCustomerForm').addEventListener('submit', (event) => cart.confirmWhatsAppOrder(event));
  field('reviewForm').addEventListener('submit', (event) => reviews.submitReview(event));

  document.addEventListener('click', (event) => {
    const control = event.target.closest('[data-cart-action]');
    if (!control) return;
    const id = control.dataset.product;
    switch (control.dataset.cartAction) {
      case 'open-cart': cart.toggleCart(true); break;
      case 'close-cart': cart.toggleCart(false); break;
      case 'openCustomerModal': void cart.openCustomerModal(); break;
      case 'closeCustomerModal': cart.closeCustomerModal(); break;
      case 'specs': cart.openSpecsModal('Filtro', '$1.50'); break;
      case 'closeSpecsModal': cart.closeSpecsModal(); break;
      case 'decrease': cart.changeItemQty(id, -1); break;
      case 'increase': cart.changeItemQty(id, 1); break;
      case 'remove': cart.removeItem(id); break;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    cart.closeCustomerModal();
    cart.closeSpecsModal();
    cart.toggleCart(false);
    mobileNav.classList.add('hidden');
    menuButton.setAttribute('aria-expanded', 'false');
  });
})();
