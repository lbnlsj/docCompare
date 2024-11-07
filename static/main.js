// PDF Worker 配置
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// 文件操作状态管理
let fileStates = {
    file1: null,
    file2: null
};

// 当前查看器实例
let viewers = {
    file1: null,
    file2: null
};

// 清理临时文件
async function cleanupTempFiles() {
    try {
        await fetch('/cleanup', {method: 'POST'});
    } catch (error) {
        console.error('Error cleaning up temp files:', error);
    }
}

// 文件选择处理
async function handleFileSelect(fileInput, fileNameId) {
    const file = fileInput.files[0];
    const fileNameElem = document.getElementById(fileNameId);
    const containerId = fileInput.id === 'file1' ? 'content1' : 'content2';

    if (file) {
        if (!validateFileType(file)) {
            showError(`Invalid file type. Please select a PDF or DOCX file.`);
            fileInput.value = '';
            fileNameElem.textContent = '';
            return;
        }

        fileStates[fileInput.id] = file;
        fileNameElem.textContent = file.name;
        updateCompareButton();

        // 上传文件并渲染
        await uploadAndRenderFile(file, containerId);
    } else {
        fileStates[fileInput.id] = null;
        fileNameElem.textContent = '';
        updateCompareButton();
        clearViewer(containerId);
    }
}

// 上传并渲染文件
async function uploadAndRenderFile(file, containerId) {
    try {
        showLoading(containerId);

        // 创建 FormData 对象
        const formData = new FormData();
        formData.append('file', file);

        // 上传文件
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('File upload failed');
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'File upload failed');
        }

        // 渲染文件
        await renderFile(data.path, containerId, file.name);
    } catch (error) {
        showError(`Error uploading file: ${error.message}`, containerId);
    }
}

// 验证文件类型
function validateFileType(file) {
    const validTypes = ['.pdf', '.docx'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    return validTypes.includes(extension);
}

// 更新比较按钮状态
function updateCompareButton() {
    const compareBtn = document.getElementById('compareBtn');
    const bothFilesSelected = fileStates.file1 && fileStates.file2;
    const sameType = bothFilesSelected &&
        fileStates.file1.name.split('.').pop() === fileStates.file2.name.split('.').pop();

    compareBtn.disabled = !bothFilesSelected || !sameType;
}

// 清除查看器内容
function clearViewer(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    if (viewers[containerId]) {
        viewers[containerId].destroy?.();
        viewers[containerId] = null;
    }
}

// 显示错误信息
function showError(message, containerId = 'content1') {
    const container = document.getElementById(containerId);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    container.innerHTML = '';
    container.appendChild(errorDiv);
}

// 显示加载状态
function showLoading(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '<div class="loading">Loading...</div>';
}

// 渲染PDF文件
async function renderPDF(url, container) {
    try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        const viewer = document.createElement('div');
        viewer.className = 'pdf-viewer';
        container.innerHTML = '';
        container.appendChild(viewer);

        // 渲染所有页面
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const canvas = document.createElement('canvas');
            viewer.appendChild(canvas);

            const viewport = page.getViewport({scale: 1.5});
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: canvas.getContext('2d'),
                viewport: viewport
            }).promise;
        }

        return {
            viewer,
            destroy: () => {
                pdf.destroy();
            }
        };
    } catch (error) {
        console.error('Error rendering PDF:', error);
        throw error;
    }
}

// 渲染DOCX文件
async function renderDOCX(url, container) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();

        // 使用 mammoth.js 转换 DOCX 为 HTML
        const result = await mammoth.convertToHtml({arrayBuffer});

        // 创建查看器容器
        const viewer = document.createElement('div');
        viewer.className = 'docx-viewer';
        container.innerHTML = '';
        container.appendChild(viewer);

        // 设置内容
        viewer.innerHTML = result.value;

        return {
            viewer,
            destroy: () => {
                viewer.innerHTML = '';
            }
        };
    } catch (error) {
        console.error('Error rendering DOCX:', error);
        throw error;
    }
}

// 渲染文件
async function renderFile(url, containerId, filename) {
    const container = document.getElementById(containerId);
    showLoading(containerId);

    try {
        const extension = filename.split('.').pop().toLowerCase();
        let viewer;

        if (extension === 'pdf') {
            viewer = await renderPDF(url, container);
        } else if (extension === 'docx') {
            viewer = await renderDOCX(url, container);
        }

        viewers[containerId] = viewer;
    } catch (error) {
        showError(`Error rendering file: ${error.message}`, containerId);
    }
}

// 比较文件
async function compareFiles() {
    try {
        const file1 = fileStates.file1;
        const file2 = fileStates.file2;

        if (!file1 || !file2) {
            showError('Please select both files');
            return;
        }

        if (file1.name.split('.').pop() !== file2.name.split('.').pop()) {
            showError('Files must be of the same type');
            return;
        }

        const formData = new FormData();
        formData.append('file1', file1);
        formData.append('file2', file2);

        const response = await fetch('/compare', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Comparison failed');
        }

        // 渲染两个文件
        await Promise.all([
            renderFile(data.file1.path, 'content1', data.file1.filename),
            renderFile(data.file2.path, 'content2', data.file2.filename)
        ]);

        // 设置同步滚动
        setupSyncScroll(
            document.getElementById('content1'),
            document.getElementById('content2')
        );

    } catch (error) {
        showError(`Error comparing files: ${error.message}`);
    }
}

// 设置同步滚动
function setupSyncScroll(container1, container2) {
    let isScrolling = false;

// 设置同步滚动(续)
    function syncScroll(source, target) {
        if (!isScrolling) {
            isScrolling = true;
            const scrollPercentage = source.scrollTop / (source.scrollHeight - source.clientHeight);
            target.scrollTop = scrollPercentage * (target.scrollHeight - target.clientHeight);
            setTimeout(() => isScrolling = false, 50);
        }
    }

    container1.onscroll = () => syncScroll(container1, container2);
    container2.onscroll = () => syncScroll(container2, container1);
}

// 初始化事件监听
document.addEventListener('DOMContentLoaded', () => {
    const file1Input = document.getElementById('file1');
    const file2Input = document.getElementById('file2');

    file1Input.addEventListener('change', () => handleFileSelect(file1Input, 'fileName1'));
    file2Input.addEventListener('change', () => handleFileSelect(file2Input, 'fileName2'));

    // 页面卸载时清理临时文件
    window.addEventListener('beforeunload', cleanupTempFiles);
});

// 自动加载和比较文件
async function autoLoadAndCompare() {
    try {
        const file1Input = document.getElementById('file1');
        const file2Input = document.getElementById('file2');

        const response1 = await fetch('/static/data/t1.docx');
        const response2 = await fetch('/static/data/t2.docx');

        if (!response1.ok || !response2.ok) {
            throw new Error('Failed to load default files');
        }

        const file1 = new File(
            [await response1.blob()],
            't1.docx',
            {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
        );
        const file2 = new File(
            [await response2.blob()],
            't2.docx',
            {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
        );

        // 使用 DataTransfer 接口设置文件
        const dataTransfer1 = new DataTransfer();
        const dataTransfer2 = new DataTransfer();

        dataTransfer1.items.add(file1);
        dataTransfer2.items.add(file2);

        file1Input.files = dataTransfer1.files;
        file2Input.files = dataTransfer2.files;

        // 处理文件选择并触发比较
        await handleFileSelect(file1Input, 'fileName1');
        await handleFileSelect(file2Input, 'fileName2');

        // 短暂延迟后执行比较
        setTimeout(() => {
            compareFiles();
        }, 500);

    } catch (error) {
        console.error('Auto load error:', error);
        showError(`Error loading default files: ${error.message}`);
    }
}

// 辅助函数：创建文件下载链接
function createDownloadLink(data, filename) {
    const blob = new Blob([data], {type: 'application/octet-stream'});
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    return link;
}

// 辅助函数：格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 辅助函数：防抖
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 辅助函数：检查文件类型的MIME类型
function checkFileMimeType(file) {
    const docxMimes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/docx'
    ];
    const pdfMimes = [
        'application/pdf'
    ];

    return [...docxMimes, ...pdfMimes].includes(file.type);
}

// 辅助函数：获取文件扩展名
function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
}

// 错误处理函数
function handleError(error, containerId = null) {
    console.error('Error:', error);
    if (containerId) {
        showError(error.message || 'An error occurred', containerId);
    } else {
        showError(error.message || 'An error occurred');
    }
}

// 自动执行初始化加载
document.addEventListener('DOMContentLoaded', function () {
    console.log('Initiating auto load and compare');
    autoLoadAndCompare();
});