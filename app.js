/**
 * app.js (actualizado)
 * Soporta selects o botones para testamento/capítulos.
 */

/* ========== CONFIG ========== */
const CONFIG = {
  baseUrl: 'https://api.scripture.api.bible/v1',
  bibleId: '592420522e16049f-01',
  useProxy: false,
  proxyBase: `${location.protocol}//${location.hostname}:3000`
};

const API_KEY = '5f4613ad10d1a15014f6488c1b309a09';

/* ========== DOM refs (soporta ambas variantes) ========== */
const testamentSelect = document.getElementById('testamentSelect'); // optional
const oldTestamentBtn = document.getElementById('oldTestamentBtn'); // optional (buttons)
const newTestamentBtn = document.getElementById('newTestamentBtn'); // optional (buttons)

const booksSection = document.getElementById('booksSection');
const booksGrid = document.getElementById('booksGrid');

const chaptersSection = document.getElementById('chaptersSection');
const chapterSelect = document.getElementById('chapterSelect'); // optional (select fallback)
const chaptersGrid = document.getElementById('chaptersGrid'); // optional (buttons)
const prevChapterBtn = document.getElementById('prevChapter');
const nextChapterBtn = document.getElementById('nextChapter');

const chapterContent = document.getElementById('chapterContent');
const welcome = document.getElementById('welcome');

const increaseFontBtn = document.getElementById('increaseFont');
const decreaseFontBtn = document.getElementById('decreaseFont');
const toggleContrastBtn = document.getElementById('toggleContrast');

let state = {
  books: [],
  chapters: [],           // listado de capítulos para el libro seleccionado
  selectedTestament: null,
  selectedBook: null,
  selectedChapter: null,  // chapterId (ej. "GEN.1")
  fontSize: parseInt(getComputedStyle(document.body).fontSize,10)
};

/* ========== HELPERS ========== */
function apiUrl(path){
  if (CONFIG.useProxy) return `${CONFIG.proxyBase}${path}`;
  return `${CONFIG.baseUrl}${path}`;
}
function apiHeaders(){
  return { 'api-key': API_KEY, 'accept': 'application/json' };
}
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showError(msg){
  chapterContent.innerHTML = `<div class="section-block"><div class="section-title">Error</div><div>${escapeHtml(msg)}</div></div>`;
}
function showLoading(msg='Cargando...'){
  chapterContent.innerHTML = `<div class="section-block"><div class="section-title">${escapeHtml(msg)}</div></div>`;
}

/* ========== FETCH WRAPPER ========== */
async function fetchApi(path){
  const url = apiUrl(path);
  try {
    const res = await fetch(url, { headers: apiHeaders() });
    if (!res.ok) {
      const txt = await res.text().catch(()=>null);
      throw new Error(`HTTP ${res.status} ${res.statusText} ${txt || ''}`);
    }
    return await res.json();
  } catch (err) {
    console.error('API fetch error:', err);
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error('No se pudo conectar a la API desde el navegador. Es probable que la API no permita solicitudes directas (CORS). Inicia el proxy local o activa useProxy.');
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

/* lista fija para dividir testamentos (RVR ids) */
const OLD_IDS = ["GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI","1CH","2CH",
  "EZR","NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER","LAM","EZK","DAN","HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP","HAG","ZEC","MAL"];

function showTestament(t){
  // llamada común para select o botones
  state.selectedTestament = t;
  const filtered = state.books.filter(b => t === 'old' ? OLD_IDS.includes(b.id) : !OLD_IDS.includes(b.id));
  renderBooksGrid(filtered);
  booksSection.classList.remove('hidden');
  chaptersSection.classList.add('hidden');
  chapterContent.innerHTML = `<div class="section-block"><div class="section-title">${t === 'old' ? 'Antiguo Testamento' : 'Nuevo Testamento'}</div><div>Seleccione un libro.</div></div>`;

  // UI visual si usas botones de testamento
  if (oldTestamentBtn && newTestamentBtn) {
    oldTestamentBtn.classList.toggle('selected', t === 'old');
    newTestamentBtn.classList.toggle('selected', t === 'new');
  }
}

/* si existe select, sigue soportándolo */
function onTestamentChange(){
  if (!testamentSelect) return;
  const val = testamentSelect.value;
  if (!val) {
    booksSection.classList.add('hidden');
    chaptersSection.classList.add('hidden');
    welcome.innerHTML = `<h2>Bienvenido</h2><p>Seleccione Testamento → Libro → Capítulo.</p>`;
    return;
  }
  showTestament(val);
}

/* Render libros (botones ya existentes en tu CSS) */
function renderBooksGrid(list){
  booksGrid.innerHTML = list.map(b => `<button class="book-button" data-id="${b.id}" title="${escapeHtml(b.name)}">${escapeHtml(b.name)}</button>`).join('');
}

/* click delegado en booksGrid (ya lo tenías) */
booksGrid.addEventListener('click', async (e) => {
  const btn = e.target.closest('.book-button');
  if (!btn) return;
  booksGrid.querySelectorAll('.book-button').forEach(x => x.classList.remove('selected'));
  btn.classList.add('selected');

  const bookId = btn.dataset.id;
  const bookName = btn.textContent;
  state.selectedBook = { id: bookId, name: bookName };
  // cargar capítulos del libro (guardamos en state.chapters)
  try{
    showLoading('Cargando capítulos...');
    const chResp = await fetchApi(`/bibles/${CONFIG.bibleId}/books/${bookId}/chapters`);
    const chapters = chResp.data || [];
    state.chapters = chapters;
    renderChapters(chapters);
    chaptersSection.classList.remove('hidden');
    chapterContent.innerHTML = `<div class="section-block"><div class="section-title">${escapeHtml(bookName)}</div><div>Seleccione un capítulo.</div></div>`;
  } catch(err){
    showError(err.message);
  }
});

/* Render capítulos: soporta dos salidas:
   - si existe chaptersGrid -> render como botones
   - else fallback a chapterSelect (select HTML)
*/
function renderChapters(chapters){
  // clear previous selection
  state.selectedChapter = null;

  if (chaptersGrid) {
    chaptersGrid.innerHTML = chapters.map((c, idx) => {
      // label: prefer number, else reference, else id
      const label = c.number || c.reference || c.id;
      return `<button class="chap-button" data-id="${c.id}" data-idx="${idx}" title="${escapeHtml(c.reference || c.id)}">${escapeHtml(String(label))}</button>`;
    }).join('');
    // attach delegated listener if not attached
    // (we attach below in init to avoid duplicates)
  } else if (chapterSelect) {
    chapterSelect.innerHTML = `<option value="">-- Seleccionar Capítulo --</option>`;
    chapters.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.reference || c.number || c.id;
      chapterSelect.appendChild(opt);
    });
  }
}

/* click delegado en chaptersGrid (botones de capítulos) */
if (chaptersGrid) {
  chaptersGrid.addEventListener('click', async (e) => {
    const btn = e.target.closest('.chap-button');
    if (!btn) return;
    // visual
    chaptersGrid.querySelectorAll('.chap-button').forEach(x => x.classList.remove('selected'));
    btn.classList.add('selected');

    const chapterId = btn.dataset.id;
    state.selectedChapter = chapterId;
    await displayChapter(chapterId);
  });
}

/* fallback: si existe select, escucha cambios */
if (chapterSelect) {
  chapterSelect.addEventListener('change', async () => {
    const chapterId = chapterSelect.value;
    if (!chapterId) return;
    state.selectedChapter = chapterId;
    await displayChapter(chapterId);
  });
}

/* Prev/Next ahora usa state.chapters[] */
async function navigateChapter(delta){
  const chapters = state.chapters || [];
  if (!chapters.length) return;
  const idx = chapters.findIndex(c => c.id === state.selectedChapter);
  // si no hay seleccionado, seleccionar el primero
  const base = idx === -1 ? 0 : idx;
  const newIdx = Math.min(Math.max(base + delta, 0), chapters.length - 1);
  const newChapter = chapters[newIdx];
  if (!newChapter) return;
  state.selectedChapter = newChapter.id;

  // actualizar UI visual
  if (chaptersGrid) {
    chaptersGrid.querySelectorAll('.chap-button').forEach(x => x.classList.remove('selected'));
    const btn = chaptersGrid.querySelector(`.chap-button[data-id="${CSS.escape(newChapter.id)}"]`);
    if (btn) btn.classList.add('selected');
  } else if (chapterSelect) {
    chapterSelect.value = newChapter.id;
  }

  await displayChapter(newChapter.id);
}

/* Wire prev/next */
if (prevChapterBtn) prevChapterBtn.addEventListener('click', () => navigateChapter(-1));
if (nextChapterBtn) nextChapterBtn.addEventListener('click', () => navigateChapter(+1));

/* displayChapter */
async function displayChapter(chapterId){
  showLoading('Cargando capítulo...');
  try{
    await fallbackRenderChapter(chapterId);
  } catch(err){
    showError(err.message);
    console.error(err);
  }
}

/* fallbackRenderChapter: trae chapter (json) y pinta en chapterContent */
async function fallbackRenderChapter(chapterId){
  try{
    const chResp = await fetchApi(`/bibles/${CONFIG.bibleId}/chapters/${encodeURIComponent(chapterId)}?content-type=json`);
    const contentNodes = chResp.data.content || [];

    chapterContent.innerHTML = `
      <div class="chapter-header">
        <div class="chapter-title">Capítulo ${chapterId.split('.')[1]}</div>
        <div class="chapter-ref">${escapeHtml(state.selectedBook ? state.selectedBook.name : '')} ${chapterId.split('.')[1]}</div>
      </div>
      <div class="chapter-body"></div>
    `;

    const area = chapterContent.querySelector('.chapter-body');
    renderContentNodes(contentNodes, area);
  }catch(e){
    throw e;
  }
}

/* renderContentNodes: pinta headings y versos dentro del contenedor dado */
function renderContentNodes(nodes, container){
  container = container || chapterContent;
  container.innerHTML = ''; // limpiar antes
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

        // crear un párrafo simple (mejor para columnas / lectura)
        const p = document.createElement('p');
        p.className = 'verse';
        if (num) {
          const spanNum = document.createElement('span');
          spanNum.className = 'verse-number';
          spanNum.textContent = num + ' ';
          p.appendChild(spanNum);
        }
        const spanText = document.createElement('span');
        spanText.className = 'verse-text';
        spanText.textContent = item.text;
        p.appendChild(spanText);

        container.appendChild(p);
      }
    }
  }
}

/* ========== Accessibility controls (simple) ========== */
function setFontSize(size) {
  const min = 12;
  const max = 36;
  const newSize = Math.min(Math.max(size, min), max);
  state.fontSize = newSize;
  document.documentElement.style.setProperty('--base-font', `${newSize}px`);
  localStorage.setItem('bibleFontSize', newSize);
}

if (increaseFontBtn) increaseFontBtn.addEventListener('click', () => setFontSize(state.fontSize + 2));
if (decreaseFontBtn) decreaseFontBtn.addEventListener('click', () => setFontSize(state.fontSize - 2));
if (toggleContrastBtn) toggleContrastBtn.addEventListener('click', () => document.documentElement.classList.toggle('high-contrast'));

/* ========== Init ========== */
async function init(){
  // restaurar tamaño letra
  try {
    const saved = localStorage.getItem('bibleFontSize');
    if (saved) setFontSize(parseInt(saved,10));
    else setFontSize(state.fontSize || 18);
  } catch(e) {}

  // Wire testament controls (buttons OR select)
  if (oldTestamentBtn && newTestamentBtn) {
    oldTestamentBtn.addEventListener('click', () => showTestament('old'));
    newTestamentBtn.addEventListener('click', () => showTestament('new'));
  } else if (testamentSelect) {
    testamentSelect.addEventListener('change', onTestamentChange);
  }

  // If using chaptersGrid, ensure click listener already attached (we attached earlier).
  // If using chapterSelect, listener attached earlier too.

  // Load books once
  try{
    const booksResp = await fetchApi(`/bibles/${CONFIG.bibleId}/books`);
    state.books = booksResp.data || [];
  } catch(err){
    showError('No se pudo conectar a la API desde el navegador. Si ves "Failed to fetch" o errores CORS, ejecuta el proxy local o configure useProxy.');
    console.error(err);
    return;
  }

  console.log('Init complete. Books loaded:', state.books.length);
}

init();
