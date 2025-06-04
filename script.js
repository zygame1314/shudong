const fileListElement = document.getElementById('file-list');

const FILES_API_URL = '/api/files';
const DOWNLOAD_API_BASE_URL = '/api/download';

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function downloadFile(filename, password) {
    if (!password) {
        alert("无法下载：未获取到验证口令。请重新验证。");
        return;
    }

    const downloadUrl = `${DOWNLOAD_API_BASE_URL}/${encodeURIComponent(filename)}`;
    const statusElement = document.getElementById(`status-${filename.replace(/[^a-zA-Z0-9]/g, '-')}`);
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
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            if (statusElement) statusElement.textContent = ' - 下载完成';

        } else {
            const errorResult = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
            console.error(`下载 ${filename} 失败:`, errorResult);
            alert(`下载 ${filename} 失败: ${errorResult.error || response.statusText}`);
             if (statusElement) statusElement.textContent = ` - 下载失败: ${errorResult.error || response.statusText}`;
        }
    } catch (error) {
        console.error(`下载 ${filename} 请求出错:`, error);
        alert(`下载 ${filename} 请求出错: ${error.message}`);
        if (statusElement) statusElement.textContent = ` - 下载错误: ${error.message}`;
    } finally {
         setTimeout(() => {
             if (statusElement) statusElement.textContent = '';
         }, 5000);
    }
}


async function fetchAndDisplayFiles(password) {
    if (!password) {
        fileListElement.innerHTML = '<li>无法获取文件列表：未获取到验证口令。请先验证。</li>';
        return;
    }

    fileListElement.innerHTML = '<li>正在加载文件列表...</li>';

    try {
        const response = await fetch(FILES_API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${password}`,
            },
        });

        const result = await response.json();

        if (response.ok && result.success) {
            fileListElement.innerHTML = '';
            if (result.files && result.files.length > 0) {
                result.files.forEach(file => {
                    const li = document.createElement('li');

                    const fileNameSpan = document.createElement('span');
                    fileNameSpan.textContent = file.key;
                    fileNameSpan.style.marginRight = '10px';

                    const fileSizeSpan = document.createElement('span');
                    fileSizeSpan.textContent = `(${formatBytes(file.size)})`;
                    fileSizeSpan.style.fontSize = '0.9em';
                    fileSizeSpan.style.color = '#666';
                    fileSizeSpan.style.marginRight = '15px';

                    const downloadButton = document.createElement('button');
                    downloadButton.textContent = '下载';
                    downloadButton.classList.add('download-button');
                    downloadButton.onclick = () => downloadFile(file.key, password);

                    const statusSpan = document.createElement('span');
                    statusSpan.id = `status-${file.key.replace(/[^a-zA-Z0-9]/g, '-')}`;
                    statusSpan.style.marginLeft = '10px';
                    statusSpan.style.fontSize = '0.9em';
                    statusSpan.style.color = 'gray';


                    li.appendChild(fileNameSpan);
                    li.appendChild(fileSizeSpan);
                    li.appendChild(downloadButton);
                    li.appendChild(statusSpan);
                    fileListElement.appendChild(li);
                });
            } else {
                fileListElement.innerHTML = '<li>暂无文件</li>';
            }
        } else {
            console.error("获取文件列表失败:", result);
            fileListElement.innerHTML = `<li>获取文件列表失败: ${result.error || '未知错误'}</li>`;
        }
    } catch (error) {
        console.error("获取文件列表请求出错:", error);
        fileListElement.innerHTML = `<li>获取文件列表请求出错: ${error.message}</li>`;
    }
}

document.addEventListener('authSuccess', (event) => {
    const password = event.detail?.password;
    console.log("验证成功，开始加载文件列表...");
    fetchAndDisplayFiles(password);
});

document.addEventListener('DOMContentLoaded', () => {
    if (typeof isUserAuthenticated === 'function' && isUserAuthenticated()) {
         const password = typeof getAuthPassword === 'function' ? getAuthPassword() : null;
         if (password) {
             console.log("用户已验证 (来自内存)，加载文件列表...");
             fetchAndDisplayFiles(password);
         } else {
             fileListElement.innerHTML = '<li>请重新完成验证以查看文件。</li>';
         }
    } else {
        fileListElement.innerHTML = '<li>请先完成验证以查看文件。</li>';
    }
});