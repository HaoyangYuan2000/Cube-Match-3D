'use strict';

function _getSetting(key, def) {
  const v = localStorage.getItem(key);
  return v === null ? def : v === '1';
}

function vibrate(pattern) {
  if (!_getSetting('cb3d_vibration', true)) return;
  if (window.AndroidVibrate) { window.AndroidVibrate.vibrate(JSON.stringify(pattern)); }
  else if (navigator.vibrate) { navigator.vibrate(pattern); }
}

function showToast(msg) {
  const wrap = document.getElementById('cw');
  if (!wrap) return;
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:absolute;top:18%;left:50%;transform:translateX(-50%) translateY(0);font-size:13px;white-space:nowrap;z-index:60;color:#ffe066;background:rgba(20,16,48,.9);padding:6px 16px;border-radius:99px;border:1px solid rgba(255,224,102,.3);pointer-events:none;transition:transform 3s ease-out,opacity 3s ease-out';
  setTimeout(() => requestAnimationFrame(() => {
    el.style.transform = 'translateX(-50%) translateY(-40px)';
    el.style.opacity = '0';
  }), 3000);
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

let _pendingCityToasts = [];

function showCityToast(name) {
  const wrap = document.getElementById('cw');
  if (!wrap) return;
  const el = document.createElement('div');
  el.textContent = '🏙️ ' + name + ' Built! Check menu';
  el.style.cssText = 'position:absolute;top:6%;left:50%;transform:translateX(-50%) translateY(0);font-size:13px;white-space:nowrap;z-index:60;color:#ffe066;background:rgba(20,16,48,.85);padding:6px 16px;border-radius:99px;border:1px solid rgba(255,224,102,.3);pointer-events:none;transition:transform 3s ease-out,opacity 3s ease-out';
  setTimeout(() => requestAnimationFrame(() => {
    el.style.transform = 'translateX(-50%) translateY(-40px)';
    el.style.opacity = '0';
  }), 3000);
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

function flushCityToasts() {
  if (!_pendingCityToasts.length) return;
  const msg = _pendingCityToasts.length === 1
    ? _pendingCityToasts[0]
    : _pendingCityToasts.length + ' new buildings';
  showCityToast(msg);
  _pendingCityToasts = [];
}

function showDailyToast() {
  showToast('🎁 Daily bonus: +6 Slice!');
}
