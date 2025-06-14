const authSection = document.getElementById('auth-section');
const loginButton = document.getElementById('login-button');
const uploadLink = document.getElementById('upload-link');
const authStatusSpan = document.getElementById('auth-status');
const AUTH_API_URL = `${API_BASE_URL}/api/auth`;
let isAuthenticated = false;
let currentUser = null;
function createAuthModal() {
    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(5px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: var(--background);
        border-radius: 20px;
        padding: 2rem;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        transform: translateY(20px);
        transition: transform 0.3s ease;
        border: 1px solid var(--border-color);
    `;
    modalContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 2rem;">
            <div style="width: 60px; height: 60px; background: var(--primary-gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; box-shadow: var(--shadow-medium);">
                <i class="fas fa-university" style="color: white; font-size: 1.5rem;"></i>
            </div>
            <h2 style="margin: 0; color: var(--text-primary); font-size: 1.5rem; font-weight: 600;">统一认证登录</h2>
            <p style="margin: 0.5rem 0 0; color: var(--text-secondary); font-size: 0.9rem;">请输入您的学号和统一认证密码</p>
        </div>
        <div style="margin-bottom: 1.5rem;">
            <div style="position: relative;">
                <i class="fas fa-user" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-secondary);"></i>
                <input type="text" id="auth-username-input" placeholder="请输入学号" style="
                    width: 100%;
                    padding: 1rem 1rem 1rem 3rem;
                    border: 2px solid var(--border-color);
                    border-radius: 12px;
                    font-size: 1rem;
                    background: var(--background-alt);
                    color: var(--text-primary);
                    transition: all 0.3s ease;
                    box-sizing: border-box;
                ">
            </div>
            <div style="position: relative; margin-top: 1rem;">
                <i class="fas fa-lock" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-secondary);"></i>
                <input type="password" id="auth-password-input" placeholder="请输入统一认证密码" style="
                    width: 100%;
                    padding: 1rem 1rem 1rem 3rem;
                    border: 2px solid var(--border-color);
                    border-radius: 12px;
                    font-size: 1rem;
                    background: var(--background-alt);
                    color: var(--text-primary);
                    transition: all 0.3s ease;
                    box-sizing: border-box;
                ">
            </div>
            <div id="auth-error" style="margin-top: 0.5rem; color: var(--accent-color); font-size: 0.8rem; min-height: 1rem;"></div>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); text-align: center; margin-bottom: 1.5rem;">
            <i class="fas fa-shield-alt"></i> 您的密码仅用于向学校服务器验证身份，本站不会存储。
        </div>
        <div style="display: flex; gap: 1rem;">
            <button id="auth-cancel-btn" style="
                flex: 1;
                padding: 0.8rem 1.5rem;
                background: var(--background-dark);
                color: var(--text-secondary);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s ease;
            ">取消</button>
            <button id="auth-submit-btn" style="
                flex: 2;
                padding: 0.8rem 1.5rem;
                background: var(--primary-gradient);
                color: white;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
            ">
                <i class="fas fa-sign-in-alt"></i>
                <span>登录</span>
            </button>
        </div>
    `;
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    setTimeout(() => {
        modal.style.opacity = '1';
        modalContent.style.transform = 'translateY(0)';
    }, 50);
    const usernameInput = modal.querySelector('#auth-username-input');
    const passwordInput = modal.querySelector('#auth-password-input');
    const submitBtn = modal.querySelector('#auth-submit-btn');
    const cancelBtn = modal.querySelector('#auth-cancel-btn');
    const errorDiv = modal.querySelector('#auth-error');
    usernameInput.focus();
    [usernameInput, passwordInput].forEach(input => {
        input.addEventListener('focus', () => {
            input.style.borderColor = 'var(--primary-color)';
            input.style.boxShadow = '0 0 0 3px rgba(46, 139, 87, 0.1)';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = 'var(--border-color)';
            input.style.boxShadow = 'none';
        });
    });
    cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = 'var(--border-color)';
        cancelBtn.style.transform = 'translateY(-1px)';
    });
    cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = 'var(--background-dark)';
        cancelBtn.style.transform = 'translateY(0)';
    });
    submitBtn.addEventListener('mouseenter', () => {
        submitBtn.style.transform = 'translateY(-1px)';
        submitBtn.style.boxShadow = 'var(--shadow-medium)';
    });
    submitBtn.addEventListener('mouseleave', () => {
        submitBtn.style.transform = 'translateY(0)';
        submitBtn.style.boxShadow = 'none';
    });
    function setLoading(loading) {
        if (loading) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
            submitBtn.innerHTML = `
                <div style="width: 16px; height: 16px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <span>验证中...</span>
            `;
        } else {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.innerHTML = `
                <i class="fas fa-sign-in-alt"></i>
                <span>验证</span>
            `;
        }
    }
    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.style.color = 'var(--accent-color)';
        passwordInput.style.borderColor = 'var(--accent-color)';
        passwordInput.style.animation = 'shake 0.3s ease-in-out';
        setTimeout(() => {
            passwordInput.style.animation = '';
        }, 300);
    }
    function closeModal() {
        modal.style.opacity = '0';
        modalContent.style.transform = 'translateY(20px)';
        setTimeout(() => {
            document.body.removeChild(modal);
        }, 300);
    }
    return new Promise((resolve, reject) => {
        async function handleSubmit() {
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();
            if (!username) {
                showError('请输入学号');
                usernameInput.focus();
                return;
            }
            if (!password) {
                showError('请输入统一认证密码');
                passwordInput.focus();
                return;
            }
            setLoading(true);
            errorDiv.textContent = '';
            try {
                const response = await fetch(`${AUTH_API_URL}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    submitBtn.innerHTML = `
                        <i class="fas fa-check"></i>
                        <span>登录成功</span>
                    `;
                    submitBtn.style.background = 'var(--success-color)';
                    setTimeout(() => {
                        closeModal();
                        resolve({ token: result.token, user: result.user });
                    }, 1000);
                } else {
                    setLoading(false);
                    showError(result.error || '登录失败，请检查学号和密码');
                }
            } catch (error) {
                setLoading(false);
                showError(`网络错误: ${error.message}`);
                console.error("登录请求出错:", error);
            }
        }
        function handleCancel() {
            closeModal();
            reject(new Error('用户取消验证'));
        }
        submitBtn.addEventListener('click', handleSubmit);
        cancelBtn.addEventListener('click', handleCancel);
        [usernameInput, passwordInput].forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    handleSubmit();
                } else if (e.key === 'Escape') {
                    handleCancel();
                }
            });
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        });
    });
}
async function checkAuth() {
    try {
        const { token, user } = await createAuthModal();
        isAuthenticated = true;
        currentUser = user;
        const expiryTime = new Date().getTime() + 24 * 60 * 60 * 1000;
        const authData = { token, user, expiry: expiryTime };
        localStorage.setItem('authData', JSON.stringify(authData));
        updateUIBasedOnAuth();
        document.dispatchEvent(new CustomEvent('authSuccess', {
            detail: { token, user }
        }));
        if (typeof showNotification === 'function') {
            showNotification(`欢迎回来, ${user.name}！`, 'success');
        }
    } catch (error) {
        console.log('用户取消登录或登录失败:', error.message);
    }
}
function checkStoredAuth() {
    const storedAuthData = localStorage.getItem('authData');
    if (storedAuthData) {
        try {
            const authData = JSON.parse(storedAuthData);
            const now = new Date().getTime();
            if (authData.expiry && authData.expiry > now && authData.token && authData.user) {
                isAuthenticated = true;
                currentUser = authData.user;
                console.log('从 localStorage 恢复登录状态');
                document.dispatchEvent(new CustomEvent('authRestored', {
                    detail: { token: authData.token, user: authData.user }
                }));
                return true;
            } else {
                localStorage.removeItem('authData');
                console.log('存储的登录信息无效或已过期，已清除');
            }
        } catch (e) {
            console.error('解析存储的登录信息时出错:', e);
            localStorage.removeItem('authData');
        }
    }
    isAuthenticated = false;
    currentUser = null;
    return false;
}
function updateUIBasedOnAuth() {
    if (isAuthenticated && currentUser) {
        if (loginButton) {
            loginButton.innerHTML = `
                <i class="fas fa-user-check"></i>
                <span>${currentUser.name}</span>
            `;
            loginButton.disabled = true;
            loginButton.style.background = 'var(--success-color)';
            loginButton.style.cursor = 'not-allowed';
        }
        if (uploadLink) {
            uploadLink.style.display = 'inline-flex';
            uploadLink.style.animation = 'fadeInUp 0.5s ease';
        }
        if (authStatusSpan) {
            authStatusSpan.textContent = `状态：已登录 (${currentUser.name})`;
            authStatusSpan.style.color = 'var(--success-color)';
        }
    } else {
        if (loginButton) {
            loginButton.innerHTML = `
                <i class="fas fa-sign-in-alt"></i>
                <span>统一认证登录</span>
            `;
            loginButton.disabled = false;
            loginButton.style.background = '';
            loginButton.style.cursor = 'pointer';
        }
        if (uploadLink) {
            uploadLink.style.display = 'none';
        }
        if (authStatusSpan) {
            authStatusSpan.textContent = '状态：未登录';
            authStatusSpan.style.color = 'var(--warning-color)';
        }
    }
}
function isUserAuthenticated() {
    return isAuthenticated;
}
function getAuthToken() {
    const storedAuthData = localStorage.getItem('authData');
    if (storedAuthData) {
        try {
            const authData = JSON.parse(storedAuthData);
            if (authData.token && authData.expiry > new Date().getTime()) {
                return authData.token;
            }
        } catch (e) {
            return null;
        }
    }
    return null;
}
function logout() {
    isAuthenticated = false;
    currentUser = null;
    localStorage.removeItem('authData');
    console.log('用户登出，清除登录信息');
    updateUIBasedOnAuth();
    if (typeof directoryCache !== 'undefined') {
        Object.keys(directoryCache).forEach(key => delete directoryCache[key]);
    }
    const fileListElement = document.getElementById('file-list');
    if (fileListElement) {
        fileListElement.innerHTML = `
            <li class="empty-state" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <i class="fas fa-user-shield" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                请先登录以查看文件
            </li>
        `;
    }
    if (typeof showNotification === 'function') {
        showNotification('已安全登出', 'info');
    }
}
if (loginButton) {
    loginButton.addEventListener('click', checkAuth);
}
document.addEventListener('DOMContentLoaded', () => {
    checkStoredAuth();
    updateUIBasedOnAuth();
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .auth-modal input:focus {
            outline: none;
        }
        .auth-modal button:disabled {
            cursor: not-allowed !important;
        }
    `;
    document.head.appendChild(style);
});
window.checkAuth = checkAuth;
window.logout = logout;
