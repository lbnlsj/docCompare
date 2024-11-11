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
                top:top: 50%;
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
}