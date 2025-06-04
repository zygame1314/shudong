const fileListElement = document.getElementById('file-list');
const currentPathElement = document.createElement('div');
currentPathElement.id = 'current-path';
currentPathElement.style.marginBottom = '1rem';
currentPathElement.style.fontWeight = 'bold';
currentPathElement.style.padding = '0.5rem 0';
currentPathElement.style.borderBottom = '1px solid #eee';
if (fileListElement && fileListElement.parentNode) {
    fileListElement.parentNode.insertBefore(currentPathElement, fileListElement);
} else {
    console.error("Could not find file list element or its parent to insert path display.");
}

const API_BASE_URL = 'shudong.zygame1314.site';

const FILES_API_URL = `${API_BASE_URL}/api/files`;
const DOWNLOAD_API_BASE_URL = `${API_BASE_URL}/api/download`;

let currentPrefix = '';
let currentPassword = null;

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


async function fetchAndDisplayFiles(prefix = '') {
    if (!currentPassword) {
        fileListElement.innerHTML = '<li>无法获取文件列表：未获取到验证口令。请先验证。</li>';
        currentPathElement.textContent = '路径：未验证';
        return;
    }

    currentPrefix = prefix;
    fileListElement.innerHTML = '<li><span class="loading-indicator">正在加载文件列表...</span></li>';
    currentPathElement.textContent = `当前路径：/${prefix}`;

    const url = `${FILES_API_URL}?prefix=${encodeURIComponent(prefix)}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${currentPassword}`,
            },
        });

        const result = await response.json();

        if (response.ok && result.success) {
            fileListElement.innerHTML = '';

            if (prefix !== '') {
                let lastSlashIndex = prefix.endsWith('/') ? prefix.lastIndexOf('/', prefix.length - 2) : prefix.lastIndexOf('/');
                const parentPrefix = lastSlashIndex >= 0 ? prefix.substring(0, lastSlashIndex + 1) : '';

                const backLi = document.createElement('li');
                backLi.classList.add('directory-item');
                const backLink = document.createElement('a');
                backLink.href = '#';
                backLink.innerHTML = '<span class="icon">⬆️</span> 返回上一级';
                backLink.onclick = (e) => {
                    e.preventDefault();
                    fetchAndDisplayFiles(parentPrefix);
                };
                backLi.appendChild(backLink);
                fileListElement.appendChild(backLi);
            }

            if (result.directories && result.directories.length > 0) {
                result.directories.forEach(dir => {
                    const li = document.createElement('li');
                    li.classList.add('directory-item');
                    const dirLink = document.createElement('a');
                    dirLink.href = '#';
                    dirLink.innerHTML = `<span class="icon">📁</span> ${dir.name}`;
                    dirLink.onclick = (e) => {
                        e.preventDefault();
                        fetchAndDisplayFiles(dir.key);
                    };
                    li.appendChild(dirLink);
                    fileListElement.appendChild(li);
                });
            }

            if (result.files && result.files.length > 0) {
                result.files.forEach(file => {
                    const li = document.createElement('li');
                    li.classList.add('file-item');

                    const fileNameSpan = document.createElement('span');
                    fileNameSpan.innerHTML = `<span class="icon">📄</span> ${file.name}`;
                    fileNameSpan.style.marginRight = '10px';

                    const fileSizeSpan = document.createElement('span');
                    fileSizeSpan.textContent = `(${formatBytes(file.size)})`;
                    fileSizeSpan.classList.add('file-size');

                    const downloadButton = document.createElement('button');
                    downloadButton.textContent = '下载';
                    downloadButton.classList.add('download-button');
                    downloadButton.onclick = () => downloadFile(file.key, currentPassword);

                    const statusSpan = document.createElement('span');
                    statusSpan.id = `status-${file.key.replace(/[^a-zA-Z0-9]/g, '-')}`;
                    statusSpan.classList.add('download-status');

                    const fileInfoDiv = document.createElement('div');
                    fileInfoDiv.style.display = 'flex';
                    fileInfoDiv.style.alignItems = 'center';
                    fileInfoDiv.style.flexGrow = '1';
                    fileInfoDiv.appendChild(fileNameSpan);
                    fileInfoDiv.appendChild(fileSizeSpan);

                    const actionsDiv = document.createElement('div');
                    actionsDiv.appendChild(downloadButton);
                    actionsDiv.appendChild(statusSpan);


                    li.appendChild(fileInfoDiv);
                    li.appendChild(actionsDiv);
                    fileListElement.appendChild(li);
                });
            }

            const hasContent = (result.directories && result.directories.length > 0) || (result.files && result.files.length > 0);
            if (!hasContent) {
                 const emptyLi = document.createElement('li');
                 emptyLi.textContent = '此目录为空';
                 emptyLi.style.fontStyle = 'italic';
                 emptyLi.style.color = '#888';
                 if (fileListElement.firstChild && fileListElement.firstChild.classList.contains('directory-item')) {
                     fileListElement.insertBefore(emptyLi, fileListElement.firstChild.nextSibling);
                 } else {
                     fileListElement.appendChild(emptyLi);
                 }
            }

        } else {
            console.error("获取文件列表失败:", result);
            fileListElement.innerHTML = `<li>获取文件列表失败: ${result.error || '未知错误'}</li>`;
            currentPathElement.textContent = `当前路径：/${prefix} (加载失败)`;
        }
    } catch (error) {
        console.error("获取文件列表请求出错:", error);
        fileListElement.innerHTML = `<li>获取文件列表请求出错: ${error.message}</li>`;
        currentPathElement.textContent = `当前路径：/${prefix} (请求错误)`;
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
        currentPathElement.textContent = '路径：验证错误';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    fileListElement.innerHTML = '<li>请先完成验证以查看文件。</li>';
    currentPathElement.textContent = '当前路径：未验证';
    currentPassword = null;
    currentPrefix = '';
});