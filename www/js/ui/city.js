'use strict';

const CITY_STAGES = [
  { id: 'cs1',         threshold: 100,   name: 'House' },
  { id: 'cs2',         threshold: 200,   name: 'Café' },
  { id: 'cs3',         threshold: 400,   name: 'Apartments' },
  { id: 'cs4',         threshold: 600,   name: 'Park' },
  { id: 'cs5',         threshold: 1000,  name: 'Office Tower' },
  { id: 'cs6',         threshold: 1500,  name: 'Skyscraper' },
  { id: 'cs7',         threshold: 2000,  name: 'Grand Tower' },
  { id: 'cs_lamps',    threshold: 2500,  name: 'Street Lamps' },
  { id: 'cs1b',        threshold: 3000,  name: 'House Garden' },
  { id: 'cs_balloon',  threshold: 3500,  name: 'Hot Air Balloon' },
  { id: 'cs2b',        threshold: 4500,  name: 'Café Terrace' },
  { id: 'cs_billboard',threshold: 5500,  name: 'Neon Billboard' },
  { id: 'cs3b',        threshold: 6500,  name: 'Rooftop Garden' },
  { id: 'cs_crane',    threshold: 7500,  name: 'Construction Crane' },
  { id: 'cs5b',        threshold: 8500,  name: 'Office Upgrade' },
  { id: 'cs_blimp',    threshold: 9500,  name: 'Airship' },
  { id: 'cs4b',        threshold: 10500, name: 'Park Fountain' },
  { id: 'cs6b',        threshold: 11500, name: 'LED Skyscraper' },
  { id: 'cs_dish',     threshold: 12500, name: 'Satellite Dish' },
  { id: 'cs7b',        threshold: 13500, name: 'Observation Deck' },
  { id: 'cs_aurora2',  threshold: 15000, name: 'Northern Lights' },
  { id: 'csfin',       threshold: 16500, name: 'Metropolis!' },
  { id: 'cs_harbor',   threshold: 18000, name: 'Harbor' },
  { id: 'cs_stadium',  threshold: 19500, name: 'Stadium' },
  { id: 'cs_monorail', threshold: 21000, name: 'Monorail' },
  { id: 'cs_museum',   threshold: 22500, name: 'Museum' },
  { id: 'cs_spire',    threshold: 24000, name: 'Crystal Spire' },
  { id: 'cs_arcadium', threshold: 25500, name: 'Arcadium' },
  { id: 'cs_colosseum',threshold: 27000, name: 'Colosseum' },
  { id: 'cs_dome',     threshold: 28500, name: 'Futuristic Dome' },
  { id: 'cs_finale2',  threshold: 30000, name: 'City of Stars' },
];

function updateCity() {
  const n = totalBlocksElim;
  const matsEl = document.getElementById('cityMats');
  if (matsEl) matsEl.textContent = n.toLocaleString();

  CITY_STAGES.forEach(({ id, threshold, name }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const unlocked = n >= threshold;
    const wasHidden = el.getAttribute('opacity') === '0';
    if (unlocked && wasHidden) {
      el.setAttribute('opacity', '1');
      el.classList.add('rising');
      setTimeout(() => el.classList.remove('rising'), 800);
      logEvent('city_stage_unlocked', { stage: name, blocks: n });
      if (gameRunning) _pendingCityToasts.push(name);
    } else if (unlocked) {
      el.setAttribute('opacity', '1');
    }
  });

  const fill = document.getElementById('cityProgressFill');
  const label = document.getElementById('cityNextLabel');
  if (!fill || !label) return;
  const next = CITY_STAGES.find(s => n < s.threshold);
  if (next) {
    const unlocked = CITY_STAGES.filter(s => n >= s.threshold);
    const prevThreshold = unlocked.length ? unlocked[unlocked.length - 1].threshold : 0;
    const pct = Math.min(100, Math.round((n - prevThreshold) / (next.threshold - prevThreshold) * 100));
    fill.style.width = pct + '%';
    label.textContent = `→ ${next.name} in ${(next.threshold - n).toLocaleString()} blocks`;
  } else {
    fill.style.width = '100%';
    label.textContent = '✨ Metropolis complete!';
  }
}
