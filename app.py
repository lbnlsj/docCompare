from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import shutil
import logging
import traceback
import os
from difflib import SequenceMatcher

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 应用初始化
app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)


def merge_close_differences(differences, max_gap=50, min_similarity=0.3):
    """
    合并相近的差异为一个大的差异块

    Parameters:
    - differences: 原始差异列表
    - max_gap: 两个差异之间的最大字符距离
    - min_similarity: 合并差异时要求的最小相似度

    Returns:
    - 合并后的差异列表
    """
    if not differences:
        return differences

    merged = []
    current_group = differences[0].copy()

    for next_diff in differences[1:]:
        # 计算两个差异之间的距离
        gap1 = next_diff['file1']['start'] - current_group['file1']['end']
        gap2 = next_diff['file2']['start'] - current_group['file2']['end']

        # 检查是否应该合并
        should_merge = (
            # 检查距离
                (gap1 <= max_gap and gap2 <= max_gap) and
                # 检查密集度 (通过比较差异大小和间隔)
                (min(gap1, gap2) < max(
                    len(current_group['file1']['text']),
                    len(current_group['file2']['text'])
                ) / 2)
        )

        if should_merge:
            # 合并差异，包括中间的文本
            current_group['file1']['end'] = next_diff['file1']['end']
            current_group['file2']['end'] = next_diff['file2']['end']
            current_group['file1']['text'] = current_group['file1']['text'] + "..." + next_diff['file1']['text']
            current_group['file2']['text'] = current_group['file2']['text'] + "..." + next_diff['file2']['text']
            current_group['type'] = 'modification'  # 合并后的差异都标记为修改
        else:
            merged.append(current_group)
            current_group = next_diff.copy()

    merged.append(current_group)
    return merged


def compare_text_content(text1, text2):
    """比较两段文本内容并返回差异"""
    # 创建序列匹配器
    matcher = SequenceMatcher(None, text1, text2, autojunk=False)

    # 处理差异
    differences = []
    stats = {
        'additions': 0,
        'deletions': 0,
        'modifications': 0
    }

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            continue

        # 确定差异类型
        diff_type = {
            'replace': 'modification',
            'delete': 'deletion',
            'insert': 'addition'
        }.get(tag, 'modification')

        # 创建差异记录
        difference = {
            'type': diff_type,
            'file1': {
                'start': i1,
                'end': i2,
                'text': text1[i1:i2]
            },
            'file2': {
                'start': j1,
                'end': j2,
                'text': text2[j1:j2]
            }
        }

        differences.append(difference)
        stats[diff_type + 's'] += 1

    # 合并相近的差异
    merged_differences = merge_close_differences(
        differences,
        max_gap=50  # 可以调整这个值来控制合并的范围
    )

    # 更新统计信息
    stats = {
        'additions': len([d for d in merged_differences if d['type'] == 'addition']),
        'deletions': len([d for d in merged_differences if d['type'] == 'deletion']),
        'modifications': len([d for d in merged_differences if d['type'] == 'modification'])
    }

    return {'differences': merged_differences, 'stats': stats}


@app.route('/')
def index():
    """渲染主页"""
    return render_template('index.html')


@app.route('/compare', methods=['POST'])
def compare_files():
    """处理文本比较请求"""
    try:
        data = request.get_json()
        if not data or 'text1' not in data or 'text2' not in data:
            return jsonify({'error': 'Both text contents are required'}), 400

        text1 = data['text1'].replace(' ', ' ')
        text2 = data['text2'].replace(' ', ' ')

        # 比较文本
        result = compare_text_content(text1, text2)

        # 转换差异为范围格式
        ranges = []
        for idx, diff in enumerate(result['differences'], 1):
            ranges.append({
                'id': idx,
                'file1': [diff['file1']['start'], diff['file1']['end']],
                'file2': [diff['file2']['start'], diff['file2']['end']],
                'type': diff['type'],
                'file1_text': diff['file1']['text'],
                'file2_text': diff['file2']['text'],
            })

        return jsonify({
            'success': True,
            'ranges': ranges,
            'stats': result['stats']
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/static/<path:path>')
def send_static(path):
    """处理静态文件请求"""
    return send_from_directory('static', path)


@app.route('/static/data/<filename>')
def serve_default_file(filename):
    """服务默认文件"""
    try:
        return send_from_directory(os.path.join('static', 'data'), filename)
    except Exception as e:
        logger.error(f"Error serving file {filename}: {str(e)}")
        return jsonify({'error': 'File not found'}), 404


@app.route('/upload', methods=['POST'])
def upload_file():
    """处理文件上传"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        # 获取文件扩展名
        ext = os.path.splitext(file.filename)[1].lower()

        # 检查文件类型
        if ext not in ['.pdf', '.docx']:
            return jsonify({'error': 'Invalid file type'}), 400

        # 保存文件到数据目录
        file_path = os.path.join('static', 'data', file.filename)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        file.save(file_path)

        return jsonify({
            'success': True,
            'filename': file.filename,
            'path': f'/static/data/{file.filename}'
        })

    except Exception as e:
        logger.error(f"Error in upload_file: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/cleanup', methods=['POST'])
def cleanup_temp_files():
    """清理临时文件"""
    try:
        temp_dir = os.path.join('static', 'temp')
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
            os.makedirs(temp_dir)
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error in cleanup_temp_files: {str(e)}")
        return jsonify({'error': str(e)}), 500


def setup_static_files():
    """设置静态文件和目录结构"""
    try:
        directories = ['static', 'static/data', 'data', 'templates', 'static/temp']
        for directory in directories:
            os.makedirs(directory, exist_ok=True)
            logger.info(f"Created or verified directory: {directory}")
    except Exception as e:
        logger.error(f"Error in setup_static_files: {str(e)}")
        raise


# 初始化设置
setup_static_files()

if __name__ == '__main__':
    try:
        logger.info("Starting Flask application...")
        app.run(debug=True, host='0.0.0.0', port=1800)
    except Exception as e:
        logger.error(f"Failed to start application: {str(e)}")