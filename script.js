const fileListElement = document.getElementById('file-list');
const breadcrumbListElement = document.getElementById('breadcrumb-list');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const themeToggle = document.getElementById('theme-toggle');
const fileCountElement = document.getElementById('file-count');
const viewButtons = document.querySelectorAll('.view-btn');
const filterButtons = document.querySelectorAll('.filter-btn');
const API_BASE_URL = 'https://shudong.zygame1314.site';
const FILES_API_URL = `${API_BASE_URL}/api/files`;
const DOWNLOAD_API_BASE_URL = `${API_BASE_URL}/api/download`;
let currentPrefix = '';
let currentView = 'list';
let currentFilter = 'all';
const directoryCache = {};
let isShowingSearchResults = false;
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
function updateFileStats(files, directories) {
    if (fileCountElement) {
        const totalFiles = files ? files.length : 0;
        const totalDirs = directories ? directories.length : 0;
        const totalItems = totalFiles + totalDirs;
        let statsText = '';
        if (totalItems === 0) {
            statsText = '空文件夹';
        } else {
            const parts = [];
            if (totalDirs > 0) parts.push(`${totalDirs} 个文件夹`);
            if (totalFiles > 0) parts.push(`${totalFiles} 个文件`);
            statsText = parts.join(', ');
        }
        fileCountElement.textContent = statsText;
    }
}
function createFileListItem(item, isDirectory, isGlobalSearch = false) {
    const li = document.createElement('li');
    li.className = 'file-list-item';
    li.style.opacity = '0';
    li.style.transform = 'translateY(20px)';
    const fileType = isDirectory ? 'folder' : getFileType(item.name);
    const iconClass = getFileIcon(item.name, isDirectory);
    li.innerHTML = `
        <div class="file-item">
            <div class="file-icon ${fileType}">
                <i class="${iconClass}"></i>
            </div>
            <div class="file-info">
                <div class="file-name">${item.name}</div>
                ${!isDirectory ? `<div class="file-meta">${formatBytes(item.size)} • 文件</div>` : '<div class="file-meta">文件夹</div>'}
            </div>
        </div>
        <div class="file-actions">
            ${!isDirectory ? `
                <button class="download-button" onclick="downloadFile('${item.key}')">
                    <i class="fas fa-download"></i>
                    下载
                </button>
                <span class="download-status" id="status-${item.key.replace(/[^a-zA-Z0-9]/g, '-')}"></span>
            ` : ''}
        </div>
    `;
    if (isDirectory) {
        li.style.cursor = 'pointer';
        li.onclick = (e) => {
            if (!e.target.closest('.download-button')) {
                if (searchInput) searchInput.value = '';
                fetchAndDisplayFiles(item.key);
            }
        };
    }
    setTimeout(() => {
        li.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        li.style.opacity = '1';
        li.style.transform = 'translateY(0)';
    }, Math.random() * 200);
    return li;
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
    updateFileStats(displayedFiles, displayedDirectories);
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
}
document.addEventListener('authSuccess', () => {
    console.log("验证成功 (authSuccess event received)，开始加载根目录文件列表...");
    fetchAndDisplayFiles('');
});
document.addEventListener('authRestored', () => {
    console.log("从 localStorage 恢复验证状态 (authRestored event received)，开始加载根目录文件列表...");
    fetchAndDisplayFiles('');
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
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            viewButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
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