'use strict';

function renderLeaderboard(elId, rows, myId) {
  const el = document.getElementById(elId);
  if (!rows || !rows.length) { el.innerHTML = '<div class="lb-loading">No scores yet</div>'; return; }
  const medals = ['🥇', '🥈', '🥉'];
  el.innerHTML = rows.map((r, i) => {
    const isMe = r.name === myId;
    const rank = i < 3 ? `<span class="lb-rank top">${medals[i]}</span>` : `<span class="lb-rank">${i + 1}</span>`;
    return `<div class="lb-row${isMe ? ' me' : ''}">${rank}<span class="lb-name">${r.name || 'Anonymous'}</span><span class="lb-score">${(r.score || 0).toLocaleString()}</span></div>`;
  }).join('');
}

let _lbTab = 'classic';

async function showLeaderboard() {
  hideAll();
  document.getElementById('splashOv').classList.add('hidden');
  document.getElementById('hud').style.display = 'none';
  document.getElementById('infoStrip').style.display = 'none';
  document.getElementById('sliceBtn').style.display = 'none';
  document.getElementById('backBtn').style.display = 'none';
  document.getElementById('lbOv').classList.remove('hidden');
  // 每次打开重置 tab 到 classic
  _lbTab = 'classic';
  document.getElementById('lbTabClassic').classList.add('active');
  document.getElementById('lbTabTimed').classList.remove('active');

  document.getElementById('lbTabFriends').classList.remove('active');
  await initFirebase();
  await loadLbTab('classic');
}

function hideLeaderboard() {
  document.getElementById('lbOv').classList.add('hidden');
  document.getElementById('splashOv').classList.remove('hidden');
}

async function switchLbTab(tab) {
  _lbTab = tab;
  document.getElementById('lbTabClassic').classList.toggle('active', tab === 'classic');
  document.getElementById('lbTabTimed').classList.toggle('active', tab === 'timed');

  document.getElementById('lbTabFriends').classList.toggle('active', tab === 'friends');
  await loadLbTab(tab);
}

async function loadLbTab(tab) {
  const el = document.getElementById('lbMain');
  el.innerHTML = '<div class="lb-loading">Loading...</div>';
  if (tab === 'friends') {
    if (isAnonymousUser()) { el.innerHTML = '<div class="lb-loading">Sign in with Google to see friends\' scores!</div>'; return; }
    const rows = await fetchFriendsLeaderboard('classic');
    if (!rows.length) { el.innerHTML = '<div class="lb-loading">Add friends to see their scores!</div>'; return; }
    renderLeaderboard('lbMain', rows, localStorage.getItem('cb3d_nickname'));
  } else {
    const rows = await fetchLeaderboard(tab);
    renderLeaderboard('lbMain', rows, localStorage.getItem('cb3d_nickname'));
  }
}
