const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const passwordInput = document.getElementById('password-input');
const uploadStatus = document.getElementById('upload-status');
const authStatusSpan = document.getElementById('auth-status');

const UPLOAD_API_URL = `${API_BASE_URL}/api/upload`;

function updateUploadPageAuthStatus() {
    if (typeof isUserAuthenticated === 'function' && isUserAuthenticated()) {
        authStatusSpan.textContent = '状态：已验证';
        authStatusSpan.style.color = 'lightgreen';
    } else {
        authStatusSpan.textContent = '状态：未验证 (需要首页验证)';
        authStatusSpan.style.color = 'yellow';
    }
}

async function handleUpload(event) {
    event.preventDefault();

    const file = fileInput.files[0];
    const password = passwordInput.value;

    if (!file) {
        uploadStatus.textContent = '请选择要上传的文件。';
        uploadStatus.style.color = 'red';
        return;
    }
    if (!password) {
        uploadStatus.textContent = '请输入验证口令。';
        uploadStatus.style.color = 'red';
        return;
    }

    uploadStatus.textContent = `正在上传 ${file.name}...`;
    uploadStatus.style.color = 'blue';
    uploadForm.querySelector('button[type="submit"]').disabled = true;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);

    try {
        const response = await fetch(UPLOAD_API_URL, {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();

        if (response.ok && result.success) {
            uploadStatus.textContent = `文件 ${result.filename || file.name} 上传成功！`;
            uploadStatus.style.color = 'green';
            uploadForm.reset();
        } else {
            uploadStatus.textContent = `上传失败: ${result.error || `HTTP ${response.status}`}`;
            uploadStatus.style.color = 'red';
            passwordInput.value = '';
        }
    } catch (error) {
        console.error('上传请求出错:', error);
        uploadStatus.textContent = `上传请求出错: ${error.message}`;
        uploadStatus.style.color = 'red';
    } finally {
        uploadForm.querySelector('button[type="submit"]').disabled = false;
    }
}

uploadForm.addEventListener('submit', handleUpload);

document.addEventListener('DOMContentLoaded', updateUploadPageAuthStatus);
document.addEventListener('authSuccess', updateUploadPageAuthStatus);