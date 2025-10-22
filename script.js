// --- KHAI BÁO BIẾN TOÀN CỤC ---
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
let profileSubscription = null; // Biến lưu "camera an ninh"

const authOverlay = document.getElementById('auth-overlay');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authButtonContainer = document.getElementById('auth-button-container');

// --- CÁC HÀM TIỆN ÍCH ---
function toggleAuthForms() {
    if (loginForm && registerForm) {
        loginForm.classList.toggle('hidden');
        registerForm.classList.toggle('hidden');
    }
}

function showPage(pageId, event) {
    if (event) event.preventDefault();
    pages.forEach(page => {
        if(pageElements[page]) pageElements[page].classList.add('hidden');
        if (navLinks[page]) navLinks[page].classList.remove('active');
    });
    if (navLinks.logout) navLinks.logout.classList.remove('active');
    if(pageElements[pageId]) pageElements[pageId].classList.remove('hidden');
    
    // Cần kiểm tra moveGlass tồn tại trước khi gọi
    if (typeof moveGlass === 'function') {
        const activeLink = navLinks[pageId] || (pageId === 'logout' ? document.getElementById('nav-logout') : null);
        if (activeLink) {
            activeLink.classList.add('active');
            moveGlass(activeLink);
        }
    }

    if (pageId === 'resources') {
        if (!currentUser) {
            if (authOverlay) authOverlay.style.display = 'flex';
        } else {
            if (authOverlay) authOverlay.style.display = 'none';
        }
        if (!resourcesInitialized) {
            initializeResources();
            resourcesInitialized = true;
        }
    }
    window.scrollTo(0, 0);
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) mobileMenu.classList.add('hidden');
    
    const zaloHelper = document.getElementById('zalo-helper');
    if (zaloHelper) {
        if (pageId === 'software') {
            zaloHelper.classList.remove('hidden');
        } else {
            zaloHelper.classList.add('hidden');
        }
    }
    
    if (typeof observeSections === 'function') {
        observeSections();
    }
}

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
                    alert('Tài khoản của bạn đã bị khóa và sẽ được đăng xuất.');
                    window.supabase.auth.signOut();
                }
            }
        )
        .subscribe();
    profileSubscription = channel;
}

async function unsubscribeFromProfileChanges() {
    if (profileSubscription) {
        await window.supabase.removeChannel(profileSubscription);
        profileSubscription = null;
    }
}

// --- LOGIC XÁC THỰC VỚI SUPABASE ---
function setupAuthStateObserver() {
    window.supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'INITIAL_SESSION' && session) {
            const { data, error } = await window.supabase
                .from('profiles')
                .select('is_banned')
                .eq('id', session.user.id)
                .single();
            if (error || (data && data.is_banned)) {
                alert("Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khóa.");
                await window.supabase.auth.signOut();
                return;
            }
        }
        const user = session?.user || null;
        currentUser = user;
        if (user) {
            updateUIForLoggedInUser(user);
            listenToProfileChanges(user.id);
            if (authOverlay && pageElements.resources && !pageElements.resources.classList.contains('hidden')) {
                authOverlay.style.display = 'none';
            }
            if (pageElements.auth && !pageElements.auth.classList.contains('hidden')) {
                showPage('home', null);
            }
        } else {
            updateUIForLoggedOutUser();
            unsubscribeFromProfileChanges();
            if (authOverlay && pageElements.resources && !pageElements.resources.classList.contains('hidden')) {
                authOverlay.style.display = 'flex';
            }
        }
    });
}

// --- LOGIC TẢI FILE (ĐÃ HOÀN THIỆN) ---
async function downloadResource(resourceId) {
    if (!currentUser) {
        alert("Vui lòng đăng nhập để tải tài nguyên!");
        showPage('auth', null);
        return;
    }

    if (!resourceId || resourceId === 'undefined') {
        console.error("Lỗi: resourceId không hợp lệ.");
        alert("Đã xảy ra lỗi, không thể tìm thấy tài nguyên này.");
        return;
    }

    try {
        const { data, error } = await window.supabase
            .from('resources')
            .select('downloadLink')
            .eq('id', resourceId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                 console.error('Không tìm thấy tài nguyên với ID:', resourceId);
                 alert('Không tìm thấy tài nguyên này trong cơ sở dữ liệu.');
            } else {
                throw error;
            }
            return;
        }

        if (data && data.downloadLink) {
            console.log('Tìm thấy link, đang mở:', data.downloadLink);
            window.open(data.downloadLink, '_blank');
        } else {
            console.warn('Không tìm thấy link tải cho resource ID:', resourceId);
            alert('Rất tiếc, link tải cho tài nguyên này chưa được cập nhật.');
        }

    } catch (error) {
        console.error("Lỗi khi lấy link tải:", error.message);
        alert("Đã xảy ra lỗi khi cố gắng lấy link tải. Vui lòng thử lại.");
    }
}


// --- CÁC HÀM CẬP NHẬT GIAO DIỆN VÀ XỬ LÝ SỰ KIỆN ---
function updateUIForLoggedInUser(user) {
    if (authButtonContainer) {
        const userMetadata = user.user_metadata;
        const displayName = userMetadata?.full_name || userMetadata?.name || user.email.split('@')[0];
        const avatarUrl = userMetadata?.avatar_url || 'https://i.imgur.com/3Z4Yp4J.png';
        authButtonContainer.innerHTML = `
            <a href="#" id="nav-logout" class="nav-link flex items-center gap-2" onclick="signOutUser(event)">
                <img src="${avatarUrl}" alt="Avatar" class="h-6 w-6 rounded-full object-cover">
                <span class="font-semibold">${displayName || 'Tài Khoản'}</span>
            </a>
        `;
        navLinks.auth = null;
        navLinks.logout = document.getElementById('nav-logout');
    }
}

function updateUIForLoggedOutUser() {
    if (authButtonContainer) {
        authButtonContainer.innerHTML = `
            <a href="#" id="nav-login" class="nav-link" onclick="showPage('auth', event)">
                <img src="https://i.imgur.com/3Z4Yp4J.png" alt="Login Icon" style="height: 20px;">
                <span>Đăng Nhập</span>
            </a>
        `;
        navLinks.logout = null;
        navLinks.auth = document.getElementById('nav-login');
    }
}

async function signInWithGoogle(event) {
    event.preventDefault();
    const { error } = await window.supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) {
        alert("Đăng nhập Google thất bại: " + error.message);
    }
}

async function handleEmailRegister(event) {
    event.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    if (!email || !password) {
        alert("Vui lòng nhập đầy đủ Email và Mật khẩu để đăng ký.");
        return;
    }
    if (password.length < 6) {
        alert("Mật khẩu phải có ít nhất 6 ký tự.");
        return;
    }
    const { error } = await window.supabase.auth.signUp({ email, password });
    if (error) {
        alert("Đăng ký thất bại: " + error.message);
    } else {
        alert("Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.");
    }
}

async function handleEmailLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    if (!email || !password) {
        alert("Vui lòng nhập đầy đủ Email và Mật khẩu để đăng nhập.");
        return;
    }
    const { error } = await window.supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert("Đăng nhập thất bại: " + error.message);
    } else {
        alert("Đăng nhập thành công!");
    }
}

async function signOutUser(event) {
    if (event) event.preventDefault();
    await unsubscribeFromProfileChanges();
    const { error } = await window.supabase.auth.signOut();
    if (error) {
        alert("Đăng xuất thất bại: " + error.message);
    } else {
        showPage('home', null);
    }
}

async function initializeResources() {
    const categoriesContainer = document.getElementById('resource-categories');
    const gridContainer = document.getElementById('resource-grid');
    if (!categoriesContainer || !gridContainer) return;

    gridContainer.innerHTML = `<p class="text-gray-400 col-span-full text-center">Đang tải tài nguyên...</p>`;
    const { data: resourceData, error } = await window.supabase.from('resources').select('*');
    if (error) {
        gridContainer.innerHTML = `<p class="text-red-400 col-span-full text-center">Không thể tải tài nguyên. Vui lòng thử lại sau.</p>`;
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
        filteredData.forEach(item => {
            const card = document.createElement('div');
            card.className = 'resource-card bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden flex flex-col';
            const categoryClass = item.category === 'Livestream' ? 'text-yellow-400 bg-yellow-500/10' : 'text-sky-400 bg-sky-500/10';
            card.innerHTML = `
                <img src="${item.imageUrl}" alt="${item.title}" class="w-full h-40 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/400x300/1f2937/9ca3af?text=Image+Not+Found';">
                <div class="p-4 flex flex-col flex-grow">
                    <h4 class="font-semibold text-white mb-1 flex-grow">${item.title}</h4>
                    <span class="text-xs ${categoryClass} px-2 py-1 rounded-full self-start mb-3">${item.category}</span>
                    <button data-id="${item.id}" class="download-btn mt-auto text-center w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">Tải Về</button>
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

document.addEventListener('DOMContentLoaded', () => {
    setupAuthStateObserver();
    
    const loginGoogleBtn = document.getElementById('login-google-btn');
    if (loginGoogleBtn) loginGoogleBtn.addEventListener('click', signInWithGoogle);
    
    const registerGoogleBtn = document.getElementById('register-google-btn');
    if (registerGoogleBtn) registerGoogleBtn.addEventListener('click', signInWithGoogle);
    
    const loginFormEl = document.querySelector('#login-form form');
    if (loginFormEl) loginFormEl.addEventListener('submit', handleEmailLogin);

    const registerFormEl = document.querySelector('#register-form form');
    if (registerFormEl) registerFormEl.addEventListener('submit', handleEmailRegister);
    
    const resourceGrid = document.getElementById('resource-grid');
    if(resourceGrid) {
        resourceGrid.addEventListener('click', (event) => {
            if (event.target && event.target.classList.contains('download-btn')) {
                const resourceId = event.target.dataset.id;
                downloadResource(resourceId);
            }
        });
    }

    showPage('home');
    if (typeof initFlyingLogos === 'function') initFlyingLogos();
    if (typeof renderVideoGallery === 'function') renderVideoGallery();
    if (typeof typingAnimation === 'function') typingAnimation();
    if (typeof initializeOAIStudio === 'function') initializeOAIStudio();

    const initialActive = document.querySelector('#desktop-nav .nav-link.active');
    setTimeout(() => {
        if (initialActive && typeof moveGlass === 'function') {
            moveGlass(initialActive);
        }
    }, 100);
});

// --- CÁC HÀM GIAO DIỆN KHÁC (Không thay đổi) ---
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
        const notifBar = document.querySelector('.fixed.bottom-4');
        if (notifBar) {
            notifBar.style.transform = 'translate(-50%, 150%)';
            setTimeout(() => notifBar.style.display = 'none', 300);
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
        const systemPrompt = "Bạn là một trợ lý ảo thân thiện và hữu ích tên là 'Oai Mini'. Bạn đang hỗ trợ trên trang web của một designer chuyên nghiệp. Hãy trả lời các câu hỏi của người dùng một cách ngắn gọn, vui vẻ và khuyến khích họ khám phá các dịch vụ. Luôn trả lời bằng tiếng Việt.";
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
                const sectionId = entry.target.id || entry.target.parentElement.id;
                showAssistantMessage(sectionId);
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

const navContainer = document.getElementById('desktop-nav');
if (navContainer) {
    const glassBg = navContainer.querySelector('.nav-glass-bg');
    const navItems = navContainer.querySelectorAll('.nav-link');

    function moveGlass(element) {
        if (!element || !glassBg) return;
        glassBg.style.width = `${element.offsetWidth}px`;
        glassBg.style.left = `${element.offsetLeft}px`;
    }

    navItems.forEach(item => {
        item.addEventListener('mouseenter', () => moveGlass(item));
    });

    navContainer.addEventListener('mouseleave', () => {
        const activeItem = navContainer.querySelector('.nav-link.active');
        moveGlass(activeItem);
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
    const img = resultBlock.querySelector('img');
    if (img && img.src) {
        const link = document.createElement('a');
        link.href = img.src;
        link.download = 'oai-studio-image.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        alert("Không tìm thấy ảnh để tải về.");
    }
}

function initializeOAIStudio() {
    const sendBtn = document.getElementById('prompt-send-btn');
    const promptInput = document.getElementById('prompt-input');
    const modelSelection = document.getElementById('model-selection');
    const conversationArea = document.getElementById('oai-conversation-area');
    const placeholder = document.getElementById('ai-placeholder');
    const presetPromptsContainer = document.getElementById('preset-prompts-container');
    const aspectRatioSelection = document.getElementById('aspect-ratio-selection');
    
    if (!sendBtn || !promptInput || !modelSelection || !conversationArea || !placeholder) {
        console.error("Một hoặc nhiều thành phần của O-AI Studio không được tìm thấy. Chức năng có thể bị ảnh hưởng.");
        return;
    }
    
    const apiKeys = {
        google: 'AIzaSyAJ9z9WHlWVKqFbGIjQiSQdrtNT1g_vFu0', 
        stability: ''
    };

    const modelConfigs = {
        'Stable Diffusion': {
            endpoint: `https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image`,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${apiKeys.stability}`
            },
            buildPayload: (prompt) => ({
                text_prompts: [{ text: prompt }],
                cfg_scale: 7,
                height: 1024,
                width: 1024,
                steps: 30,
                samples: 1,
            }),
            getResult: (data) => data.artifacts[0].base64
        },
        'O-AI Nano': {
            endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKeys.google}`,
            headers: { 'Content-Type': 'application/json' },
            buildPayload: (prompt) => ({
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

    const generateImage = async () => {
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
        
        if ((modelName === 'Stable Diffusion' && !apiKeys.stability) || (modelName === 'O-AI Nano' && !apiKeys.google)) {
            alert(`API Key cho model ${modelName} chưa được cung cấp. Vui lòng thêm API Key vào file script.js để tiếp tục.`);
            return;
        }

        placeholder.classList.add('hidden');

        const newBlock = document.createElement('div');
        newBlock.className = 'conversation-block';
        newBlock.innerHTML = `
            <div class="user-prompt-block">
                <p>${prompt.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
            </div>
            <div class="ai-result-block">
                <div class="loading-spinner flex flex-col justify-center items-center h-32">
                    <svg class="animate-spin h-8 w-8 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p class="text-gray-400 mt-2 text-sm">AI đang vẽ, vui lòng đợi trong giây lát...</p>
                </div>
            </div>
        `;
        conversationArea.appendChild(newBlock);
        promptInput.value = '';
        conversationArea.scrollTop = conversationArea.scrollHeight;

        const resultBlock = newBlock.querySelector('.ai-result-block');

        try {
            const payload = config.buildPayload(prompt);
            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers: config.headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch(e) { throw new Error(errorText || 'Lỗi không xác định từ API'); }
                throw new Error(errorData.error?.message || errorData.message || 'Lỗi không xác định từ API');
            }

            const data = await response.json();
            const base64Data = config.getResult(data);

            if (base64Data) {
                const imageUrl = `data:image/png;base64,${base64Data}`;
                resultBlock.innerHTML = `
                    <img src="${imageUrl}" alt="AI generated image for: ${prompt.replace(/"/g, "'")}" class="w-full rounded-lg">
                    <div id="image-actions-container" class="mt-3 flex gap-2 visible">
                         <button class="ai-action-btn" onclick="downloadImageFromButton(this)">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            <span>Tải xuống</span>
                        </button>
                    </div>
                `;
            } else {
                console.error("Không nhận được dữ liệu base64 từ API response:", data);
                throw new Error("Không nhận được dữ liệu hình ảnh hợp lệ.");
            }
        } catch (error) {
            console.error("Lỗi khi tạo ảnh:", error);
            resultBlock.innerHTML = `<p class="text-red-400 p-4 bg-red-900/20 rounded-lg"><b>Đã xảy ra lỗi:</b> ${error.message}</p>`;
        }
    };
    
    // Event Listeners
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
                const event = new Event('input', { bubbles: true });
                promptInput.dispatchEvent(event);
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