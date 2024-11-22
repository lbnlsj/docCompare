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

        // 设置文件
        const dataTransfer1 = new DataTransfer();
        const dataTransfer2 = new DataTransfer();
        dataTransfer1.items.add(file1);
        dataTransfer2.items.add(file2);
        file1Input.files = dataTransfer1.files;
        file2Input.files = dataTransfer2.files;

        // 渲染文件
        fileStates.file1 = file1;
        fileStates.file2 = file2;

        // 更新文件名显示
        document.getElementById('fileName1').textContent = file1.name;
        document.getElementById('fileName2').textContent = file2.name;

        // 先渲染两个文件
        await Promise.all([
            renderFile('/static/data/t1.docx', 'content1', 't1.docx'),
            renderFile('/static/data/t2.docx', 'content2', 't2.docx')
        ]);

        // 确保 DOM 完全更新
        await new Promise(resolve => setTimeout(resolve, 100));

        // 执行比较并创建连接线
        await compareFiles();

    } catch (error) {
        console.error('Auto load error:', error);
        showError(`Error loading default files: ${error.message}`);
    }
}


// 修改查找文本元素的函数，使其能更准确地定位差异内容
function findTextElement(container, content, fileType) {
    // 对于文本内容进行清理和转义，以便更准确的匹配
    const cleanContent = content.trim().replace(/\s+/g, ' ');

    if (fileType === 'pdf') {
        const textSpans = container.querySelectorAll('.textLayer > span');
        return Array.from(textSpans).find(span =>
            span.textContent.trim().replace(/\s+/g, ' ').includes(cleanContent));
    } else {
        // 对于DOCX，直接查找包含差异内容的段落元素
        const allParagraphs = container.querySelectorAll('p');
        return Array.from(allParagraphs).find(p =>
            p.textContent.trim().replace(/\s+/g, ' ').includes(''));
    }
}

// 更新创建连接线的函数
function createConnectionLines(container1, container2, changes, fileType) {
    // 清除现有的连接线
    const existingLines = document.querySelector('.connection-lines');
    if (existingLines) {
        existingLines.remove();
    }

    // 创建SVG容器
    const svgContainer = document.createElement('div');
    svgContainer.className = 'connection-lines';
    svgContainer.style.cssText = `
        position: fixed;  /* 改为 fixed 定位 */
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 9999;  /* 使用较大的 z-index 值确保在最上层 */
    `;

    // 创建SVG元素
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = `
        position: absolute;
        width: 100%;
        height: 100%;
        overflow: visible;
    `;
    svgContainer.appendChild(svg);

    // 获取容器的位置信息
    const container1Rect = container1.getBoundingClientRect();
    const container2Rect = container2.getBoundingClientRect();
    const containerParent = container1.closest('.container');
    const parentRect = containerParent.getBoundingClientRect();

    // 遍历所有变更并创建连接线
    changes.changes.forEach((change, index) => {
        if (change.type === 'addition' || change.type === 'deletion') {
            console.log(`开始创建第${index}条连接线`);
            // 查找对应的文本元素
            const leftElement = findTextElement(container1, change.content, fileType);
            const rightElement = findTextElement(container2, change.content, fileType);

            if (leftElement && rightElement) {
                // 获取元素的位置
                const leftRect = leftElement.getBoundingClientRect();
                const rightRect = rightElement.getBoundingClientRect();

                // 计算相对于父容器的坐标
                const x1 = leftRect.right - parentRect.left;
                const y1 = (leftRect.top + leftRect.height / 2) - parentRect.top;
                const x2 = rightRect.left - parentRect.left;
                const y2 = (rightRect.top + rightRect.height / 2) - parentRect.top;

                // 创建连接线
                const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

                // 添加发光效果
                const filterId = `glow-${index}`;
                const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
                filter.setAttribute('id', filterId);
                filter.innerHTML = `
                    <feGaussianBlur stdDeviation="2" result="blur"/>
                    <feFlood flood-color="${change.type === 'deletion' ? '#EF4444' : '#22C55E'}" result="color"/>
                    <feComposite in="color" in2="blur" operator="in"/>
                    <feMerge>
                        <feMergeNode/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                `;
                svg.appendChild(filter);

                // 创建贝塞尔曲线
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const controlPointOffset = Math.abs(x2 - x1) * 0.4;
                const d = `M ${x1} ${y1} C ${x1 + controlPointOffset} ${y1}, ${x2 - controlPointOffset} ${y2}, ${x2} ${y2}`;

                path.setAttribute('d', d);
                path.setAttribute('stroke', change.type === 'deletion' ? '#EF4444' : '#22C55E');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');
                path.setAttribute('filter', `url(#${filterId})`);
                path.setAttribute('stroke-dasharray', '4 4');

                // 添加动画
                path.innerHTML = `
                    <animate 
                        attributeName="stroke-dashoffset"
                        from="0"
                        to="8"
                        dur="1s"
                        repeatCount="indefinite"
                    />
                `;

                group.appendChild(path);

                // 添加端点圆圈
                [x1, x2].forEach((x, i) => {
                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('cx', x);
                    circle.setAttribute('cy', i === 0 ? y1 : y2);
                    circle.setAttribute('r', '3');
                    circle.setAttribute('fill', change.type === 'deletion' ? '#EF4444' : '#22C55E');
                    circle.setAttribute('filter', `url(#${filterId})`);
                    group.appendChild(circle);
                });

                console.log('添加成功');
                svg.appendChild(group);

                // 添加连接线的悬停效果
                const addHighlight = () => {
                    leftElement.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                    rightElement.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                    path.setAttribute('stroke-width', '3');
                };

                const removeHighlight = () => {
                    leftElement.style.backgroundColor = '';
                    rightElement.style.backgroundColor = '';
                    path.setAttribute('stroke-width', '2');
                };

                group.addEventListener('mouseenter', addHighlight);
                group.addEventListener('mouseleave', removeHighlight);
            }
        }
    });

    return svgContainer;
}


















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
            // viewer = await renderPDF(url, container);
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

        // 用于存储完整的文本内容
        let fullText = '';
        const textPositions = new Map();

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

            const canvasContext = canvas.getContext('2d');
            // 设置canvas的背景为白色
            canvasContext.fillStyle = 'white';
            canvasContext.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({
                canvasContext: canvasContext,
                viewport: viewport,
                background: 'white'
            }).promise;
            pageContainer.appendChild(canvas);

            // 创建文本层
            const textLayerDiv = document.createElement('div');
            textLayerDiv.setAttribute('class', 'textLayer');
            textLayerDiv.style.width = `${viewport.width}px`;
            textLayerDiv.style.height = `${viewport.height}px`;
            pageContainer.appendChild(textLayerDiv);

            // 获取页面文本内容
            const textContent = await page.getTextContent();

            // 使用 renderTextLayer 渲染文本层
            const renderTextLayerParams = {
                textContent: textContent,
                container: textLayerDiv,
                viewport: viewport,
                textDivs: []
            };

            await pdfjsLib.renderTextLayer(renderTextLayerParams).promise;

            // 存储页面文本用于比较
            let pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + ' ';

            // 如果有比较数据，处理差异高亮
            if (comparisonData) {
                const highlightContainer = document.createElement('div');
                highlightContainer.className = 'highlight-layer';
                highlightContainer.style.cssText = `
                    position: absolute;
                    left: 0;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    pointer-events: none;
                    z-index: 2;
                `;
                pageContainer.appendChild(highlightContainer);

                for (const change of comparisonData.changes) {
                    if (change.type === 'addition' || change.type === 'deletion') {
                        const content = change.content.trim();
                        let startIndex = 0;

                        while (true) {
                            const index = pageText.indexOf(content, startIndex);
                            if (index === -1) break;

                            // 找到匹配文本的位置
                            let currentLength = 0;
                            let relevantItems = [];

                            for (const item of textContent.items) {
                                const itemStart = currentLength;
                                currentLength += item.str.length + 1;

                                if (currentLength > index && itemStart < index + content.length) {
                                    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                                    relevantItems.push({
                                        text: item.str,
                                        rect: {
                                            left: tx[4],
                                            top: tx[5],
                                            width: item.width * viewport.scale,
                                            height: item.height * viewport.scale
                                        }
                                    });
                                }
                            }

                            if (relevantItems.length > 0) {
                                const highlightDiv = document.createElement('div');
                                highlightDiv.className = `diff-${change.type}`;

                                const bounds = {
                                    left: Math.min(...relevantItems.map(item => item.rect.left)),
                                    top: Math.min(...relevantItems.map(item => item.rect.top)),
                                    right: Math.max(...relevantItems.map(item => item.rect.left + item.rect.width)),
                                    bottom: Math.max(...relevantItems.map(item => item.rect.top + item.rect.height))
                                };

                                highlightDiv.style.cssText = `
                                    position: absolute;
                                    left: ${bounds.left}px;
                                    top: ${bounds.top}px;
                                    width: ${bounds.right - bounds.left}px;
                                    height: ${bounds.bottom - bounds.top}px;
                                    background-color: ${change.type === 'deletion' ? 'rgba(254, 242, 242, 0.7)' : 'rgba(240, 253, 244, 0.7)'};
                                    border-left: 4px solid ${change.type === 'deletion' ? '#EF4444' : '#22C55E'};
                                    pointer-events: none;
                                `;

                                highlightContainer.appendChild(highlightDiv);
                            }

                            startIndex = index + 1;
                        }
                    }
                }
            }
        }

        // 添加PDF查看器样式
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
            
            .highlight-layer {
                pointer-events: none;
                z-index: 1;
            }
        `;
        document.head.appendChild(style);

        return viewer;
    } catch (error) {
        console.error('Error rendering PDF:', error);
        throw error;
    }
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

        // 检查文件类型是否匹配
        const extension1 = file1.name.split('.').pop().toLowerCase();
        const extension2 = file2.name.split('.').pop().toLowerCase();
        if (extension1 !== extension2) {
            showError('Files must be of the same type');
            return;
        }

        // 显示加载状态
        const container1 = document.getElementById('content1');
        const container2 = document.getElementById('content2');
        showLoading('content1');
        showLoading('content2');

        // 发送比较请求
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

        // 清除现有的查看器和连接线
        clearViewer('content1');
        clearViewer('content2');
        const oldSvgContainer = document.querySelector('.connection-lines');
        if (oldSvgContainer) {
            oldSvgContainer.remove();
        }

        // 根据文件类型选择渲染方法
        const renderMethod = extension1 === 'pdf' ? renderPDF : renderDOCX;

        // 并行渲染两个文档
        const [viewer1, viewer2] = await Promise.all([
            renderMethod('/static/data/' + file1.name, container1, data.comparison),
            renderMethod('/static/data/' + file2.name, container2, data.comparison)
        ]);

        // 存储查看器实例
        viewers.file1 = viewer1;
        viewers.file2 = viewer2;

        // 获取容器父元素并确保其定位正确
        const containerParent = container1.closest('.container') || container1.offsetParent;
        containerParent.style.position = 'relative';

        // 清理旧的事件监听器
        if (containerParent._cleanupConnectionLines) {
            containerParent._cleanupConnectionLines();
        }

        // 创建和更新连接线的函数
        const updateConnectionLines = () => {
            const oldLines = document.querySelector('.connection-lines');
            if (oldLines) {
                oldLines.remove();
            }
            const svgContainer = createConnectionLines(container1, container2, data.comparison, extension1);
            containerParent.appendChild(svgContainer);
        };

        // 初始创建连接线
        updateConnectionLines();

        // 设置滚动同步
        setupSyncScroll(container1, container2);

        // 创建防抖函数
        const debounce = (func, wait) => {
            let timeout;
            return function(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };

        // 处理滚动和窗口大小改变的防抖函数
        const handleUpdate = debounce(() => {
            requestAnimationFrame(updateConnectionLines);
        }, 100);

        // 添加事件监听器
        container1.addEventListener('scroll', handleUpdate);
        container2.addEventListener('scroll', handleUpdate);
        window.addEventListener('resize', handleUpdate);

        // 创建清理函数
        const cleanup = () => {
            container1.removeEventListener('scroll', handleUpdate);
            container2.removeEventListener('scroll', handleUpdate);
            window.removeEventListener('resize', handleUpdate);
            const lines = document.querySelector('.connection-lines');
            if (lines) lines.remove();
        };

        // 存储清理函数以便后续使用
        containerParent._cleanupConnectionLines = cleanup;

        // 添加差异统计信息
        if (data.comparison.stats) {
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

            // 5秒后自动移除统计信息
            setTimeout(() => {
                statsContainer.style.opacity = '0';
                statsContainer.style.transition = 'opacity 0.5s ease-out';
                setTimeout(() => statsContainer.remove(), 500);
            }, 5000);
        }

    } catch (error) {
        showError(`Error comparing files: ${error.message}`);
        console.error('Comparison error:', error);
    }
}






