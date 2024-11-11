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


// 自动加载和比较文件
async function autoLoadAndCompare() {
    try {
        const file1Input = document.getElementById('file1');
        const file2Input = document.getElementById('file2');

        const response1 = await fetch('/static/data/t3.pdf');
        const response2 = await fetch('/static/data/t4.pdf');

        if (!response1.ok || !response2.ok) {
            throw new Error('Failed to load default files');
        }

        const file1 = new File(
            [await response1.blob()],
            't3.pdf',
            {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
        );
        const file2 = new File(
            [await response2.blob()],
            't4.pdf',
            {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
        );

        const dataTransfer1 = new DataTransfer();
        const dataTransfer2 = new DataTransfer();

        dataTransfer1.items.add(file1);
        dataTransfer2.items.add(file2);

        file1Input.files = dataTransfer1.files;
        file2Input.files = dataTransfer2.files;

        await handleFileSelect(file1Input, 'fileName1');
        await handleFileSelect(file2Input, 'fileName2');

        setTimeout(compareFiles, 1000);

    } catch (error) {
        console.error('Auto load error:', error);
        showError(`Error loading default files: ${error.message}`);
    }
}


// 高亮显示文档差异
function highlightDifferences(viewer, changes) {
    const paragraphs = viewer.querySelectorAll('.docx-wrapper p');
    let currentParagraph = 0;

    changes.changes.forEach((change, index) => {
        const paragraph = paragraphs[currentParagraph];
        if (!paragraph) return;

        if (change.type === 'addition' || change.type === 'deletion') {
            // 创建包装器元素
            const wrapper = document.createElement('div');
            wrapper.className = `diff-${change.type}`;
            wrapper.dataset.diffId = `diff-${index}`;
            wrapper.dataset.lineNumber = change.line_number;

            // 设置基本样式
            const backgroundColor = change.type === 'deletion' ? '#FEF2F2' : '#F0FDF4';
            const borderColor = change.type === 'deletion' ? '#EF4444' : '#22C55E';

            wrapper.style.cssText = `
                position: relative;
                padding: 2px 8px;
                margin: 2px 0;
                background-color: ${backgroundColor};
                border-left: 4px solid ${borderColor};
                transition: all 0.2s ease-in-out;
            `;

            // 添加变更指示器
            const indicator = document.createElement('div');
            indicator.className = 'change-indicator';
            indicator.textContent = change.type === 'deletion' ? '-' : '+';
            indicator.style.cssText = `
                position: absolute;
                left: -20px;
                top: 50%;
                transform: translateY(-50%);
                font-weight: bold;
                color: ${borderColor};
            `;

            wrapper.appendChild(indicator);

            // 包装段落
            paragraph.parentNode.insertBefore(wrapper, paragraph);
            wrapper.appendChild(paragraph);

            // 添加工具提示
            const tooltip = document.createElement('div');
            tooltip.className = 'diff-tooltip';
            tooltip.textContent = change.type === 'deletion' ? 'Deleted content' : 'Added content';
            tooltip.style.cssText = `
                position: absolute;
                left: -4px;
                top: 50%;
                transform: translateY(-50%) translateX(-100%);
                background-color: #1F2937;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease-in-out;
                white-space: nowrap;
                z-index: 1000;
            `;

            wrapper.appendChild(tooltip);

            // 添加悬停效果
            wrapper.addEventListener('mouseenter', () => {
                tooltip.style.opacity = '1';
                wrapper.style.transform = 'scale(1.01)';
                wrapper.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            });

            wrapper.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
                wrapper.style.transform = 'scale(1)';
                wrapper.style.boxShadow = 'none';
            });
        }

        // 根据变更类型更新段落计数
        if (change.type !== 'addition') {
            currentParagraph++;
        }
    });

    // 添加全局样式
    const style = document.createElement('style');
    style.textContent = `
        .hover-highlight {
            background-color: rgba(59, 130, 246, 0.1) !important;
            transition: background-color 0.2s ease-in-out;
        }

        .diff-addition:hover, .diff-deletion:hover {
            cursor: pointer;
        }

        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); }
            100% { transform: scale(1); }
        }

        .diff-pulse {
            animation: pulse 0.5s ease-in-out;
        }
    `;
    document.head.appendChild(style);
}


// 根据文件类型渲染文档
async function renderFile(url, containerId, filename) {
    const container = document.getElementById(containerId);
    showLoading(containerId);

    try {
        const extension = filename.split('.').pop().toLowerCase();
        let viewer;

        // 根据文件扩展名选择渲染方法
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
async function renderDOCX(url, container, comparisonData = null) {
    try {
        // 1. 获取文件
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch document: ${response.statusText}`);
        }

        // 2. 获取ArrayBuffer
        const arrayBuffer = await response.arrayBuffer();

        // 3. 创建容器
        const viewer = document.createElement('div');
        viewer.className = 'docx-viewer';
        container.innerHTML = '';
        container.appendChild(viewer);

        // 4. 配置docx-preview选项
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

        // 5. 使用docx-preview渲染文档
        await docx.renderAsync(arrayBuffer, viewer, null, renderOptions);

        // 6. 如果有比较数据，添加差异标记
        if (comparisonData) {
            highlightDifferences(viewer, comparisonData);
        }

        return viewer;
    } catch (error) {
        console.error('Error in renderDOCX:', error);
        throw error;
    }
}


// 修改样式定义
const style = document.createElement('style');
style.textContent = `
    .container {
        position: relative;
        display: flex;
        gap: 2rem;
        width: 100%;
        height: 80vh;
        overflow-y: auto;  /* 只在外层容器添加滚动条 */
        background: #fff;
        padding: 20px;
    }

    .file-container {
        position: relative;
        flex: 1;
        min-width: 0;  /* 防止flex子项溢出 */
        overflow: hidden;  /* 禁用内部滚动 */
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
        padding: 0;  /* 移除内部padding */
    }

    .diff-addition {
        position: relative;
        background-color: #F0FDF4;
        border-left: 4px solid #22C55E;
        padding: 2px 8px;
        margin: 2px 0;
    }
    
    .diff-deletion {
        position: relative;
        background-color: #FEF2F2;
        border-left: 4px solid #EF4444;
        padding: 2px 8px;
        margin: 2px 0;
    }
    
    .connection-lines {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 100;
        overflow: visible;  /* 确保连接线不被裁剪 */
    }

    /* 去除多余的滚动条 */
    .file-container::-webkit-scrollbar {
        display: none;
    }

    /* 美化主滚动条 */
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
`;
document.head.appendChild(style);
// 初始化
document.addEventListener('DOMContentLoaded', () => {
    const file1Input = document.getElementById('file1');
    const file2Input = document.getElementById('file2');

    file1Input.addEventListener('change', () => handleFileSelect(file1Input, 'fileName1'));
    file2Input.addEventListener('change', () => handleFileSelect(file2Input, 'fileName2'));

    // 添加比较按钮事件监听器
    const compareBtn = document.getElementById('compareBtn');
    if (compareBtn) {
        compareBtn.addEventListener('click', compareFiles);
    }

    // 清理临时文件的事件监听器
    window.addEventListener('beforeunload', cleanupTempFiles);

    // 自动加载并比较默认文件
    autoLoadAndCompare();
});


// 渲染PDF文件并高亮差异
async function renderPDF(url, container, comparisonData = null) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const viewer = document.createElement('div');
        viewer.className = 'pdf-viewer';
        container.innerHTML = '';
        container.appendChild(viewer);

        // 加载PDF
        const loadingTask = pdfjsLib.getDocument({data: await blob.arrayBuffer()});
        const pdf = await loadingTask.promise;

        let currentTextPosition = 0; // 跟踪当前文本位置

        // 渲染每一页
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);

            // 创建页面容器
            const pageContainer = document.createElement('div');
            pageContainer.className = 'pdf-page';
            pageContainer.dataset.pageNumber = pageNum;
            pageContainer.style.position = 'relative';
            viewer.appendChild(pageContainer);

            // 渲染PDF页面到画布
            const canvas = document.createElement('canvas');
            const viewport = page.getViewport({scale: 1.5});
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: canvas.getContext('2d'),
                viewport: viewport
            }).promise;
            pageContainer.appendChild(canvas);

            // 创建文本层
            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'text-layer';
            textLayerDiv.style.cssText = `
                position: absolute;
                left: 0;
                top: 0;
                right: 0;
                bottom: 0;
                overflow: hidden;
                line-height: 1.0;
                pointer-events: none;
            `;
            pageContainer.appendChild(textLayerDiv);

            // 获取页面文本内容
            const textContent = await page.getTextContent();
            const textItems = textContent.items;

            // 为文本内容创建元素并应用高亮
            for (const item of textItems) {
                const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                const textDiv = document.createElement('div');
                textDiv.className = 'text-item';

                // 查找此文本是否在比较数据中
                if (comparisonData) {
                    const matchingChange = comparisonData.changes.find(change =>
                        change.content.includes(item.str) &&
                        (change.type === 'addition' || change.type === 'deletion')
                    );

                    if (matchingChange) {
                        // 添加差异标记
                        textDiv.classList.add(`diff-${matchingChange.type}`);
                        textDiv.dataset.diffId = `diff-${currentTextPosition}`;
                        textDiv.dataset.lineNumber = matchingChange.line_number;

                        // 设置高亮样式
                        const highlightColor = matchingChange.type === 'deletion' ?
                            'rgba(254, 242, 242, 0.7)' : 'rgba(240, 253, 244, 0.7)';
                        const borderColor = matchingChange.type === 'deletion' ?
                            '#EF4444' : '#22C55E';

                        textDiv.style.cssText += `
                            background-color: ${highlightColor};
                            border-left: 4px solid ${borderColor};
                            padding: 2px 4px;
                            margin: -2px -4px;
                            border-radius: 2px;
                            transition: all 0.2s ease-in-out;
                        `;
                    }
                }

                // 设置文本位置和样式
                textDiv.style.cssText += `
                    position: absolute;
                    white-space: pre;
                    cursor: text;
                    transform-origin: 0% 0%;
                    left: ${tx[4]}px;
                    top: ${tx[5]}px;
                    font-size: ${Math.floor(item.height)}px;
                    transform: scaleX(${item.width / item.str.length / item.height});
                `;

                textDiv.textContent = item.str;
                textLayerDiv.appendChild(textDiv);
                currentTextPosition++;
            }
        }

        // 添加PDF查看器特定样式
        const style = document.createElement('style');
        style.textContent = `
            .pdf-viewer {
                position: relative;
                width: 100%;
                background-color: #525659;
                padding: 8px;
            }
            
            .pdf-page {
                background-color: white;
                margin: 8px auto;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .text-layer {
                z-index: 2;
            }
            
            .text-item {
                color: transparent;
                z-index: 2;
            }
            
            .diff-addition:hover, .diff-deletion:hover {
                filter: brightness(0.95);
                transform: scale(1.01);
            }
        `;
        document.head.appendChild(style);

        return viewer;
    } catch (error) {
        console.error('Error rendering PDF:', error);
        throw error;
    }
}

// 创建连接线辅助函数
function findTextDivByContent(container, content) {
    const textItems = container.querySelectorAll('.text-item');
    return Array.from(textItems).find(item => item.textContent.includes(content));
}

// 优化后的连接线创建函数
function createConnectionLines(container1, container2, changes) {
    const svgContainer = document.createElement('div');
    svgContainer.className = 'connection-lines';
    svgContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 100;
    `;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = `
        width: 100%;
        height: 100%;
        position: absolute;
        overflow: visible;
    `;
    svgContainer.appendChild(svg);

    // 获取容器位置
    const containerParent = container1.offsetParent;
    const containerParentRect = containerParent.getBoundingClientRect();

    // 创建连接线
    changes.forEach((change, index) => {
        if (change.type === 'addition' || change.type === 'deletion') {
            const leftElement = findTextDivByContent(container1, change.content);
            const rightElement = findTextDivByContent(container2, change.content);

            if (leftElement && rightElement) {
                const leftRect = leftElement.getBoundingClientRect();
                const rightRect = rightElement.getBoundingClientRect();

                // 计算连接线坐标
                const x1 = leftRect.right - containerParentRect.left;
                const y1 = (leftRect.top + leftRect.height / 2) - containerParentRect.top;
                const x2 = rightRect.left - containerParentRect.left;
                const y2 = (rightRect.top + rightRect.height / 2) - containerParentRect.top;

                // 创建连接线组
                const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

                // 创建贝塞尔曲线
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const controlPointOffset = Math.abs(x2 - x1) * 0.5;
                const d = `M ${x1} ${y1} C ${x1 + controlPointOffset} ${y1}, ${x2 - controlPointOffset} ${y2}, ${x2} ${y2}`;

                path.setAttribute('d', d);
                path.setAttribute('stroke', change.type === 'deletion' ? '#EF4444' : '#22C55E');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke-dasharray', '4');

                group.appendChild(path);

                // 添加端点圆点
                [x1, x2].forEach((x, i) => {
                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('cx', x);
                    circle.setAttribute('cy', i === 0 ? y1 : y2);
                    circle.setAttribute('r', '4');
                    circle.setAttribute('fill', change.type === 'deletion' ? '#EF4444' : '#22C55E');
                    group.appendChild(circle);
                });

                svg.appendChild(group);
            }
        }
    });

    return svgContainer;
}


// 修改比较文件函数以支持PDF差异高亮
async function compareFiles() {
    try {
        const file1 = fileStates.file1;
        const file2 = fileStates.file2;

        if (!file1 || !file2) {
            showError('Please select both files');
            return;
        }

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

        // 渲染两个文档
        const container1 = document.getElementById('content1');
        const container2 = document.getElementById('content2');
        const extension = file1.name.split('.').pop().toLowerCase();

        // 无论是PDF还是DOCX都使用相同的渲染和高亮逻辑
        const [viewer1, viewer2] = await Promise.all([
            (extension === 'pdf' ? renderPDF : renderDOCX)('/static/data/' + file1.name, container1, data.comparison),
            (extension === 'pdf' ? renderPDF : renderDOCX)('/static/data/' + file2.name, container2, data.comparison)
        ]);

        // 添加连接线（对PDF和DOCX都适用）
        const containerParent = container1.closest('.container') || container1.offsetParent;
        containerParent.style.position = 'relative';

        // 创建和更新连接线
        const updateConnectionLines = () => {
            const oldSvgContainer = document.querySelector('.connection-lines');
            if (oldSvgContainer) {
                oldSvgContainer.remove();
            }
            const svgContainer = createConnectionLines(container1, container2, data.comparison.changes);
            containerParent.appendChild(svgContainer);
        };

        // 初始创建连接线
        updateConnectionLines();

        // 设置滚动同步和连接线更新
        setupSyncScroll(container1, container2);

        // 为滚动和调整大小事件添加防抖处理
        const debounce = (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };

        // 处理滚动和窗口大小改变
        const handleUpdate = debounce(() => {
            requestAnimationFrame(updateConnectionLines);
        }, 16);

        container1.addEventListener('scroll', handleUpdate);
        container2.addEventListener('scroll', handleUpdate);
        window.addEventListener('resize', handleUpdate);

        // 清理函数
        const cleanup = () => {
            container1.removeEventListener('scroll', handleUpdate);
            container2.removeEventListener('scroll', handleUpdate);
            window.removeEventListener('resize', handleUpdate);
        };

        // 存储清理函数
        containerParent._cleanupConnectionLines = cleanup;

    } catch (error) {
        showError(`Error comparing files: ${error.message}`);
        console.error('Comparison error:', error);
    }
}
