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


// 处理文件选择
async function handleFileSelect(fileInput, fileNameId) {
    const file = fileInput.files[0];
    const fileNameElem = document.getElementById(fileNameId);
    // 修改这里：根据 input ID 确定对应的 content ID
    const containerId = fileInput.id === 'file1' ? 'content1' : 'content2';

    if (file) {
        if (!validateFileType(file)) {
            showError(`Invalid file type. Please select a PDF or DOCX file.`, containerId);
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

        // 确保传入正确的参数
        await renderFile(data.path, containerId, file.name);

        // 添加延迟以确保 DOM 完全更新
        await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
        showError(`Error uploading file: ${error.message}`, containerId);
    }
}

// 渲染文件的辅助函数
async function renderFile(url, containerId, filename) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container not found: ${containerId}`);
        return;
    }

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
        console.error('Error in renderFile:', error);
        showError(`Error rendering file: ${error.message}`, containerId);
    }
}


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
            setTimeout(() => isScrolling = false, 2);
        }
    }

    container1.onscroll = () => syncScroll(container1, container2);
    container2.onscroll = () => syncScroll(container2, container1);
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

// 自动加载并比较默认文件
async function autoLoadAndCompare() {
    try {
        const file1Input = document.getElementById('file1');
        const file2Input = document.getElementById('file2');

        const [response1, response2] = await Promise.all([
            fetch('/static/data/数字孪生技术服务合同V6.docx'),
            fetch('/static/data/数字孪生技术服务合同V8.docx')
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
            '数字孪生技术服务合同V6.docx',
            {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
        );
        const file2 = new File(
            [blob2],
            '数字孪生技术服务合同V8.docx',
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
            renderFile('/static/data/数字孪生技术服务合同V6.docx', 'content1', '数字孪生技术服务合同V6.docx'),
            renderFile('/static/data/数字孪生技术服务合同V8.docx', 'content2', '数字孪生技术服务合同V8.docx')
        ]);

        await new Promise(resolve => setTimeout(resolve, 100));
        await compareFiles();

    } catch (error) {
        console.error('Auto load and compare error:', error);
    }
}

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

function highlightAndConnect(range1, range2, id) {
    // 获取或创建蒙版容器
    function getOrCreateOverlay(containerId) {
        const container = document.getElementById(containerId);
        let overlay = container.querySelector(`.highlight-overlay-${id}`);

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = `highlight-overlay-${id}`;
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
                z-index: 1;
            `;
            container.style.position = 'relative';
            container.appendChild(overlay);
        }

        return overlay;
    }

    // 创建或获取 SVG 容器并确保其与文件内容同步
    function getOrCreateSVGContainer(containerId) {
        const container = document.getElementById(containerId);
        let svgContainer = container.querySelector(`.diff-connections-container-${id}`);

        if (!svgContainer) {
            svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgContainer.setAttribute('class', `diff-connections-container-${id}`);
            svgContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 10000%;
                pointer-events: none;
                z-index: 2;
            `;
            container.appendChild(svgContainer);
        }

        return svgContainer;
    }

    // 计算文本范围的客户端矩形
    function getRangeRects(container, rangeStart, rangeEnd) {
        const range = document.createRange();
        const textRects = [];
        let charCount = 0;

        // 改进的 TreeWalker，只获取 p 和 span 标签内的文本节点
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    const parent = node.parentElement;
                    // 检查父元素是否为 p 或者 span
                    if (parent && (parent.tagName === 'P' || parent.tagName === 'SPAN')) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            },
            false
        );
        let node;
        let startNode = null;
        let endNode = null;
        let startOffset = 0;
        let endOffset = 0;

        // 找到范围的起点和终点
        while ((node = walker.nextNode())) {
            const length = node.textContent.length;

            if (!startNode && charCount + length > rangeStart) {
                startNode = node;
                startOffset = rangeStart - charCount;
            }

            if (!endNode && charCount + length >= rangeEnd) {
                endNode = node;
                endOffset = rangeEnd - charCount;
                break;
            }

            charCount += length;
        }

        if (startNode && endNode) {
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);

            // 获取范围的客户端矩形
            const rects = range.getClientRects();
            for (let i = 0; i < rects.length; i++) {
                textRects.push(rects[i]);
            }
        }
        return textRects;
    }

    // 在蒙版上创建高亮元素
    function createHighlights(overlay, rects, containerRect, className) {
        rects.forEach(rect => {
            const highlight = document.createElement('div');
            highlight.className = `highlight ${className}`;
            highlight.style.cssText = `
                position: absolute;
                background-color: rgba(255, 255, 0, 0.3);
                top: ${rect.top - containerRect.top}px;
                left: ${rect.left - containerRect.left}px;
                width: ${rect.width}px;
                height: ${rect.height}px;
                pointer-events: none;
            `;
            overlay.appendChild(highlight);
        });
    }

    // 重新计算和绘制 SVG 连接线
    function updateConnections(rects1, rects2, svgContainer, containerRect) {
        console.log('rects1');
        console.log(rects1);
        console.log('rects2');
        console.log(rects2);
        svgContainer.innerHTML = ''; // 清除现有路径

        rects1.forEach((rect1, index) => {
            if (rects2[index]) {
                const rect2 = rects2[index];

                const x1 = rect1.right - containerRect.left;
                const y1 = rect1.top + rect1.height / 2 - containerRect.top;
                const x2 = rect2.left - containerRect.left;
                const y2 = rect2.top + rect2.height / 2 - containerRect.top;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const controlPointOffset = (x2 - x1) / 2;
                const d = `M ${x1} ${y1} 
                          C ${x1 + controlPointOffset} ${y1},
                            ${x2 - controlPointOffset} ${y2},
                            ${x2} ${y2}`;

                path.setAttribute('d', d);
                path.setAttribute('stroke', 'rgba(255, 165, 0, 0.5)');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');
                // path.style.zIndex = 10;

                svgContainer.appendChild(path);
            }
        });
    }

    // 清除现有的高亮和连接
    function clearExisting(id) {
        ['content1', 'content2'].forEach(containerId => {
            const overlays = document.querySelectorAll(`#${containerId} .highlight-overlay-${id}`);
            overlays.forEach(overlay => overlay.innerHTML = '');

            const connections = document.querySelector(`#${containerId} .diff-connections-container-${id}`);
            if (connections) {
                connections.innerHTML = '';
            }
        });
    }

    // 主执行逻辑
    clearExisting(id);

    const container1 = document.getElementById('content1');
    const container2 = document.getElementById('content2');

    const overlay1 = getOrCreateOverlay('content1');
    const overlay2 = getOrCreateOverlay('content2');

    const containerRect1 = container1.getBoundingClientRect();
    const containerRect2 = container2.getBoundingClientRect();

    const rects1 = getRangeRects(container1, range1[0], range1[1]);
    const rects2 = getRangeRects(container2, range2[0], range2[1]);

    createHighlights(overlay1, rects1, containerRect1, 'highlight-left');
    createHighlights(overlay2, rects2, containerRect2, 'highlight-right');

    const svgContainer1 = getOrCreateSVGContainer('content1');
    const svgContainer2 = getOrCreateSVGContainer('content2');

    updateConnections(rects1, rects2, svgContainer1, containerRect1);
    updateConnections(rects1, rects2, svgContainer2, containerRect2);

    // 添加滚动事件监听器，以便在滚动时更新连接线
    // container1.addEventListener('scroll', () => {
    //     updateConnections(rects1, rects2, svgContainer1, container1.getBoundingClientRect());
    // });
    //
    // container2.addEventListener('scroll', () => {
    //     updateConnections(rects1, rects2, svgContainer2, container2.getBoundingClientRect());
    // });
}

// Text extraction utilities
const DocumentTextExtractor = {
    // Extract text from PDF viewer
    async extractPDFText(container) {
        const textContent = [];
        const textLayers = container.querySelectorAll('.textLayer');

        textLayers.forEach(layer => {
            const spans = layer.querySelectorAll('span');
            spans.forEach(span => {
                if (span.textContent.trim()) {
                    textContent.push(span.textContent);
                }
            });
        });

        return textContent.join(' ');
    },

    // Extract text from DOCX viewer
    async extractDOCXText1(container) {
        const textContent = [];
        const paragraphs = container.querySelectorAll('p > span');

        paragraphs.forEach(p => {
            console.log(p.textContent);
            textContent.push(p.textContent);
        });

        return textContent.join('');
    },

    async extractDOCXText(container) {
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    const parent = node.parentElement;
                    // 检查父元素是否为 p 或者 span
                    if (parent && (parent.tagName === 'P' || parent.tagName === 'SPAN')) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            },
            true
        );

        let textContent = '';
        // 找到范围的起点和终点
        while ((node = walker.nextNode())) {
            textContent += node.textContent;
        }

        return textContent;
    },

    // Extract text based on file type
    async extractText(container, fileType) {
        if (fileType === 'pdf') {
            return await this.extractPDFText(container);
        } else if (fileType === 'docx') {
            return await this.extractDOCXText(container);
        }
        throw new Error('Unsupported file type');
    }
};

// Modify the compareFiles function to use text extraction
async function compareFiles() {
    try {
        const file1 = fileStates.file1;
        const file2 = fileStates.file2;

        if (!file1 || !file2) {
            showError('Please select both files');
            return;
        }

        const container1 = document.getElementById('content1');
        const container2 = document.getElementById('content2');
        const fileType = file1.name.split('.').pop().toLowerCase();

        // Extract text from both documents
        const text1 = await DocumentTextExtractor.extractText(container1, fileType);
        const text2 = await DocumentTextExtractor.extractText(container2, fileType);

        // Send extracted text to backend
        const response = await fetch('/compare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text1: text1,
                text2: text2,
                fileType: fileType
            })
        });

        if (!response.ok) {
            throw new Error('Comparison failed');
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Comparison failed');
        }

        // Process comparison results
        const ranges = result.ranges;
        ranges.forEach(range => highlightAndConnect(range.file1, range.file2, range.id));

        setupSyncScroll(container1, container2)

    } catch (error) {
        showError(`Error comparing files: ${error.message}`);
        console.error('Comparison error:', error);
    }
}


document.querySelector('.container').insertAdjacentHTML('beforeend', `
    <div id="middle-connection-container" style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 1000;
    "></div>
`);



