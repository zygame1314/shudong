const fileListElement = document.getElementById('file-list');
const breadcrumbListElement = document.getElementById('breadcrumb-list');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const themeToggle = document.getElementById('theme-toggle');
const fileCountElement = document.getElementById('file-count');
const totalSizeElement = document.getElementById('total-size');
const viewButtons = document.querySelectorAll('.view-btn');
const filterButtons = document.querySelectorAll('.filter-btn');
const fileListContainer = document.querySelector('.file-list-container');
const previewModal = document.getElementById('preview-modal');
const previewTitle = document.getElementById('preview-title');
const previewIframe = document.getElementById('preview-iframe');
const closePreviewBtn = document.getElementById('close-preview');
const API_BASE_URL = 'https://shudong.zygame1314.site';
const FILES_API_URL = `${API_BASE_URL}/api/files`;
const DOWNLOAD_API_BASE_URL = `${API_BASE_URL}/api/download`;
let currentPrefix = '';
let currentView = 'list';
let currentFilter = 'all';
const directoryCache = {};
let isShowingSearchResults = false;
let isSelectionMode = false;
let selectedItems = new Set();
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
    const existingParticles = particlesContainer.querySelectorAll('.particle');
    existingParticles.forEach(p => p.remove());
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 4 + 2}px;
            height: ${Math.random() * 4 + 2}px;
            background: rgba(46, 139, 87, ${Math.random() * 0.5 + 0.1});
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: particleFloat ${Math.random() * 10 + 10}s linear infinite;
        `;
        particlesContainer.appendChild(particle);
    }
}
function formatBytes(bytes, decimals = 2) {
    if (bytes == null || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.max(0, Math.floor(Math.log(bytes) / Math.log(k)));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
    return (isNaN(size) ? 0 : size) + ' ' + sizes[i];
}
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) {
        return Math.floor(interval) + " 年前";
    }
    interval = seconds / 2592000;
    if (interval > 1) {
        return Math.floor(interval) + " 个月前";
    }
    interval = seconds / 86400;
    if (interval > 1) {
        return Math.floor(interval) + " 天前";
    }
    interval = seconds / 3600;
    if (interval > 1) {
        return Math.floor(interval) + " 小时前";
    }
    interval = seconds / 60;
    if (interval > 1) {
        return Math.floor(interval) + " 分钟前";
    }
    return "刚刚";
}
function getFileIcon(fileName, isDirectory = false) {
    if (isDirectory) return 'fas fa-folder';
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
        'rar': 'fas fa-file-archive',
        '7z': 'fas fa-file-archive'
    };
    return iconMap[ext] || 'fas fa-file';
}
function getFileType(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    const typeMap = {
        'pdf': 'pdf',
        'doc': 'doc',
        'docx': 'doc',
        'xls': 'doc',
        'xlsx': 'doc',
        'ppt': 'doc',
        'pptx': 'doc',
        'txt': 'doc',
        'jpg': 'image',
        'jpeg': 'image',
        'png': 'image',
        'gif': 'image',
        'mp4': 'video',
        'avi': 'video',
        'mov': 'video'
    };
    return typeMap[ext] || 'default';
}
async function fetchFileStats() {
    const password = getAuthPassword();
    if (!password) {
        if (fileCountElement) fileCountElement.textContent = '验证后可用';
        return;
    }
    try {
        const response = await fetch(`${FILES_API_URL}?action=stats`, {
            headers: { 'Authorization': `Bearer ${password}` }
        });
        const result = await response.json();
        if (response.ok && result.success) {
            const { fileCount, totalSize } = result.stats;
            if (fileCountElement) {
                fileCountElement.textContent = `${fileCount} 个文件`;
            }
            if (totalSizeElement) {
                totalSizeElement.textContent = formatBytes(totalSize);
                const divider = document.querySelector('.stat-divider');
                if (divider) divider.style.display = 'inline';
            }
        } else {
            if (fileCountElement) fileCountElement.textContent = '统计失败';
            console.error('获取统计信息失败:', result.error);
        }
    } catch (error) {
        if (fileCountElement) fileCountElement.textContent = '统计出错';
        console.error('请求统计信息出错:', error);
    }
}
async function downloadFile(fileKey) {
    const password = getAuthPassword();
    if (!password) {
        showNotification("无法下载：未获取到验证口令。请重新验证。", 'error');
        return;
    }
    const downloadUrl = `${DOWNLOAD_API_BASE_URL}/${encodeURIComponent(fileKey)}`;
    const statusElementId = `status-${fileKey.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const statusElement = document.getElementById(statusElementId);
    const downloadBtn = document.querySelector(`[onclick*="${fileKey}"]`);
    if (statusElement) statusElement.textContent = '下载中...';
    if (downloadBtn) {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 下载中';
    }
    try {
        const response = await fetch(downloadUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${password}`,
            },
        });
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileKey.includes('/') ? fileKey.substring(fileKey.lastIndexOf('/') + 1) : fileKey;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            if (statusElement) statusElement.textContent = '下载完成';
            showNotification('文件下载完成', 'success');
        } else {
            const errorResult = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
            console.error(`下载 ${fileKey} 失败:`, errorResult);
            showNotification(`下载失败: ${errorResult.error || response.statusText}`, 'error');
            if (statusElement) statusElement.textContent = `下载失败`;
        }
    } catch (error) {
        console.error(`下载 ${fileKey} 请求出错:`, error);
        showNotification(`下载错误: ${error.message}`, 'error');
        if (statusElement) statusElement.textContent = `下载错误`;
    } finally {
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> 下载';
        }
        setTimeout(() => {
            const finalStatusElement = document.getElementById(statusElementId);
            if (finalStatusElement) finalStatusElement.textContent = '';
        }, 5000);
    }
}
async function deleteFile(key, isDirectory) {
    try {
        await createAuthModal({
            title: '确认删除',
            subtitle: `你确定要永久删除 "${key}" 吗？此操作不可逆！`,
            placeholder: '请输入管理员密码以确认删除',
            buttonText: '确认删除',
            iconClass: 'fa-exclamation-triangle',
            action: async (adminPassword) => {
                const password = getAuthPassword();
                if (!password) {
                    throw new Error("无法删除：未获取到验证口令。请重新验证。");
                }
                const response = await fetch(`${FILES_API_URL}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${password}`,
                    },
                    body: JSON.stringify({
                        key: key,
                        adminPassword: adminPassword
                    }),
                });
                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.error || '删除失败，请检查管理员密码或稍后重试');
                }
                showNotification(`${isDirectory ? '文件夹' : '文件'} "${key}" 已删除`, 'success');
                const parentPrefix = key.includes('/') ? key.substring(0, key.lastIndexOf('/') + 1) : '';
                if (directoryCache[currentPrefix]) {
                    delete directoryCache[currentPrefix];
                }
                if (directoryCache[parentPrefix]) {
                    delete directoryCache[parentPrefix];
                }
                fetchAndDisplayFiles(currentPrefix);
            }
        });
    } catch (error) {
        if (error.message !== '用户取消验证') {
            showNotification(`删除操作失败: ${error.message}`, 'error');
        } else {
            showNotification('删除操作已取消', 'info');
        }
        console.log('删除操作处理完毕:', error.message);
        }
    }
    async function previewFile(fileKey, fileName, fileSize) {
        if (fileSize > 2 * 1024 * 1024) {
            showNotification('文件超过2MB，不支持预览。', 'info');
            return;
        }
        const extension = fileName.split('.').pop().toLowerCase();
        const officeExtensions = ['docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls'];
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
        const password = getAuthPassword();
        if (!password) {
            showNotification("无法预览：未获取到验证口令。", 'error');
            return;
        }
        const previewLoader = previewModal.querySelector('.preview-loader');
        previewTitle.textContent = `预览: ${fileName}`;
        previewModal.classList.add('visible');
        previewLoader.style.display = 'flex';
        previewIframe.style.display = 'none';
        const existingImage = previewModal.querySelector('.preview-image');
        if (existingImage) {
            existingImage.remove();
        }
        try {
            let isImagePreview = imageExtensions.includes(extension);
            if (extension === 'pdf' || officeExtensions.includes(extension) || isImagePreview) {
                const response = await fetch(`${API_BASE_URL}/api/preview?key=${encodeURIComponent(fileKey)}`, {
                    headers: { 'Authorization': `Bearer ${password}` }
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.error || '无法获取文件预览链接');
                }
                const previewUrl = data.url;
                const hideLoader = () => {
                    previewLoader.style.display = 'none';
                };
                if (isImagePreview) {
                    const img = document.createElement('img');
                    img.src = previewUrl;
                    img.className = 'preview-image';
                    img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain; display: none; margin: auto;';
                    img.onload = () => {
                        hideLoader();
                        img.style.display = 'block';
                    };
                    img.onerror = () => {
                        hideLoader();
                        showNotification('图片加载失败', 'error');
                    };
                    previewIframe.parentElement.appendChild(img);
                } else {
                    previewIframe.onload = hideLoader;
                    previewIframe.onerror = () => {
                        hideLoader();
                        showNotification('预览加载失败', 'error');
                    };
                    if (officeExtensions.includes(extension)) {
                        const xdocinBaseUrl = "https://view.xdocin.com/view";
                        const params = new URLSearchParams({
                            src: previewUrl,
                            title: fileName,
                            printable: 'false',
                            copyable: 'false',
                            watermark: '生科树洞'
                        });
                        previewIframe.src = `${xdocinBaseUrl}?${params.toString()}`;
                    } else {
                        previewIframe.src = previewUrl;
                    }
                    previewIframe.style.display = 'block';
                }
            } else {
                showNotification('该文件类型不支持预览。', 'info');
                previewModal.classList.remove('visible');
                return;
            }
        } catch (error) {
            console.error("预览文件时出错:", error);
            showNotification(`预览失败: ${error.message}`, 'error');
            previewLoader.style.display = 'none';
            previewModal.classList.remove('visible');
        }
    }
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
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
function updateBreadcrumb(prefix, isSearch = false, searchTerm = '') {
    if (!breadcrumbListElement) return;
    breadcrumbListElement.innerHTML = '';
    if (isSearch) {
        const searchItem = document.createElement('li');
        searchItem.className = 'breadcrumb-item';
        searchItem.setAttribute('aria-current', 'page');
        searchItem.innerHTML = `<i class="fas fa-search" style="margin-right: 0.5rem;"></i>搜索结果: "${searchTerm}"`;
        breadcrumbListElement.appendChild(searchItem);
        return;
    }
    const rootLi = document.createElement('li');
    rootLi.classList.add('breadcrumb-item');
    const rootLink = document.createElement('a');
    rootLink.href = '#';
    rootLink.textContent = '根目录';
    rootLink.onclick = (e) => {
        e.preventDefault();
        fetchAndDisplayFiles('');
    };
    rootLi.appendChild(rootLink);
    breadcrumbListElement.appendChild(rootLi);
    if (prefix) {
        const parts = prefix.endsWith('/') ? prefix.slice(0, -1).split('/') : prefix.split('/');
        let currentPath = '';
        parts.forEach((part, index) => {
            currentPath += part + '/';
            const li = document.createElement('li');
            li.classList.add('breadcrumb-item');
            if (index === parts.length - 1) {
                li.textContent = part;
                li.setAttribute('aria-current', 'page');
            } else {
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = part;
                const pathOnClick = currentPath;
                link.onclick = (e) => {
                    e.preventDefault();
                    fetchAndDisplayFiles(pathOnClick);
                };
                li.appendChild(link);
            }
            breadcrumbListElement.appendChild(li);
        });
    }
}
function createFileListItem(item, isDirectory, isGlobalSearch = false) {
    const li = document.createElement('li');
    li.className = 'file-list-item';
    li.dataset.key = item.key;
    li.style.opacity = '0';
    li.style.transform = 'translateY(20px)';
    const fileType = isDirectory ? 'folder' : getFileType(item.name);
    const iconClass = getFileIcon(item.name, isDirectory);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'file-checkbox';
    checkbox.dataset.key = item.key;
    checkbox.onchange = (e) => handleItemSelection(e.target, item);
    const fileItemDiv = document.createElement('div');
    fileItemDiv.className = 'file-item';
    fileItemDiv.innerHTML = `
        <div class="file-icon ${fileType}">
            <i class="${iconClass}"></i>
        </div>
        <div class="file-info">
            <div class="file-name">${item.name}</div>
            ${!isDirectory ? `<div class="file-meta">${formatBytes(item.size)} • ${formatDate(item.uploaded)}</div>` : '<div class="file-meta">文件夹</div>'}
        </div>
    `;
    const fileActionsDiv = document.createElement('div');
    fileActionsDiv.className = 'file-actions';
    fileActionsDiv.innerHTML = `
        ${!isDirectory ? `
            ${item.size > 2 * 1024 * 1024
                ? `<button class="preview-button" disabled title="文件超过2MB，不支持预览">
                       <i class="fas fa-eye-slash"></i>
                       预览
                   </button>`
                : `<button class="preview-button">
                       <i class="fas fa-eye"></i>
                       预览
                   </button>`
            }
            <button class="download-button">
                <i class="fas fa-download"></i>
                下载
            </button>
        ` : ''}
        <button class="delete-button">
            <i class="fas fa-trash"></i>
        </button>
    `;
    li.appendChild(checkbox);
    li.appendChild(fileItemDiv);
    li.appendChild(fileActionsDiv);
    if (!isDirectory) {
        const previewBtn = fileActionsDiv.querySelector('.preview-button');
        if (previewBtn && !previewBtn.disabled) {
            previewBtn.onclick = () => previewFile(item.key, item.name, item.size);
        }
        const downloadBtn = fileActionsDiv.querySelector('.download-button');
        if (downloadBtn) {
            downloadBtn.onclick = () => downloadFile(item.key);
        }
    }
    const deleteBtn = fileActionsDiv.querySelector('.delete-button');
    if (deleteBtn) {
        deleteBtn.onclick = () => deleteFile(item.key, isDirectory);
    }
    if (isDirectory) {
        fileItemDiv.style.cursor = 'pointer';
        fileItemDiv.onclick = (e) => {
            if (!isSelectionMode) {
                if (searchInput) searchInput.value = '';
                fetchAndDisplayFiles(item.key);
            }
        };
    }
    li.onclick = (e) => {
        if (isSelectionMode && e.target.type !== 'checkbox') {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        }
    };
    setTimeout(() => {
        li.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        li.style.opacity = '1';
        li.style.transform = 'translateY(0)';
    }, Math.random() * 200);
    return li;
}
function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;
    fileListElement.classList.toggle('selection-mode', isSelectionMode);
    const selectionModeBtn = document.getElementById('selection-mode-btn');
    selectionModeBtn.classList.toggle('active', isSelectionMode);
    selectionModeBtn.title = isSelectionMode ? '退出选择模式' : '进入选择模式';
    if (!isSelectionMode) {
        selectedItems.clear();
        document.querySelectorAll('.file-checkbox').forEach(cb => cb.checked = false);
        document.querySelectorAll('.file-list-item.selected').forEach(item => item.classList.remove('selected'));
    }
    updateSelectionToolbar();
}
function handleItemSelection(checkbox, item) {
    const listItem = checkbox.closest('.file-list-item');
    if (checkbox.checked) {
        selectedItems.add(item.key);
        listItem.classList.add('selected');
    } else {
        selectedItems.delete(item.key);
        listItem.classList.remove('selected');
    }
    updateSelectionToolbar();
}
function updateSelectionToolbar() {
    const toolbar = document.getElementById('selection-toolbar');
    const countSpan = document.getElementById('selection-count');
    const selectedCount = selectedItems.size;
    if (isSelectionMode && selectedCount > 0) {
        toolbar.classList.add('visible');
        countSpan.textContent = `已选择 ${selectedCount} 项`;
    } else {
        toolbar.classList.remove('visible');
    }
}
async function handleBatchDelete() {
    const keysToDelete = Array.from(selectedItems);
    if (keysToDelete.length === 0) {
        showNotification('没有选择任何项目', 'info');
        return;
    }
    try {
        await createAuthModal({
            title: '确认批量删除',
            subtitle: `你确定要永久删除选中的 ${keysToDelete.length} 个项目吗？此操作不可逆！`,
            placeholder: '请输入管理员密码以确认删除',
            buttonText: '确认删除',
            iconClass: 'fa-exclamation-triangle',
            action: async (adminPassword) => {
                const password = getAuthPassword();
                if (!password) {
                    throw new Error("无法删除：未获取到验证口令。请重新验证。");
                }
                const response = await fetch(`${FILES_API_URL}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${password}`,
                    },
                    body: JSON.stringify({
                        keys: keysToDelete,
                        adminPassword: adminPassword
                    }),
                });
                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.error || '批量删除失败，请检查管理员密码或稍后重试');
                }
                showNotification(`成功删除了 ${result.deletedCount} 个项目`, 'success');
                keysToDelete.forEach(key => {
                    const parentPrefix = key.includes('/') ? key.substring(0, key.lastIndexOf('/') + 1) : '';
                    if (directoryCache[parentPrefix]) {
                        delete directoryCache[parentPrefix];
                    }
                });
                if (directoryCache[currentPrefix]) {
                    delete directoryCache[currentPrefix];
                }
                selectedItems.clear();
                toggleSelectionMode();
                fetchAndDisplayFiles(currentPrefix);
            }
        });
    } catch (error) {
        if (error.message !== '用户取消验证') {
            showNotification(`批量删除操作失败: ${error.message}`, 'error');
        } else {
            showNotification('批量删除操作已取消', 'info');
        }
        console.log('批量删除操作处理完毕:', error.message);
    }
}
async function handleBatchDownload() {
    const keysToDownload = Array.from(selectedItems);
    if (keysToDownload.length === 0) {
        showNotification('没有选择任何项目', 'info');
        return;
    }
    const password = getAuthPassword();
    if (!password) {
        showNotification("无法下载：未获取到验证口令。请重新验证。", 'error');
        return;
    }
    const downloadBtn = document.getElementById('batch-download-btn');
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 打包中...';
    showNotification(`正在准备下载 ${keysToDownload.length} 个项目...`, 'info');
    try {
        const response = await fetch(`${API_BASE_URL}/api/batch-download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${password}`,
            },
            body: JSON.stringify({ keys: keysToDownload }),
        });
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
            a.download = `shudong_batch_${timestamp}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showNotification('文件包下载完成', 'success');
            toggleSelectionMode();
        } else {
            const errorResult = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
            console.error(`批量下载失败:`, errorResult);
            showNotification(`批量下载失败: ${errorResult.error || response.statusText}`, 'error');
        }
    } catch (error) {
        console.error(`批量下载请求出错:`, error);
        showNotification(`批量下载错误: ${error.message}`, 'error');
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> 批量下载';
    }
}
function renderFileList(prefix, data, isGlobalSearch = false, localSearchTerm = '') {
    fileListElement.innerHTML = '';
    const lowerLocalSearchTerm = localSearchTerm.trim().toLowerCase();
    if (isGlobalSearch) {
        isShowingSearchResults = true;
        updateBreadcrumb('', true, localSearchTerm);
    } else {
        isShowingSearchResults = false;
        updateBreadcrumb(prefix);
        if (prefix !== '') {
            let lastSlashIndex = prefix.endsWith('/') ? prefix.lastIndexOf('/', prefix.length - 2) : prefix.lastIndexOf('/');
            const parentPrefix = lastSlashIndex >= 0 ? prefix.substring(0, lastSlashIndex + 1) : '';
            const backLi = document.createElement('li');
            backLi.className = 'file-list-item back-item';
            backLi.innerHTML = `
                <div class="file-item">
                    <div class="file-icon folder">
                        <i class="fas fa-arrow-left"></i>
                    </div>
                    <div class="file-info">
                        <div class="file-name">返回上一级</div>
                        <div class="file-meta">上级目录</div>
                    </div>
                </div>
            `;
            backLi.style.cursor = 'pointer';
            backLi.onclick = (e) => {
                e.preventDefault();
                if (searchInput) searchInput.value = '';
                fetchAndDisplayFiles(parentPrefix);
            };
            fileListElement.appendChild(backLi);
        }
    }
    let displayedDirectories = [];
    if (!isGlobalSearch && data.directories && data.directories.length > 0) {
        let filteredDirectories = data.directories;
        if (lowerLocalSearchTerm) {
            filteredDirectories = filteredDirectories.filter(dir => 
                dir.name.toLowerCase().includes(lowerLocalSearchTerm)
            );
        }
        displayedDirectories = filteredDirectories;
        displayedDirectories.forEach((dir, index) => {
            setTimeout(() => {
                const li = createFileListItem(dir, true, isGlobalSearch);
                fileListElement.appendChild(li);
            }, index * 50);
        });
    }
    let displayedFiles = [];
    if (data.files && data.files.length > 0) {
        let filteredFiles = data.files;
        if (!isGlobalSearch && lowerLocalSearchTerm) {
            filteredFiles = filteredFiles.filter(file => 
                file.name.toLowerCase().includes(lowerLocalSearchTerm)
            );
        }
        if (currentFilter !== 'all') {
            filteredFiles = filteredFiles.filter(file => {
                const fileType = getFileType(file.name);
                return fileType === currentFilter;
            });
        }
        displayedFiles = filteredFiles;
        displayedFiles.forEach((file, index) => {
            if (!file.isDirectoryPlaceholder) {
                setTimeout(() => {
                    const li = createFileListItem(file, false, isGlobalSearch);
                    fileListElement.appendChild(li);
                }, (displayedDirectories.length + index) * 50);
            }
        });
    }
    const hasDisplayedContent = displayedDirectories.length > 0 || displayedFiles.length > 0;
    if (!hasDisplayedContent) {
        const emptyLi = document.createElement('li');
        emptyLi.className = 'empty-state';
        emptyLi.style.cssText = `
            text-align: center;
            padding: 3rem;
            color: var(--text-secondary);
            font-style: italic;
        `;
        let emptyMessage = '';
        if (isGlobalSearch) {
            emptyMessage = `<i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                           找不到包含 "${localSearchTerm}" 的文件或文件夹`;
        } else if (lowerLocalSearchTerm) {
            emptyMessage = `<i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                           在当前目录中找不到包含 "${localSearchTerm}" 的文件或文件夹`;
        } else {
            emptyMessage = `<i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                           此目录为空`;
        }
        emptyLi.innerHTML = emptyMessage;
        fileListElement.appendChild(emptyLi);
    }
}
async function fetchAndDisplayFiles(prefix = '', searchTerm = '') {
    const password = getAuthPassword();
    if (!password) {
        fileListElement.innerHTML = `
            <li class="empty-state" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <i class="fas fa-user-shield" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                无法获取文件列表：未获取到验证口令。请先验证。
            </li>
        `;
        updateBreadcrumb('');
        isShowingSearchResults = false;
        return;
    }
    const isGlobal = searchTerm.trim() !== '';
    if (!isGlobal) {
        currentPrefix = prefix;
    }
    fileListElement.innerHTML = `
        <li class="loading-item">
            <div class="loading-spinner"></div>
            <span>正在加载文件列表...</span>
        </li>
    `;
    let url;
    if (isGlobal) {
        console.log(`发起全局搜索: "${searchTerm}"`);
        url = `${FILES_API_URL}?search=${encodeURIComponent(searchTerm.trim())}`;
    } else {
        console.log(`加载目录: "${prefix || '根目录'}"`);
        url = `${FILES_API_URL}?prefix=${encodeURIComponent(prefix)}`;
        const localSearchTerm = searchInput ? searchInput.value.trim() : '';
        if (!localSearchTerm && directoryCache[prefix]) {
            console.log(`从缓存加载: ${prefix || '根目录'}`);
            renderFileList(prefix, directoryCache[prefix], false, '');
            isShowingSearchResults = false;
            updateBreadcrumb(prefix);
            return;
        }
    }
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${password}`,
            },
        });
        let result;
        try {
            result = await response.json();
        } catch (jsonError) {
            console.error("JSON 解析错误:", jsonError);
            result = { success: false, error: `无法解析响应: ${response.statusText}` };
        }
        if (response.ok && result.success) {
            const receivedData = {
                files: result.files || [],
                directories: result.directories || [],
            };
            if (result.files) {
                receivedData.files.forEach((file, index) => {
                    if (result.files[index] && result.files[index].isDirectoryPlaceholder !== undefined) {
                        file.isDirectoryPlaceholder = result.files[index].isDirectoryPlaceholder;
                    } else {
                        file.isDirectoryPlaceholder = false;
                    }
                });
            }
            if (!isGlobal) {
                directoryCache[prefix] = { files: receivedData.files, directories: receivedData.directories };
                console.log(`缓存已更新: ${prefix || '根目录'}`);
            }
            const currentLocalSearch = searchInput ? searchInput.value.trim() : '';
            renderFileList(isGlobal ? '' : prefix, receivedData, isGlobal, isGlobal ? searchTerm.trim() : currentLocalSearch);
        } else {
            const errorMessage = result?.error || `HTTP 错误 ${response.status}`;
            console.error("获取文件列表失败:", errorMessage, result);
            fileListElement.innerHTML = `
                <li class="empty-state" style="text-align: center; padding: 3rem; color: var(--accent-color);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    获取文件列表失败: ${errorMessage}
                </li>
            `;
            isShowingSearchResults = isGlobal;
            updateBreadcrumb(isGlobal ? '' : prefix, isGlobal, searchTerm.trim());
        }
    } catch (error) {
        console.error("获取文件列表请求出错:", error);
        fileListElement.innerHTML = `
            <li class="empty-state" style="text-align: center; padding: 3rem; color: var(--accent-color);">
                <i class="fas fa-wifi" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                获取文件列表请求出错: ${error.message}
            </li>
        `;
        isShowingSearchResults = isGlobal;
        updateBreadcrumb(isGlobal ? '' : prefix, isGlobal, searchTerm.trim());
    }
    updateUploadButtonLink();
}
document.addEventListener('authSuccess', () => {
    console.log("验证成功 (authSuccess event received)，开始加载根目录文件列表...");
    fetchAndDisplayFiles('');
    fetchFileStats();
});
document.addEventListener('authRestored', () => {
    console.log("从 localStorage 恢复验证状态 (authRestored event received)，开始加载根目录文件列表...");
    fetchAndDisplayFiles('');
    fetchFileStats();
});
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    createParticleBackground();
    fileListElement.innerHTML = `
        <li class="empty-state" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
            <i class="fas fa-user-shield" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
            请先完成验证以查看文件
        </li>
    `;
    updateBreadcrumb('');
    currentPrefix = '';
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    const selectionModeBtn = document.getElementById('selection-mode-btn');
    if (selectionModeBtn) {
        selectionModeBtn.addEventListener('click', toggleSelectionMode);
    }
    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', handleBatchDelete);
    }
    const batchDownloadBtn = document.getElementById('batch-download-btn');
    if (batchDownloadBtn) {
        batchDownloadBtn.addEventListener('click', handleBatchDownload);
    }
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            viewButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            if (fileListContainer) {
                fileListContainer.classList.toggle('grid-view', currentView === 'grid');
            }
        });
    });
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            if (currentPrefix && directoryCache[currentPrefix]) {
                renderFileList(currentPrefix, directoryCache[currentPrefix], false, searchInput?.value.trim() || '');
            }
        });
    });
    if (closePreviewBtn && previewModal) {
        const closeAndCleanup = () => {
            previewModal.classList.remove('visible');
            previewIframe.src = '';
            const existingImage = previewModal.querySelector('.preview-image');
            if (existingImage) {
                existingImage.remove();
            }
        };
        closePreviewBtn.addEventListener('click', closeAndCleanup);
        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) {
                closeAndCleanup();
            }
        });
    }
});
if (searchButton && searchInput) {
    const performSearch = () => {
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
            fetchAndDisplayFiles('', searchTerm);
        } else {
            fetchAndDisplayFiles(currentPrefix, '');
        }
    };
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            performSearch();
        }
    });
    searchInput.addEventListener('input', () => {
        if (searchInput.value.trim() === '') {
            fetchAndDisplayFiles(currentPrefix, '');
        }
    });
}
function updateUploadButtonLink() {
    const uploadBtn = document.getElementById('upload-btn-link');
    if (uploadBtn) {
        let uploadUrl = 'upload.html';
        if (currentPrefix) {
            uploadUrl += `?path=${encodeURIComponent(currentPrefix)}`;
        }
        uploadBtn.href = uploadUrl;
    }
}
const style = document.createElement('style');
style.textContent = `
    @keyframes particleFloat {
        0% { transform: translateY(0px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
    }
    .file-list-item {
        animation: fadeInUp 0.4s ease forwards;
    }
    .file-list-item:hover {
        transform: translateY(-2px);
        transition: transform 0.2s ease;
    }
    .delete-button {
        background: transparent;
        border: 1px solid var(--accent-color);
        color: var(--accent-color);
        padding: 0.4rem 0.8rem;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-left: 0.5rem;
        font-size: 0.8rem;
    }
    .delete-button:hover {
        background: var(--accent-color);
        color: white;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
    }
    .notification {
        animation: slideInRight 0.3s ease;
    }
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);