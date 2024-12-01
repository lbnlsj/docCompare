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

// 验证文件类型
function validateFileType(file) {
    const validTypes = ['.pdf', '.docx'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    return validTypes.includes(extension);
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

// 更新比较按钮状态
function updateCompareButton() {
    const compareBtn = document.getElementById('compareBtn');
    const bothFilesSelected = fileStates.file1 && fileStates.file2;
    compareBtn.disabled = !bothFilesSelected;
}

// 清除查看器内容
function clearViewer(containerId) {
    const container = document.getElementById(containerId);
    if (viewers[containerId]) {
        if (typeof viewers[containerId].destroy === 'function') {
            viewers[containerId].destroy();
        }
        viewers[containerId] = null;
    }
    container.innerHTML = '';
}

// 设置同步滚动
function setupSyncScroll(container1, container2) {
    let isScrolling = false;

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

// 处理文件选择
async function handleFileSelect(fileInput, fileNameId) {
    const file = fileInput.files[0];
    const fileNameElem = document.getElementById(fileNameId);
    const containerId = fileInput.id;

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

        const formData = new FormData();
        formData.append('file', file);

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

        await renderFile(data.path, containerId, file.name);
    } catch (error) {
        showError(`Error uploading file: ${error.message}`, containerId);
    }
}

// 根据文件类型渲染文档
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
        } else {
            throw new Error('Unsupported file type');
        }

        viewers[containerId] = viewer;
    } catch (error) {
        showError(`Error rendering file: ${error.message}`, containerId);
    }
}

// 渲染DOCX文件
async function renderDOCX(url, container) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch document: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        const viewer = document.createElement('div');
        viewer.className = 'docx-viewer';
        container.innerHTML = '';
        container.appendChild(viewer);

        const renderOptions = {
            className: 'docx-wrapper',
            inWrapper: true,
            ignoreWidth: true,
            ignoreHeight: true,
            defaultFont: {
                family: 'Arial',
                size: 11
            },
            breakPages: true,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            renderEndnotes: true,
            useBase64URL: true
        };

        await docx.renderAsync(arrayBuffer, viewer, null, renderOptions);
        return viewer;
    } catch (error) {
        console.error('Error in renderDOCX:', error);
        throw error;
    }
}

// 渲染PDF文件
async function renderPDF(url, container) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const viewer = document.createElement('div');
        viewer.className = 'pdf-viewer';
        container.innerHTML = '';
        container.appendChild(viewer);

        const loadingTask = pdfjsLib.getDocument({data: await blob.arrayBuffer()});
        const pdf = await loadingTask.promise;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const pageContainer = document.createElement('div');
            pageContainer.className = 'pdf-page';
            pageContainer.dataset.pageNumber = pageNum;
            pageContainer.style.position = 'relative';
            viewer.appendChild(pageContainer);

            const canvas = document.createElement('canvas');
            const viewport = page.getViewport({scale: 1.5});
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const canvasContext = canvas.getContext('2d');
            canvasContext.fillStyle = 'white';
            canvasContext.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({
                canvasContext: canvasContext,
                viewport: viewport,
                background: 'white'
            }).promise;
            pageContainer.appendChild(canvas);

            const textLayerDiv = document.createElement('div');
            textLayerDiv.setAttribute('class', 'textLayer');
            textLayerDiv.style.width = `${viewport.width}px`;
            textLayerDiv.style.height = `${viewport.height}px`;
            pageContainer.appendChild(textLayerDiv);

            const textContent = await page.getTextContent();
            const renderTextLayerParams = {
                textContent: textContent,
                container: textLayerDiv,
                viewport: viewport,
                textDivs: []
            };

            await pdfjsLib.renderTextLayer(renderTextLayerParams).promise;
        }

        return viewer;
    } catch (error) {
        console.error('Error rendering PDF:', error);
        throw error;
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

        const extension1 = file1.name.split('.').pop().toLowerCase();
        const extension2 = file2.name.split('.').pop().toLowerCase();
        if (extension1 !== extension2) {
            showError('Files must be of the same type');
            return;
        }

        const container1 = document.getElementById('content1');
        const container2 = document.getElementById('content2');
        showLoading('content1');
        showLoading('content2');

        const response = await fetch('/compare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file1: file1.name,
                file2: file2.name
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Comparison failed');
        }

        clearViewer('content1');
        clearViewer('content2');

        const renderMethod = extension1 === 'pdf' ? renderPDF : renderDOCX;

        const [viewer1, viewer2] = await Promise.all([
            renderMethod('/static/data/' + file1.name, container1),
            renderMethod('/static/data/' + file2.name, container2)
        ]);

        viewers.file1 = viewer1;
        viewers.file2 = viewer2;

        setupSyncScroll(container1, container2);

        // 显示比较统计
        const statsContainer = document.createElement('div');
        statsContainer.className = 'comparison-stats';
        statsContainer.innerHTML = `
            <div class="stats-item">
                <span class="stats-label">Additions:</span>
                <span class="stats-value">${data.comparison.stats.additions}</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">Deletions:</span>
                <span class="stats-value">${data.comparison.stats.deletions}</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">Modifications:</span>
                <span class="stats-value">${data.comparison.stats.modifications}</span>
            </div>
        `;
        statsContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 10px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            z-index: 1000;
        `;
        document.body.appendChild(statsContainer);

        setTimeout(() => {
            statsContainer.style.opacity = '0';
            statsContainer.style.transition = 'opacity 0.5s ease-out';
            setTimeout(() => statsContainer.remove(), 500);
        }, 5000);

    } catch (error) {
        showError(`Error comparing files: ${error.message}`);
        console.error('Comparison error:', error);
    }
}

// 自动加载并比较默认文件
async function autoLoadAndCompare() {
    try {
        const file1Input = document.getElementById('file1');
        const file2Input = document.getElementById('file2');

        const [response1, response2] = await Promise.all([
            fetch('/static/data/t1.docx'),
            fetch('/static/data/t2.docx')
        ]);

        if (!response1.ok || !response2.ok) {
            throw new Error('Failed to load default files');
        }

        const [blob1, blob2] = await Promise.all([
            response1.blob(),
            response2.blob()
        ]);

        const file1 = new File(
            [blob1],
            't1.docx',
            {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
        );
        const file2 = new File(
            [blob2],
            't2.docx',
            {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
        );

        const dataTransfer1 = new DataTransfer();
        const dataTransfer2 = new DataTransfer();
        dataTransfer1.items.add(file1);
        dataTransfer2.items.add(file2);
        file1Input.files = dataTransfer1.files;
        file2Input.files = dataTransfer2.files;

        fileStates.file1 = file1;
        fileStates.file2 = file2;

        document.getElementById('fileName1').textContent = file1.name;
        document.getElementById('fileName2').textContent = file2.name;

        await Promise.all([
            renderFile('/static/data/t1.docx', 'content1', 't1.docx'),
            renderFile('/static/data/t2.docx', 'content2', 't2.docx')
        ]);

        await new Promise(resolve => setTimeout(resolve, 100));
        await compareFiles();

    } catch (error) {
        console.error('Auto load error:', error);
        showError(`Error loading default files: ${error.message}`);
    }
}

// 基础样式
const style = document.createElement('style');
style.textContent = `
    .container {
        position: relative;
        display: flex;
        gap: 2rem;
        width: 100%;
        height: 80vh;
        overflow-y: auto;
        background: #fff;
        padding: 20px;
    }

    .file-container {
        position: relative;
        flex: 1;
        min-width: 0;
        overflow: hidden;
    }
    
    .file-header {
        position: sticky;
        top: 0;
        background: #fff;
        padding: 10px;
        font-weight: bold;
        border-bottom: 1px solid #e5e7eb;
        z-index: 10;
    }
    
    .file-content {
        padding: 10px;
    }
    
    .docx-viewer {
        padding: 0;
    }

    .file-container::-webkit-scrollbar {
        display: none;
    }

    .container::-webkit-scrollbar {
        width: 8px;
    }

    .container::-webkit-scrollbar-track {
        background: #f1f1f1;
    }

    .container::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 4px;
    }

    .container::-webkit-scrollbar-thumb:hover {
        background: #666;
    }
    
    .pdf-viewer {
        position: relative;
        width: 100%;
        background-color: #525659;
        padding: 8px;
    }
    
    .pdf-page {
        background-color: white;
        margin: 8px auto;
        box-shadow: 0 2px 4px;
        background-color: white;
        margin: 8px auto;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    
    .textLayer {
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        bottom: 0;
        overflow: hidden;
        opacity: 0.2;
        line-height: 1.0;
        z-index: 2;
    }
    
    .textLayer > span {
        color: transparent;
        position: absolute;
        white-space: pre;
        cursor: text;
        transform-origin: 0% 0%;
    }
    
    .textLayer ::selection {
        background: rgba(0, 0, 255, 0.2);
    }
    
    .loading {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        font-size: 16px;
        color: #666;
    }

    .error-message {
        color: #EF4444;
        padding: 10px;
        margin: 10px 0;
        border: 1px solid #EF4444;
        border-radius: 4px;
        background-color: #FEF2F2;
    }

    .comparison-stats {
        font-size: 14px;
    }

    .stats-item {
        margin: 5px 0;
    }

    .stats-label {
        font-weight: bold;
        margin-right: 8px;
    }
`;
document.head.appendChild(style);

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    const file1Input = document.getElementById('file1');
    const file2Input = document.getElementById('file2');

    file1Input.addEventListener('change', () => handleFileSelect(file1Input, 'fileName1'));
    file2Input.addEventListener('change', () => handleFileSelect(file2Input, 'fileName2'));

    const compareBtn = document.getElementById('compareBtn');
    if (compareBtn) {
        compareBtn.addEventListener('click', compareFiles);
    }

    window.addEventListener('beforeunload', cleanupTempFiles);

    autoLoadAndCompare();
});