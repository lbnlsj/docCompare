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

        let currentTextPosition = 0;

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

            // 为文本内容创建元素并应用高亮
            for (const item of textContent.items) {
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

        return viewer;
    } catch (error) {
        console.error('Error rendering PDF:', error);
        throw error;
    }
}