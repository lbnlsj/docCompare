# 文档对比工具

一个基于Web的文档对比工具，支持PDF和DOCX文件的并排比较功能，类似于PyCharm的文件对比功能。本工具支持文档差异显示和同步滚动等特性。

![演示截图](demo-screenshot.png)

## 主要功能

- 支持PDF和DOCX格式文件
- 文档并排对比显示
- 双窗口同步滚动
- 文档差异突出显示
- 简洁直观的Web界面
- 实时文件预览
- 临时文件自动清理

## 技术架构

### 后端
- Python 3.8+
- Flask (Web框架)
- python-docx (DOCX文件处理)
- PyPDF2 (PDF文件处理)

### 前端
- HTML5
- JavaScript (ES6+)
- CSS3
- PDF.js (PDF渲染)
- Mammoth.js (DOCX渲染)

## 项目结构
```
project/
├── app.py              # Flask应用主程序
├── static/
│   ├── data/          # 默认示例文件
│   ├── main.js        # 前端JavaScript代码
│   └── style.css      # CSS样式表
├── templates/
│   └── index.html     # 主页面模板
├── data/              # 源数据文件
│   ├── t1.docx
│   └── t2.docx
└── requirements.txt   # Python依赖包清单
```

## 安装说明

1. 克隆代码仓库：
```bash
git clone https://github.com/yourusername/document-comparison-tool.git
cd document-comparison-tool
```

2. 创建并激活虚拟环境：
```bash
python -m venv venv
source venv/bin/activate  # Windows系统使用: venv\Scripts\activate
```

3. 安装依赖包：
```bash
pip install -r requirements.txt
```

4. 启动应用：
```bash
python app.py
```

应用将在 `http://localhost:5000` 上运行

## 使用说明

1. 在浏览器中打开应用
2. 点击"选择原始文件"按钮上传第一个文档
3. 点击"选择修改文件"按钮上传第二个文档
4. 点击"对比文件"按钮查看并排对比结果
5. 使用滚动条导航 - 两个文档窗口将同步滚动

## API接口说明

- `GET /` - 主页面
- `POST /upload` - 上传单个文件
- `POST /compare` - 对比两个文件
- `POST /cleanup` - 清理临时文件
- `GET /static/data/<filename>` - 访问默认文件

## 开发指南

在开发模式下运行应用：

```bash
export FLASK_ENV=development
export FLASK_APP=app.py
flask run
```

## 参与贡献

1. Fork 项目代码仓库
2. 创建新的分支
3. 提交您的修改
4. 提交 Pull Request

## 开源协议

本项目采用 MIT 协议 - 详见 LICENSE 文件

## 致谢

- PDF.js 提供PDF渲染功能
- Mammoth.js 提供DOCX渲染功能
- Flask 框架提供后端实现

## 后续改进计划

- [ ] 增加更多文件格式支持
- [ ] 实现文档差异高亮显示
- [ ] 添加文件导出功能
- [ ] 改进错误处理机制
- [ ] 添加单元测试
- [ ] 添加文件版本历史记录

## 常见问题

### 常见错误

1. 文件上传失败
   - 检查文件大小限制
   - 验证文件格式是否支持
   - 检查临时目录权限

2. 对比功能无法使用
   - 确保两个文件格式相同
   - 检查浏览器控制台错误信息
   - 验证文件是否损坏

### 错误信息说明

- `No file part`: 未选择上传文件
- `Invalid file type`: 不支持的文件格式
- `Both files are required`: 需要选择两个文件进行对比

## 联系方式

如有问题或需要支持，请在GitHub仓库提交Issue。

## 环境要求

- Python 3.8 或更高版本
- 现代浏览器（Chrome、Firefox、Safari、Edge等）
- 网络连接（用于加载部分前端依赖）

## 部署说明

### Docker部署
```bash
# 构建镜像
docker build -t doc-compare .

# 运行容器
docker run -p 5000:5000 doc-compare
```

### 传统部署
1. 确保安装所有依赖：
```bash
pip install -r requirements.txt
```

2. 配置系统环境：
```bash
# Linux/Mac
export FLASK_APP=app.py
export FLASK_ENV=production

# Windows
set FLASK_APP=app.py
set FLASK_ENV=production
```

3. 启动服务：
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## 维护说明

1. 定期清理临时文件：
```bash
# 添加到crontab
0 0 * * * /path/to/cleanup.sh
```

2. 日志管理：
- 应用日志位于 `logs/app.log`
- 建议配置日志轮转

3. 数据备份：
- 定期备份 `data` 目录
- 保存用户上传的重要文件