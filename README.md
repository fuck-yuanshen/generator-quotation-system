# 报价单生成系统（Flask + SQLite）

一个手机端适配的发电机组选配报价网页，支持：

- 前台按分类下拉选择（单选下拉 + 多选可选配置）、实时计算总价
- 后台调整每个选项的价格、描述、图片、上下架
- 后台可新增/修改下拉分类（如机组功率、发动机品牌、发电机品牌等）
- 后台可为每个选项维护参数（每行 `参数名:参数值`）
- 前台支持“参数”页面查看所选商品参数，并可生成参数图片弹窗
- 前台支持含税/不含税切换、图片/参数/货期/合同快捷按钮
- 生成报价单（Excel 下载）
- 生成合同图片（PNG）

## 技术栈

- 后端：Python + Flask
- 数据库：SQLite
- 前端：HTML + CSS + JavaScript（原生）

## 快速启动

1. 安装依赖

```bash
pip install -r requirements.txt
```

2. 启动项目

```bash
python app.py
```

3. 打开页面

- 前台：`http://127.0.0.1:5000/`
- 参数页：`http://127.0.0.1:5000/params`
- 后台：`http://127.0.0.1:5000/admin/login`

## Docker 部署

1. 构建并启动

```bash
docker compose up -d --build
```

2. 查看日志

```bash
docker compose logs -f
```

3. 停止服务

```bash
docker compose down
```

## 后台账号

请在本地初始化数据库后创建管理员账号。仓库不保存固定密码，可通过环境变量配置：

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `FLASK_SECRET_KEY`

## 项目结构

```text
.
├── app.py
├── data.db                 # 首次启动自动创建
├── requirements.txt
├── templates
│   ├── index.html
│   ├── admin_login.html
│   └── admin_dashboard.html
└── static
    ├── css
    │   ├── style.css
    │   └── admin.css
    ├── js
    │   └── app.js
    ├── uploads             # 后台上传选项图片
    └── generated           # 合同图片/报价单输出
```

## 功能说明

### 前台报价流程

1. 选择各分类配置项
2. 填写客户信息
3. 点击：
   - `生成报价单`：创建报价并下载 Excel
   - `生成合同图片`：创建报价并生成合同 PNG 预览

### 后台管理

- 基础设置：公司信息、税率、合同说明
- 分类管理：新增/编辑/删除分类，设置是否必选和选择模式（单选下拉/多选）
- 选项参数：在选项中维护参数文本，前台参数页自动读取展示
- 选项管理：新增/编辑/删除选项，调整价格和图片，上传本地图片

## 说明

- `data.db`、`static/uploads`、`static/generated` 均会在运行时自动创建或写入。
- 合同图片使用 PIL 生成，优先尝试系统中文字体（微软雅黑/黑体等）。
