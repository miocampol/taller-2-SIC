/**
 * app.js
 * Frontend logic: carga libros, capítulos, secciones y renderiza capítulo
 * Notas:
 *  - Si la API no permite fetch directo (CORS), ver mensaje en pantalla
 *  - Para producción: mover API key a backend (server.js incluido más abajo)
 */

/* ========== CONFIG ========== */
const CONFIG = {
  baseUrl: 'https://api.scripture.api.bible/v1',
  bibleId: '592420522e16049f-01', // Reina Valera (texto)
  // Si quieres forzar el uso de proxy local, pon proxy:true y cambia proxyBase a tu servidor.
  useProxy: false,
  proxyBase: `${location.protocol}//${location.hostname}:3000` // default proxy local
};

// API key (la incluyes aquí para pruebas; en producción ponla en backend)
const API_KEY = '5f4613ad10d1a15014f6488c1b309a09';

/* ========== DOM refs ========== */
const testamentSelect = document.getElementById('testamentSelect');
const booksSection = document.getElementById('booksSection');
const booksGrid = document.getElementById('booksGrid');
const chaptersSection = document.getElementById('chaptersSection');
const chapterSelect = document.getElementById('chapterSelect');
const chapterContent = document.getElementById('chapterContent');
const welcome = document.getElementById('welcome');

const increaseFontBtn = document.getElementById('increaseFont');
const decreaseFontBtn = document.getElementById('decreaseFont');
const toggleContrastBtn = document.getElementById('toggleContrast');

let state = {
  books: [],
  selectedTestament: null,
  selectedBook: null,
  selectedChapter: null,
  fontSize: parseInt(getComputedStyle(document.body).fontSize,10)
};

/* ========== HELPERS ========== */
function apiUrl(path){
  if (CONFIG.useProxy) return `${CONFIG.proxyBase}${path}`; // proxy expects same path
  return `${CONFIG.baseUrl}${path}`;
}
function apiHeaders(){
  // API.bible expects header name "api-key"
  return { 'api-key': API_KEY, 'accept': 'application/json' };
}
function showError(msg){
  chapterContent.innerHTML = `<div class="section-block"><div class="section-title">Error</div><div>${escapeHtml(msg)}</div></div>`;
}
function showLoading(msg='Cargando...'){
  chapterContent.innerHTML = `<div class="section-block"><div class="section-title">${escapeHtml(msg)}</div></div>`;
}
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ========== FETCH WRAPPER ========== */
async function fetchApi(path){
  const url = apiUrl(path);
  try{
    const res = await fetch(url, { headers: apiHeaders() });
    if (!res.ok) {
      const txt = await res.text().catch(()=>null);
      throw new Error(`HTTP ${res.status} ${res.statusText} ${txt || ''}`);
    }
    return await res.json();
  } catch (err) {
    // Si es error de CORS/Network, mostrar mensaje claro
    console.error('API fetch error:', err);
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error('No se pudo conectar a la API desde el navegador. Es probable que la API no permita solicitudes directas (CORS). Inicia el proxy (server.js) o activa useProxy en CONFIG.');
    }
    throw err;
  }
}

/* ========== CARGA Y RENDER ========== */
async function loadBooks(){
  try{
    showLoading('Cargando libros...');
    const res = await fetchApi(`/bibles/${CONFIG.bibleId}/books`);
    state.books = res.data || [];
    welcome.innerHTML = `<h2>Seleccione Testamento</h2><p>Elige Antiguo o Nuevo Testamento para ver los libros.</p>`;
  } catch(err){
    showError(err.message);
    console.error(err);
  }
}

/* Filtrar por testamento (lista fija de IDs para RVR) */
const OLD_IDS = ["GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI","1CH","2CH",
  "EZR","NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER","LAM","EZK","DAN","HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP","HAG","ZEC","MAL"];
function onTestamentChange(){
  const val = testamentSelect.value;
  if (!val) {
    booksSection.classList.add('hidden');
    chaptersSection.classList.add('hidden');
    welcome.innerHTML = `<h2>Bienvenido</h2><p>Seleccione Testamento → Libro → Capítulo.</p>`;
    return;
  }
  state.selectedTestament = val;
  const filtered = state.books.filter(b => val === 'old' ? OLD_IDS.includes(b.id) : !OLD_IDS.includes(b.id));
  renderBooksGrid(filtered);
  booksSection.classList.remove('hidden');
  chaptersSection.classList.add('hidden');
  chapterContent.innerHTML = `<div class="section-block"><div class="section-title">${val === 'old' ? 'Antiguo Testamento' : 'Nuevo Testamento'}</div><div>Seleccione un libro.</div></div>`;
}

function renderBooksGrid(list){
  booksGrid.innerHTML = list.map(b => `<button class="book-button" data-id="${b.id}" title="${escapeHtml(b.name)}">${escapeHtml(b.name)}</button>`).join('');
}

/* click delegado en booksGrid */
booksGrid.addEventListener('click', async (e)=>{
  const btn = e.target.closest('.book-button');
  if(!btn) return;
  // limpiar selección visual
  booksGrid.querySelectorAll('.book-button').forEach(x=>x.classList.remove('selected'));
  btn.classList.add('selected');
  const bookId = btn.dataset.id;
  const bookName = btn.textContent;
  state.selectedBook = { id: bookId, name: bookName };
  // cargar capítulos
  try{
    showLoading('Cargando capítulos...');
    const ch = await fetchApi(`/bibles/${CONFIG.bibleId}/books/${bookId}/chapters`);
    renderChapters(ch.data || []);
    chaptersSection.classList.remove('hidden');
    chapterContent.innerHTML = `<div class="section-block"><div class="section-title">${escapeHtml(bookName)}</div><div>Seleccione un capítulo.</div></div>`;
  } catch(err){
    showError(err.message);
  }
});

function renderChapters(chapters){
  chapterSelect.innerHTML = `<option value="">-- Seleccionar Capítulo --</option>`;
  chapters.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; // e.g. GEN.1
    opt.textContent = c.reference; // e.g. Génesis 1
    chapterSelect.appendChild(opt);
  });
}

/* Manejo cambio capítulo */
chapterSelect.addEventListener('change', async ()=>{
  const chapterId = chapterSelect.value;
  if(!chapterId) return;
  state.selectedChapter = chapterId;
  await displayChapter(chapterSelect.value);
});

/* Prev/Next */
document.getElementById('prevChapter').addEventListener('click', navigateChapter.bind(null, -1));
document.getElementById('nextChapter').addEventListener('click', navigateChapter.bind(null, +1));

async function navigateChapter(delta){
  // get list of options and current index
  const opts = Array.from(chapterSelect.options).filter(o=>o.value);
  const idx = opts.findIndex(o=>o.value === state.selectedChapter);
  const newIdx = (idx === -1) ? 0 : Math.min(Math.max(idx + delta, 0), opts.length -1);
  if (opts[newIdx]) {
    chapterSelect.value = opts[newIdx].value;
    state.selectedChapter = opts[newIdx].value;
    await displayChapter(state.selectedChapter);
  }
}

async function displayChapter(chapterId){
  showLoading('Cargando capítulo...');
  try{
    await fallbackRenderChapter(chapterId);
  } catch(err){
    showError(err.message);
    console.error(err);
  }
}

async function fallbackRenderChapter(chapterId){
  try{
    const chResp = await fetchApi(`/bibles/${CONFIG.bibleId}/chapters/${encodeURIComponent(chapterId)}?content-type=json`);
    const contentNodes = chResp.data.content;

    // header + body
    chapterContent.innerHTML = `
      <div class="chapter-header">
        <div class="chapter-title">Capítulo ${chapterId.split('.')[1]}</div>
        <div class="chapter-ref">${escapeHtml(state.selectedBook.name)} ${chapterId.split('.')[1]}</div>
      </div>
      <div class="chapter-body"></div>
    `;

    const area = chapterContent.querySelector('.chapter-body'); // 👈 ahora sí existe
    renderContentNodes(contentNodes, area);
  }catch(e){
    throw e;
  }
}


/* renderContentNodes: recorre nodos/content y escribe solo versos, sin enumeración extra */
function renderContentNodes(nodes, container){
  container = container || chapterContent;
  for (const node of nodes || []) {
    if (!node.items) continue;
    for (const item of node.items) {
      if (item.type === 'heading') {
        const el = document.createElement('div');
        el.className = 'section-title';
        el.textContent = item.text || '';
        container.appendChild(el);
        continue;
      }
      if (item.text) {
        let num = null;
        if (item.verse !== undefined && item.verse !== null && item.verse !== '') {
          num = String(item.verse);
        } else if (item.verseId) {
          const parts = item.verseId.split('.');
          if (parts.length >= 3) num = parts[2];
        }

        const v = document.createElement('div');
        v.className = 'verse';
        // Mostrar número de verso solo si la API lo entrega
        if (num) {
          v.innerHTML = `<span class="verse-number">${escapeHtml(num)}</span> <span class="verse-text">${escapeHtml(item.text)}</span>`;
        } else {
          v.innerHTML = `<span class="verse-text">${escapeHtml(item.text)}</span>`;
        }
        container.appendChild(v);
      }
    }
  }
}

/* ========== Accessibility controls ========== */
increaseFontBtn.addEventListener('click', () => {
  state.fontSize = Math.min(state.fontSize + 2, 28);
  document.body.style.fontSize = state.fontSize + 'px';
  localStorage.setItem('bibleFontSize', state.fontSize);
});
decreaseFontBtn.addEventListener('click', () => {
  state.fontSize = Math.max(state.fontSize - 2, 14);
  document.body.style.fontSize = state.fontSize + 'px';
  localStorage.setItem('bibleFontSize', state.fontSize);
});
toggleContrastBtn.addEventListener('click', () => {
  document.documentElement.classList.toggle('high-contrast');
});

/* ========== Init ========== */
async function init(){
  // restaurar tamaño letra
  const saved = localStorage.getItem('bibleFontSize');
  if (saved) { state.fontSize = parseInt(saved,10); document.body.style.fontSize = state.fontSize + 'px'; }

  try{
    // 1) load books
    const booksResp = await fetchApi(`/bibles/${CONFIG.bibleId}/books`);
    state.books = booksResp.data || [];
  } catch(err){
    // mostrar mensaje en UI con instrucción
    showError('No se pudo conectar a la API desde el navegador. Si ves "Failed to fetch" o errores CORS, ejecuta el proxy local (server.js) o configure useProxy en app.js. También puedes probar con Postman/cURL.');
    console.error(err);
    return;
  }

  // Wire up events
  testamentSelect.addEventListener('change', onTestamentChange);
  chapterSelect.addEventListener('change', ()=>{ /* manejador ya agregado más arriba */ });

  console.log('Libros disponibles:', state.books.length);
}

init();
