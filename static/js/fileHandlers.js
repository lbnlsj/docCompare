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