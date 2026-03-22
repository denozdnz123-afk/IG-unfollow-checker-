/* ============================================
   IG Unfollow Checker - Main Script
   ============================================ */

let followersData = null;
let followingData = null;
let currentTab = 'not-following-back';
let analysisResults = {
    notFollowingBack: [],
    fans: [],
    mutual: []
};

// Sorting
let sortState = { column: null, direction: 'asc' };

// Pagination
let currentPage = 1;
const itemsPerPage = 50;

// DOM
const zipDropzone = document.getElementById('zip-dropzone');
const zipInput = document.getElementById('zip-input');
const analyzeContainer = document.getElementById('analyze-container');
const analyzeBtn = document.getElementById('analyze-btn');
const resultsSection = document.getElementById('results-section');
const resultsBody = document.getElementById('results-body');
const searchInput = document.getElementById('search-input');
const exportBtn = document.getElementById('export-btn');
const resetBtn = document.getElementById('reset-btn');

// Navbar Scroll Logic
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// ========== Parsing ==========

function parseFollowers(json) {
    try {
        const data = JSON.parse(json);
        let entries = [];
        if (Array.isArray(data)) entries = data;
        else if (data.relationships_followers) entries = data.relationships_followers;
        else if (typeof data === 'object') {
            for (const key of Object.keys(data)) {
                if (Array.isArray(data[key])) { entries = data[key]; break; }
            }
        }
        return extractUsernames(entries);
    } catch (e) {
        throw new Error('ไม่สามารถอ่านไฟล์ followers ได้');
    }
}

function parseFollowing(json) {
    try {
        const data = JSON.parse(json);
        let entries = [];
        if (data.relationships_following) entries = data.relationships_following;
        else if (Array.isArray(data)) entries = data;
        else if (typeof data === 'object') {
            for (const key of Object.keys(data)) {
                if (Array.isArray(data[key])) { entries = data[key]; break; }
            }
        }
        return extractUsernames(entries);
    } catch (e) {
        throw new Error('ไม่สามารถอ่านไฟล์ following ได้');
    }
}

function extractUsernames(entries) {
    const users = [];
    for (const entry of entries) {
        if (entry.string_list_data && Array.isArray(entry.string_list_data)) {
            for (const item of entry.string_list_data) {
                const username = item.value || entry.title;
                if (username) users.push({ username, href: item.href || `https://www.instagram.com/${username}/`, timestamp: item.timestamp || entry.timestamp || 0 });
            }
            if (entry.string_list_data.length === 0 && entry.title) {
                users.push({ username: entry.title, href: `https://www.instagram.com/${entry.title}/`, timestamp: entry.timestamp || 0 });
            }
        } else if (entry.title) {
            users.push({ username: entry.title, href: `https://www.instagram.com/${entry.title}/`, timestamp: entry.timestamp || 0 });
        } else if (entry.value) {
            users.push({ username: entry.value, href: entry.href || `https://www.instagram.com/${entry.value}/`, timestamp: entry.timestamp || 0 });
        }
    }
    return users;
}

// ========== Dropzone ==========

function setupDropzone(dropzone, inputEl, type) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
        dropzone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); });
    });
    ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, () => dropzone.classList.add('drag-over')));
    ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, () => dropzone.classList.remove('drag-over')));
    dropzone.addEventListener('drop', e => { 
        if (dropzone.classList.contains('uploaded')) return;
        const f = e.dataTransfer.files[0]; 
        if (f) handleFile(f, type, dropzone); 
    });
    dropzone.addEventListener('click', e => { 
        if (dropzone.classList.contains('uploaded')) return;
        if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') inputEl.click(); 
    });
    inputEl.addEventListener('change', e => { 
        if (dropzone.classList.contains('uploaded')) return;
        const f = e.target.files[0]; 
        if (f) handleFile(f, type, dropzone); 
    });
}

function handleFile(file, type, dropzone) {
    if (!file.name.endsWith('.zip')) {
        showToast('❌ กรุณาเลือกไฟล์ .zip เท่านั้น');
        return;
    }
    
    dropzone.classList.remove('error', 'uploaded'); // Clear previous states
    dropzone.parentElement.classList.remove('error', 'uploaded');

    const contentEl = dropzone.querySelector('.dropzone-content');
    contentEl.innerHTML = `<span class="spinner"></span><p style="font-family:'Kanit',sans-serif;font-size:0.85rem;color:var(--text-2);margin-top:8px;">กำลังอ่านไฟล์ ZIP...</p>`;

    setTimeout(() => {
        const jsZip = new window.JSZip();
        jsZip.loadAsync(file).then(zip => {
            let followersFiles = [], followingFiles = [];
            zip.forEach((relativePath, zipEntry) => {
                if (zipEntry.name.match(/followers(_\d+)?\.json/i)) followersFiles.push(zipEntry);
                else if (zipEntry.name.match(/following\.json/i) && !zipEntry.name.includes('channels')) followingFiles.push(zipEntry);
            });

            if (followersFiles.length === 0 || followingFiles.length === 0)
                throw new Error('ไม่พบข้อมูลผู้ติดตาม/กำลังติดตาม ในไฟล์ ZIP นี้');

            return Promise.all([
                Promise.all(followersFiles.map(e => e.async('string').then(parseFollowers))),
                Promise.all(followingFiles.map(e => e.async('string').then(parseFollowing)))
            ]);
        }).then(results => {
            followersData = results[0].flat();
            followingData = results[1].flat();
            showUploadSuccess(dropzone, `โหลดสำเร็จ! ผู้ติดตาม ${followersData.length} · กำลังติดตาม ${followingData.length}`);
        }).catch(err => {
            dropzone.classList.add('error');
            dropzone.parentElement.classList.add('error');
            contentEl.innerHTML = `
                <div class="dz-icon-wrap" style="background:rgba(255,68,102,0.1);color:var(--danger);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <p style="font-family:'Kanit',sans-serif;font-size:0.85rem;color:var(--danger);">${err.message}</p>
                <label class="upload-btn" for="zip-input">ลองใหม่</label>
                <input type="file" id="zip-input" accept=".zip" hidden>`;
            const newInput = document.getElementById('zip-input');
            newInput.addEventListener('change', e => { const f = e.target.files[0]; if (f) handleFile(f, 'zip', dropzone); });
        });
    }, 60);
}

function showUploadSuccess(dropzone, msg) {
    const contentEl = dropzone.querySelector('.dropzone-content');
    const successEl = dropzone.querySelector('.dropzone-success');
    contentEl.hidden = true;
    successEl.hidden = false;
    document.getElementById('zip-success-msg').textContent = msg;
    dropzone.classList.add('uploaded');
    dropzone.parentElement.classList.add('uploaded');
    analyzeContainer.hidden = false;
}

// ========== Analyze ==========

function analyze() {
    if (!followersData || !followingData) return;

    const followersSet = new Set(followersData.map(u => u.username.toLowerCase()));
    const followingSet = new Set(followingData.map(u => u.username.toLowerCase()));

    analysisResults.notFollowingBack = followingData.filter(u => !followersSet.has(u.username.toLowerCase()));
    analysisResults.fans = followersData.filter(u => !followingSet.has(u.username.toLowerCase()));
    analysisResults.mutual = followingData.filter(u => followersSet.has(u.username.toLowerCase()));

    document.getElementById('stat-following').textContent = followingData.length;
    document.getElementById('stat-followers').textContent = followersData.length;
    document.getElementById('stat-not-following-back').textContent = analysisResults.notFollowingBack.length;
    document.getElementById('stat-fans').textContent = analysisResults.fans.length;
    document.getElementById('tab-count-nfb').textContent = analysisResults.notFollowingBack.length;
    document.getElementById('tab-count-fans').textContent = analysisResults.fans.length;
    document.getElementById('tab-count-mutual').textContent = analysisResults.mutual.length;

    resultsSection.hidden = false;
    renderTable(analysisResults.notFollowingBack);
    animateStats();
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ========== Sorting ==========

function sortData(data) {
    if (!sortState.column) return data;
    const sorted = [...data];
    const dir = sortState.direction === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
        if (sortState.column === 'username') {
            return dir * a.username.localeCompare(b.username);
        } else if (sortState.column === 'date') {
            return dir * ((a.timestamp || 0) - (b.timestamp || 0));
        }
        return 0;
    });
    return sorted;
}

function toggleSort(column) {
    if (sortState.column === column) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.column = column;
        sortState.direction = 'asc';
    }
    currentPage = 1;
    updateSortIndicators();
    const map = { 'not-following-back': 'notFollowingBack', fans: 'fans', mutual: 'mutual' };
    renderTable(analysisResults[map[currentTab]], searchInput.value);
}

function updateSortIndicators() {
    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === sortState.column) {
            th.classList.add(sortState.direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });
}

// ========== Render ==========

function renderTable(data, filter = '') {
    const noResults = document.getElementById('no-results');
    resultsBody.innerHTML = '';

    let filtered = filter
        ? data.filter(u => u.username.toLowerCase().includes(filter.toLowerCase()))
        : [...data];

    // Apply sorting
    filtered = sortData(filtered);

    if (filtered.length === 0) {
        noResults.hidden = false;
        renderPagination(0);
        return;
    }
    noResults.hidden = true;

    // Pagination
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * itemsPerPage;
    const pageData = filtered.slice(startIdx, startIdx + itemsPerPage);

    const fragment = document.createDocumentFragment();
    pageData.forEach((user, index) => {
        const globalIndex = startIdx + index;
        const tr = document.createElement('tr');
        const delay = Math.min(index * 25, 600);
        tr.style.opacity = '0';
        tr.style.animation = `fadeInUp 0.4s cubic-bezier(0.25, 1, 0.5, 1) ${delay}ms forwards`;
        tr.innerHTML = `
            <td class="td-n">${globalIndex + 1}</td>
            <td class="td-username">${escapeHtml(user.username)}</td>
            <td class="td-date">${formatDate(user.timestamp)}</td>
            <td class="td-link"><a href="${escapeHtml(user.href)}" target="_blank" rel="noopener noreferrer">เปิด IG ↗</a></td>`;
        fragment.appendChild(tr);
    });
    resultsBody.appendChild(fragment);
    renderPagination(filtered.length);
}

// ========== Pagination ==========

function renderPagination(totalItems) {
    const container = document.getElementById('pagination');
    if (!container) return;
    container.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return;

    const nav = document.createElement('div');
    nav.className = 'pagination-inner';

    // Info text
    const info = document.createElement('span');
    info.className = 'page-info';
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);
    info.textContent = `${start}-${end} จาก ${totalItems}`;
    nav.appendChild(info);

    const btnsWrap = document.createElement('div');
    btnsWrap.className = 'page-btns';

    // Prev
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn' + (currentPage === 1 ? ' disabled' : '');
    prevBtn.innerHTML = '‹';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
    btnsWrap.appendChild(prevBtn);

    // Page numbers — show smart range
    const pages = getPageRange(currentPage, totalPages);
    pages.forEach(p => {
        if (p === '...') {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '…';
            btnsWrap.appendChild(ellipsis);
        } else {
            const btn = document.createElement('button');
            btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
            btn.textContent = p;
            btn.addEventListener('click', () => goToPage(p));
            btnsWrap.appendChild(btn);
        }
    });

    // Next
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn' + (currentPage === totalPages ? ' disabled' : '');
    nextBtn.innerHTML = '›';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => goToPage(currentPage + 1));
    btnsWrap.appendChild(nextBtn);

    nav.appendChild(btnsWrap);
    container.appendChild(nav);
}

function getPageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        pages.push(i);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
}

function goToPage(page) {
    currentPage = page;
    const map = { 'not-following-back': 'notFollowingBack', fans: 'fans', mutual: 'mutual' };
    renderTable(analysisResults[map[currentTab]], searchInput.value);
    document.querySelector('.table-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function formatDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function animateStats() {
    document.querySelectorAll('.stat-val').forEach(el => {
        const target = parseInt(el.textContent);
        if (isNaN(target) || target === 0) return;
        let current = 0;
        const step = Math.max(1, Math.floor(target / 28));
        const interval = setInterval(() => {
            current = Math.min(current + step, target);
            el.textContent = current;
            if (current >= target) clearInterval(interval);
        }, 30);
    });
}

// ========== Tabs ==========

function switchTab(tab) {
    currentTab = tab;
    currentPage = 1;
    sortState = { column: null, direction: 'asc' };
    updateSortIndicators();
    document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    searchInput.value = '';
    const map = { 'not-following-back': 'notFollowingBack', fans: 'fans', mutual: 'mutual' };
    renderTable(analysisResults[map[tab]]);
}

// ========== Export ==========

function getExportData() {
    const map = { 'not-following-back': { data: analysisResults.notFollowingBack, label: 'ไม่ฟอลกลับ' }, fans: { data: analysisResults.fans, label: 'แฟนคลับ' }, mutual: { data: analysisResults.mutual, label: 'ฟอลกันทั้งคู่' } };
    return map[currentTab];
}

function exportResults() {
    const { data, label } = getExportData();
    if (!data || data.length === 0) { showToast('ไม่มีข้อมูลให้คัดลอก'); return; }

    const text = `=== ${label} (${data.length} คน) ===\n\n` + data.map((u, i) => `${i + 1}. @${u.username}`).join('\n');
    navigator.clipboard.writeText(text).then(() => showToast('✅ คัดลอกรายชื่อแล้ว!')).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('✅ คัดลอกรายชื่อแล้ว!');
    });
}

function exportCSV() {
    const { data, label } = getExportData();
    if (!data || data.length === 0) { showToast('ไม่มีข้อมูลให้ดาวน์โหลด'); return; }
    const bom = '\uFEFF';
    const header = '#,ชื่อผู้ใช้,วันที่ติดตาม,ลิงก์\n';
    const rows = data.map((u, i) => `${i + 1},${u.username},${formatDate(u.timestamp)},${u.href}`).join('\n');
    downloadFile(bom + header + rows, `ig-${label}.csv`, 'text/csv;charset=utf-8');
    showToast('✅ ดาวน์โหลด CSV แล้ว!');
}

function exportTXT() {
    const { data, label } = getExportData();
    if (!data || data.length === 0) { showToast('ไม่มีข้อมูลให้ดาวน์โหลด'); return; }
    const text = `=== ${label} (${data.length} คน) ===\n\n` + data.map((u, i) => `${i + 1}. @${u.username} — ${formatDate(u.timestamp)}`).join('\n');
    downloadFile(text, `ig-${label}.txt`, 'text/plain;charset=utf-8');
    showToast('✅ ดาวน์โหลด TXT แล้ว!');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ========== Reset ==========

function resetAll() {
    followersData = followingData = null;
    analysisResults = { notFollowingBack: [], fans: [], mutual: [] };
    currentTab = 'not-following-back';
    currentPage = 1;
    sortState = { column: null, direction: 'asc' };

    const dz = zipDropzone;
    dz.querySelector('.dropzone-content').innerHTML = `
        <div class="dz-icon-wrap"><div class="dz-icon-glow"></div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <h3>วางไฟล์ .zip ตรงนี้</h3>
        <p>ลากมาวาง หรือกดปุ่มด้านล่าง</p>
        <label class="upload-btn" for="zip-input">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            เลือกไฟล์ ZIP
        </label>
        <input type="file" id="zip-input" accept=".zip" hidden>
        <p class="dz-note">รองรับเฉพาะไฟล์ .zip จาก Instagram เท่านั้น</p>`;

    const newInput = document.getElementById('zip-input');
    newInput.addEventListener('change', e => { const f = e.target.files[0]; if (f) handleFile(f, 'zip', zipDropzone); });

    dz.querySelector('.dropzone-content').hidden = false;
    dz.querySelector('.dropzone-success').hidden = true;
    dz.classList.remove('uploaded', 'error');
    dz.parentElement.classList.remove('uploaded', 'error');
    zipInput.value = '';
    analyzeContainer.hidden = true;
    resultsSection.hidden = true;
    searchInput.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== Toast ==========

function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3000);
}

// ========== FAQ Toggle ==========

function initFAQ() {
    document.querySelectorAll('.faq-question').forEach(q => {
        q.addEventListener('click', () => {
            const item = q.parentElement;
            const isOpen = item.classList.contains('open');
            // Close all
            document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
            // Toggle clicked
            if (!isOpen) item.classList.add('open');
        });
    });
}

// ========== Init ==========

setupDropzone(zipDropzone, zipInput, 'zip');
analyzeBtn.addEventListener('click', analyze);
document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
searchInput.addEventListener('input', e => {
    currentPage = 1;
    const map = { 'not-following-back': 'notFollowingBack', fans: 'fans', mutual: 'mutual' };
    renderTable(analysisResults[map[currentTab]], e.target.value);
});
exportBtn.addEventListener('click', exportResults);
resetBtn.addEventListener('click', resetAll);

// Sorting
document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => toggleSort(th.dataset.sort));
});

// Export buttons
const csvBtn = document.getElementById('export-csv-btn');
const txtBtn = document.getElementById('export-txt-btn');
if (csvBtn) csvBtn.addEventListener('click', exportCSV);
if (txtBtn) txtBtn.addEventListener('click', exportTXT);

// FAQ
initFAQ();
