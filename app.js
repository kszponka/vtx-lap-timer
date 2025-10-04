// RX5808 Panel — single-file JS (app + mock)
// Wersja scalona: logika UI + mock danych w jednym pliku.
// Chcesz wyłączyć mock? Dopisz do URL: ?mock=0 (domyślnie mock=ON)

(function(){
  const params = new URLSearchParams(location.search);
  const USE_MOCK = params.get('mock') !== '0'; // domyślnie true

  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>[...document.querySelectorAll(s)];

  /* ---------------- Router: three tabs ---------------- */
  const tabs = { history: $('#btnTabHistory'), settings: $('#btnTabSettings'), new: $('#btnTabNew') };
  Object.entries(tabs).forEach(([key,btn])=> btn && btn.addEventListener('click', ()=> go(key)) );
  function go(name){ location.hash = `#/${name}`; }
  function applyRoute(){
    const r = location.hash.replace(/^#\/?/, '') || 'history';
    $$('section[data-route]').forEach(sec => sec.hidden = (sec.dataset.route!==r));
    Object.entries(tabs).forEach(([k,btn])=> btn && btn.classList.toggle('active', k===r));
  }
addEventListener('hashchange', applyRoute);
// domyślnie otwieraj New Race
if (!location.hash) location.hash = '#/new';
applyRoute();

  /* ---------------- Channel grid: Band E only (E1..E8) ---------------- */
  const chGrid = document.getElementById('chGridE');
  const channelsE = Array.from({length:8}).map((_,i)=>`E${i+1}`);
  let currentCh = 'E1';
  if(chGrid){
    channelsE.forEach((ch,idx)=>{
      const div=document.createElement('div');
      div.className='ch';
      div.textContent=ch;
      if(ch===currentCh) div.classList.add('active');
      div.addEventListener('click',()=>{
        currentCh=ch;
        const lab=document.getElementById('channelLabel'); if(lab) lab.textContent=ch;
        const badge=document.getElementById('channelBadge'); if(badge) badge.textContent=ch;
        [...chGrid.children].forEach((c,i)=> c.classList.toggle('active', i===idx));
        toast(`Channel set to ${ch}`);
        // TODO: send to device via WS/REST, e.g. sendCmdWS('vtx:set', { channel: ch })
      });
      chGrid.appendChild(div);
    });
  }

  /* ---------------- History: list + details modal ---------------- */
  const historyEl = $('#races-history');
  function renderHistory(list){
    if(!historyEl) return;
    historyEl.innerHTML='';
    if(!list || list.length===0){
      const it=document.createElement('div'); it.className='item';
      it.textContent='No data yet — start a mock race (Start) or connect device';
      historyEl.appendChild(it);
      return;
    }
    list.forEach(r=>{
      const it=document.createElement('div'); it.className='item';
      it.innerHTML=`<div class="row"><b>#${r.id}</b><span class="mono">${new Date(r.timestamp).toLocaleString()}</span><span class="right">Best ${(r.best_ms/1000).toFixed(2)}s</span></div>`;
      it.addEventListener('click', ()=> openRaceDetail(r));
      historyEl.appendChild(it);
    });
  }

  function openRaceDetail(r){
    $('#raceTitle').textContent = `Race #${r.id}`;
    const total = (r.laps||[]).reduce((a,l)=>a+(l.lap_ms||0),0);
    const best = Math.min(...(r.laps||[]).map(l=>l.lap_ms||1e12));
    $('#raceSummary').innerHTML = `
      <div class="row">
        <div><small>Start</small><div class="mono">${new Date(r.timestamp).toLocaleString()}</div></div>
        <div><small>Laps</small><div class="mono">${(r.laps||[]).length}</div></div>
        <div><small>Best</small><div class="mono">${(best/1000).toFixed(2)}s</div></div>
        <div class="right"><small>Total</small><div class="mono">${fmtDur(total)}</div></div>
      </div>`;
    const list = $('#raceLaps'); if(list){ list.innerHTML=''; (r.laps||[]).forEach((lap,i)=>{ const it=document.createElement('div'); it.className='item'; it.textContent = `Lap ${i+1}: ${(lap.lap_ms/1000).toFixed(2)}s`; list.appendChild(it); }); }
    $('#raceModal').classList.add('show'); $('#raceModal').setAttribute('aria-hidden','false');
  }
  const closeBtn = $('#closeModal');
  if(closeBtn){ closeBtn.addEventListener('click', ()=>{ $('#raceModal').classList.remove('show'); $('#raceModal').setAttribute('aria-hidden','true'); }); }

  /* ---------------- Utils ---------------- */
  function fmtSec(s){ return (Math.round(s*100)/100).toFixed(2)+'s'; }
  function fmtDur(ms){ const t=Math.floor(ms/100); const cs=t%10; const s=Math.floor(t/10)%60; const m=Math.floor(t/600); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${cs}`; }
  function pushLastLap(ms){ const box=$('#lastLaps'); if(!box) return; const d=document.createElement('div'); d.className='item'; d.textContent=`Lap ${box.children.length+1}: ${(ms/1000).toFixed(2)}s`; box.prepend(d); while(box.children.length>5) box.lastChild.remove(); speakLap(ms); }
  function updateLive({lap,last_ms,best_ms,total_ms}){ if($('#liveLap')) $('#liveLap').textContent=lap??'-'; if($('#liveLast')) $('#liveLast').textContent=last_ms?fmtSec(last_ms/1000):'--.-s'; if($('#liveBest')) $('#liveBest').textContent=best_ms?fmtSec(best_ms/1000):'--.-s'; if($('#liveTotal')) $('#liveTotal').textContent=total_ms?fmtDur(total_ms):'00:00.0'; }
  function toast(msg,t=1500){ const el=$('#toast'); if(!el) return; el.textContent=msg; el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'), t); }

  /* ---------------- Lap voice (Web Speech API) ---------------- */
function speakLap(ms){
  try {
    const sec = (ms / 1000).toFixed(2);  // np. "9.42"
    const parts = sec.split('.');        // ["9","42"]
    const digits = parts[0].split('').join(' ') + ' point ' + parts[1].split('').join(' ');
    const utter = new SpeechSynthesisUtterance(digits);
    utter.lang = 'en-US'; // albo 'pl-PL'
    speechSynthesis.speak(utter);
  } catch(e){
    console.warn('speech error', e);
  }
}

  /* ---------------- Built-in MOCK: seed + controls ---------------- */
  function mockSeedHistory(){
    const now = Date.now();
    const gen = (n)=> Array.from({length:n}).map(()=>({ lap_ms: Math.round(10000 + Math.random()*5000) }));
    return Array.from({length:6}).map((_,i)=>({
      id: 60-i,
      timestamp: now - i*3600_000,
      best_ms: 12000+i*200,
      total_ms: 150000+i*1000,
      pilot: ['Neo','Kira','Max'][i%3],
      laps: gen(8+(i%4))
    }));
  }

  function mockMount(){
    // Historia startowa
    let history = mockSeedHistory();
    renderHistory(history);

    // New Race symulacja
    let simTimer=null, simRunning=false;
    const btnStart = $('#btnStart');
    const btnStop  = $('#btnStop');
    const lapsTarget = $('#lapsTarget');
    const startDelay = $('#startDelay');
    const minLap     = $('#minLap'); // hidden, używane przez mock

    btnStart?.addEventListener('click', ()=>{
      if(simRunning) return; simRunning=true; btnStart.classList.add('primary'); btnStop?.classList.remove('primary');
      $('#lastLaps').innerHTML=''; updateLive({lap:0,last_ms:0,best_ms:0,total_ms:0});
      const lapsN = Math.max(1, +lapsTarget.value||5);
      const delay0 = Math.max(0, +startDelay.value||0)*1000;
      const minLapMs = Math.round((+minLap.value||7)*1000);
      const race = { id: Math.floor(1000+Math.random()*9000), timestamp: Date.now(), laps: [] };
      let best=1e9, total=0, i=0;
      function tick(){
        if(!simRunning) return;
        if(i===0 && delay0){ toast(`Start in ${Math.round(delay0/1000)}s`); simTimer=setTimeout(()=>{ i=1; tick(); }, delay0); return; }
        const ms = Math.round(5000 + Math.random()*5000);
        race.laps.push({ lap_ms: ms }); best = Math.min(best, ms); total += ms; i++;
        pushLastLap(ms); updateLive({lap:i,last_ms:ms,best_ms:best,total_ms:total});
        if(!simRunning) return;
        if(i<lapsN){ simTimer=setTimeout(tick, 3000 + Math.random()*300); }
        else { finish(); }
      }
      function finish(){
        simRunning=false; btnStop?.classList.remove('primary');
        race.best_ms = best; race.total_ms = total; race.pilot = '—';
        history = [race, ...history];
        renderHistory(history);
        toast('Race saved');
      }
      tick();
    });

    btnStop?.addEventListener('click', ()=>{
      if(!simRunning) return; simRunning=false; if(simTimer) clearTimeout(simTimer); btnStop.classList.add('primary'); btnStart?.classList.remove('primary'); toast('Stopped');
    });

    // Calibration mock
    let calTimer=null, calRunning=false, base=0, peak=0;
    const btnCalStart = $('#btnCalStart');
    const btnCalStop  = $('#btnCalStop');
    const elBase = $('#calBase');
    const elPeak = $('#calPeak');
    const elGate = $('#calGate');

    function updateCal(){ if(elBase) elBase.textContent = base+" dB"; if(elPeak) elPeak.textContent = peak+" dB"; if(elGate) elGate.textContent = Math.round((base+peak)/2)+" dB"; }

    btnCalStart?.addEventListener('click', ()=>{ if(calRunning) return; calRunning=true; base=40+rand(6); peak=60+rand(10); updateCal(); loop(); toast('Calibration started'); });
    btnCalStop?.addEventListener('click', ()=>{ calRunning=false; if(calTimer) clearTimeout(calTimer); toast('Calibration stopped'); });

    function loop(){ if(!calRunning) return; peak = Math.max(peak, 70+rand(20)); updateCal(); calTimer=setTimeout(loop, 500); }
  }

  function rand(n){ return Math.floor(Math.random()*n); }

  // Mount
  if(USE_MOCK){
    mockMount();
  } else {
    // Brak mocka: pokaż pustą historię, czeka na realne WS/REST
    renderHistory([]);
  }
})();
