let unit = 'C';
let lastData = null;
let lastPlace = null;
let miniMap = null;
let miniMarker = null;

/* ---------- Saved locations (persisted in this browser) ---------- */
const SAVED_KEY = 'weatherapp_saved_locations';

function getSavedLocations(){
  try{
    return JSON.parse(localStorage.getItem(SAVED_KEY)) || [];
  }catch(e){
    return [];
  }
}
function setSavedLocations(list){
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
}
function isSaved(name){
  return getSavedLocations().some(l => l.name === name);
}

const codeMap = {
  0:['Clear','☀'], 1:['Mainly clear','🌤'], 2:['Partly cloudy','⛅'], 3:['Overcast','☁'],
  45:['Fog','🌫'], 48:['Rime fog','🌫'],
  51:['Light drizzle','🌦'], 53:['Drizzle','🌦'], 55:['Dense drizzle','🌦'],
  56:['Freezing drizzle','🌧'], 57:['Freezing drizzle','🌧'],
  61:['Light rain','🌧'], 63:['Rain','🌧'], 65:['Heavy rain','🌧'],
  66:['Freezing rain','🌧'], 67:['Freezing rain','🌧'],
  71:['Light snow','🌨'], 73:['Snow','🌨'], 75:['Heavy snow','❄'],
  77:['Snow grains','❄'],
  80:['Light showers','🌦'], 81:['Showers','🌦'], 82:['Violent showers','⛈'],
  85:['Snow showers','🌨'], 86:['Snow showers','🌨'],
  95:['Thunderstorm','⛈'], 96:['Thunderstorm w/ hail','⛈'], 99:['Severe storm','⛈']
};

/* ---------- Helpers ---------- */
function cToF(c){ return c*9/5+32; }
function fmtTemp(c){
  const v = unit==='C' ? c : cToF(c);
  return Math.round(v)+'°';
}
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2500);
}

function weatherColor(code, isDay){
  if(!isDay) return 'linear-gradient(160deg, #0b1a33, #1a3a6b 60%, #2d5a9e)';
  if(code===0 || code===1) return 'linear-gradient(160deg, #1a3a6b, #3d7bd9 60%, #6fb1e8)';
  if(code<=3) return 'linear-gradient(160deg, #45607d, #6f8ba6 60%, #a9c0d4)';
  if(code===45 || code===48) return 'linear-gradient(160deg, #5c6b73, #8a9aa3 60%, #b9c4ca)';
  if(code>=51 && code<=67) return 'linear-gradient(160deg, #2b3f52, #4d6a83 60%, #7d97ab)';
  if(code>=71 && code<=86) return 'linear-gradient(160deg, #4a5568, #7b8a9a 60%, #c3ccd4)';
  if(code>=95) return 'linear-gradient(160deg, #2b2140, #4a3f6e 60%, #6b5a9a)';
  return 'linear-gradient(160deg, #2b3142, #4a5568 60%, #6b7688)';
}

/* Solid pin colors for map markers (distinct from the hero gradient above) */
function pinColor(code, isDay){
  if(!isDay) return {bg:'#1a2a4a', text:'#ffffff'};
  if(code===0 || code===1) return {bg:'#3d7bd9', text:'#ffffff'};
  if(code<=3) return {bg:'#78899c', text:'#ffffff'};
  if(code===45 || code===48) return {bg:'#9aa5ab', text:'#ffffff'};
  if(code>=51 && code<=67) return {bg:'#3f6e8c', text:'#ffffff'};
  if(code>=71 && code<=86) return {bg:'#7fa8c9', text:'#0b2540'};
  if(code>=95) return {bg:'#4a3f6e', text:'#ffffff'};
  return {bg:'#5f6368', text:'#ffffff'};
}

const majorCities = [
  {name:'London', lat:51.5074, lon:-0.1278},
  {name:'New York', lat:40.7128, lon:-74.0060},
  {name:'Tokyo', lat:35.6762, lon:139.6503},
  {name:'Sydney', lat:-33.8688, lon:151.2093},
  {name:'Cairo', lat:30.0444, lon:31.2357},
  {name:'Kolkata', lat:22.5726, lon:88.3639},
  {name:'Rio de Janeiro', lat:-22.9068, lon:-43.1729},
  {name:'Moscow', lat:55.7558, lon:37.6173}
];

/* ---------- API calls ---------- */
async function geocode(query){
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  if(!data.results || data.results.length===0) throw new Error('No place found for "'+query+'"');
  return data.results[0];
}

async function fetchWeather(lat, lon){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure,is_day` +
    `&hourly=temperature_2m,weather_code,precipitation_probability` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset` +
    `&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Weather service unavailable');
  return res.json();
}

/* ---------- Mini map ---------- */
function renderMiniMap(lat, lon, label){
  if(!miniMap){
    miniMap = L.map('miniMap', {
      zoomControl:false, attributionControl:true, dragging:true, scrollWheelZoom:false
    }).setView([lat, lon], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:'&copy; OpenStreetMap &copy; CARTO',
      subdomains:'abcd', maxZoom:19
    }).addTo(miniMap);
    miniMarker = L.marker([lat, lon]).addTo(miniMap);
  }else{
    miniMap.setView([lat, lon], 10);
    miniMarker.setLatLng([lat, lon]);
  }
  // Leaflet needs a resize nudge since the container was just made visible
  setTimeout(() => miniMap.invalidateSize(), 150);

  document.getElementById('openMapLink').href =
    `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=11/${lat}/${lon}`;
}

/* ---------- World map (first page) ---------- */
let worldMap = null;

function worldPinIcon(iconChar, tempStr, color){
  return L.divIcon({
    className:'',
    html:`<div class="pin" style="background:${color.bg}; color:${color.text};">
            <span class="icon">${iconChar}</span><span class="t">${tempStr}</span>
          </div>`,
    iconSize:[0,0]
  });
}

function initWorldMap(){
  worldMap = L.map('worldMap', {zoomControl:false, attributionControl:true}).setView([20, 0], 2);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution:'&copy; OpenStreetMap &copy; CARTO',
    subdomains:'abcd', maxZoom:19
  }).addTo(worldMap);
  L.control.zoom({position:'bottomright'}).addTo(worldMap);

  worldMap.on('click', (e) => {
    loadCoords(e.latlng.lat, e.latlng.lng, 'Selected location');
  });

  majorCities.forEach(async (city) => {
    try{
      const data = await fetchWeather(city.lat, city.lon);
      const cur = data.current;
      const [, icon] = codeMap[cur.weather_code] || ['','—'];
      const color = pinColor(cur.weather_code, cur.is_day);
      const marker = L.marker([city.lat, city.lon], {
        icon: worldPinIcon(icon, fmtTemp(cur.temperature_2m), color)
      }).addTo(worldMap);
      marker.on('click', () => loadCoords(city.lat, city.lon, city.name));
    }catch(e){ /* silently skip a city that fails to load */ }
  });
}

async function renderChips(){
  const bar = document.getElementById('locationsBar');
  const saved = getSavedLocations();
  if(saved.length === 0){
    bar.innerHTML = '';
    return;
  }
  bar.innerHTML = saved.map(() => '').join(''); // clear first
  const chipEls = await Promise.all(saved.map(async (loc) => {
    let icon = '—', temp = '';
    try{
      const data = await fetchWeather(loc.lat, loc.lon);
      const [, ic] = codeMap[data.current.weather_code] || ['','—'];
      icon = ic;
      temp = fmtTemp(data.current.temperature_2m);
    }catch(e){ /* keep placeholder if this one fails */ }
    const isActive = lastPlace && lastPlace.name === loc.name;
    const chip = document.createElement('div');
    chip.className = 'chip' + (isActive ? ' active' : '');
    chip.innerHTML = `
      <span class="chip-icon">${icon}</span>
      <span>${loc.name.split(',')[0]}</span>
      <span>${temp}</span>
      <button class="chip-remove" title="Remove">✕</button>
    `;
    chip.addEventListener('click', (e) => {
      if(e.target.classList.contains('chip-remove')) return;
      loadCoords(loc.lat, loc.lon, loc.name);
    });
    chip.querySelector('.chip-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      const updated = getSavedLocations().filter(l => l.name !== loc.name);
      setSavedLocations(updated);
      renderChips();
    });
    return chip;
  }));
  bar.innerHTML = '';
  chipEls.forEach(el => bar.appendChild(el));
}

/* ---------- Render result page ---------- */
function renderResult(place, data){
  lastData = data;
  lastPlace = place;

  document.getElementById('emptyState').classList.remove('show');
  document.getElementById('loading').classList.remove('show');
  document.getElementById('result').classList.add('show');

  const cur = data.current;
  const [condLabel, icon] = codeMap[cur.weather_code] || ['Unknown','—'];

  document.getElementById('heroBand').style.background = weatherColor(cur.weather_code, cur.is_day);
  document.getElementById('placeName').textContent = place.name;
  document.getElementById('placeSub').textContent = 'Updated ' + new Date().toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
  document.getElementById('heroIcon').textContent = icon;
  document.getElementById('heroTemp').textContent = fmtTemp(cur.temperature_2m);
  document.getElementById('heroCond').textContent = condLabel;
  document.getElementById('unitToggle').textContent = '°'+unit;

  const hi = data.daily.temperature_2m_max[0];
  const lo = data.daily.temperature_2m_min[0];
  document.getElementById('hilo').textContent =
    `H: ${fmtTemp(hi)}  L: ${fmtTemp(lo)} · Feels like ${fmtTemp(cur.apparent_temperature)}`;

  renderMiniMap(place.lat, place.lon, place.name);

  const saveBtn = document.getElementById('saveBtn');
  const alreadySaved = isSaved(place.name);
  saveBtn.textContent = alreadySaved ? '✓' : '+';
  saveBtn.classList.toggle('saved', alreadySaved);
  saveBtn.onclick = () => {
    const saved = getSavedLocations();
    if(isSaved(place.name)){
      setSavedLocations(saved.filter(l => l.name !== place.name));
    }else{
      saved.push({name: place.name, lat: place.lat, lon: place.lon});
      setSavedLocations(saved);
    }
    const nowSaved = isSaved(place.name);
    saveBtn.textContent = nowSaved ? '✓' : '+';
    saveBtn.classList.toggle('saved', nowSaved);
    renderChips();
  };

  renderChips();

  // hourly
  const hourly = document.getElementById('hourly');
  hourly.innerHTML = '';
  const nowIdx = data.hourly.time.findIndex(t => t === cur.time) || 0;
  for(let i=nowIdx; i<Math.min(nowIdx+24, data.hourly.time.length); i++){
    const t = new Date(data.hourly.time[i]);
    const [,hIcon] = codeMap[data.hourly.weather_code[i]] || ['','—'];
    const item = document.createElement('div');
    item.className = 'hour-item';
    item.innerHTML = `
      <div class="t">${i===nowIdx ? 'Now' : t.toLocaleTimeString(undefined,{hour:'numeric'})}</div>
      <div class="icon">${hIcon}</div>
      <div class="v">${fmtTemp(data.hourly.temperature_2m[i])}</div>
      <div class="pop">${data.hourly.precipitation_probability[i]}%</div>
    `;
    hourly.appendChild(item);
  }

  // daily
  const daily = document.getElementById('daily');
  daily.innerHTML = '';
  const allMax = Math.max(...data.daily.temperature_2m_max);
  const allMin = Math.min(...data.daily.temperature_2m_min);
  const range = allMax - allMin || 1;
  data.daily.time.forEach((dstr, i) => {
    const d = new Date(dstr+'T00:00:00');
    const [,dIcon] = codeMap[data.daily.weather_code[i]] || ['','—'];
    const dLo = data.daily.temperature_2m_min[i];
    const dHi = data.daily.temperature_2m_max[i];
    const leftPct = ((dLo-allMin)/range)*100;
    const widthPct = ((dHi-dLo)/range)*100;
    const row = document.createElement('div');
    row.className = 'day-row';
    row.innerHTML = `
      <div class="name ${i===0?'today':''}">${i===0?'Today':d.toLocaleDateString(undefined,{weekday:'short'})}</div>
      <div class="icon">${dIcon}</div>
      <div class="bar-track"><div class="bar-fill" style="left:${leftPct}%;width:${widthPct}%"></div></div>
      <div class="temps"><span class="lo">${fmtTemp(dLo)}</span><span class="hi">${fmtTemp(dHi)}</span></div>
    `;
    daily.appendChild(row);
  });

  // details
  const sunrise = new Date(data.daily.sunrise[0]);
  const sunset = new Date(data.daily.sunset[0]);
  document.getElementById('details').innerHTML = `
    <div class="tile"><div class="label">Humidity</div><div class="value">${cur.relative_humidity_2m}%</div></div>
    <div class="tile"><div class="label">Wind</div><div class="value">${Math.round(cur.wind_speed_10m)} km/h</div></div>
    <div class="tile"><div class="label">UV Index</div><div class="value">${data.daily.uv_index_max[0].toFixed(1)}</div></div>
    <div class="tile"><div class="label">Pressure</div><div class="value">${Math.round(cur.surface_pressure)} hPa</div></div>
    <div class="tile"><div class="label">Sunrise</div><div class="value" style="font-size:16px">${sunrise.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</div></div>
    <div class="tile"><div class="label">Sunset</div><div class="value" style="font-size:16px">${sunset.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</div></div>
  `;
}

/* ---------- Search / geolocation flows ---------- */
async function loadCity(query){
  document.getElementById('emptyState').classList.remove('show');
  document.getElementById('result').classList.remove('show');
  document.getElementById('loading').classList.add('show');
  try{
    const place = await geocode(query);
    const fullName = place.name + (place.admin1 ? ', '+place.admin1 : '') + (place.country ? ', '+place.country : '');
    const data = await fetchWeather(place.latitude, place.longitude);
    renderResult({name: fullName, lat: place.latitude, lon: place.longitude}, data);
  }catch(err){
    document.getElementById('loading').classList.remove('show');
    showToast(err.message || 'Something went wrong.');
    if(!lastData) document.getElementById('emptyState').classList.add('show');
  }
}

async function loadCoords(lat, lon, label){
  document.getElementById('emptyState').classList.remove('show');
  document.getElementById('result').classList.remove('show');
  document.getElementById('loading').classList.add('show');
  try{
    const data = await fetchWeather(lat, lon);
    renderResult({name: label || 'Current location', lat: lat, lon: lon}, data);
  }catch(err){
    document.getElementById('loading').classList.remove('show');
    showToast(err.message || 'Could not load weather here.');
    if(!lastData) document.getElementById('emptyState').classList.add('show');
  }
}

/* ---------- Search bar ---------- */
document.getElementById('searchBtn').addEventListener('click', () => {
  const v = document.getElementById('cityInput').value.trim();
  if(v) loadCity(v);
});
document.getElementById('cityInput').addEventListener('keydown', (e) => {
  if(e.key === 'Enter'){
    const v = e.target.value.trim();
    if(v) loadCity(v);
  }
});
document.getElementById('unitToggle').addEventListener('click', () => {
  unit = unit==='C' ? 'F' : 'C';
  if(lastData && lastPlace) renderResult(lastPlace, lastData);
});
document.getElementById('backBtn').addEventListener('click', () => {
  document.getElementById('result').classList.remove('show');
  document.getElementById('emptyState').classList.add('show');
  if(worldMap) setTimeout(() => worldMap.invalidateSize(), 150);
});

/* ---------- Voice search (mic button) ---------- */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const micBtn = document.getElementById('micBtn');

if(SpeechRecognition){
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;

  let listening = false;

  micBtn.addEventListener('click', () => {
    if(listening){
      recognition.stop();
      return;
    }
    recognition.start();
  });

  recognition.onstart = () => {
    listening = true;
    micBtn.classList.add('listening');
    showToast('Listening…');
  };
  recognition.onend = () => {
    listening = false;
    micBtn.classList.remove('listening');
  };
  recognition.onerror = () => {
    listening = false;
    micBtn.classList.remove('listening');
    showToast('Could not hear that — try again.');
  };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('cityInput').value = transcript;
    loadCity(transcript);
  };
}else{
  micBtn.addEventListener('click', () => {
    showToast('Voice search is not supported in this browser.');
  });
}

/* ---------- Boot ---------- */
document.getElementById('emptyState').classList.add('show');
initWorldMap();
renderChips();