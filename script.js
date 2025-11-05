// --- KHAI BÁO BIẾN TOÀN CỤC ---
// === BẮT ĐẦU CẬP NHẬT GIAI ĐOẠN 3 ===
// Dán URL của Worker (bạn nhận được sau Giai đoạn 1.5) vào đây
// Ví dụ: 'https://oai-downloader.ten-ban.workers.dev'
const WORKER_URL = 'https://oai-downloader.xinchaomoinguoi1102.workers.dev'; // <<<--- DÁN URL WORKER CỦA BẠN VÀO ĐÂY
const LOCK_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày
// === KẾT THÚC CẬP NHẬT GIAI ĐOẠN 3 ===

const pages = ['home', 'oai-studio', 'resources', 'software', 'contact', 'auth'];
const navLinks = {
    home: document.getElementById('nav-home'),
    resources: document.getElementById('nav-resources'),
    software: document.getElementById('nav-software'),
    'oai-studio': document.getElementById('nav-oai-studio'),
    contact: document.getElementById('nav-contact'),
    auth: document.getElementById('nav-login')
};
const pageElements = {
    home: document.getElementById('page-home'),
    'oai-studio': document.getElementById('page-oai-studio'),
    resources: document.getElementById('page-resources'),
    software: document.getElementById('page-software'),
    contact: document.getElementById('page-contact'),
    auth: document.getElementById('page-auth')
};

let resourcesInitialized = false;
let currentUser = null;
let profileSubscription = null;
let authStateReady = false;

// === FIX LỖI v3: Khai báo biến DOM là let, sẽ gán sau ===
let authOverlay = null;
let authOverlayOai = null;
let loginForm = null;
let registerForm = null;
let authButtonContainer = null;

// === GIAI ĐOẠN 3: Thêm biến cho Modal Mật khẩu ===
let currentResourceId = null; // Biến tạm để lưu ID file đang chờ tải
let currentDownloadButton = null; // Biến tạm để lưu nút đang xử lý
let passwordModal = null;
let passwordForm = null;
let passwordInput = null;
let passwordError = null;
let passwordSubmitBtn = null;
// === KẾT THÚC KHAI BÁO BIẾN ===


// === FIX LỖI v3: HÀM KHỞI TẠO CHÍNH ===
// Hàm này sẽ được GỌI TỪ index.html SAU KHI window.supabase đã được tạo
function initializeApp() {
    
    // 1. Gán các biến DOM (Vì script được gọi ở cuối body, DOM đã sẵn sàng)
    authOverlay = document.getElementById('auth-overlay');
    authOverlayOai = document.getElementById('auth-overlay-oai');
    loginForm = document.getElementById('login-form');
    registerForm = document.getElementById('register-form');
    authButtonContainer = document.getElementById('auth-button-container');

    passwordModal = document.getElementById('password-modal');
    passwordForm = document.getElementById('password-form');
    passwordInput = document.getElementById('download-password');
    passwordError = document.getElementById('password-error');
    passwordSubmitBtn = document.getElementById('password-submit-btn');

    // 2. Bắt đầu lắng nghe Supabase (VÌ window.supabase ĐÃ TỒN TẠI)
    setupAuthStateObserver();

    // 3. Gắn các Event Listeners
    window.addEventListener('click', (event) => {
        const dropdown = document.getElementById('account-dropdown');
        const menuButton = document.getElementById('account-menu-button');
        if (dropdown && dropdown.classList.contains('open') &&
            menuButton && !menuButton.contains(event.target) &&
            !dropdown.contains(event.target)) {
            dropdown.classList.remove('open');
        }
    });

    const loginGoogleBtn = document.getElementById('login-google-btn');
    if (loginGoogleBtn) loginGoogleBtn.addEventListener('click', signInWithGoogle);

    const registerGoogleBtn = document.getElementById('register-google-btn');
    if (registerGoogleBtn) registerGoogleBtn.addEventListener('click', signInWithGoogle);

    const loginFormEl = document.querySelector('#login-form form');
    if (loginFormEl) loginFormEl.addEventListener('submit', handleEmailLogin);

    const registerFormEl = document.querySelector('#register-form form');
    if (registerFormEl) registerFormEl.addEventListener('submit', handleEmailRegister);

    // Gắn listener cho Modal Mật khẩu
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordSubmit);
    }

    // Gắn listener cho Lưới Tài nguyên
    const resourceGrid = document.getElementById('resource-grid');
    if (resourceGrid) {
        resourceGrid.addEventListener('click', (event) => {
            const button = event.target.closest('.download-btn');
            if (button && !button.disabled) { // Chỉ xử lý nếu nút không bị khóa
                const resourceId = button.dataset.id;
                // Gọi hàm MỞ MODAL, không gọi hàm tải file
                startDownloadProcess(resourceId, button);
            } else if (!currentUser && button) {
                // alert("Vui lòng đăng nhập để tải tài nguyên!"); // Không dùng alert
                console.warn("User not logged in, redirecting to auth.");
                showPage('auth', event); // Chuyển đến trang đăng nhập
            }
        });
    }

    // 4. Khởi tạo các thành phần giao diện khác
    if (typeof initFlyingLogos === 'function') initFlyingLogos();
    if (typeof renderVideoGallery === 'function') renderVideoGallery();
    if (typeof typingAnimation === 'function') typingAnimation();
    if (typeof initializeOAIStudio === 'function') initializeOAIStudio();

    console.log("Ứng dụng đã khởi tạo thành công!"); // Để kiểm tra
}
// === KẾT THÚC HÀM KHỞI TẠO CHÍNH ===


// --- CÁC HÀM TIỆN ÍCH ---

function toggleAuthForms() {
    if (loginForm && registerForm) {
        loginForm.classList.toggle('hidden');
        registerForm.classList.toggle('hidden');
    }
}

// === GIAI ĐOẠN 3: Hàm tính thời gian còn lại (để hiển thị trên nút bị khóa) ===
function getRemainingTime(expiryTime) {
    const remaining = expiryTime - Date.now();
    if (remaining <= 0) return null;
    
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    if (days > 0) return `(còn ${days} ngày)`;
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    if (hours > 0) return `(còn ${hours} giờ)`;
    
    return '(còn < 1 giờ)';
}

// Task 3: Hàm phụ trợ lấy ngày YYYY-MM-DD
function getCurrentDateString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Task 1 & 10 & 3 & FIX: Hàm _displayPage (lõi logic hiển thị)
function _displayPage(pageId) { 
    if (authOverlay) authOverlay.style.display = 'none';
    // if (authOverlayOai) authOverlayOai.style.display = 'none'; // FIX 2: KHÔNG ẩn overlay OAI (đã được đặt thành "Coming Soon")

    let finalPageId = pageId;
    if (!pages.includes(finalPageId)) {
        console.warn(`Invalid pageId '${finalPageId}', defaulting to 'home'.`);
        finalPageId = 'home';
    }
    if (finalPageId === 'auth' && currentUser) {
        finalPageId = 'home';
    }

    pages.forEach(page => {
        if(pageElements[page]) pageElements[page].classList.add('hidden');
        if (navLinks[page]) navLinks[page].classList.remove('active');
    });
    const accountMenuButton = document.getElementById('account-menu-button');
    if (accountMenuButton) accountMenuButton.classList.remove('active');

    if(pageElements[finalPageId]) {
         pageElements[finalPageId].classList.remove('hidden');
    } else {
         console.error(`Page element for '${finalPageId}' not found!`);
         pageElements.home.classList.remove('hidden'); // Fallback về home
    }

    if ((finalPageId === 'resources') && !currentUser) {
        if (finalPageId === 'resources' && authOverlay) {
            authOverlay.style.display = 'flex';
        }
    }

    if (typeof moveGlass === 'function') {
        let targetElementForGlass = navLinks[finalPageId];

        if (currentUser) {
            if (!targetElementForGlass) {
                targetElementForGlass = accountMenuButton;
            }
        } else {
             if (!targetElementForGlass && finalPageId !== 'auth') {
                targetElementForGlass = navLinks.auth;
            } else if (finalPageId === 'auth'){
                 targetElementForGlass = navLinks.auth;
            }
        }


        if (targetElementForGlass) {
            targetElementForGlass.classList.add('active');
            moveGlass(targetElementForGlass);
        }
    }

    if (finalPageId === 'resources' && currentUser) {
        if (!resourcesInitialized) {
            initializeResources();
            resourcesInitialized = true;
        }
    } else if (finalPageId === 'oai-studio' && currentUser) {
        // Có thể thêm logic init cho OAI nếu cần
    }

    window.scrollTo(0, 0);
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) mobileMenu.classList.add('hidden');

    const zaloHelper = document.getElementById('zalo-helper');
    if (zaloHelper) {
        if (finalPageId === 'software') {
            zaloHelper.classList.remove('hidden');
        } else {
            zaloHelper.classList.add('hidden');
        }
    }

    if (typeof observeSections === 'function') {
        observeSections();
    }
}

// Task 1 & FIX Auth Overlay: Hàm showPage (Xử lý sự kiện click và History API)
function showPage(pageId, event) {
    if (event) event.preventDefault();

    let targetPageId = pageId;
    if (!pages.includes(targetPageId)) {
        targetPageId = 'home';
    }
     if (targetPageId === 'auth' && currentUser) {
         targetPageId = 'home';
    }


    const currentPath = window.location.pathname.substring(1) || 'home';

    if (targetPageId !== currentPath) {
         const newPath = (targetPageId === 'home') ? '/' : `/${targetPageId}`;
         history.pushState({ pageId: targetPageId }, '', newPath);
    }
    _displayPage(targetPageId);
}


// Task 1: Hàm xử lý nút Back/Forward của trình duyệt
function handlePopState(event) {
    let pageId = event.state?.pageId;
    if (!pageId) {
        pageId = window.location.pathname.substring(1) || 'home';
    }
    if (!pages.includes(pageId)) {
        pageId = 'home';
    }
    _displayPage(pageId);
}
window.addEventListener('popstate', handlePopState);


// --- LOGIC BẢO MẬT "NGƯỜI GIÁM SÁT" ---
function listenToProfileChanges(userId) {
    if (profileSubscription) {
        window.supabase.removeChannel(profileSubscription);
        profileSubscription = null;
    }
    const channel = window.supabase
        .channel(`public:profiles:id=eq.${userId}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
            (payload) => {
                const isBanned = payload.new.is_banned;
                if (isBanned) {
                    // === CẬP NHẬT "BAN MẠNH HƠN" ===
                    // Xóa alert() và gọi signOut() ngay lập tức
                    console.warn("Realtime update: User has been banned. Forcing logout.");
                    window.supabase.auth.signOut();
                    // === KẾT THÚC CẬP NHẬT ===
                }
            }
        )
        .subscribe();
    profileSubscription = channel;
}

async function unsubscribeFromProfileChanges() {
    if (profileSubscription) {
        await window.supabase.removeChannel(profileSubscription);
    }
    profileSubscription = null;
}

// --- LOGIC XÁC THỰC VỚI SUPABASE ---
function setupAuthStateObserver() {
    // FIX LỖI v3: Đảm bảo window.supabase đã tồn tại trước khi gọi
    if (!window.supabase) {
        console.error("Supabase client (window.supabase) chưa được khởi tạo!");
        return;
    }

    window.supabase.auth.onAuthStateChange(async (event, session) => {
        if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session) {
            const { data, error } = await window.supabase
                .from('profiles')
                .select('is_banned')
                .eq('id', session.user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error("Lỗi kiểm tra trạng thái ban:", error);
            }

            if (data && data.is_banned) {
                // === CẬP NHẬT "BAN MẠNH HƠN" ===
                // Xóa alert() và gọi signOut() ngay lập tức
                console.warn("Auth state change: Banned user detected. Forcing logout.");
                await window.supabase.auth.signOut();
                session = null;
                // === KẾT THÚC CẬP NHẬT ===
            }
        }

        const user = session?.user || null;
        const wasLoggedIn = !!currentUser;
        currentUser = user;

        if (user) {
            updateUIForLoggedInUser(user);
            listenToProfileChanges(user.id);
        } else {
            updateUIForLoggedOutUser();
            unsubscribeFromProfileChanges();
        }

        const authNowReady = !authStateReady || (user && !wasLoggedIn) || (!user && wasLoggedIn);
        if(!authStateReady && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT')) {
             authStateReady = true;
        } else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
             authStateReady = true;
        }

        if (authStateReady && authNowReady) {
             let pageIdFromUrl = window.location.pathname.substring(1) || 'home';
             _displayPage(pageIdFromUrl);
        }
    });
}


// === GIAI ĐOẠN 3: LOGIC TẢI FILE MỚI HOÀN TOÀN ===

// Hàm này BẮT ĐẦU quá trình (Phòng thủ 1: Khóa 7 ngày)
// Nó không thực sự tải file, nó chỉ mở modal mật khẩu
async function startDownloadProcess(resourceId, buttonElement) {
    // 1. Kiểm tra đăng nhập
    if (!currentUser) {
        // alert("Vui lòng đăng nhập để tải tài nguyên!"); // Không dùng alert
        console.warn("User not logged in, redirecting to auth.");
        showPage('auth');
        return;
    }
    
    // 2. (Phòng thủ 1) Kiểm tra "Khóa 1 Tuần"
    const lockKey = `download_lock_${currentUser.id}_${resourceId}`;
    const expiryTime = localStorage.getItem(lockKey);
    
    if (expiryTime && Date.now() < parseInt(expiryTime, 10)) {
        // Tạm thời vẫn dùng alert ở đây để thông báo cho user biết
        alert(`Bạn đã tải file này. Vui lòng quay lại sau. ${getRemainingTime(parseInt(expiryTime, 10)) || ''}`);
        return;
    }

    // 3. Mở Modal Mật khẩu
    currentResourceId = resourceId; // Lưu ID file đang chờ
    currentDownloadButton = buttonElement; // Lưu nút đang chờ
    
    if (passwordInput) passwordInput.value = ''; // Xóa mật khẩu cũ
    if (passwordError) passwordError.classList.add('hidden'); // Ẩn lỗi cũ
    
    openModal('password-modal'); // Mở pop-up
    if (passwordInput) passwordInput.focus(); // Tự động trỏ vào ô mật khẩu
}

// Hàm này được gọi khi người dùng bấm "Xác Nhận" trên Modal
async function handlePasswordSubmit(event) {
    event.preventDefault(); // Ngăn form tự reload trang
    
    if (!currentResourceId || !currentDownloadButton || !currentUser || !passwordInput || !passwordSubmitBtn || !passwordError) {
        console.error("Thiếu thông tin để xử lý tải file.");
        return;
    }

    const password = passwordInput.value;
    if (!password) {
        passwordError.textContent = "Vui lòng nhập mật khẩu.";
        passwordError.classList.remove('hidden');
        return;
    }

    // Vô hiệu hóa nút "Xác Nhận" để tránh bấm đúp
    passwordSubmitBtn.disabled = true;
    passwordSubmitBtn.textContent = 'Đang kiểm tra...';
    passwordError.classList.add('hidden');

    try {
        // Lấy "Thẻ An Ninh" (Token)
        const session = await window.supabase.auth.getSession();
        const authToken = session?.data?.session?.access_token;

        if (!authToken) {
            throw new Error("Không tìm thấy token. Vui lòng đăng nhập lại.");
        }

        // 4. (Phòng thủ 2) Gọi "Người Gác Cổng" (Cloudflare Worker)
        // Gửi "Thẻ An Ninh" (Token) + Mật khẩu + ID file
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}` // Gửi "Thẻ An Ninh"
            },
            body: JSON.stringify({
                resourceId: currentResourceId,
                password: password
            })
        });

        const data = await response.json();

        // 5. Xử lý kết quả
        if (!response.ok) {
            // Nếu Worker báo lỗi (sai mật khẩu, hết hạn token, file không tồn tại...)
            throw new Error(data.error || 'Đã xảy ra lỗi không xác định.');
        }

        // 6. THÀNH CÔNG! (Worker trả về link 5 phút)
        const { downloadLink, fileName } = data;

        if (!downloadLink || !fileName) {
            throw new Error('Phản hồi từ máy chủ không hợp lệ.');
        }

        // 7. Kích hoạt "Tải về tàng hình"
        const link = document.createElement('a');
        link.href = downloadLink;
        link.download = fileName; // Tên file mà trình duyệt sẽ lưu
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 8. Kích hoạt "Khóa 1 Tuần"
        const lockKey = `download_lock_${currentUser.id}_${currentResourceId}`;
        const expiryTime = Date.now() + LOCK_DURATION_MS;
        localStorage.setItem(lockKey, expiryTime.toString());
        
        // Cập nhật giao diện nút
        currentDownloadButton.textContent = `Đã tải ${getRemainingTime(expiryTime)}`;
        currentDownloadButton.disabled = true;
        currentDownloadButton.classList.add('opacity-50', 'cursor-not-allowed');

        // 9. Đóng Modal
        closeModal('password-modal');

    } catch (error) {
        // Xử lý lỗi (ví dụ: sai mật khẩu)
        console.error("Lỗi khi xử lý tải file:", error.message);
        passwordError.textContent = error.message; // Hiển thị lỗi cho người dùng
        passwordError.classList.remove('hidden');
    } finally {
        // Mở lại nút "Xác Nhận"
        passwordSubmitBtn.disabled = false;
        passwordSubmitBtn.textContent = 'Xác Nhận';
    }
}
// === KẾT THÚC LOGIC TẢI FILE MỚI ===


// --- CÁC HÀM CẬP NHẬT GIAO DIỆN VÀ XỬ LÝ SỰ KIỆN ---

// NÂNG CẤP B.1: Cập nhật UI cho người dùng đã đăng nhập (Menu Dropdown)
function updateUIForLoggedInUser(user) {
    // FIX LỖI v3: 'authButtonContainer' giờ đã được gán chính xác
    if (authButtonContainer) {
        const userMetadata = user.user_metadata;
        const displayName = userMetadata?.full_name || userMetadata?.name || user.email.split('@')[0];
        const avatarUrl = userMetadata?.avatar_url || 'https://i.imgur.com/3Z4Yp4J.png';

        authButtonContainer.innerHTML = `
            <button id="account-menu-button" class="nav-link flex items-center gap-2 cursor-pointer" type="button">
                <img src="${avatarUrl}" alt="Avatar" class="h-6 w-6 rounded-full object-cover">
                <span class="font-semibold">${displayName}</span>
            </button>
            <div id="account-dropdown" class="account-dropdown">
                <button id="logout-button" class="account-dropdown-item logout-btn">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                    </svg>
                    <span>Đăng xuất</span>
                </button>
            </div>
        `;
        
        navLinks.auth = null;
        navLinks.logout = document.getElementById('account-menu-button');

        const menuButton = document.getElementById('account-menu-button');
        const dropdown = document.getElementById('account-dropdown');
        const logoutButton = document.getElementById('logout-button');

        if (menuButton && dropdown) {
            menuButton.addEventListener('click', (event) => {
                event.stopPropagation();
                dropdown.classList.toggle('open');
            });
        }
        if (logoutButton) {
            logoutButton.addEventListener('click', (event) => {
                event.preventDefault();
                signOutUser(event);
            });
        }

        setTimeout(() => {
            if (typeof moveGlass === 'function') {
                const activeLink = document.querySelector('#desktop-nav .nav-link.active');
                moveGlass(activeLink || navLinks.logout);
            }
        }, 50);
    } else {
        console.error("'authButtonContainer' không tìm thấy!"); // Log lỗi nếu vẫn sai
    }
}

// NÂNG CẤP B.2: Cập nhật UI cho người dùng đã đăng xuất (Logo mới)
function updateUIForLoggedOutUser() {
    if (authButtonContainer) {
        authButtonContainer.innerHTML = `
            <a href="#" id="nav-login" class="nav-link" onclick="showPage('auth', event)">
                <img src="https://i.imgur.com/hhc1Ect.png" alt="Login Icon" style="height: 20px;">
                <span>Đăng Nhập</span>
            </a>
        `;
        navLinks.logout = null;
        navLinks.auth = document.getElementById('nav-login');

        setTimeout(() => {
            if (typeof moveGlass === 'function') {
                const activeLink = document.querySelector('#desktop-nav .nav-link.active');
                moveGlass(activeLink || navLinks.auth);
            }
        }, 50);
    } else {
        console.error("'authButtonContainer' không tìm thấy!"); // Log lỗi nếu vẫn sai
    }
}


async function signInWithGoogle(event) {
    event.preventDefault();
    const { error } = await window.supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) {
        console.error("Đăng nhập Google thất bại: " + error.message);
    }
}

async function handleEmailRegister(event) {
    event.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    if (!email || !password) {
        alert("Vui lòng nhập đầy đủ Email và Mật khẩu để đăng ký."); // Giữ alert này vì đây là lỗi form
        return;
    }
    if (password.length < 6) {
        alert("Mật khẩu phải có ít nhất 6 ký tự."); // Giữ alert này
        return;
    }
    const { error } = await window.supabase.auth.signUp({ email, password });
    if (error) {
        alert("Đăng ký thất bại: " + error.message); // Giữ alert này
    } else {
        alert("Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản."); // Giữ alert này
        toggleAuthForms();
    }
}

async function handleEmailLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    if (!email || !password) {
        alert("Vui lòng nhập đầy đủ Email và Mật khẩu để đăng nhập."); // Giữ alert này
        return;
    }
    const { error } = await window.supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert("Đăng nhập thất bại: " + error.message); // Giữ alert này
    }
}

async function signOutUser(event) {
    if (event) event.preventDefault();
    await unsubscribeFromProfileChanges();
    const { error } = await window.supabase.auth.signOut();
    if (error) {
        console.error("Đăng xuất thất bại: " + error.message);
    }
    showPage('home');
}


// === GIAI ĐOẠN 3: Cập nhật hàm initializeResources ===
async function initializeResources() {
    const categoriesContainer = document.getElementById('resource-categories');
    const gridContainer = document.getElementById('resource-grid');
    if (!categoriesContainer || !gridContainer) return;

    gridContainer.innerHTML = `<p class="text-gray-400 col-span-full text-center">Đang tải tài nguyên...</p>`;
    
    // NÂNG CẤP: Chỉ lấy các trường công khai & Thêm sắp xếp
    const { data: resourceData, error } = await window.supabase
        .from('resources')
        .select('id, title, imageUrl, category, sort_order') // Chỉ lấy các trường công khai
        .order('sort_order', { ascending: true, nullsLast: true }); // Sắp xếp theo cột mới
        
    if (error) {
        console.error("Lỗi tải tài nguyên:", error.message);
        gridContainer.innerHTML = `<p class="text-red-400 col-span-full text-center">Không thể tải tài nguyên. Lỗi: ${error.message}</p>`;
        return;
    }
    if (!resourceData || resourceData.length === 0) {
        gridContainer.innerHTML = `<p class="text-gray-400 col-span-full text-center">Chưa có tài nguyên nào.</p>`;
        return;
    }

    const categories = ['Tất cả', ...new Set(resourceData.map(item => item.category))];
    let activeCategoryButton = null;
    
    function renderResources(filter = 'Tất cả') {
        gridContainer.innerHTML = '';
        const filteredData = filter === 'Tất cả' ? resourceData : resourceData.filter(item => item.category === filter);
        
        if (filteredData.length === 0) {
            gridContainer.innerHTML = `<p class="text-gray-400 col-span-full text-center">Không có tài nguyên nào trong mục này.</p>`;
            return;
        }

        // Lấy ID người dùng (nếu có) để kiểm tra khóa
        const userId = currentUser?.id;

        filteredData.forEach(item => {
            const card = document.createElement('div');
            card.className = 'resource-card bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden flex flex-col';
            const categoryClass = item.category === 'Livestream' ? 'text-yellow-400 bg-yellow-500/10' : 'text-sky-400 bg-sky-500/10';
            
            let buttonHtml;
            // (Phòng thủ 1) Kiểm tra "Khóa 1 Tuần" ngay khi render
            if (userId) {
                const lockKey = `download_lock_${userId}_${item.id}`;
                const expiryTime = localStorage.getItem(lockKey);
                
                if (expiryTime && Date.now() < parseInt(expiryTime, 10)) {
                    // Bị khóa
                    const remaining = getRemainingTime(parseInt(expiryTime, 10));
                    buttonHtml = `
                        <button 
                            data-id="${item.id}" 
                            class="download-btn mt-auto text-center w-full bg-gray-600 text-white font-bold py-2 px-4 rounded-lg text-sm opacity-50 cursor-not-allowed"
                            disabled>
                            Đã tải ${remaining || ''}
                        </button>`;
                } else {
                    // Không bị khóa
                    buttonHtml = `
                        <button 
                            data-id="${item.id}" 
                            class="download-btn mt-auto text-center w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">
                            Tải Về
                        </button>`;
                }
            } else {
                // Chưa đăng nhập
                buttonHtml = `
                    <button 
                        data-id="${item.id}" 
                        class="download-btn mt-auto text-center w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">
                        Tải Về
                    </button>`;
            }

            card.innerHTML = `
                <img src="${item.imageUrl}" alt="${item.title}" class="w-full h-40 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/400x300/1f2937/9ca3af?text=Image+Not+Found';">
                <div class="p-4 flex flex-col flex-grow">
                    <h4 class="font-semibold text-white mb-1 flex-grow">${item.title}</h4>
                    <span class="text-xs ${categoryClass} px-2 py-1 rounded-full self-start mb-3">${item.category}</span>
                    ${buttonHtml}
                </div>
            `;
            gridContainer.appendChild(card);
        });
    }
    
    categoriesContainer.innerHTML = '';
    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'w-full text-left px-4 py-2 rounded-md text-gray-300 hover:bg-gray-700 transition-colors';
        button.textContent = category;
        if (category === 'Tất cả') {
            button.classList.add('bg-sky-600', 'text-white');
            activeCategoryButton = button;
        }
        if (category === 'Livestream') {
            button.classList.add('text-yellow-400', 'font-semibold');
        }
        button.addEventListener('click', () => {
            renderResources(category);
            if (activeCategoryButton) {
                activeCategoryButton.classList.remove('bg-sky-600', 'text-white');
            }
            button.classList.add('bg-sky-600', 'text-white');
            activeCategoryButton = button;
        });
        categoriesContainer.appendChild(button);
    });
    
    renderResources();
}

// === FIX LỖI v3: Xóa bỏ DOMContentLoaded listener ===
// document.addEventListener('DOMContentLoaded', () => { ... });
// (Nội dung của nó đã được chuyển vào hàm initializeApp())


// --- CÁC HÀM GIAO DIỆN KHÁC ---
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('open'), 10);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('open');
    setTimeout(() => {
        modal.classList.add('hidden');
        if (modalId === 'video-modal') {
            const videoContainer = document.getElementById('video-player-container');
            if (videoContainer) videoContainer.innerHTML = '';
        }
        // === GIAI ĐOẠN 3: Reset nút khi đóng modal mật khẩu ===
        if (modalId === 'password-modal') {
             if (passwordSubmitBtn) {
                passwordSubmitBtn.disabled = false;
                passwordSubmitBtn.textContent = 'Xác Nhận';
             }
             if (passwordError) {
                passwordError.classList.add('hidden');
             }
             currentResourceId = null;
             currentDownloadButton = null;
        }
    }, 300);
}

const mobileMenuButton = document.getElementById('mobile-menu-button');
if (mobileMenuButton) {
    mobileMenuButton.addEventListener('click', function () {
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu) mobileMenu.classList.toggle('hidden');
    });
}

const closeNotificationBtn = document.getElementById('close-notification');
if (closeNotificationBtn) {
    closeNotificationBtn.addEventListener('click', () => {
        const notifBarWrapper = document.getElementById('notification-bar-wrapper');
        if (notifBarWrapper) {
            notifBarWrapper.style.transition = 'height 0.3s ease, opacity 0.3s ease, margin-top 0.3s ease';
            notifBarWrapper.style.height = '0';
            notifBarWrapper.style.opacity = '0';
            notifBarWrapper.style.marginTop = '0';
            notifBarWrapper.style.overflow = 'hidden';
            setTimeout(() => notifBarWrapper.style.display = 'none', 300);
        }
    });
}


const assistantContainer = document.getElementById('assistant-container');
const chatWidget = document.getElementById('chat-widget');
const closeChatBtn = document.getElementById('close-chat');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat');
const typingIndicator = document.getElementById('typing-indicator');
const speechBubble = document.getElementById('assistant-speech-bubble');
let speechTimeout;

const assistantMessages = {
    'hero': "Trợ Lý Oai Mini: Chào mừng bạn! Đây là trang chủ của DesignPro.",
    'services': "Trợ Lý Oai Mini: Đây là các dịch vụ chính của tôi. Nhấp vào để xem chi tiết nhé!",
    'image-carousel': "Trợ Lý Oai Mini: Lướt xem các sản phẩm thiết kế nổi bật của tôi nhé!",
    'video-gallery': "Trợ Lý Oai Mini: Khám phá thư viện video hướng dẫn của tôi nhé!",
    'software-showcase': "Trợ Lý Oai Mini: Khám phá các công cụ thiết kế mạnh mẽ mà tôi cung cấp bản quyền.",
    'why-us': "Trợ Lý Oai Mini: Bạn thắc mắc tại sao nên chọn tôi? Khu vực này sẽ giải đáp điều đó.",
    'community': "Trợ Lý Oai Mini: Hãy tham gia cộng đồng designer để cùng học hỏi và phát triển nhé!",
    'page-resources': "Trợ Lý Oai Mini: Đây là kho tài nguyên miễn phí tôi dành tặng bạn.",
    'page-contact': "Trợ Lý Oai Mini: Đừng ngần ngại! Hãy gửi tin nhắn cho tôi nếu bạn cần tư vấn."
};

function showAssistantMessage(sectionId) {
    if (assistantMessages[sectionId] && speechBubble) {
        clearTimeout(speechTimeout);
        speechBubble.textContent = assistantMessages[sectionId];
        speechBubble.classList.remove('opacity-0');
        speechBubble.classList.add('opacity-100');
        speechTimeout = setTimeout(() => {
            speechBubble.classList.remove('opacity-100');
            speechBubble.classList.add('opacity-0');
        }, 5000);
    }
}

function toggleChat() {
    if (chatWidget && chatWidget.classList.contains('hidden')) {
        chatWidget.classList.remove('hidden');
        setTimeout(() => chatWidget.classList.add('open'), 10);
    } else if (chatWidget) {
        chatWidget.classList.remove('open');
        setTimeout(() => chatWidget.classList.add('hidden'), 400);
    }
}

async function sendMessage() {
    if (!chatInput || !chatMessages || !typingIndicator) return;
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;
    const userMessageDiv = document.createElement('div');
    userMessageDiv.className = 'user-message text-white text-sm rounded-lg p-2 max-w-xs';
    userMessageDiv.textContent = userMessage;
    chatMessages.appendChild(userMessageDiv);
    chatInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;
    typingIndicator.classList.remove('hidden');
    try {
        const apiKey = ""; 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
        const systemPrompt = "Bạn là 'Oai Mini', trợ lý AI trên website 'Oai Design'. Nhiệm vụ của bạn là CHỈ trả lời các câu hỏi liên quan đến nội dung, dịch vụ, tài nguyên, hoặc các chủ đề về thiết kế (design) có trên website này. Nếu người dùng hỏi về chủ đề không liên quan (ví dụ: thời tiết, chính trị, nấu ăn, các chủ đề chung chung...), bạn PHẢI lịch sự từ chối và hướng họ quay lại chủ đề của website. Luôn trả lời bằng tiếng Việt, ngắn gọn, thân thiện.";
        const payload = {
            contents: [{ parts: [{ text: userMessage }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const result = await response.json();
        const assistantResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "Xin lỗi, tôi gặp chút sự cố. Bạn thử lại nhé!";
        const assistantMessageDiv = document.createElement('div');
        assistantMessageDiv.className = 'assistant-message text-white text-sm rounded-lg p-2 max-w-xs';
        assistantMessageDiv.textContent = assistantResponse;
        chatMessages.appendChild(assistantMessageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'assistant-message text-white text-sm rounded-lg p-2 max-w-xs';
        errorDiv.textContent = 'Oops! Có lỗi xảy ra, vui lòng thử lại sau.';
        chatMessages.appendChild(errorDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } finally {
        typingIndicator.classList.add('hidden');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

if (assistantContainer) assistantContainer.addEventListener('click', toggleChat);
if (closeChatBtn) closeChatBtn.addEventListener('click', toggleChat);
if (sendChatBtn) sendChatBtn.addEventListener('click', sendMessage);
if (chatInput) chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

const observeSections = () => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
            if (entry.intersectionRatio > 0.5) {
                const sectionId = entry.target.id || entry.target.parentElement?.id; // Thêm ?. để tránh lỗi nếu không có parent
                if(sectionId) showAssistantMessage(sectionId);
            }
        });
    }, { threshold: [0.1, 0.5] });
    document.querySelectorAll('.reveal').forEach(el => {
        observer.observe(el);
    });
};

const videoData = [
    { id: 'Ck2ZMxG-aew', title: 'THIẾT KẾ KEY VISUAL E-COMEMERCE TRÊN ILUSSTRATOR | OAI DESIGN | LIVESTREAM DESIGN' },
    { id: 'w3AakiNW3cc', title: 'THIẾT KẾ SOCIAL POST TRUNG THU | OAI DESIGN | LIVESTREAM DESIGN' },
    { id: 'ytMcifLE57E', title: 'THIẾT KẾ SOCIAL POST | OAI DESIGN | | LIVESTREAM DESIGN' },
    { id: 'rmmNNzLY8Ko', title: 'THIẾT KẾ POSTER KỶ NIỆM 80 NĂM QUỐC KHÁNH NƯỚC CHXHCN VIỆT NAM | OAI DESIGN | LIVESTREAM DESIGN' },
    { id: 'RepirYxs8w0', title: 'THIẾT KẾ KEY VISUAL E-COMEMERCE TRÊN PHOTOSHOP | OAI DESIGN | | LIVESTREAM DESIGN' },
    { id: 'xAZKBqkPH9c', title: 'TẠO MODEL AI TRÊN FREEPIK | OAI DESIGN | | LIVESTREAM DESIGN' },
    { id: 'LzTaxUWopNc', title: 'THIẾT KẾ SOCIAL POST BEAUTY | OAI DESIGN | LIVESTREAM DESIGN' },
    { id: 'U8MLQNm8tH0', title: 'THIẾT KẾ KEY VISUAL HIGHLAND COFFEE | OAI DESIGN | LIVESTREAM DESIGN' }
];

function renderVideoGallery() {
    const grid = document.getElementById('video-grid');
    if (!grid) return;
    grid.innerHTML = '';
    videoData.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card group';
        card.dataset.videoId = video.id;
        card.innerHTML = `
            <img src="https://img.youtube.com/vi/${video.id}/hqdefault.jpg" alt="${video.title}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-40 transition-all duration-300"></div>
            <div class="play-icon">
                <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg>
            </div>
            <p class="absolute bottom-0 left-0 p-3 text-white font-semibold text-sm drop-shadow-lg">${video.title}</p>
        `;
        grid.appendChild(card);
    });
}

const videoGrid = document.getElementById('video-grid');
if (videoGrid) {
    videoGrid.addEventListener('click', function (e) {
        const card = e.target.closest('.video-card');
        if (card) {
            const videoId = card.dataset.videoId;
            const playerContainer = document.getElementById('video-player-container');
            if (playerContainer) {
                playerContainer.innerHTML = `
                    <iframe
                        class="w-full h-full"
                        src="https://www.youtube.com/embed/${videoId}?autoplay=1"
                        title="YouTube video player"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowfullscreen>
                    </iframe>
                `;
            }
            openModal('video-modal');
        }
    });
}

const backToTopBtn = document.getElementById('backToTopBtn');
if (backToTopBtn) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('show');
        } else {
            backToTopBtn.classList.remove('show');
        }
    });
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function initFlyingLogos() {
    const container = document.getElementById('logo-animation-container');
    if (!container) return;
    const logos = [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Adobe_Photoshop_CC_icon.svg/1024px-Adobe_Photoshop_CC_icon.svg.png',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Adobe_Illustrator_CC_icon.svg/1024px-Adobe_Illustrator_CC_icon.svg.png',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Adobe_Premiere_Pro_CC_icon.svg/1024px-Adobe_Premiere_Pro_CC_icon.svg.png',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Adobe_After_Effects_CC_icon.svg/1024px-Adobe_After_Effects_CC_icon.svg.png',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Adobe_Dimension_Logo.svg/512px-Adobe_Dimension_Logo.svg.png?20200617143151'
    ];
    const numberOfLogos = 15;
    for (let i = 0; i < numberOfLogos; i++) {
        const logo = document.createElement('img');
        logo.className = 'flying-logo';
        logo.src = logos[i % logos.length];
        logo.style.setProperty('--start-x', `${Math.random() * 100}vw`);
        logo.style.setProperty('--start-y', `${Math.random() * 100}vh`);
        logo.style.setProperty('--end-x', `${Math.random() * 100}vw`);
        logo.style.setProperty('--end-y', `${Math.random() * 100}vh`);
        const size = Math.random() * 40 + 20;
        logo.style.width = `${size}px`;
        logo.style.height = `${size}px`;
        const duration = Math.random() * 20 + 15;
        const delay = Math.random() * -duration;
        logo.style.animationDuration = `${duration}s`;
        logo.style.animationDelay = `${delay}s`;
        container.appendChild(logo);
    }
}

function moveGlass(element) {
    const navContainer = document.getElementById('desktop-nav');
    if (!navContainer) return;
    const glassBg = navContainer.querySelector('.nav-glass-bg');
    if (!element || !glassBg) return;
    // Thêm kiểm tra element có thực sự nằm trong navContainer không
    if (navContainer.contains(element)) {
        glassBg.style.width = `${element.offsetWidth}px`;
        glassBg.style.left = `${element.offsetLeft}px`;
    } else {
        // Nếu element không có trong nav (ví dụ: logout đang bị ẩn), ẩn kính đi
        glassBg.style.width = `0px`;
    }
}


const navContainer = document.getElementById('desktop-nav');
if (navContainer) {
    const glassBg = navContainer.querySelector('.nav-glass-bg');
    const navItems = navContainer.querySelectorAll('.nav-link');

    navItems.forEach(item => {
        item.addEventListener('mouseenter', () => moveGlass(item));
    });

    navContainer.addEventListener('mouseleave', () => {
        const activeItem = navContainer.querySelector('.nav-link.active');
        moveGlass(activeItem); // activeItem có thể là null nếu không có link nào active
    });
}


function typingAnimation() {
    const textElement = document.getElementById('typed-text');
    const signatureElement = document.getElementById('hero-signature');
    const cursorElement = document.querySelector('.cursor');
    const textContentWrapper = document.getElementById('hero-text-content');
    if (!textElement || !signatureElement || !cursorElement || !textContentWrapper) {
        console.warn('Typing animation elements not found.');
        return;
    }
    const fullText = "Chào anh em, mình là Oai Design đây. Mình hay Livestream chia sẻ góc nhìn cá nhân về thiết kế. Cách mình làm, mẹo mình dùng, chuyện vui buồn trong nghề. Đây không phải lớp học mà cũng không phải là khóa học, nó chỉ đơn giản là nơi anh em ngồi coi mình làm rồi bàn tán cho vui. Sau một thời gian đồng hành cùng các bạn, mình quyết định làm website này để có thể share file của mình cho các bạn một cách tiện nhất. Trong này có nhiều sự thú vị dành cho anh em, mong rằng sẽ giúp ích cho anh em.";
    let i = 0;

    function runAnimation() {
        i = 0;
        textElement.innerHTML = '';
        textContentWrapper.style.transition = 'none';
        signatureElement.style.transition = 'none';
        textContentWrapper.style.opacity = '1';
        signatureElement.style.opacity = '0';
        textContentWrapper.style.filter = 'none';
        signatureElement.style.filter = 'none';

        cursorElement.style.display = 'inline-block';
        cursorElement.style.animation = 'blink 1s infinite';
        cursorElement.style.opacity = '1';

        function type() {
            if (i < fullText.length) {
                textElement.innerHTML = `“${fullText.substring(0, i + 1)}”`;
                i++;
                setTimeout(type, 25);
            } else {
                signatureElement.style.transition = 'opacity 1s ease-in-out';
                signatureElement.style.opacity = '1';
                cursorElement.style.animation = 'none';
                cursorElement.style.opacity = '0';

                setTimeout(() => {
                    textContentWrapper.style.transition = 'opacity 0.8s ease-out, filter 0.8s ease-out';
                    signatureElement.style.transition = 'opacity 0.8s ease-out, filter 0.8s ease-out';
textContentWrapper.style.opacity = '0';
                    textContentWrapper.style.filter = 'blur(5px)';
                    signatureElement.style.opacity = '0';
                    signatureElement.style.filter = 'blur(5px)';
                    setTimeout(runAnimation, 1000);
                }, 10000);
            }
        }
        setTimeout(type, 500);
    }
    runAnimation();
}

// === NÂNG CẤP O-AI STUDIO LOGIC ===
function downloadImageFromButton(buttonElement) {
    const resultBlock = buttonElement.closest('.ai-result-block');
    if (!resultBlock) return;
    // Sửa selector để tìm đúng ảnh bên trong wrapper
    const img = resultBlock.querySelector('.ai-image-wrapper img');
    if (img && img.src && !img.src.startsWith('https://placehold.co')) { // Đảm bảo không tải placeholder
        const link = document.createElement('a');
        link.href = img.src;
        link.download = 'oai-studio-image.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        alert("Không tìm thấy ảnh hợp lệ để tải về."); // Giữ alert này
    }
}


// Task 7 & 4: Hàm phụ trợ lấy kích thước (Thêm logic 2K)
function getDimensions(aspectRatio, resolution) {
    let width = 1024;
    let height = 1024;

    if (resolution === '1K') {
        if (aspectRatio === '1:1') { width = 1024; height = 1024; }
        else if (aspectRatio === '16:9') { width = 1360; height = 768; } // ~1.77
        else if (aspectRatio === '9:16') { width = 768; height = 1360; } // ~0.56
        else if (aspectRatio === '4:3') { width = 1152; height = 864; } // 1.33
        else if (aspectRatio === '3:4') { width = 864; height = 1152; } // 0.75
    } else if (resolution === '2K') { // NÂNG CẤP 4: Thêm logic 2K
        if (aspectRatio === '1:1') { width = 2048; height = 2048; }
        else if (aspectRatio === '16:9') { width = 2720; height = 1536; } // Gần 2K chiều cao, giữ tỉ lệ
        else if (aspectRatio === '9:16') { width = 1536; height = 2720; } // Gần 2K chiều rộng, giữ tỉ lệ
        else if (aspectRatio === '4:3') { width = 2304; height = 1728; } // Gần 2K chiều rộng, giữ tỉ lệ
        else if (aspectRatio === '3:4') { width = 1728; height = 2304; } // Gần 2K chiều cao, giữ tỉ lệ
    }

    // Stable Diffusion yêu cầu kích thước là bội số của 64
    width = Math.round(width / 64) * 64;
    height = Math.round(height / 64) * 64;

    // Đảm bảo kích thước tối thiểu (ví dụ: SDXL cần ít nhất 512)
    width = Math.max(width, 512);
    height = Math.max(height, 512);

    return { width, height };
}



// Task 5, 6, 7: Cập nhật initializeOAIStudio
function initializeOAIStudio() {
    const sendBtn = document.getElementById('prompt-send-btn');
    const promptInput = document.getElementById('prompt-input');
    const modelSelection = document.getElementById('model-selection');
    const conversationArea = document.getElementById('oai-conversation-area');
    const placeholder = document.getElementById('ai-placeholder');
    const presetPromptsContainer = document.getElementById('preset-prompts-container');
    const aspectRatioSelection = document.getElementById('aspect-ratio-selection');
    const resolutionSelection = document.getElementById('resolution-selection');

    if (!sendBtn || !promptInput || !modelSelection || !conversationArea || !placeholder || !aspectRatioSelection || !resolutionSelection) {
        console.error("Một hoặc nhiều thành phần của O-AI Studio không được tìm thấy. Chức năng có thể bị ảnh hưởng.");
        return;
    }

    // === NÂNG CẤP BẢO MẬT: XÓA BỎ API KEY KHỎI CLIENT ===
    // const apiKeys = {
    //     google: 'AIzaSyAJ9z9WHlWVKqFbGIjQiSQdrtNT1g_vFu0',
    //     stability: '' // ĐIỀN API KEY STABILITY AI CỦA BẠN VÀO ĐÂY NẾU CÓ
    // };
    // === KẾT THÚC NÂNG CẤP BẢO MẬT ===

    // === NÂNG CẤP BẢO MẬT: Logic này bây giờ phải gọi Worker (backend) ===
    // (Hiện tại chúng ta sẽ vô hiệu hóa nó)
    const generateImage = async () => {
         alert("Chức năng O-AI Studio đang được bảo trì để nâng cấp bảo mật. Vui lòng quay lại sau!"); // Giữ alert này
         return; 
    
        // === TOÀN BỘ LOGIC CŨ BÊN DƯỚI SẼ BỊ VÔ HIỆU HÓA ===
        /*
        // Kiểm tra đăng nhập trước khi tạo ảnh
        if (!currentUser) {
             alert("Vui lòng đăng nhập để sử dụng O-AI Studio.");
             // Không cần gọi showPage('auth') vì overlay sẽ hiện nếu trang đang mở
             return;
        }

        const prompt = promptInput.value.trim();
        if (!prompt) {
            alert("Vui lòng nhập mô tả cho hình ảnh!");
            return;
        }

        const activeModelCard = modelSelection.querySelector('.model-card.active');
        const modelName = activeModelCard.dataset.modelName;
        const config = modelConfigs[modelName];

        if (!config || !config.endpoint) {
            alert(`Model "${modelName}" hiện chưa khả dụng hoặc chưa được cấu hình.`);
            return;
        }

        if ((modelName === 'Stable Diffusion' && !apiKeys.stability)) {
             alert(`API Key cho model Stable Diffusion chưa được cung cấp trong script.js. Vui lòng thêm key để sử dụng model này.`);
            return; // Chỉ chặn nếu chọn SD mà không có key
        }
         if (modelName === 'O-AI Nano' && !apiKeys.google) {
             alert(`API Key cho model O-AI Nano chưa được cung cấp trong script.js.`);
             return; // Chặn nếu chọn Nano mà không có key
        }

        placeholder.classList.add('hidden');

        // Lấy giá trị Tỷ lệ & Độ phân giải
        const activeAspectBtn = aspectRatioSelection.querySelector('.aspect-ratio-btn.active');
        const aspectRatio = activeAspectBtn ? activeAspectBtn.dataset.aspect : '1:1';
        const resolution = resolutionSelection.value || '1K';

        // Tính toán kích thước
        const { width, height } = getDimensions(aspectRatio, resolution);

        // Tạo khối loading ngay lập tức
        const newBlock = document.createElement('div');
        newBlock.className = 'conversation-block';
        newBlock.innerHTML = `
            <div class="user-prompt-block">
                <p>${prompt.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
            </div>
            <div class="ai-result-block">
                 <div class="loading-spinner flex flex-col justify-center items-center h-[512px]"> <!-- Đặt chiều cao cố định cho spinner -->
                    <svg class="animate-spin h-8 w-8 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p class="text-gray-400 mt-2 text-sm">AI đang vẽ (${width}x${height}), vui lòng đợi...</p> <!-- Hiển thị kích thước yêu cầu -->
                </div>
            </div>
        `;
        conversationArea.appendChild(newBlock);

        // Reset prompt input và cuộn xuống
        promptInput.value = '';
        promptInput.style.height = 'auto'; // Reset chiều cao
        conversationArea.scrollTop = conversationArea.scrollHeight;

        const resultBlock = newBlock.querySelector('.ai-result-block'); // Tham chiếu đến khối kết quả

        // Gọi API
        try {
            const payload = config.buildPayload(prompt, width, height);
            console.log(`Sending payload to ${modelName}:`, { prompt, width, height }); // Log payload để debug

            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers: config.headers,
                body: JSON.stringify(payload)
            });

             // Log chi tiết lỗi nếu có
            if (!response.ok) {
                let errorDetails = `API Error ${response.status}: ${response.statusText}`;
                try {
                    const errorJson = await response.json();
                    errorDetails += `\n${JSON.stringify(errorJson, null, 2)}`;
                } catch (e) {
                    const errorText = await response.text();
                    errorDetails += `\nResponse: ${errorText}`;
                }
                 console.error(errorDetails); // Log lỗi chi tiết
                throw new Error(`Yêu cầu API thất bại (Status: ${response.status}). Kiểm tra console để biết chi tiết.`);
            }


            const data = await response.json();
            const base64Data = config.getResult(data);

            if (base64Data) {
                const imageUrl = `data:image/png;base64,${base64Data}`;
                // Cập nhật khối kết quả với ảnh và nút tải
                resultBlock.innerHTML = `
                    <div class="ai-image-wrapper">
                         <img src="${imageUrl}" alt="AI generated image for: ${prompt.replace(/"/g, "'")}" class="block max-w-full max-h-full object-contain">
                    </div>
                    <div class="mt-3 flex gap-2"> <!-- Bỏ ID không cần thiết -->
                         <button class="ai-action-btn" onclick="downloadImageFromButton(this)">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            <span>Tải xuống</span>
                        </button>
                    </div>
                `;
            } else {
                 console.error("Không nhận được dữ liệu base64 hợp lệ từ API response:", data);
                throw new Error("Phản hồi API không chứa dữ liệu hình ảnh hợp lệ.");
            }
        } catch (error) {
            console.error("Lỗi trong quá trình tạo ảnh:", error);
            // Hiển thị lỗi trong khối kết quả
            resultBlock.innerHTML = `<p class="text-red-400 p-4 bg-red-900/20 rounded-lg text-sm"><b>Đã xảy ra lỗi:</b> ${error.message}</p>`;
        } finally {
             // Đảm bảo cuộn xuống cuối sau khi có kết quả hoặc lỗi
             conversationArea.scrollTop = conversationArea.scrollHeight;
        }
        */
    };
    
    // NÂNG CẤP BẢO MẬT: Xóa bỏ model configs vì chúng chứa API key
    /*
    const modelConfigs = {
        'Stable Diffusion': {
            endpoint: `https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image`,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${apiKeys.stability}`
            },
            buildPayload: (prompt, width, height) => ({
                text_prompts: [{ text: prompt }],
                cfg_scale: 7,
                height: height,
                width: width,
                steps: 30, // Có thể tăng steps để ảnh chi tiết hơn (vd: 40-50)
                samples: 1,
            }),
            getResult: (data) => data.artifacts?.[0]?.base64 // Thêm ?. để tránh lỗi nếu không có artifacts
        },
        'O-AI Nano': {
            endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKeys.google}`,
            headers: { 'Content-Type': 'application/json' },
            buildPayload: (prompt, width, height) => ({ // API này không dùng width/height
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseModalities: ["IMAGE"] }
            }),
            getResult: (data) => {
                const imagePart = data?.candidates?.[0]?.content?.parts?.find(part => part.inlineData && part.inlineData.mimeType.startsWith('image/'));
                return imagePart?.inlineData?.data;
            }
        },
        'O-AI Gen 4': { endpoint: null },
        'O-AI Gen 4 Ultra': { endpoint: null }
    };
    */
    // === KẾT THÚC NÂNG CẤP BẢO MẬT ===


    // Event Listeners (Không đổi)
    if (modelSelection) {
        const models = modelSelection.querySelectorAll('.model-card');
        models.forEach(model => {
            model.addEventListener('click', () => {
                if (model.innerHTML.includes('Coming Soon')) return;
                models.forEach(m => m.classList.remove('active'));
                model.classList.add('active');
            });
        });
    }

    if (aspectRatioSelection) {
        const aspectRatios = aspectRatioSelection.querySelectorAll('.aspect-ratio-btn');
        aspectRatios.forEach(btn => {
            btn.addEventListener('click', () => {
                aspectRatios.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    if (presetPromptsContainer) {
        presetPromptsContainer.addEventListener('click', (e) => {
            const promptItem = e.target.closest('.preset-prompt-card');
            if (promptItem && promptInput) {
                promptInput.value = promptItem.dataset.prompt;
                promptInput.focus();
                // Tự động điều chỉnh chiều cao sau khi chèn preset
                promptInput.style.height = 'auto';
                promptInput.style.height = (promptInput.scrollHeight) + 'px';
            }
        });
    }

    sendBtn.addEventListener('click', generateImage);
    promptInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            generateImage();
        }
    });

    promptInput.addEventListener('input', () => {
        promptInput.style.height = 'auto';
        promptInput.style.height = (promptInput.scrollHeight) + 'px';
    });
}