const fileListElement = document.getElementById('file-list');
const breadcrumbListElement = document.getElementById('breadcrumb-list');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const API_BASE_URL = 'https://shudong.zygame1314.site';

const FILES_API_URL = `${API_BASE_URL}/api/files`;
const DOWNLOAD_API_BASE_URL = `${API_BASE_URL}/api/download`;

let currentPrefix = '';
let currentPassword = null;
const directoryCache = {};
let isShowingSearchResults = false;

function formatBytes(bytes, decimals = 2) {
    if (bytes == null || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.max(0, Math.floor(Math.log(bytes) / Math.log(k)));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
    return (isNaN(size) ? 0 : size) + ' ' + sizes[i];
}

async function downloadFile(fileKey, password) {
    if (!password) {
        alert("无法下载：未获取到验证口令。请重新验证。");
        return;
    }

    const downloadUrl = `${DOWNLOAD_API_BASE_URL}/${encodeURIComponent(fileKey)}`;
    const statusElementId = `status-${fileKey.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const statusElement = document.getElementById(statusElementId);
    if (statusElement) statusElement.textContent = ' - 下载中...';

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
            if (statusElement) statusElement.textContent = ' - 下载完成';
        } else {
            const errorResult = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
            console.error(`下载 ${fileKey} 失败:`, errorResult);
            alert(`下载 ${fileKey} 失败: ${errorResult.error || response.statusText}`);
             if (statusElement) statusElement.textContent = ` - 下载失败: ${errorResult.error || response.statusText}`;
        }
    } catch (error) {
        console.error(`下载 ${fileKey} 请求出错:`, error);
        alert(`下载 ${fileKey} 请求出错: ${error.message}`);
        if (statusElement) statusElement.textContent = ` - 下载错误: ${error.message}`;
    } finally {
         setTimeout(() => {
             const finalStatusElement = document.getElementById(statusElementId);
             if (finalStatusElement) finalStatusElement.textContent = '';
         }, 5000);
    }
}


function updateBreadcrumb(prefix, isSearch = false, searchTerm = '') {
    if (!breadcrumbListElement) return;
    breadcrumbListElement.innerHTML = '';

    if (isSearch) {
         breadcrumbListElement.style.display = 'none';
         return;
    }

    breadcrumbListElement.style.display = '';

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


function renderFileList(prefix, data, isGlobalSearch = false, localSearchTerm = '') {
    fileListElement.innerHTML = '';
    const lowerLocalSearchTerm = localSearchTerm.trim().toLowerCase();

    if (isGlobalSearch) {
        isShowingSearchResults = true;
        updateBreadcrumb('', true, localSearchTerm);
        const searchInfoLi = document.createElement('li');
        searchInfoLi.textContent = `全局搜索 "${localSearchTerm}" 的结果:`;
        searchInfoLi.classList.add('search-info');
        fileListElement.appendChild(searchInfoLi);

    } else {
        isShowingSearchResults = false;
        updateBreadcrumb(prefix);
        if (prefix !== '') {
            let lastSlashIndex = prefix.endsWith('/') ? prefix.lastIndexOf('/', prefix.length - 2) : prefix.lastIndexOf('/');
            const parentPrefix = lastSlashIndex >= 0 ? prefix.substring(0, lastSlashIndex + 1) : '';

            const backLi = document.createElement('li');
            backLi.classList.add('directory-item', 'back-button');
            const backLink = document.createElement('a');
            backLink.href = '#';
            backLink.innerHTML = '<span class="icon">⬆️</span> 返回上一级';
            backLink.onclick = (e) => {
                e.preventDefault();
                if (searchInput) searchInput.value = '';
                fetchAndDisplayFiles(parentPrefix);
            };
            backLi.appendChild(backLink);
            fileListElement.appendChild(backLi);
        }
    }

    let displayedDirectories = [];
    if (!isGlobalSearch && data.directories && data.directories.length > 0) {
        let filteredDirectories = data.directories;
        if (lowerLocalSearchTerm) {
             filteredDirectories = filteredDirectories.filter(dir => dir.name.toLowerCase().includes(lowerLocalSearchTerm));
        }
        displayedDirectories = filteredDirectories;

        displayedDirectories.forEach(dir => {
            const li = document.createElement('li');
            li.classList.add('directory-item');
            const dirLink = document.createElement('a');
            dirLink.href = '#';
            dirLink.innerHTML = `<span class="icon">📁</span> ${dir.name}`;
            dirLink.onclick = (e) => {
                e.preventDefault();
                if (searchInput) searchInput.value = '';
                fetchAndDisplayFiles(dir.key);
            };
            li.appendChild(dirLink);
            fileListElement.appendChild(li);
        });
    }

    let displayedFiles = [];
    if (data.files && data.files.length > 0) {
        let filteredFiles = data.files;
        if (!isGlobalSearch && lowerLocalSearchTerm) {
            filteredFiles = filteredFiles.filter(file => file.name.toLowerCase().includes(lowerLocalSearchTerm));
        }
        displayedFiles = filteredFiles;

        displayedFiles.forEach(file => {
            const isDirectoryPlaceholder = file.isDirectoryPlaceholder;
            const li = document.createElement('li');
            li.classList.add(isDirectoryPlaceholder ? 'directory-item' : 'file-item');

            let nameElement;
            const displayName = isGlobalSearch ? file.name : file.name;
            const displayIcon = isDirectoryPlaceholder ? '📁' : '📄';

            if (isDirectoryPlaceholder) {
                nameElement = document.createElement('a');
                nameElement.href = '#';
                nameElement.innerHTML = `<span class="icon">${displayIcon}</span> ${displayName}`;
                nameElement.onclick = (e) => {
                    e.preventDefault();
                    if (searchInput) searchInput.value = '';
                    fetchAndDisplayFiles(file.key);
                };
            } else {
                nameElement = document.createElement('span');
                nameElement.innerHTML = `<span class="icon">${displayIcon}</span> ${displayName}`;
            }
            nameElement.style.marginRight = '10px';


            const fileSizeSpan = document.createElement('span');
            if (!isDirectoryPlaceholder) {
                fileSizeSpan.textContent = `(${formatBytes(file.size)})`;
                fileSizeSpan.classList.add('file-size');
            }

            const downloadButton = document.createElement('button');
            if (!isDirectoryPlaceholder) {
                downloadButton.textContent = '下载';
                downloadButton.classList.add('download-button');
                downloadButton.onclick = () => downloadFile(file.key, currentPassword);
            }

            const statusSpan = document.createElement('span');
             if (!isDirectoryPlaceholder) {
                statusSpan.id = `status-${file.key.replace(/[^a-zA-Z0-9]/g, '-')}`;
                statusSpan.classList.add('download-status');
             }

            const infoDiv = document.createElement('div');
            infoDiv.style.display = 'flex';
            infoDiv.style.alignItems = 'center';
            infoDiv.style.flexGrow = '1';
            infoDiv.appendChild(nameElement);
            infoDiv.appendChild(fileSizeSpan);

            const actionsDiv = document.createElement('div');
            if (!isDirectoryPlaceholder) {
                 actionsDiv.appendChild(downloadButton);
                 actionsDiv.appendChild(statusSpan);
            }


            li.appendChild(infoDiv);
            li.appendChild(actionsDiv);
            fileListElement.appendChild(li);
        });
    }

    const hasDisplayedContent = displayedDirectories.length > 0 || displayedFiles.length > 0;

     if (!hasDisplayedContent) {
         const emptyLi = document.createElement('li');
         if (isGlobalSearch) {
             emptyLi.textContent = `找不到包含 "${localSearchTerm}" 的文件或文件夹。`;
         } else if (lowerLocalSearchTerm) {
              emptyLi.textContent = `在当前目录中找不到包含 "${localSearchTerm}" 的文件或文件夹。`;
         } else {
             emptyLi.textContent = '此目录为空';
         }
         emptyLi.style.fontStyle = 'italic';
         emptyLi.style.color = '#888';

         const firstRealItem = fileListElement.querySelector('.directory-item:not(.back-button), .file-item');
         if (firstRealItem) {
             fileListElement.insertBefore(emptyLi, firstRealItem);
         } else {
             fileListElement.appendChild(emptyLi);
         }
    }
}


async function fetchAndDisplayFiles(prefix = '', searchTerm = '') {
    if (!currentPassword) {
        fileListElement.innerHTML = '<li>无法获取文件列表：未获取到验证口令。请先验证。</li>';
        updateBreadcrumb('');
        isShowingSearchResults = false;
        return;
    }

    const isGlobal = searchTerm.trim() !== '';
    if (!isGlobal) {
        currentPrefix = prefix;
    }


    fileListElement.innerHTML = '<li><span class="loading-indicator">正在加载文件列表...</span></li>';

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
                'Authorization': `Bearer ${currentPassword}`,
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
            fileListElement.innerHTML = `<li>获取文件列表失败: ${errorMessage}</li>`;
            isShowingSearchResults = isGlobal;
            updateBreadcrumb(isGlobal ? '' : prefix, isGlobal, searchTerm.trim());
        }
    } catch (error) {
        console.error("获取文件列表请求出错:", error);
        fileListElement.innerHTML = `<li>获取文件列表请求出错: ${error.message}</li>`;
        isShowingSearchResults = isGlobal;
        updateBreadcrumb(isGlobal ? '' : prefix, isGlobal, searchTerm.trim());
    }
}

document.addEventListener('authSuccess', (event) => {
    currentPassword = event.detail?.password;
    if (currentPassword) {
        console.log("验证成功，开始加载根目录文件列表...");
        fetchAndDisplayFiles('');
    } else {
        console.error("验证成功事件未提供密码！");
        fileListElement.innerHTML = '<li>验证出错，无法加载文件。</li>';
        updateBreadcrumb('');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    fileListElement.innerHTML = '<li>请先完成验证以查看文件。</li>';
    updateBreadcrumb('');
    currentPassword = null;
    currentPrefix = '';
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