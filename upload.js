const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const passwordInput = document.getElementById('password-input');
const uploadStatus = document.getElementById('upload-status');
const fileDropZone = document.getElementById('file-drop-zone');
const selectedFileInfo = document.getElementById('selected-file-info');
const removeFileBtn = document.getElementById('remove-file-btn');
const uploadSubmitBtn = document.getElementById('upload-submit-btn');
const uploadProgress = document.getElementById('upload-progress');
const progressFill = document.getElementById('progress-fill');
const progressPercentage = document.getElementById('progress-percentage');
const progressStatus = document.getElementById('progress-status');
const passwordToggle = document.getElementById('password-toggle');
const themeToggle = document.getElementById('theme-toggle');
const UPLOAD_API_URL = `${API_BASE_URL}/api/upload`;
let selectedFile = null;
let isDragging = false;
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}
function updateThemeIcon(theme) {
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
}
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    setTimeout(() => {
        document.body.style.transition = '';
    }, 300);
}
function createParticleBackground() {
    const particlesContainer = document.getElementById('particles-background');
    if (!particlesContainer) return;
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 4 + 2}px;
            height: ${Math.random() * 4 + 2}px;
            background: rgba(46, 139, 87, ${Math.random() * 0.3 + 0.1});
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: particleFloat ${Math.random() * 15 + 15}s linear infinite;
        `;
        particlesContainer.appendChild(particle);
    }
}
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
function getFileIcon(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    const iconMap = {
        'pdf': 'fas fa-file-pdf',
        'doc': 'fas fa-file-word',
        'docx': 'fas fa-file-word',
        'xls': 'fas fa-file-excel',
        'xlsx': 'fas fa-file-excel',
        'ppt': 'fas fa-file-powerpoint',
        'pptx': 'fas fa-file-powerpoint',
        'txt': 'fas fa-file-alt',
        'jpg': 'fas fa-file-image',
        'jpeg': 'fas fa-file-image',
        'png': 'fas fa-file-image',
        'gif': 'fas fa-file-image',
        'mp4': 'fas fa-file-video',
        'avi': 'fas fa-file-video',
        'mov': 'fas fa-file-video',
        'mp3': 'fas fa-file-audio',
        'wav': 'fas fa-file-audio',
        'zip': 'fas fa-file-archive',
        'rar': 'fas fa-file-archive'
    };
    return iconMap[ext] || 'fas fa-file';
}
function validateFile(file) {
    const maxSize = 100 * 1024 * 1024;
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/gif',
        'video/mp4',
        'video/avi',
        'video/quicktime',
        'audio/mpeg',
        'audio/wav',
        'application/zip',
        'application/x-rar-compressed'
    ];
    if (file.size > maxSize) {
        return { valid: false, error: `文件大小超过限制（最大 ${formatBytes(maxSize)}）` };
    }
    if (!allowedTypes.includes(file.type) && file.type !== '') {
        console.warn(`文件类型 ${file.type} 可能不被完全支持`);
    }
    return { valid: true };
}
function showSelectedFile(file) {
    selectedFile = file;
    const iconClass = getFileIcon(file.name);
    selectedFileInfo.querySelector('.file-icon-preview i').className = iconClass;
    selectedFileInfo.querySelector('.file-name').textContent = file.name;
    selectedFileInfo.querySelector('.file-size').textContent = formatBytes(file.size);
    selectedFileInfo.style.display = 'block';
    fileDropZone.style.display = 'none';
    selectedFileInfo.style.opacity = '0';
    selectedFileInfo.style.transform = 'translateY(10px)';
    setTimeout(() => {
        selectedFileInfo.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        selectedFileInfo.style.opacity = '1';
        selectedFileInfo.style.transform = 'translateY(0)';
    }, 50);
}
function clearSelectedFile() {
    selectedFile = null;
    fileInput.value = '';
    selectedFileInfo.style.display = 'none';
    fileDropZone.style.display = 'flex';
    resetProgress();
}
function resetProgress() {
    uploadProgress.style.display = 'none';
    progressFill.style.width = '0%';
    progressPercentage.textContent = '0%';
    progressStatus.textContent = '准备上传...';
}
function updateProgress(percentage, status) {
    uploadProgress.style.display = 'block';
    progressFill.style.width = percentage + '%';
    progressPercentage.textContent = percentage + '%';
    progressStatus.textContent = status;
}
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#27AE60' : type === 'error' ? '#E74C3C' : '#3498DB'};
        color: white;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        font-weight: 500;
    `;
    const icon = type === 'success' ? 'fas fa-check-circle' : type === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-info-circle';
    notification.innerHTML = `<i class="${icon}" style="margin-right: 0.5rem;"></i>${message}`;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}
function showUploadStatus(message, type = 'info') {
    uploadStatus.innerHTML = `
        <div class="status-message status-${type}">
            <i class="${type === 'success' ? 'fas fa-check-circle' : type === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    if (type === 'success') {
        setTimeout(() => {
            uploadStatus.innerHTML = '';
        }, 5000);
    }
}
function fillPasswordIfAuthenticated() {
    if (typeof isUserAuthenticated === 'function' && isUserAuthenticated()) {
        const password = getAuthPassword();
        if (password && passwordInput) {
            passwordInput.value = password;
            console.log('已自动填充验证口令。');
            showNotification('已自动填充验证口令', 'info');
        }
    }
}
function handleFileSelect(file) {
    const validation = validateFile(file);
    if (!validation.valid) {
        showNotification(validation.error, 'error');
        return;
    }
    showSelectedFile(file);
    showNotification('文件选择成功', 'success');
}
async function handleUpload(event) {
    event.preventDefault();
    if (!selectedFile) {
        showNotification('请选择要上传的文件', 'error');
        return;
    }
    const password = passwordInput.value.trim();
    if (!password) {
        showNotification('请输入验证密码', 'error');
        passwordInput.focus();
        return;
    }
    const authPassword = typeof getAuthPassword === 'function' ? getAuthPassword() : null;
    if (password !== authPassword) {
        showNotification('输入的验证密码与当前会话不符，请检查或返回首页重新验证。', 'error');
        passwordInput.focus();
        return;
    }
    uploadSubmitBtn.disabled = true;
    uploadSubmitBtn.innerHTML = `
        <div style="width: 16px; height: 16px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span>上传中...</span>
    `;
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('password', password);
    try {
        updateProgress(0, '开始上传...');
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentage = Math.round((e.loaded / e.total) * 100);
                updateProgress(percentage, `上传中... ${formatBytes(e.loaded)} / ${formatBytes(e.total)}`);
            }
        });
        xhr.addEventListener('load', () => {
            try {
                const result = JSON.parse(xhr.responseText);
                if (xhr.status === 200 && result.success) {
                    updateProgress(100, '上传完成！');
                    showUploadStatus(`文件 "${result.filename || selectedFile.name}" 上传成功！`, 'success');
                    showNotification('文件上传成功！', 'success');
                    setTimeout(() => {
                        clearSelectedFile();
                        passwordInput.value = '';
                        resetProgress();
                    }, 2000);
                } else {
                    throw new Error(result.error || `HTTP ${xhr.status}`);
                }
            } catch (error) {
                showUploadStatus(`上传失败: ${error.message}`, 'error');
                showNotification(`上传失败: ${error.message}`, 'error');
                resetProgress();
            }
        });
        xhr.addEventListener('error', () => {
            showUploadStatus('上传过程中发生网络错误', 'error');
            showNotification('网络错误，请检查连接后重试', 'error');
            resetProgress();
        });
        xhr.open('POST', UPLOAD_API_URL);
        xhr.send(formData);
    } catch (error) {
        console.error('上传请求出错:', error);
        showUploadStatus(`上传请求出错: ${error.message}`, 'error');
        showNotification(`上传请求出错: ${error.message}`, 'error');
        resetProgress();
    } finally {
        setTimeout(() => {
            uploadSubmitBtn.disabled = false;
            uploadSubmitBtn.innerHTML = `
                <i class="fas fa-upload"></i>
                <span>开始上传</span>
            `;
        }, 1000);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    createParticleBackground();
    fillPasswordIfAuthenticated();
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    if (passwordToggle) {
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            passwordToggle.querySelector('i').className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        });
    }
    if (fileDropZone) {
        fileDropZone.addEventListener('click', () => {
            fileInput.click();
        });
        fileDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isDragging) {
                isDragging = true;
                fileDropZone.style.borderColor = 'var(--primary-color)';
                fileDropZone.style.backgroundColor = 'rgba(46, 139, 87, 0.1)';
            }
        });
        fileDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!fileDropZone.contains(e.relatedTarget)) {
                isDragging = false;
                fileDropZone.style.borderColor = '';
                fileDropZone.style.backgroundColor = '';
            }
        });
        fileDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isDragging = false;
            fileDropZone.style.borderColor = '';
            fileDropZone.style.backgroundColor = '';
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });
    }
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }
    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', () => {
            clearSelectedFile();
            showNotification('已清除选中文件', 'info');
        });
    }
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);
    }
});
document.addEventListener('authSuccess', fillPasswordIfAuthenticated);
document.addEventListener('authRestored', fillPasswordIfAuthenticated);
const style = document.createElement('style');
style.textContent = `
    @keyframes particleFloat {
        0% { transform: translateY(0px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    .upload-hero {
        padding: 2rem 1rem;
    }
    .upload-stats {
        display: flex;
        gap: 2rem;
        justify-content: center;
        margin-top: 2rem;
        flex-wrap: wrap;
    }
    .stat-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--text-secondary);
        font-size: 0.9rem;
    }
    .upload-container {
        max-width: 800px;
        margin: 0 auto;
    }
    .upload-card {
        background: var(--background);
        border-radius: 20px;
        box-shadow: var(--shadow-heavy);
        overflow: hidden;
        margin-bottom: 2rem;
    }
    .upload-header {
        background: var(--background-alt);
        padding: 2rem;
        text-align: center;
        border-bottom: 1px solid var(--border-color);
    }
    .upload-description {
        color: var(--text-secondary);
        margin: 0.5rem 0 0;
    }
    .upload-form {
        padding: 2rem;
    }
    .file-drop-zone {
        border: 2px dashed var(--border-color);
        border-radius: 15px;
        padding: 3rem 2rem;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s ease;
        background: var(--background-alt);
        margin-bottom: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
    }
    .file-drop-zone:hover {
        border-color: var(--primary-light);
        background: rgba(46, 139, 87, 0.05);
    }
    .drop-zone-icon {
        font-size: 3rem;
        color: var(--primary-color);
        margin-bottom: 1rem;
    }
    .drop-zone-text h3 {
        margin: 0 0 0.5rem;
        color: var(--text-primary);
    }
    .drop-zone-text p {
        margin: 0 0 1rem;
        color: var(--text-secondary);
    }
    .browse-text {
        color: var(--primary-color);
        font-weight: 500;
    }
    .file-types {
        font-size: 0.8rem;
        color: var(--text-light);
    }
    .selected-file-info {
        margin-bottom: 2rem;
    }
    .file-preview {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1.5rem;
        background: var(--background-alt);
        border-radius: 12px;
        border: 1px solid var(--border-color);
    }
    .file-icon-preview {
        width: 50px;
        height: 50px;
        background: var(--primary-gradient);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.5rem;
    }
    .file-details {
        flex: 1;
    }
    .file-details .file-name {
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 0.2rem;
    }
    .file-details .file-size {
        font-size: 0.9rem;
        color: var(--text-secondary);
    }
    .remove-file-btn {
        width: 32px;
        height: 32px;
        border: none;
        background: var(--accent-color);
        color: white;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .remove-file-btn:hover {
        background: #c0392b;
        transform: scale(1.1);
    }
    .form-group {
        margin-bottom: 2rem;
    }
    .form-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.8rem;
        font-weight: 500;
        color: var(--text-primary);
    }
    .password-input-container {
        position: relative;
    }
    .form-input {
        width: 100%;
        padding: 1rem;
        border: 2px solid var(--border-color);
        border-radius: 12px;
        font-size: 1rem;
        background: var(--background);
        color: var(--text-primary);
        transition: all 0.3s ease;
        box-sizing: border-box;
    }
    .form-input:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(46, 139, 87, 0.1);
    }
    .password-toggle {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 0.5rem;
    }
    .form-hint {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.5rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    .upload-progress {
        margin-bottom: 2rem;
        padding: 1.5rem;
        background: var(--background-alt);
        border-radius: 12px;
        border: 1px solid var(--border-color);
    }
    .progress-bar {
        width: 100%;
        height: 8px;
        background: var(--background-dark);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 1rem;
    }
    .progress-fill {
        height: 100%;
        background: var(--primary-gradient);
        border-radius: 4px;
        transition: width 0.3s ease;
        width: 0%;
    }
    .progress-text {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.9rem;
        color: var(--text-secondary);
    }
    .upload-submit-btn {
        width: 100%;
        padding: 1rem 2rem;
        background: var(--primary-gradient);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.8rem;
        box-shadow: var(--shadow-light);
    }
    .upload-submit-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: var(--shadow-medium);
    }
    .upload-submit-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none;
    }
    .upload-status {
        margin-top: 1.5rem;
    }
    .status-message {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 1rem;
        border-radius: 10px;
        font-weight: 500;
    }
    .status-success {
        background: rgba(39, 174, 96, 0.1);
        color: var(--success-color);
        border: 1px solid rgba(39, 174, 96, 0.2);
    }
    .status-error {
        background: rgba(231, 76, 60, 0.1);
        color: var(--accent-color);
        border: 1px solid rgba(231, 76, 60, 0.2);
    }
    .status-info {
        background: rgba(52, 152, 219, 0.1);
        color: var(--secondary-color);
        border: 1px solid rgba(52, 152, 219, 0.2);
    }
    .upload-guide {
        background: var(--background);
        border-radius: 15px;
        padding: 2rem;
        box-shadow: var(--shadow-light);
    }
    .upload-guide h3 {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
        color: var(--text-primary);
    }
    .upload-guide ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    .upload-guide li {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        margin-bottom: 0.8rem;
        color: var(--text-secondary);
    }
    .upload-guide li i {
        color: var(--success-color);
        width: 16px;
    }
    @media (max-width: 768px) {
        .upload-stats {
            gap: 1rem;
        }
        .stat-item {
            font-size: 0.8rem;
        }
        .file-drop-zone {
            padding: 2rem 1rem;
            min-height: 150px;
        }
        .drop-zone-icon {
            font-size: 2rem;
        }
        .upload-form {
            padding: 1.5rem;
        }
        .upload-header {
            padding: 1.5rem;
        }
    }
`;
document.head.appendChild(style);