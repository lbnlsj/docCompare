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