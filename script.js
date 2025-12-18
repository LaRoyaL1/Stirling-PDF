// DOM Elements - عناصر الصفحة
const usernameInput = document.getElementById('usernameInput');
const searchBtn = document.getElementById('searchBtn');
const statusMessage = document.getElementById('statusMessage');
const resultsContainer = document.getElementById('resultsContainer');
const resultsTitle = document.getElementById('resultsTitle');
const resultsCount = document.getElementById('resultsCount');
const snapsGrid = document.getElementById('snapsGrid');
const paginationContainer = document.getElementById('paginationContainer');
const mediaModal = document.getElementById('mediaModal');
const modalMediaContainer = document.getElementById('modalMediaContainer');
const closeModal = document.querySelector('.close');

// متغيرات الصفحات
let allSnaps = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 20;

// متغيرات اختيار الفيديوهات للدمج
let selectedSnaps = [];

/// دالة لتحديث زر التحميل العائم
function updateMergeButton() {
    let mergeBtn = document.getElementById('mergeFloatingBtn');
    
    // عدد جميع الملفات المختارة (فيديو + صور)
    const totalSelected = selectedSnaps.length;
    
    if (totalSelected >= 1) {
        if (!mergeBtn) {
            mergeBtn = document.createElement('div');
            mergeBtn.id = 'mergeFloatingBtn';
            mergeBtn.className = 'merge-floating-btn';
            mergeBtn.innerHTML = `
                <span class="merge-count">${totalSelected}</span>
                <span class="merge-text">تحميل الملفات</span>
                <span class="merge-icon">📦</span>
            `;
            mergeBtn.onclick = mergeSelectedVideos;
            document.body.appendChild(mergeBtn);
        } else {
            mergeBtn.querySelector('.merge-count').textContent = totalSelected;
            mergeBtn.querySelector('.merge-text').textContent = totalSelected === 1 ? 'تحميل الملف' : `تحميل ${totalSelected} ملفات`;
        }
        mergeBtn.classList.add('show');
    } else if (mergeBtn) {
        mergeBtn.classList.remove('show');
    }
}

/// دالة لتبديل اختيار السنابة
function toggleSnapSelection(snap, checkbox) {
    const index = selectedSnaps.findIndex(s => s.url === snap.url);
    
    if (index > -1) {
        selectedSnaps.splice(index, 1);
        checkbox.classList.remove('checked');
    } else {
        selectedSnaps.push(snap);
        checkbox.classList.add('checked');
    }
    
    updateMergeButton();
}

/// دالة لتحميل جميع الملفات المختارة كـ ZIP
async function mergeSelectedVideos() {
    if (selectedSnaps.length < 1) {
        showStatus('الرجاء اختيار ملف واحد على الأقل', 'error');
        return;
    }
    
    // تعطيل الزر أثناء التحميل
    const mergeBtn = document.getElementById('mergeFloatingBtn');
    if (mergeBtn) {
        mergeBtn.style.pointerEvents = 'none';
        mergeBtn.querySelector('.merge-text').textContent = 'جاري التحميل...';
    }
    
    const totalFiles = selectedSnaps.length;
    showStatus(`جاري تحميل ${totalFiles} ملفات...`, 'info');
    
    try {
        // إنشاء ملف ZIP
        const zip = new JSZip();
        
        // تحميل كل ملف وإضافته للـ ZIP
        for (let i = 0; i < selectedSnaps.length; i++) {
            const snap = selectedSnaps[i];
            const isVideo = snap.type === 'video';
            
            showStatus(`جاري تحميل ${isVideo ? 'الفيديو' : 'الصورة'} ${i + 1} من ${totalFiles}...`, 'info');
            
            try {
                // تحميل الملف عبر proxy
                const response = await fetch(getProxyUrl(snap.url));
                if (!response.ok) throw new Error('Proxy failed');
                const blob = await response.blob();
                
                // تحديد الامتداد
                let ext = isVideo ? 'mp4' : 'jpg';
                if (blob.type.includes('mp4')) ext = 'mp4';
                else if (blob.type.includes('webm')) ext = 'webm';
                else if (blob.type.includes('mov')) ext = 'mov';
                else if (blob.type.includes('png')) ext = 'png';
                else if (blob.type.includes('gif')) ext = 'gif';
                else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) ext = 'jpg';
                
                // إضافة الملف للـ ZIP
                const fileName = `snapchat_${isVideo ? 'video' : 'image'}_${i + 1}.${ext}`;
                zip.file(fileName, blob);
                
            } catch (e) {
                console.error('Error downloading file:', e);
                showStatus(`فشل تحميل الملف ${i + 1}، جاري المتابعة...`, 'info');
            }
        }
        
        showStatus('جاري إنشاء ملف ZIP...', 'info');
        
        // إنشاء ملف ZIP وتحميله
        const zipBlob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        }, (metadata) => {
            showStatus(`جاري الضغط... ${Math.round(metadata.percent)}%`, 'info');
        });
        
        // تحميل ملف ZIP
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `snapchat_${totalFiles}_files_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        showStatus(`تم تحميل ${totalFiles} ملفات في ملف ZIP بنجاح! ✅`, 'success');
        
        // إلغاء الاختيار
        clearSelection();
        
    } catch (error) {
        console.error('Download error:', error);
        showStatus('حدث خطأ: ' + error.message, 'error');
    } finally {
        // إعادة تفعيل الزر
        if (mergeBtn) {
            mergeBtn.style.pointerEvents = 'auto';
            mergeBtn.querySelector('.merge-text').textContent = 'تحميل الملفات';
        }
    }
}

/// دالة لإلغاء جميع الاختيارات
function clearSelection() {
    selectedSnaps = [];
    document.querySelectorAll('.snap-checkbox.checked').forEach(cb => {
        cb.classList.remove('checked');
    });
    updateMergeButton();
}

/// دالة للحصول على رابط الوسائط عبر الـ proxy لتجاوز CORS
function getProxyUrl(originalUrl) {
    return `/api/proxy?url=${encodeURIComponent(originalUrl)}`;
}

/// دالة للكشف عن نوع الوسائط من السيرفر
async function detectMediaTypeFromServer(url) {
    try {
        const response = await fetch(`/api/detect-type?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        return data.type || 'image';
    } catch (error) {
        console.error('Error detecting media type:', error);
        return null;
    }
}

// عناصر البحث برابط
const snapLinkInput = document.getElementById('snapLinkInput');
const linkSearchBtn = document.getElementById('linkSearchBtn');
const searchTabs = document.querySelectorAll('.search-tab');
const searchContents = document.querySelectorAll('.search-content');

// متغير لتحديد إذا كان البحث عن سنابة واحدة
let isSingleSnapSearch = false;

// Event Listeners
searchBtn.addEventListener('click', handleSearch);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

// Event Listeners للبحث برابط
if (linkSearchBtn) {
    linkSearchBtn.addEventListener('click', handleLinkSearch);
}
if (snapLinkInput) {
    snapLinkInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLinkSearch();
        }
    });
}

// تبديل التبويبات
searchTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // تحديث التبويبات
        searchTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // تحديث المحتوى
        document.getElementById('usernameSearch').classList.remove('active');
        document.getElementById('linkSearch').classList.remove('active');
        
        if (tabName === 'username') {
            document.getElementById('usernameSearch').classList.add('active');
        } else {
            document.getElementById('linkSearch').classList.add('active');
        }
    });
});

/// دالة البحث برابط سنابة
async function handleLinkSearch() {
    const link = snapLinkInput.value.trim();
    
    if (!link) {
        showStatus('الرجاء إدخال رابط السنابة', 'error');
        return;
    }
    
    // التحقق من صيغة الرابط
    if (!link.includes('snapchat.com')) {
        showStatus('الرجاء إدخال رابط سناب شات صحيح', 'error');
        return;
    }
    
    setLinkLoadingState(true);
    hideStatus();
    resultsContainer.style.display = 'none';
    
    try {
        // جلب السنابة المحددة أولاً
        showStatus('جاري تحميل السنابة المحددة...', 'info');
        
        const response = await fetch('/api/snap-link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ link })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success || !data.snap) {
            throw new Error(data.error || 'لم يتم العثور على السنابة');
        }
        
        const mainSnap = data.snap;
        mainSnap.isMainSnap = true; // علامة للسنابة الرئيسية
        const username = data.username;
        
        // إذا وجدنا اسم المستخدم، نجلب باقي سناباته
        if (username) {
            showStatus(`جاري تحميل سنابات @${username}...`, 'info');
            
            try {
                const userResponse = await fetch(`/api/snaps/${username}`);
                const userData = await userResponse.json();
                
                if (userData.success && userData.snaps && userData.snaps.length > 0) {
                    // عرض السنابة الرئيسية مع باقي السنابات (سريع بدون فلترة)
                    displaySnapsWithMainFirst(username, userData.snaps, mainSnap);
                    showStatus(`تم تحميل السنابة و ${allSnaps.length - 1} سنابات أخرى!`, 'success');
                } else {
                    // عرض السنابة المحددة فقط
                    displaySingleSnap(mainSnap, username);
                    showStatus('تم تحميل السنابة بنجاح!', 'success');
                }
            } catch (e) {
                // عرض السنابة المحددة فقط في حالة الخطأ
                displaySingleSnap(mainSnap, username);
                showStatus('تم تحميل السنابة بنجاح!', 'success');
            }
        } else {
            // عرض السنابة المحددة فقط
            displaySingleSnap(mainSnap, null);
            showStatus('تم تحميل السنابة بنجاح!', 'success');
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus(error.message || 'فشل في تحميل السنابة', 'error');
    } finally {
        setLinkLoadingState(false);
    }
}

/// دالة لعرض السنابات مع السنابة الرئيسية أولاً (بدون فلترة بطيئة)
function displaySnapsWithMainFirst(username, snaps, mainSnap) {
    // تحديد أنه بحث متعدد
    isSingleSnapSearch = false;
    
    resultsTitle.textContent = `@${username}`;
    snapsGrid.innerHTML = '';
    resultsContainer.style.display = 'block';
    
    // إضافة السنابة الرئيسية في البداية
    let allSnapsToShow = [...snaps];
    
    // التحقق إذا كانت السنابة الرئيسية موجودة بالفعل
    const mainSnapId = mainSnap.url ? mainSnap.url.split('?')[0].split('/').pop() : '';
    const mainIndex = allSnapsToShow.findIndex(s => {
        const snapId = s.url ? s.url.split('?')[0].split('/').pop() : '';
        return snapId === mainSnapId;
    });
    
    if (mainIndex >= 0) {
        // نقل السنابة الرئيسية للأول
        const [snap] = allSnapsToShow.splice(mainIndex, 1);
        snap.isMainSnap = true;
        allSnapsToShow.unshift(snap);
    } else {
        // إضافة السنابة الرئيسية في البداية
        allSnapsToShow.unshift(mainSnap);
    }
    
    // تحديث العداد
    resultsCount.textContent = `${allSnapsToShow.length} سناب`;
    
    // حفظ السنابات للـ pagination
    allSnaps = allSnapsToShow;
    currentPage = 1;
    
    // عرض السنابات
    const endIndex = Math.min(SNAPS_PER_PAGE, allSnapsToShow.length);
    const totalPages = Math.ceil(allSnapsToShow.length / SNAPS_PER_PAGE);
    
    for (let i = 0; i < endIndex; i++) {
        const card = createSnapCard(allSnapsToShow[i], i);
        snapsGrid.appendChild(card);
    }
    
    displayPagination(totalPages);
    
    // إعادة تعيين الاختيارات
    selectedSnaps = [];
    updateFloatingButton();
    
    setTimeout(() => {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

/// دالة لعرض سنابة مفردة مع زر لعرض جميع السنابات
async function displaySingleSnap(snap, username) {
    // تحديد أنه بحث عن سنابة واحدة
    isSingleSnapSearch = true;
    
    resultsTitle.textContent = username ? `@${username}` : 'سنابة';
    resultsCount.textContent = 'سنابة واحدة';
    
    snapsGrid.innerHTML = '';
    
    // استخدام النوع المرسل من السيرفر (تم التحقق منه عبر Content-Type)
    // أو فحص الرابط كـ fallback
    if (snap.type !== 'video' && snap.type !== 'image') {
        const url = snap.url.toLowerCase();
        // روابط الفيديو في Snapchat CDN تحتوي على /i/ أو .1034.
        if (url.includes('cf-st.sc-cdn.net/i/') || 
            url.includes('.1034.') || 
            url.includes('/video/') ||
            url.includes('.mp4')) {
            snap.type = 'video';
        } else {
            snap.type = 'image';
        }
    }
    
    console.log('Single snap type:', snap.type, 'URL:', snap.url);
    
    // إنشاء البطاقة
    snap.isMainSnap = true;
    const card = createSnapCard(snap, 0);
    snapsGrid.appendChild(card);
    
    // إضافة زر لعرض جميع سنابات اليوزر
    if (username) {
        const viewAllContainer = document.createElement('div');
        viewAllContainer.className = 'view-all-snaps-container';
        viewAllContainer.innerHTML = `
            <div class="view-all-divider">
                <span>هل تريد مشاهدة المزيد؟</span>
            </div>
            <button class="view-all-snaps-btn" onclick="loadAllUserSnaps('${username}')">
                📂 عرض جميع سنابات @${username} (آخر ${MAX_DAYS_OLD} أيام)
            </button>
        `;
        snapsGrid.appendChild(viewAllContainer);
    }
    
    // إخفاء الـ pagination
    paginationContainer.style.display = 'none';
    
    resultsContainer.style.display = 'block';
    
    setTimeout(() => {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

/// دالة لتحميل جميع سنابات اليوزر
async function loadAllUserSnaps(username) {
    // تغيير الزر لحالة التحميل
    const btn = document.querySelector('.view-all-snaps-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ جاري التحميل...';
    }
    
    try {
        showStatus(`جاري تحميل سنابات @${username}...`, 'info');
        
        const response = await fetch(`/api/snaps/${username}`);
        const data = await response.json();
        
        if (data.success && data.snaps && data.snaps.length > 0) {
            // عرض السنابات مع الفلترة
            allSnaps = data.snaps;
            currentPage = 1;
            displaySnaps(data.username, data.snaps);
            showStatus(`تم تحميل ${data.snaps.length} سناب!`, 'success');
        } else {
            showStatus('لم يتم العثور على سنابات إضافية', 'info');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `📂 عرض جميع سنابات @${username} (آخر ${MAX_DAYS_OLD} أيام)`;
            }
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus('فشل في تحميل السنابات', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `📂 عرض جميع سنابات @${username} (آخر ${MAX_DAYS_OLD} أيام)`;
        }
    }
}

/// دالة لتغيير حالة التحميل لزر البحث برابط
function setLinkLoadingState(isLoading) {
    if (!linkSearchBtn) return;
    
    linkSearchBtn.disabled = isLoading;
    const btnText = linkSearchBtn.querySelector('.btn-text');
    const btnLoader = linkSearchBtn.querySelector('.btn-loader');

    if (isLoading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'flex';
    } else {
        btnText.style.display = 'block';
        btnLoader.style.display = 'none';
    }
}

/// دالة لإغلاق المودال وإيقاف أي فيديو يعمل
function closeMediaModal() {
    // إيقاف الفيديو إذا كان يعمل
    const video = modalMediaContainer.querySelector('video');
    if (video) {
        video.pause();
        video.currentTime = 0;
    }
    mediaModal.classList.remove('show');
    modalMediaContainer.innerHTML = '';
}

closeModal.addEventListener('click', closeMediaModal);

window.addEventListener('click', (e) => {
    if (e.target === mediaModal) {
        closeMediaModal();
    }
});

// إغلاق المودال عند الضغط على زر Escape
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mediaModal.classList.contains('show')) {
        closeMediaModal();
    }
});

// Main search handler
async function handleSearch() {
    const username = usernameInput.value.trim();

    if (!username) {
        showStatus('الرجاء إدخال اسم مستخدم', 'error');
        return;
    }

    const usernameRegex = /^[a-zA-Z0-9._-]{3,15}$/;
    if (!usernameRegex.test(username)) {
        showStatus('صيغة اسم المستخدم غير صحيحة. استخدم 3-15 حرفاً من الأحرف والأرقام والنقاط والشرطات السفلية والعلوية فقط.', 'error');
        return;
    }

    setLoadingState(true);
    hideStatus();
    resultsContainer.style.display = 'none';

    try {
        const response = await fetch(`/api/snaps/${username}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'فشل في تحميل السنابات');
        }

        if (data.success) {
            if (data.snaps && data.snaps.length > 0) {
                allSnaps = data.snaps;
                currentPage = 1;
                displaySnaps(data.username, data.snaps);
                showStatus(`تم تحميل ${data.snaps.length} سناب بنجاح!`, 'success');
            } else {
                showStatus(data.message || 'لم يتم العثور على سنابات عامة لهذا المستخدم.', 'info');
                resultsContainer.style.display = 'none';
            }
        } else {
            throw new Error(data.error || 'حدث خطأ غير معروف');
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus(error.message || 'فشل في تحميل السنابات. الرجاء المحاولة مرة أخرى.', 'error');
        resultsContainer.style.display = 'none';
    } finally {
        setLoadingState(false);
    }
}

/// دالة لفلترة السنابات حسب التاريخ (آخر 6 أيام فقط) - سريعة جداً
/// دالة لحذف سنابة تالفة وتحديث الـ pagination
function removeInvalidSnap(snap) {
    // حذف من القائمة الرئيسية
    const index = allSnaps.findIndex(s => s.url === snap.url);
    if (index > -1) {
        allSnaps.splice(index, 1);
        console.log(`Removed invalid snap. Remaining: ${allSnaps.length}`);
        
        // تحديث العداد
        resultsCount.textContent = `${allSnaps.length} سناب`;
        
        // تحديث الـ pagination
        const totalPages = Math.ceil(allSnaps.length / ITEMS_PER_PAGE);
        displayPagination(totalPages);
        
        // إذا أصبحت الصفحة الحالية فارغة، ارجع للصفحة السابقة
        if (currentPage > totalPages && totalPages > 0) {
            currentPage = totalPages;
            refreshCurrentPage();
        }
        
        // إذا لم يتبق سنابات في الصفحة الحالية، أعد عرضها
        const visibleCards = snapsGrid.querySelectorAll('.snap-card').length;
        if (visibleCards === 0 && allSnaps.length > 0) {
            refreshCurrentPage();
        }
    }
    
    // حذف من الاختيارات أيضاً
    const selectedIndex = selectedSnaps.findIndex(s => s.url === snap.url);
    if (selectedIndex > -1) {
        selectedSnaps.splice(selectedIndex, 1);
        updateFloatingButton();
    }
}

/// دالة لإعادة عرض الصفحة الحالية
function refreshCurrentPage() {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, allSnaps.length);
    const currentSnaps = allSnaps.slice(startIndex, endIndex);
    
    snapsGrid.innerHTML = '';
    
    currentSnaps.forEach((snap, index) => {
        const card = createSnapCard(snap, startIndex + index);
        snapsGrid.appendChild(card);
    });
}

/// دالة للتحقق إذا كان الرابط صورة بروفايل أو رابط غير صالح
function isProfileOrInvalidUrl(url) {
    if (!url) return true;
    
    const urlLower = url.toLowerCase();
    
    // صور البروفايل
    if (urlLower.includes('api.snapchat.com')) return true;
    if (urlLower.includes('/preview/square')) return true;
    if (urlLower.includes('/add/')) return true;
    if (urlLower.includes('bitmoji')) return true;
    if (urlLower.includes('avatar')) return true;
    if (urlLower.includes('profile')) return true;
    
    // روابط غير صالحة
    if (!urlLower.includes('cf-st.sc-cdn.net')) return true;
    
    return false;
}

/// فلترة سريعة - بدون انتظار (يتم إخفاء التالفة عند فشل التحميل)
async function filterRecentSnaps(snaps) {
    // فلترة سريعة من نمط الرابط فقط
    const validSnaps = snaps.filter(snap => !isProfileOrInvalidUrl(snap.url));
    
    console.log(`Quick filter: ${snaps.length} → ${validSnaps.length} snaps`);
    
    // لا نتحقق من التاريخ هنا - نعرض مباشرة
    // السنابات التالفة ستُحذف تلقائياً عند فشل تحميلها
    return { recentSnaps: validSnaps, oldCount: snaps.length - validSnaps.length };
}

function displaySnaps(username, snaps) {
    // تحديد أنه بحث متعدد (وليس سنابة واحدة)
    isSingleSnapSearch = false;
    
    resultsTitle.textContent = `@${username}`;
    snapsGrid.innerHTML = '';
    resultsContainer.style.display = 'block';
    
    // فلترة سريعة من نمط الرابط فقط (بدون انتظار)
    const validSnaps = snaps.filter(snap => !isProfileOrInvalidUrl(snap.url));
    
    console.log(`Quick display: ${snaps.length} → ${validSnaps.length} valid snaps`);
    
    // تحديث allSnaps
    allSnaps = validSnaps;
    
    if (validSnaps.length === 0) {
        resultsCount.textContent = 'لا توجد سنابات';
        snapsGrid.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">لا توجد سنابات</p>';
        return;
    }
    
    // تحديث العداد
    resultsCount.textContent = `${validSnaps.length} سناب`;
    
    // عرض السنابات مباشرة (السنابات التالفة ستُحذف تلقائياً عند فشل التحميل)
    const totalPages = Math.ceil(validSnaps.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentSnaps = validSnaps.slice(startIndex, endIndex);

    currentSnaps.forEach((snap, index) => {
        const card = createSnapCard(snap, startIndex + index);
        snapsGrid.appendChild(card);
    });

    displayPagination(totalPages);
    
    setTimeout(() => {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

/// دالة لتحويل رابط الفيديو إلى رابط الصورة المصغرة (poster)
function getVideoPosterUrl(videoUrl) {
    if (!videoUrl) return null;
    
    // Snapchat يستخدم /i/ للفيديو و /d/ للصورة المصغرة
    // مثال: https://cf-st.sc-cdn.net/i/xxx -> https://cf-st.sc-cdn.net/d/xxx
    if (videoUrl.includes('cf-st.sc-cdn.net/i/')) {
        return videoUrl.replace('cf-st.sc-cdn.net/i/', 'cf-st.sc-cdn.net/d/');
    }
    
    // إذا كان الرابط يحتوي على .1034. (فيديو) نحوله إلى .256. (صورة)
    if (videoUrl.includes('.1034.')) {
        return videoUrl.replace('.1034.', '.256.');
    }
    
    return null;
}

/// دالة إنشاء بطاقة السناب
function createSnapCard(snap, index) {
    const card = document.createElement('div');
    card.className = 'snap-card';
    if (snap.isMainSnap) {
        card.classList.add('main-snap');
    }
    card.style.animationDelay = `${index * 0.05}s`;

    const mediaContainer = document.createElement('div');
    mediaContainer.className = 'snap-media-container';
    
    // إضافة النقر للعرض
    mediaContainer.style.cursor = 'pointer';
    mediaContainer.onclick = () => viewMedia(snap);

    // إذا كان من بحث رابط مفرد، نثق بالنوع المرسل من السيرفر
    let isVideo = snap.type === 'video';
    
    // إذا لم يكن النوع محدد ولم يكن بحث مفرد، نحاول الكشف من الرابط
    if (!isSingleSnapSearch && (!snap.type || snap.type !== 'video' && snap.type !== 'image')) {
        isVideo = detectMediaType(snap.url, snap.type);
    }

    let mediaElement;
    
    if (isVideo) {
        // استخدام video element مع preload="metadata" لعرض أول إطار
        mediaElement = document.createElement('video');
        mediaElement.src = snap.url;
        mediaElement.preload = 'metadata'; // تحميل البيانات الوصفية فقط (أول إطار)
        mediaElement.muted = true;
        mediaElement.playsInline = true;
        mediaElement.autoplay = false;
        mediaElement.loop = false;
        mediaElement.setAttribute('referrerpolicy', 'no-referrer');
        
        mediaElement.style.objectFit = 'cover';
        mediaElement.style.width = '100%';
        mediaElement.style.height = '100%';
        mediaElement.style.position = 'absolute';
        mediaElement.style.top = '0';
        mediaElement.style.left = '0';
        mediaElement.style.backgroundColor = '#000';
        
        // عند تحميل البيانات الوصفية، ننتقل لأول إطار
        mediaElement.addEventListener('loadedmetadata', () => {
            mediaElement.currentTime = 0.1; // الانتقال لأول إطار
        });
        
        // منع التشغيل عند النقر على البطاقة (سيتم التشغيل في المودال)
        mediaElement.addEventListener('play', (e) => {
            e.preventDefault();
            mediaElement.pause();
            mediaElement.currentTime = 0.1;
        });
        
        // في حالة الخطأ - إخفاء البطاقة وتحديث القائمة
        mediaElement.onerror = () => {
            console.log('Removing invalid video card');
            card.remove();
            // حذف السنابة من القائمة الرئيسية
            removeInvalidSnap(snap);
        };
        
        snap.type = 'video';
        
        // علامة الفيديو
        const videoLabel = document.createElement('div');
        videoLabel.className = 'media-label video-label';
        videoLabel.textContent = 'فيديو';
        mediaContainer.appendChild(videoLabel);
        
        // أيقونة التشغيل
        const videoIndicator = document.createElement('div');
        videoIndicator.className = 'video-indicator';
        videoIndicator.innerHTML = '▶️';
        mediaContainer.appendChild(videoIndicator);
        
        // دائرة الاختيار للدمج (فقط للبحث المتعدد)
        if (!isSingleSnapSearch) {
            const checkbox = document.createElement('div');
            checkbox.className = 'snap-checkbox';
            checkbox.innerHTML = '✓';
            checkbox.onclick = (e) => {
                e.stopPropagation();
                toggleSnapSelection(snap, checkbox);
            };
            mediaContainer.appendChild(checkbox);
        }
    } else {
        // الصور
        mediaElement = document.createElement('img');
        mediaElement.src = snap.thumbnail || snap.url;
        mediaElement.alt = 'صورة';
        mediaElement.loading = 'lazy';
        // مهم لتجاوز CORS
        mediaElement.setAttribute('referrerpolicy', 'no-referrer');
        mediaElement.crossOrigin = 'anonymous';
        
        mediaElement.style.objectFit = 'cover';
        mediaElement.style.width = '100%';
        mediaElement.style.height = '100%';
        mediaElement.style.position = 'absolute';
        mediaElement.style.top = '0';
        mediaElement.style.left = '0';
        snap.type = 'image';
        
        mediaElement.onerror = () => {
            // محاولة بدون crossOrigin
            mediaElement.removeAttribute('crossOrigin');
            mediaElement.src = snap.url;
            mediaElement.onerror = () => {
                // إخفاء البطاقة وتحديث القائمة
                console.log('Removing invalid image card');
                card.remove();
                removeInvalidSnap(snap);
            };
        };
        
        // دائرة الاختيار للصور (فقط للبحث المتعدد)
        if (!isSingleSnapSearch) {
            const checkbox = document.createElement('div');
            checkbox.className = 'snap-checkbox';
            checkbox.innerHTML = '✓';
            checkbox.onclick = (e) => {
                e.stopPropagation();
                toggleSnapSelection(snap, checkbox);
            };
            mediaContainer.appendChild(checkbox);
        }
    }

    mediaContainer.appendChild(mediaElement);

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'snap-actions';

    // زر التحميل
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    
    const fileExt = detectFileExtension(snap.url, isVideo);
    
    // نص زر التحميل حسب نوع الوسائط
    const typeText = isVideo ? 'الفيديو' : 'الصورة';
    const downloadText = `تحميل ${typeText}`;
    
    // إنشاء عنصر التاريخ
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'snap-timestamp';
    timestampSpan.textContent = 'Loading...';
    
    downloadBtn.innerHTML = `
        <div class="download-content">
            <span class="download-main">
                <span class="download-icon">⬇️</span>
                <span class="download-text">${downloadText}</span>
            </span>
        </div>
    `;
    
    // إضافة عنصر التاريخ
    downloadBtn.querySelector('.download-content').appendChild(timestampSpan);
    
    // استخدام التاريخ المحمل مسبقاً (من filterRecentSnaps)
    if (snap.formattedDate) {
        timestampSpan.textContent = snap.formattedDate;
    } else {
        // إذا لم يكن محملاً، نحمله الآن
        fetchMediaDate(snap.url).then(dateInfo => {
            if (dateInfo && dateInfo.formatted) {
                timestampSpan.textContent = dateInfo.formatted;
                snap.formattedDate = dateInfo.formatted;
            } else {
                timestampSpan.style.display = 'none';
            }
        });
    }
    
    downloadBtn.onclick = (e) => {
        e.stopPropagation();
        downloadMedia(snap, index, isVideo, fileExt);
    };

    actionsContainer.appendChild(downloadBtn);

    card.appendChild(mediaContainer);
    card.appendChild(actionsContainer);

    return card;
}

/// دالة للكشف عن نوع الوسائط بدقة
function detectMediaType(url, type) {
    if (!url) return false;
    
    const urlLower = url.toLowerCase();
    
    // فحص النوع من السيرفر أولاً
    if (type === 'video' || type === 'VIDEO') return true;
    if (type === 'image' || type === 'IMAGE') return false;
    
    // فحص روابط Snapchat CDN
    // الفيديو عادة يحتوي على /i/ أو .1034. أو أرقام كبيرة
    if (urlLower.includes('cf-st.sc-cdn.net/i/')) return true;
    if (urlLower.includes('.1034.')) return true;
    if (urlLower.includes('/i/') && urlLower.includes('sc-cdn.net')) return true;
    
    // الصور عادة تحتوي على /d/ أو .256.
    if (urlLower.includes('cf-st.sc-cdn.net/d/')) return false;
    if (urlLower.includes('.256.')) return false;
    
    // فحص امتدادات الفيديو
    const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.m4v', '.mkv', '.flv', '.wmv'];
    for (const ext of videoExtensions) {
        if (urlLower.includes(ext)) return true;
    }
    
    // فحص أنماط الفيديو
    const videoPatterns = ['/video/', '/media/video', 'video.', 'vid_', 'movie', '.m3u8', 'media_type=video'];
    for (const pattern of videoPatterns) {
        if (urlLower.includes(pattern)) return true;
    }
    
    // فحص امتدادات الصور
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    for (const ext of imageExtensions) {
        if (urlLower.includes(ext)) return false;
    }
    
    // إذا كان الرابط من Snapchat CDN ولم نعرف النوع، نفترض أنه فيديو
    // لأن معظم السنابات فيديو
    if (urlLower.includes('sc-cdn.net')) {
        return true;
    }
    
    return false;
}

// Helper function to detect file extension
function detectFileExtension(url, isVideo) {
    if (!url) return isVideo ? 'mp4' : 'jpg';
    
    const urlLower = url.toLowerCase();
    
    // Video extensions
    if (urlLower.includes('.mp4')) return 'mp4';
    if (urlLower.includes('.mov')) return 'mov';
    if (urlLower.includes('.avi')) return 'avi';
    if (urlLower.includes('.webm')) return 'webm';
    if (urlLower.includes('.m4v')) return 'm4v';
    
    // Image extensions
    if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return 'jpg';
    if (urlLower.includes('.png')) return 'png';
    if (urlLower.includes('.gif')) return 'gif';
    if (urlLower.includes('.webp')) return 'webp';
    
    // Default based on type
    return isVideo ? 'mp4' : 'jpg';
}

// عدد الأيام المسموح بها (آخر 6 أيام فقط)
const MAX_DAYS_OLD = 6;

/// دالة للتحقق إذا كان التاريخ ضمن آخر 6 أيام
function isWithinLastDays(dateStr, days = MAX_DAYS_OLD) {
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= days;
    } catch (e) {
        return true; // إذا فشل التحقق، نعرض السنابة
    }
}

/// دالة لاستخراج التاريخ من السنابة (تُرجع Promise)
async function fetchMediaDate(url) {
    try {
        const response = await fetch(`/api/media-date?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        
        if (data.success && data.lastModified) {
            return {
                formatted: formatTimestamp(new Date(data.lastModified).getTime()),
                raw: data.lastModified,
                isRecent: isWithinLastDays(data.lastModified)
            };
        }
    } catch (e) {
        console.log('Error fetching media date:', e);
    }
    return null;
}

/// دالة لاستخراج التاريخ من السنابة
function extractTimestamp(snap) {
    // 1. إذا كان التاريخ محفوظ مسبقاً
    if (snap.formattedDate) {
        return snap.formattedDate;
    }
    
    // 2. محاولة من الخصائص المباشرة
    if (snap.timestamp) {
        return formatTimestamp(snap.timestamp);
    }
    if (snap.createdAt) {
        return formatTimestamp(snap.createdAt);
    }
    if (snap.date) {
        return formatTimestamp(snap.date);
    }
    if (snap.lastModified) {
        return formatTimestamp(new Date(snap.lastModified).getTime());
    }
    
    // 3. إرجاع فارغ مؤقتاً (سيتم تحديثه لاحقاً)
    return '';
}

/// دالة لتنسيق التاريخ مثل "Posted on yesterday at 1:48 PM"
function formatTimestamp(timestamp) {
    try {
        let date;
        if (typeof timestamp === 'number') {
            // تحويل للميلي ثانية إذا لزم
            if (timestamp < 10000000000) {
                timestamp *= 1000;
            }
            date = new Date(timestamp);
        } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        } else {
            return '';
        }
        
        if (isNaN(date.getTime())) return '';
        
        const now = new Date();
        
        // حساب فرق الأيام بشكل صحيح (بناءً على التاريخ المحلي وليس الميلي ثانية)
        const dateLocal = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffDays = Math.round((nowLocal - dateLocal) / (1000 * 60 * 60 * 24));
        
        // تنسيق الوقت (بالتوقيت المحلي)
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const timeStr = `${hours}:${minutes} ${ampm}`;
        
        // تحديد اليوم
        let dayStr = '';
        
        if (diffDays === 0) {
            // اليوم - نفس التاريخ
            const diffMs = now - date;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours < 1) {
                const diffMins = Math.floor(diffMs / (1000 * 60));
                if (diffMins < 1) {
                    return 'Just now';
                }
                return `${diffMins} min ago`;
            }
            if (diffHours === 1) {
                return '1 hour ago';
            }
            if (diffHours < 6) {
                return `${diffHours} hours ago`;
            }
            dayStr = 'today';
        } else if (diffDays === 1) {
            dayStr = 'yesterday';
        } else if (diffDays < 7) {
            // أيام الأسبوع
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            dayStr = days[date.getDay()];
        } else {
            // التاريخ الكامل
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[date.getMonth()];
            const day = date.getDate();
            
            // إضافة السنة إذا كانت مختلفة
            if (date.getFullYear() !== now.getFullYear()) {
                dayStr = `${month} ${day}, ${date.getFullYear()}`;
            } else {
                dayStr = `${month} ${day}`;
            }
        }
        
        return `Posted on ${dayStr} at ${timeStr}`;
    } catch (e) {
        return '';
    }
}

/// دالة عرض الوسائط في نافذة منبثقة مع دعم الصوت للفيديو
function viewMedia(snap) {
    modalMediaContainer.innerHTML = '';
    
    // عرض مؤشر التحميل
    const loader = document.createElement('div');
    loader.className = 'media-loader';
    loader.textContent = 'جاري التحميل...';
    modalMediaContainer.appendChild(loader);

    // التحقق من نوع الوسائط
    const isVideo = snap.type === 'video' || detectMediaType(snap.url, snap.type);

    let mediaElement;
    if (isVideo) {
        // إنشاء عنصر الفيديو مع الصوت
        mediaElement = document.createElement('video');
        mediaElement.src = snap.url;
        mediaElement.controls = true;
        mediaElement.autoplay = true; // تشغيل تلقائي
        mediaElement.loop = false;
        mediaElement.preload = 'auto';
        mediaElement.playsInline = true;
        
        // مهم جداً لتجاوز CORS
        mediaElement.setAttribute('referrerpolicy', 'no-referrer');
        
        mediaElement.style.maxWidth = '100%';
        mediaElement.style.maxHeight = '85vh';
        mediaElement.style.backgroundColor = '#000';
        mediaElement.style.borderRadius = '12px';
        
        // البدء بدون صوت للسماح بالتشغيل التلقائي، ثم تفعيل الصوت
        mediaElement.muted = true;
        mediaElement.volume = 1.0;
        
        // عند تحميل البيانات - تشغيل الفيديو
        mediaElement.onloadeddata = () => {
            loader.remove();
            
            // محاولة التشغيل
            mediaElement.play().then(() => {
                // بعد بدء التشغيل، نحاول تفعيل الصوت
                setTimeout(() => {
                    mediaElement.muted = false;
                }, 100);
            }).catch(err => {
                console.log('التشغيل التلقائي ممنوع:', err);
                // إضافة رسالة للنقر للتشغيل
                const playHint = document.createElement('div');
                playHint.className = 'sound-hint';
                playHint.innerHTML = '▶️ انقر للتشغيل';
                playHint.onclick = () => {
                    mediaElement.muted = false;
                    mediaElement.play();
                    playHint.remove();
                };
                modalMediaContainer.appendChild(playHint);
            });
        };
        
        // عند بدء التشغيل - تفعيل الصوت
        mediaElement.onplay = () => {
            setTimeout(() => {
                mediaElement.muted = false;
            }, 100);
            const hint = modalMediaContainer.querySelector('.sound-hint');
            if (hint) hint.remove();
        };
        
        mediaElement.oncanplay = () => {
            loader.remove();
        };
        
        // مهلة زمنية للتحميل
        setTimeout(() => {
            if (loader.parentElement) {
                loader.remove();
            }
        }, 5000);
        
        mediaElement.onerror = (e) => {
            console.error('خطأ في الفيديو:', e);
            loader.textContent = 'فشل تحميل الفيديو - جاري المحاولة عبر proxy...';
            
            // محاولة التحميل عبر proxy
            setTimeout(() => {
                mediaElement.src = getProxyUrl(snap.url);
            }, 1000);
        };
    } else {
        // عرض الصورة
        mediaElement = document.createElement('img');
        mediaElement.src = snap.url;
        mediaElement.alt = 'سناب';
        mediaElement.setAttribute('referrerpolicy', 'no-referrer');
        mediaElement.style.maxWidth = '100%';
        mediaElement.style.maxHeight = '85vh';
        mediaElement.style.objectFit = 'contain';
        mediaElement.style.borderRadius = '12px';
        
        mediaElement.onload = () => {
            loader.remove();
        };
        
        mediaElement.onerror = () => {
            // محاولة التحميل عبر proxy
            mediaElement.src = getProxyUrl(snap.url);
            mediaElement.onerror = () => {
                loader.textContent = 'فشل تحميل الصورة';
                setTimeout(() => loader.remove(), 2000);
            };
        };
    }

    modalMediaContainer.appendChild(mediaElement);
    mediaModal.classList.add('show');
}

/// دالة تحميل الوسائط
async function downloadMedia(snap, index, isVideo, fileExt) {
    try {
        showStatus('جاري التحميل...', 'info');
        
        // تحديد الامتداد الصحيح
        let extension = fileExt || (isVideo ? 'mp4' : 'jpg');
        
        // استخدام الـ proxy للتحميل
        const proxyUrl = getProxyUrl(snap.url);
        
        const response = await fetch(proxyUrl, {
            method: 'GET',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error('فشل في تحميل الملف');
        }
        
        const blob = await response.blob();
        
        // التحقق من نوع الملف من الـ blob
        if (blob.type) {
            if (blob.type.includes('video/mp4')) extension = 'mp4';
            else if (blob.type.includes('video/quicktime')) extension = 'mov';
            else if (blob.type.includes('video/webm')) extension = 'webm';
            else if (blob.type.includes('video')) extension = 'mp4';
            else if (blob.type.includes('image/jpeg')) extension = 'jpg';
            else if (blob.type.includes('image/png')) extension = 'png';
            else if (blob.type.includes('image/gif')) extension = 'gif';
            else if (blob.type.includes('image/webp')) extension = 'webp';
        }
        
        // إنشاء رابط التحميل
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `snapchat_${Date.now()}_${index + 1}.${extension}`;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        }, 100);
        
        showStatus('تم التحميل بنجاح! ✅', 'success');
        
    } catch (error) {
        console.error('Download error:', error);
        
        // محاولة التحميل المباشر
        try {
            showStatus('جاري المحاولة بطريقة بديلة...', 'info');
            
            const response = await fetch(snap.url, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache'
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `snapchat_${Date.now()}_${index + 1}.${isVideo ? 'mp4' : 'jpg'}`;
                link.style.display = 'none';
                
                document.body.appendChild(link);
                link.click();
                
                setTimeout(() => {
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(blobUrl);
                }, 100);
                
                showStatus('تم التحميل بنجاح! ✅', 'success');
                return;
            }
        } catch (e) {
            // فشلت المحاولة المباشرة أيضاً
        }
        
        // فتح الرابط في نافذة جديدة
        const link = document.createElement('a');
        link.href = snap.url;
        link.download = `snapchat_${Date.now()}_${index + 1}.${isVideo ? 'mp4' : 'jpg'}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showStatus('تم فتح الرابط. احفظ الملف من المتصفح (Ctrl+S أو انقر بالزر الأيمن).', 'info');
    }
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;
}

function hideStatus() {
    statusMessage.className = 'status-message';
}

function setLoadingState(isLoading) {
    searchBtn.disabled = isLoading;
    const btnText = searchBtn.querySelector('.btn-text');
    const btnLoader = searchBtn.querySelector('.btn-loader');

    if (isLoading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'flex';
    } else {
        btnText.style.display = 'block';
        btnLoader.style.display = 'none';
    }
}

function displayPagination(totalPages) {
    paginationContainer.innerHTML = '';
    
    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }
    
    paginationContainer.style.display = 'flex';
    
    // Previous button
    if (currentPage > 1) {
        const prevBtn = createPaginationButton('السابق', () => {
            currentPage--;
            displaySnaps(resultsTitle.textContent.replace('@', ''), allSnaps);
            resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        prevBtn.classList.add('pagination-prev');
        paginationContainer.appendChild(prevBtn);
    }
    
    // Page numbers (show max 7 pages)
    const maxVisible = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    // First page
    if (startPage > 1) {
        const firstBtn = createPaginationButton(1, () => changePage(1));
        paginationContainer.appendChild(firstBtn);
        
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.className = 'pagination-dots';
            dots.textContent = '...';
            paginationContainer.appendChild(dots);
        }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = createPaginationButton(i, () => changePage(i));
        if (i === currentPage) {
            pageBtn.classList.add('active');
        }
        paginationContainer.appendChild(pageBtn);
    }
    
    // Last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.className = 'pagination-dots';
            dots.textContent = '...';
            paginationContainer.appendChild(dots);
        }
        
        const lastBtn = createPaginationButton(totalPages, () => changePage(totalPages));
        paginationContainer.appendChild(lastBtn);
    }
    
    // Next button
    if (currentPage < totalPages) {
        const nextBtn = createPaginationButton('التالي', () => {
            currentPage++;
            displaySnaps(resultsTitle.textContent.replace('@', ''), allSnaps);
            resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        nextBtn.classList.add('pagination-next');
        paginationContainer.appendChild(nextBtn);
    }
}

function createPaginationButton(text, onClick) {
    const button = document.createElement('button');
    button.className = 'pagination-btn';
    button.textContent = text;
    button.onclick = onClick;
    return button;
}

function changePage(page) {
    currentPage = page;
    displaySnaps(resultsTitle.textContent.replace('@', ''), allSnaps);
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.addEventListener('load', () => {
    usernameInput.focus();
});