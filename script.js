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

const SHARE_ICON_SVG = `<svg class="share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3v11"></path>
  <path d="M8 6.5 12 2.5l4 4"></path>
  <path d="M5 13v7.5h14V13"></path>
</svg>`;

function difficultyPillHtml(ride) {
  if (!ride.RideDifficulty) return '';
  return `<div class="difficulty-pill">${escapeHtml(ride.RideDifficulty)}</div>`;
}

function ridersRowHtml(ride, extraSuffix) {
  if (ride.RideRiders === null || ride.RideRiders === undefined || ride.RideRiders === '') return '';
  const text = `${escapeHtml(ride.RideRiders)} riders${extraSuffix || ''}\nare committed!`;
  return `<div class="riders-row"><span class="icon-bike" aria-hidden="true"></span><span>${text}</span></div>`;
}

function rideCardHtml(ride, committed) {
  const isCommitted = !!committed[ride.RideName];
  const stateText = isCommitted ? 'You are\ncommitted!' : 'You haven’t\ncommitted';
  return `
    <a class="ride-card" href="#/ride/${encodeURIComponent(ride.RideName)}">
      <div class="ride-card-top">
        <div class="ride-name">${escapeHtml(ride.RideName)}</div>
        <button type="button" class="share-btn" data-ride="${escapeHtml(ride.RideName)}" aria-label="Share ${escapeHtml(ride.RideName)}">${SHARE_ICON_SVG}</button>
      </div>
      <div class="ride-card-divider"></div>
      <div class="ride-card-body">
        ${dateBoxHtml(ride)}
        <div class="ride-card-info">
          <div class="ride-stats-row">
            ${difficultyPillHtml(ride)}
            <div class="ride-stats">
              <span>${escapeHtml(ride.RideDistance)}</span>
              <span>${escapeHtml(ride.RideDuration)}</span>
            </div>
          </div>
          <div class="ride-place">
            <span>${escapeHtml(ride.RideTrailName)}</span>
            <span>${escapeHtml(ride.RideLocation)}</span>
          </div>
          ${ridersRowHtml(ride)}
        </div>
        <div class="ride-card-state ${isCommitted ? 'is-committed' : ''}">${escapeHtml(stateText)}</div>
      </div>
    </a>`;
}

function shareRide(rideName) {
  const url = `${window.location.origin}${window.location.pathname}#/ride/${encodeURIComponent(rideName)}`;
  if (navigator.share) {
    navigator.share({ title: rideName, url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => {});
  }
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

  view.querySelectorAll('.share-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      shareRide(btn.dataset.ride);
    });
  });
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
    <div class="detail-hero">
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
            ${difficultyPillHtml(ride)}
            <span>${escapeHtml(ride.RideDistance)}</span>
            <span>${escapeHtml(ride.RideDuration)}</span>
          </div>
        </div>
      </div>
    </div>
    ${ride.RideRiders !== null && ride.RideRiders !== undefined && ride.RideRiders !== ''
      ? `<div class="detail-riders-row">
          <span class="icon-bike" aria-hidden="true"></span>
          <div class="detail-riders-text">${escapeHtml(ride.RideRiders)} riders${isCommitted ? ' + you' : ''}<br>are committed!</div>
        </div>`
      : ''}
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
