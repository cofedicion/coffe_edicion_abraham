(() => {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;

  const preferenceKey = 'filterCoffeePrivacyChoiceV1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  let choice;
  let started = false;
  let previouslyFocused;

  function startAnalytics() {
    if (started || location.origin !== 'https://coffe-edicion-abraham.vercel.app') return;
    started = true;
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    window.va('beforeSend', (event) => {
      if (choice !== 'accept') return null;
      const url = new URL(event.url, location.origin);
      url.search = '';
      url.hash = '';
      return { ...event, url: url.href };
    });

    const script = document.createElement('script');
    script.src = '/_vercel/insights/script.js';
    script.defer = true;
    document.head.append(script);
  }

  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey));
    if (['accept', 'reject'].includes(saved?.choice) && saved.expiresAt > Date.now()) choice = saved.choice;
  } catch { /* Use the default with no analytics. */ }

  banner.hidden = Boolean(choice);
  if (choice === 'accept') startAnalytics();

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-cookie-settings')) {
      previouslyFocused = button;
      banner.hidden = false;
      banner.querySelector('button')?.focus();
    } else if (button.dataset.cookieChoice && banner.contains(button)) {
      choice = button.dataset.cookieChoice;
      try { localStorage.setItem(preferenceKey, JSON.stringify({ choice, expiresAt: Date.now() + lifetime })); } catch { /* Keep this page's choice. */ }
      if (choice === 'accept') startAnalytics();
      banner.hidden = true;
      previouslyFocused?.focus();
    }
  });
})();
