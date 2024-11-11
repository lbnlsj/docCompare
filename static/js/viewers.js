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