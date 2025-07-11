const authSection = document.getElementById('auth-section');
const loginButton = document.getElementById('login-button');
const adminLoginButton = document.getElementById('admin-login-button');
const uploadLink = document.getElementById('upload-btn-link');
const authStatusSpan = document.getElementById('auth-status');
const AUTH_API_URL = `${API_BASE_URL}/api/auth`;
let isAuthenticated = false;
let isAdminAuthenticated = false;
let currentPassword = null;
let currentAdminPassword = null;
function getAdminPassword() {
   if (isAdminAuthenticated && currentAdminPassword) {
       return currentAdminPassword;
   }
   const storedAdminAuth = sessionStorage.getItem('adminAuth');
   if (storedAdminAuth) {
       try {
           const adminAuthData = JSON.parse(storedAdminAuth);
           if (adminAuthData.password) {
               isAdminAuthenticated = true;
               currentAdminPassword = adminAuthData.password;
               return currentAdminPassword;
           }
       } catch (e) {
           console.error('Error parsing admin auth data from sessionStorage', e);
           sessionStorage.removeItem('adminAuth');
       }
   }
   return null;
}
function createAuthModal(options = {}) {
    const {
        title = '身份验证',
        subtitle = '请输入访问口令以继续',
        placeholder = '请输入访问口令',
        buttonText = '验证',
        iconClass = 'fa-key',
        performValidation = true,
        action = null
    } = options;
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
                <i class="fas ${iconClass}" style="color: white; font-size: 1.5rem;"></i>
            </div>
            <h2 style="margin: 0; color: var(--text-primary); font-size: 1.5rem; font-weight: 600;">${title}</h2>
            <p style="margin: 0.5rem 0 0; color: var(--text-secondary); font-size: 0.9rem;">${subtitle}</p>
        </div>
        <div style="margin-bottom: 2rem;">
            <div style="position: relative;">
                <i class="fas fa-lock" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-secondary);"></i>
                <input type="password" id="auth-password-input" placeholder="${placeholder}" style="
                    width: 100%;
                    padding: 1rem 3.5rem 1rem 3rem;
                    border: 2px solid var(--border-color);
                    border-radius: 12px;
                    font-size: 1rem;
                    background: var(--background-alt);
                    color: var(--text-primary);
                    transition: all 0.3s ease;
                    box-sizing: border-box;
                ">
                <i class="fas fa-eye" id="toggle-password-visibility" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-secondary); cursor: pointer; transition: color 0.2s;"></i>
            </div>
            <div id="auth-error" style="margin-top: 0.5rem; color: var(--accent-color); font-size: 0.8rem; min-height: 1rem;"></div>
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
                <span>${buttonText}</span>
            </button>
        </div>
        <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color); text-align: center;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.8rem;">
                <i class="fas fa-info-circle"></i>
                <span>这是来自"生科树洞"的知识传承平台</span>
            </div>
        </div>
    `;
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    setTimeout(() => {
        modal.style.opacity = '1';
        modalContent.style.transform = 'translateY(0)';
    }, 50);
    const passwordInput = modal.querySelector('#auth-password-input');
    const submitBtn = modal.querySelector('#auth-submit-btn');
    const cancelBtn = modal.querySelector('#auth-cancel-btn');
    const errorDiv = modal.querySelector('#auth-error');
    const togglePasswordBtn = modal.querySelector('#toggle-password-visibility');
    passwordInput.focus();
    togglePasswordBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        togglePasswordBtn.classList.toggle('fa-eye', !isPassword);
        togglePasswordBtn.classList.toggle('fa-eye-slash', isPassword);
        togglePasswordBtn.style.color = isPassword ? 'var(--primary-color)' : 'var(--text-secondary)';
    });
    passwordInput.addEventListener('focus', () => {
        passwordInput.style.borderColor = 'var(--primary-color)';
        passwordInput.style.boxShadow = '0 0 0 3px rgba(46, 139, 87, 0.1)';
    });
    passwordInput.addEventListener('blur', () => {
        passwordInput.style.borderColor = 'var(--border-color)';
        passwordInput.style.boxShadow = 'none';
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
                <span>${buttonText}</span>
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
            if (modal.parentNode) {
                document.body.removeChild(modal);
            }
        }, 300);
    }
    return new Promise((resolve, reject) => {
        async function handleSubmit() {
            const password = passwordInput.value.trim();
            if (!password) {
                showError('输入不能为空');
                return;
            }
            if (action) {
                setLoading(true);
                errorDiv.textContent = '';
                try {
                    await action(password);
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `
                        <i class="fas fa-check"></i>
                        <span>操作成功</span>
                    `;
                    submitBtn.style.background = 'var(--success-color)';
                    setTimeout(() => {
                        closeModal();
                        resolve(password);
                    }, 1000);
                } catch (error) {
                    setLoading(false);
                    showError(error.message || '操作失败');
                }
                return;
            }
            if (!performValidation) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `
                    <i class="fas fa-check"></i>
                    <span>已确认</span>
                `;
                submitBtn.style.background = 'var(--success-color)';
                setTimeout(() => {
                    closeModal();
                    resolve(password);
                }, 500);
                return;
            }
            setLoading(true);
            errorDiv.textContent = '';
            try {
                const response = await fetch(AUTH_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        password: password,
                        type: options.isAdmin ? 'admin' : 'user'
                    }),
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    submitBtn.innerHTML = `
                        <i class="fas fa-check"></i>
                        <span>验证成功</span>
                    `;
                    submitBtn.style.background = 'var(--success-color)';
                    setTimeout(() => {
                        closeModal();
                        resolve(password);
                    }, 1000);
                } else {
                    setLoading(false);
                    showError(result.error || '验证失败，请检查口令是否正确');
                }
            } catch (error) {
                setLoading(false);
                showError(`网络错误: ${error.message}`);
                console.error("验证请求出错:", error);
            }
        }
        function handleCancel() {
            closeModal();
            reject(new Error('用户取消验证'));
        }
        submitBtn.addEventListener('click', handleSubmit);
        cancelBtn.addEventListener('click', handleCancel);
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleSubmit();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
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
        const password = await createAuthModal({
            title: '身份验证',
            subtitle: '请输入访问口令以继续',
            placeholder: '请输入访问口令',
            buttonText: '验证',
            iconClass: 'fa-key',
            performValidation: true
        });
        isAuthenticated = true;
        currentPassword = password;
        const expiryTime = new Date().getTime() + 24 * 60 * 60 * 1000;
        const authData = {
            password: password,
            expiry: expiryTime
        };
        localStorage.setItem('authData', JSON.stringify(authData));
        updateUIBasedOnAuth();
        document.dispatchEvent(new CustomEvent('authSuccess', {
            detail: { password: currentPassword }
        }));
        if (typeof showNotification === 'function') {
            showNotification('身份验证成功！欢迎回到生科树洞', 'success');
        }
    } catch (error) {
        console.log('用户取消验证或验证失败:', error.message);
    }
}
async function checkAdminAuth() {
   try {
       const password = await createAuthModal({
           title: '管理员验证',
           subtitle: '请输入管理员密码以进行高级操作',
           placeholder: '请输入管理员密码',
           buttonText: '验证',
           iconClass: 'fa-user-shield',
           performValidation: true,
           isAdmin: true
       });
       isAdminAuthenticated = true;
       currentAdminPassword = password;
       sessionStorage.setItem('adminAuth', JSON.stringify({ password: password }));
       updateUIBasedOnAuth();
       if (typeof showNotification === 'function') {
           showNotification('管理员验证成功！', 'success');
       }
   } catch (error) {
       console.log('管理员验证取消或失败:', error.message);
   }
}
function checkStoredAuth() {
    const storedAuthData = localStorage.getItem('authData');
    if (storedAuthData) {
        try {
            const authData = JSON.parse(storedAuthData);
            const now = new Date().getTime();
            if (authData.expiry && authData.expiry > now && authData.password) {
                isAuthenticated = true;
                currentPassword = authData.password;
                console.log('从 localStorage 恢复验证状态');
                document.dispatchEvent(new CustomEvent('authRestored', {
                    detail: { password: currentPassword }
                }));
                return true;
            } else {
                localStorage.removeItem('authData');
                console.log('存储的验证信息无效或已过期，已清除');
            }
        } catch (e) {
            console.error('解析存储的验证信息时出错:', e);
            localStorage.removeItem('authData');
        }
    }
    isAuthenticated = false;
    currentPassword = null;
    return false;
}
function updateUIBasedOnAuth() {
    if (isAuthenticated) {
        if (loginButton) {
            loginButton.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <span>已验证</span>
            `;
            loginButton.disabled = true;
            loginButton.style.background = 'var(--success-color)';
            loginButton.style.cursor = 'not-allowed';
        }
       if (adminLoginButton) {
           adminLoginButton.style.display = 'inline-flex';
           if (isAdminAuthenticated) {
               adminLoginButton.innerHTML = `
                   <i class="fas fa-user-check"></i>
                   <span>管理员</span>
               `;
               adminLoginButton.disabled = true;
               adminLoginButton.style.background = 'var(--accent-color)';
                adminLoginButton.style.cursor = 'not-allowed';
           } else {
                adminLoginButton.innerHTML = `
                   <i class="fas fa-user-shield"></i>
                   <span>管理员验证</span>
               `;
               adminLoginButton.disabled = false;
               adminLoginButton.style.background = '';
               adminLoginButton.style.cursor = 'pointer';
           }
       }
        if (uploadLink) {
            const currentPath = typeof getCurrentPath === 'function' ? getCurrentPath() : '';
            uploadLink.href = `upload.html${currentPath ? '?path=' + encodeURIComponent(currentPath) : ''}`;
            uploadLink.style.display = 'inline-flex';
        }
        if (authStatusSpan) {
            authStatusSpan.textContent = '状态：已验证';
            authStatusSpan.style.color = 'var(--success-color)';
        }
    } else {
        if (loginButton) {
            loginButton.innerHTML = `
                <i class="fas fa-user"></i>
                <span>口令验证</span>
            `;
            loginButton.disabled = false;
            loginButton.style.background = '';
            loginButton.style.cursor = 'pointer';
        }
       if (adminLoginButton) {
           adminLoginButton.style.display = 'none';
       }
        if (uploadLink) {
            uploadLink.style.display = 'none';
        }
        if (authStatusSpan) {
            authStatusSpan.textContent = '状态：未验证';
            authStatusSpan.style.color = 'var(--warning-color)';
        }
    }
}
function isUserAuthenticated() {
    return isAuthenticated;
}
function getAuthPassword() {
    return currentPassword;
}
function logout() {
    isAuthenticated = false;
    currentPassword = null;
    localStorage.removeItem('authData');
   sessionStorage.removeItem('adminAuth');
   isAdminAuthenticated = false;
   currentAdminPassword = null;
    console.log('用户登出，清除验证信息');
    updateUIBasedOnAuth();
    if (typeof directoryCache !== 'undefined') {
        Object.keys(directoryCache).forEach(key => delete directoryCache[key]);
    }
    const fileListElement = document.getElementById('file-list');
    if (fileListElement) {
        fileListElement.innerHTML = `
            <li class="empty-state" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <i class="fas fa-user-shield" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                请先完成验证以查看文件
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
if (adminLoginButton) {
   adminLoginButton.addEventListener('click', checkAdminAuth);
}
document.addEventListener('DOMContentLoaded', () => {
    checkStoredAuth();
   getAdminPassword();
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
        #auth-password-input::-ms-reveal,
        #auth-password-input::-webkit-reveal {
            display: none;
        }
    `;
    document.head.appendChild(style);
});
window.checkAuth = checkAuth;
window.logout = logout;
window.isUserAuthenticated = isUserAuthenticated;
