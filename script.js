// Public, browser-safe Supabase project URL + publishable key (safe to expose client-side).
const SUPABASE_URL = 'https://ejpvsmlcuebkuaicvamy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_O7gu4FO4QtmoVdmhADKZWA_9zQ-wSth';
const RIDES_TABLE = 'MTBrideData';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const view = document.getElementById('view');

const COMMIT_STORAGE_KEY = 'mtbt_committed_rides';

let ridesCache = null;

function getCommitted() {
  try {
    return JSON.parse(localStorage.getItem(COMMIT_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function setCommitted(map) {
  try {
    localStorage.setItem(COMMIT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore storage failures (private browsing, etc.) */
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

async function fetchRides() {
  if (ridesCache) return ridesCache;
  const { data, error } = await supabaseClient
    .from(RIDES_TABLE)
    .select('*')
    .order('date', { ascending: true });
  if (error) throw error;
  ridesCache = data ?? [];
  return ridesCache;
}

function dateBoxHtml(ride) {
  return `
    <div class="date-box">
      <div class="date-box-month">${escapeHtml(ride.month)}</div>
      <div class="date-box-day">${escapeHtml(ride.date)}</div>
      <div class="date-box-weekday">${escapeHtml(ride.dayOfWeek)}</div>
      <div class="date-box-rule"></div>
      <div class="date-box-time">${escapeHtml(ride.time)}</div>
      <div class="date-box-zone">${escapeHtml(ride.timeZone)}</div>
    </div>`;
}

function rideCardHtml(ride, committed) {
  const isCommitted = !!committed[ride.RideName];
  const stateText = isCommitted ? 'You are\ncommitted!' : 'You haven’t\ncommitted';
  return `
    <a class="ride-card" href="#/ride/${encodeURIComponent(ride.RideName)}">
      <div class="ride-card-state ${isCommitted ? 'is-committed' : ''}">${escapeHtml(stateText)}</div>
      <div class="ride-name">${escapeHtml(ride.RideName)}</div>
      <div class="ride-card-divider"></div>
      <div class="ride-card-body">
        ${dateBoxHtml(ride)}
        <div class="ride-card-info">
          <div class="ride-stats">
            <span>${escapeHtml(ride.RideDistance)}</span>
            <span>${escapeHtml(ride.RideDuration)}</span>
          </div>
          <div class="ride-place">
            <span>${escapeHtml(ride.RideTrailName)}</span>
            <span>${escapeHtml(ride.RideLocation)}</span>
          </div>
        </div>
      </div>
    </a>`;
}

async function renderList() {
  view.innerHTML = '<div class="status-message">Loading rides…</div>';
  let rides;
  try {
    rides = await fetchRides();
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="status-message error">Couldn’t load rides from Supabase. Please try again later.</div>`;
    return;
  }

  if (!rides.length) {
    view.innerHTML = '<div class="status-message">No rides scheduled right now — check back soon!</div>';
    return;
  }

  const committed = getCommitted();
  view.innerHTML = `<div class="ride-list">${rides.map((r) => rideCardHtml(r, committed)).join('')}</div>`;
}

async function renderDetail(rideName) {
  view.innerHTML = '<div class="status-message">Loading ride…</div>';
  let rides;
  try {
    rides = await fetchRides();
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="status-message error">Couldn’t load this ride from Supabase. Please try again later.</div>`;
    return;
  }

  const ride = rides.find((r) => r.RideName === rideName);
  if (!ride) {
    view.innerHTML = '<div class="status-message error">Ride not found.</div>';
    return;
  }

  const committed = getCommitted();
  const isCommitted = !!committed[ride.RideName];

  view.innerHTML = `
    <a class="detail-back" href="#/" aria-label="Back to rides">
      <svg viewBox="0 0 54 90" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M46 5 12 45l34 40"></path>
      </svg>
    </a>
    <div class="detail-name">${escapeHtml(ride.RideName)}</div>
    <div class="detail-body">
      ${dateBoxHtml(ride)}
      <div class="detail-info">
        <div class="detail-trail">${escapeHtml(ride.RideTrailName)}</div>
        <div class="detail-location">${escapeHtml(ride.RideLocation)}</div>
        <div class="detail-stats">
          <span>${escapeHtml(ride.RideDistance)}</span>
          <span>${escapeHtml(ride.RideDuration)}</span>
        </div>
      </div>
    </div>
    <div class="commit-section">
      <div class="commit-status">${isCommitted ? 'You are committed!' : 'You haven’t committed yet.'}</div>
      <button type="button" class="commit-btn ${isCommitted ? 'is-committed' : ''}" id="commit-toggle">
        ${isCommitted ? 'Uncommit' : 'Commit'}
      </button>
    </div>`;

  document.getElementById('commit-toggle').addEventListener('click', () => {
    const map = getCommitted();
    map[ride.RideName] = !map[ride.RideName];
    setCommitted(map);
    renderDetail(rideName);
  });
}

function route() {
  const hash = window.location.hash || '#/';
  const detailMatch = hash.match(/^#\/ride\/(.+)$/);
  if (detailMatch) {
    renderDetail(decodeURIComponent(detailMatch[1]));
  } else {
    renderList();
  }
}

window.addEventListener('hashchange', route);
route();
