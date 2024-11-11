// 添加全局样式
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
        overflow: visible;
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