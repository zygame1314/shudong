const authSection = document.getElementById('auth-section');
const loginButton = document.getElementById('login-button');
const uploadLink = document.getElementById('upload-link');
const authStatusSpan = document.getElementById('auth-status');

let currentPassword = null;
let isAuthenticated = false;

const AUTH_API_URL = '/api/auth';

async function checkAuth() {
    const password = prompt("请输入访问口令：");
    if (!password) {
        alert("请输入口令。");
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = '验证中...';

    try {
        const response = await fetch(AUTH_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: password }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
            isAuthenticated = true;
            currentPassword = password;
            updateUIBasedOnAuth();
            document.dispatchEvent(new CustomEvent('authSuccess', { detail: { password: currentPassword } }));
            alert("验证成功！");
        } else {
            isAuthenticated = false;
            currentPassword = null;
            updateUIBasedOnAuth();
            alert(`验证失败: ${result.error || '未知错误'}`);
        }
    } catch (error) {
        console.error("验证请求出错:", error);
        isAuthenticated = false;
        currentPassword = null;
        updateUIBasedOnAuth();
        alert(`验证请求出错: ${error.message}`);
    } finally {
        if (!isAuthenticated) {
            loginButton.disabled = false;
            loginButton.textContent = '登录/验证';
        }
    }
}

function updateUIBasedOnAuth() {
    if (isAuthenticated) {
        if (loginButton) {
            loginButton.textContent = '已验证';
            loginButton.disabled = true;
        }
        if (uploadLink) {
             uploadLink.style.display = 'inline-block';
        }
        if (authStatusSpan) {
            authStatusSpan.textContent = '状态：已验证';
            authStatusSpan.style.color = 'lightgreen';
        }
    } else {
        if (loginButton) {
            loginButton.textContent = '登录/验证';
            loginButton.disabled = false;
        }
         if (uploadLink) {
             uploadLink.style.display = 'none';
         }
         if (authStatusSpan) {
            authStatusSpan.textContent = '状态：未验证';
            authStatusSpan.style.color = 'yellow';
         }
    }
}

function isUserAuthenticated() {
    return isAuthenticated;
}

function getAuthPassword() {
    return currentPassword;
}


if (loginButton) {
    loginButton.addEventListener('click', checkAuth);
}

document.addEventListener('DOMContentLoaded', () => {
    isAuthenticated = false;
    currentPassword = null;
    updateUIBasedOnAuth();
});