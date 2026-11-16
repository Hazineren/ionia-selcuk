document.documentElement.classList.add('js');

/*
 * Integration seams for the next semester.
 * API_BASE points at the static sample feed today; swap it for the backend
 * (e.g. '/api/v1/') once one exists. Third-party services are listed in
 * THIRD_PARTY so they can be replaced, proxied or disabled in one place.
 */
const CONFIG = {
  API_BASE: 'data/',
  THIRD_PARTY: {
    weather: {
      enabled: true,
      // Open-Meteo: free, no API key, no cookies. Coordinates: Selçuk town centre.
      url: 'https://api.open-meteo.com/v1/forecast?latitude=37.95&longitude=27.37&current=temperature_2m,wind_speed_10m,weather_code&timezone=Europe%2FIstanbul'
    },
    map: {
      // OpenStreetMap link pattern; a tile-based map can replace it later.
      link: (lat, lon) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`
    }
  }
};

async function getJSON(url, { timeout = 6000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const api = {
  places: () => getJSON(`${CONFIG.API_BASE}places.json`),
  weather: () => getJSON(CONFIG.THIRD_PARTY.weather.url)
};

/* Mobile navigation */
const menuButton = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');

if (menuButton && menu) {
  const setOpen = (open) => {
    menuButton.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
  };
  menuButton.addEventListener('click', () => setOpen(menuButton.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      menuButton.focus();
    }
  });
}

/* Places: render from the data feed, keep the static cards as fallback */
const placeGrid = document.querySelector('[data-place-grid]');
const placeFilter = document.querySelector('[data-place-filter]');
const filterStatus = document.querySelector('[data-filter-status]');
const typeLabels = { ancient: 'Ancient city', faith: 'Faith & pilgrimage', museum: 'Museum', village: 'Village life' };

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function placeCard(item, index) {
  const { image: img, geo, source } = item;
  const number = String(index + 1).padStart(2, '0');
  return `<article class="place-card h-card" id="${escapeHTML(item.id)}" data-type="${escapeHTML(item.type)}">
    <figure><img src="${img.src}-640.webp" srcset="${img.src}-640.webp 640w, ${img.src}-1200.webp 1200w" sizes="(max-width: 680px) 100vw, 50vw" width="${img.width}" height="${img.height}" alt="${escapeHTML(img.alt)}" loading="lazy" decoding="async"><figcaption>${escapeHTML(img.credit)}</figcaption></figure>
    <div class="place-content"><span class="place-kicker">${number} · ${escapeHTML(typeLabels[item.type] || item.type).toUpperCase()}</span><h3 class="p-name">${escapeHTML(item.name)}</h3><p class="p-note">${escapeHTML(item.summary)}</p>
    <p class="place-geo"><span class="p-locality">${escapeHTML(item.area)}</span> · <span class="h-geo p-geo"><span class="p-latitude">${geo.lat}</span>, <span class="p-longitude">${geo.lon}</span></span></p>
    <div class="place-links"><a class="text-link" href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.label)} <span class="sr-only">(opens in a new tab)</span><span aria-hidden="true">↗</span></a><a class="text-link" href="${CONFIG.THIRD_PARTY.map.link(geo.lat, geo.lon)}" target="_blank" rel="noopener noreferrer">Map <span class="sr-only">of ${escapeHTML(item.name)} (opens in a new tab)</span><span aria-hidden="true">↗</span></a></div></div>
  </article>`;
}

function applyFilter() {
  if (!placeGrid) return;
  const value = placeFilter ? placeFilter.value : 'all';
  let visible = 0;
  for (const card of placeGrid.querySelectorAll('[data-type]')) {
    const show = value === 'all' || card.dataset.type === value;
    card.hidden = !show;
    visible += Number(show);
  }
  if (filterStatus) filterStatus.textContent = `Showing ${visible} ${visible === 1 ? 'place' : 'places'}.`;
}

if (placeGrid) {
  placeGrid.setAttribute('aria-busy', 'true');
  api.places()
    .then((data) => {
      placeGrid.innerHTML = data.items.map(placeCard).join('');
      applyFilter();
    })
    .catch(() => {
      if (filterStatus) filterStatus.textContent = 'Showing the places included in this page.';
    })
    .finally(() => placeGrid.removeAttribute('aria-busy'));
}

if (placeFilter) placeFilter.addEventListener('change', applyFilter);

/* Weather: third-party API demo with a silent, accessible fallback */
const weatherBox = document.querySelector('[data-weather]');
const weatherCodes = { 0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 80: 'rain showers', 81: 'rain showers', 82: 'heavy showers', 95: 'thunderstorm' };

if (weatherBox && CONFIG.THIRD_PARTY.weather.enabled) {
  api.weather()
    .then(({ current }) => {
      const sky = weatherCodes[current.weather_code] || 'variable conditions';
      weatherBox.querySelector('[data-weather-value]').textContent = `${Math.round(current.temperature_2m)} °C, ${sky}, wind ${Math.round(current.wind_speed_10m)} km/h`;
      weatherBox.hidden = false;
    })
    .catch(() => { weatherBox.hidden = true; });
}

/* Visit planner */
const interestForm = document.querySelector('[data-interest-form]');
const suggestion = document.querySelector('[data-suggestion]');
const suggestions = {
  history: { title: 'Give Ephesus a full morning.', text: 'Start early at the ancient city, then see its finds at the Ephesus Museum in the town centre in the afternoon.' },
  faith: { title: 'Walk up Ayasuluk Hill.', text: 'The Basilica of St John, the İsa Bey Mosque and the Artemision lie within a short walk of one another in Selçuk.' },
  village: { title: 'Spend an evening in Şirince.', text: 'Take the short road into the hills, stay for dinner and choose a family-run guesthouse rather than a day trip.' },
  food: { title: 'Follow the olive and the vine.', text: 'Taste local olive oil and fruit wines in Şirince, and ask producers how the harvest shapes their year.' }
};

if (interestForm && suggestion) {
  interestForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const chosen = new FormData(interestForm).getAll('interest');
    const title = suggestion.querySelector('h3');
    const body = suggestion.querySelector('p:last-child');
    if (!chosen.length) {
      title.textContent = 'Choose a thread to follow.';
      body.textContent = 'Select at least one interest to get a starting idea.';
      return;
    }
    const ideas = chosen.map((key) => suggestions[key]).filter(Boolean);
    title.textContent = ideas[0].title;
    body.textContent = ideas.map((idea) => idea.text).join(' ');
  });
}
