// 防抖函数
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
// 查找文本内容的辅助函数
function findTextDivByContent(container, content) {
    const textItems = container.querySelectorAll('.text-item');
    return Array.from(textItems).find(item => item.textContent.includes(content));
}
// 创建连接线
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

    const containerParent = container1.offsetParent;
    const containerParentRect = containerParent.getBoundingClientRect();

    changes.forEach((change, index) => {
        if (change.type === 'addition' || change.type === 'deletion') {
            const leftElement = findTextDivByContent(container1, change.content);
            const rightElement = findTextDivByContent(container2, change.content);

            if (leftElement && rightElement) {
                const leftRect = leftElement.getBoundingClientRect();
                const rightRect = rightElement.getBoundingClientRect();

                const x1 = leftRect.right - containerParentRect.left;
                const y1 = (leftRect.top + leftRect.height / 2) - containerParentRect.top;
                const x2 = rightRect.left - containerParentRect.left;
                const y2 = (rightRect.top + rightRect.height / 2) - containerParentRect.top;

                const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

                const controlPointOffset = Math.abs(x2 - x1) * 0.5;
                const d = `M ${x1} ${y1} C ${x1 + controlPointOffset} ${y1}, ${x2 - controlPointOffset} ${y2}, ${x2} ${y2}`;

                path.setAttribute('d', d);
                path.setAttribute('stroke', change.type === 'deletion' ? '#EF4444' : '#22C55E');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke-dasharray', '4');

                group.appendChild(path);

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

// 比较文件
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

        const [viewer1, viewer2] = await Promise.all([
            (extension === 'pdf' ? renderPDF : renderDOCX)('/static/data/' + file1.name, container1, data.comparison),
            (extension === 'pdf' ? renderPDF : renderDOCX)('/static/data/' + file2.name, container2, data.comparison)
        ]);

        const containerParent = container1.closest('.container') || container1.offsetParent;
        containerParent.style.position = 'relative';

        const updateConnectionLines = () => {
            const oldSvgContainer = document.querySelector('.connection-lines');
            if (oldSvgContainer) {
                oldSvgContainer.remove();
            }
            const svgContainer = createConnectionLines(container1, container2, data.comparison.changes);
            containerParent.appendChild(svgContainer);
        };

        updateConnectionLines();
        setupSyncScroll(container1, container2);

        const handleUpdate = debounce(() => {
            requestAnimationFrame(updateConnectionLines);
        }, 16);

        container1.addEventListener('scroll', handleUpdate);
        container2.addEventListener('scroll', handleUpdate);
        window.addEventListener('resize', handleUpdate);

        const cleanup = () => {
            container1.removeEventListener('scroll', handleUpdate);
            container2.removeEventListener('scroll', handleUpdate);
            window.removeEventListener('resize', handleUpdate);
        };

        containerParent._cleanupConnectionLines = cleanup;

    } catch (error) {
        showError(`Error comparing files: ${error.message}`);
        console.error('Comparison error:', error);
    }
}