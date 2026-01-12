# SillyTavern-WorldInfo-Recommender 安装指南

## ⚠️ 重要提示

**必须复制整个项目目录，而不只是 `dist/` 文件夹！**

---

## 正确的文件结构

扩展需要以下文件和目录才能正常工作：

```
SillyTavern-WorldInfo-Recommender/
├── manifest.json          ← 扩展配置文件（必需）
├── templates/             ← 模板目录（必需）
│   └── settings.html      ← 设置页面模板
├── dist/                  ← 构建输出（必需）
│   ├── index.js           ← 主脚本
│   └── style.css          ← 样式文件
└── src/                   ← 源代码（可选，不影响运行）
```

---

## 安装步骤

### 方法 1：从 GitHub 下载（推荐）

1. **下载完整源代码**
   ```bash
   git clone https://github.com/xiu14/SillyTavern-WorldInfo-Recommender.git
   ```
   
   或从 GitHub Release 页面下载完整的源代码压缩包（不是单独的 dist 包）

2. **复制到 SillyTavern 扩展目录**
   
   将整个 `SillyTavern-WorldInfo-Recommender` 文件夹复制到：
   ```
   SillyTavern/public/scripts/extensions/third-party/
   ```
   
   最终路径应该是：
   ```
   SillyTavern/public/scripts/extensions/third-party/SillyTavern-WorldInfo-Recommender/
   ```

3. **重启 SillyTavern**

4. **验证安装**
   - 打开 SillyTavern 设置 → 扩展管理
   - 确认 "World Info Recommender" 出现在列表中
   - 展开设置面板，应该正常显示（无 404 错误）

### 方法 2：从源代码构建

1. **克隆仓库**
   ```bash
   git clone https://github.com/xiu14/SillyTavern-WorldInfo-Recommender.git
   cd SillyTavern-WorldInfo-Recommender
   ```

2. **安装依赖并构建**
   ```bash
   npm install
   npm run build
   ```

3. **复制到 SillyTavern**
   
   将整个项目目录复制到 SillyTavern 扩展目录（参考方法 1 的步骤 2）

---

## ❌ 常见错误

### 错误 1：只复制了 `dist/` 文件夹

**症状**：
```
Error loading templates/settings.html: 404 Not Found
```

**原因**：`templates/` 目录在项目根目录，不在 `dist/` 中

**解决方案**：复制整个项目目录，而不只是 `dist/`

### 错误 2：文件夹名称不正确

**症状**：扩展无法加载

**原因**：文件夹名称必须是 `SillyTavern-WorldInfo-Recommender`

**解决方案**：确保复制后的文件夹名称正确

---

## 验证安装

### 检查文件结构

确保以下文件存在：
```bash
# 在 SillyTavern 扩展目录中
ls public/scripts/extensions/third-party/SillyTavern-WorldInfo-Recommender/

# 应该看到：
# manifest.json
# templates/
# dist/
```

### 检查模板文件

```bash
ls public/scripts/extensions/third-party/SillyTavern-WorldInfo-Recommender/templates/

# 应该看到：
# settings.html
```

### 检查构建文件

```bash
ls public/scripts/extensions/third-party/SillyTavern-WorldInfo-Recommender/dist/

# 应该看到：
# index.js
# style.css
```

---

## 故障排除

### 浏览器控制台错误

如果看到 404 错误，请检查：

1. ✅ `templates/settings.html` 文件存在
2. ✅ 文件夹名称是 `SillyTavern-WorldInfo-Recommender`
3. ✅ 文件夹在正确位置：`SillyTavern/public/scripts/extensions/third-party/`

### 扩展不显示

1. 重启 SillyTavern
2. 清除浏览器缓存
3. 检查 SillyTavern 控制台是否有错误信息

---

## 开发者注意事项

如果你正在开发或构建此扩展：

1. **构建输出**：`npm run build` 只生成 `dist/index.js` 和 `dist/style.css`
2. **模板文件**：`templates/` 目录**不会**被复制到 `dist/`，这是正常的
3. **部署**：部署时需要包含整个项目目录，而不只是 `dist/`

---

## 相关链接

- GitHub 仓库：https://github.com/xiu14/SillyTavern-WorldInfo-Recommender
- 问题反馈：https://github.com/xiu14/SillyTavern-WorldInfo-Recommender/issues
