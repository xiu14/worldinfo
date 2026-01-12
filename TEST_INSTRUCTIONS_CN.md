# 测试说明

## 如何测试修复

### 1. 编译项目

如果你有 Node.js 和 npm 安装：

```bash
npm install
npm run build
```

如果编译成功，会在 `dist/` 目录下生成文件。

### 2. 在 SillyTavern 中测试

1. 将整个项目文件夹复制到 SillyTavern 的 `extensions/third-party/` 目录
2. 重启 SillyTavern 或刷新页面
3. 打开扩展管理器，启用 "World Info Recommender"

### 3. 测试错误显示

#### 测试场景 1: 没有选择连接配置
1. 打开 World Info Recommender
2. 不选择任何连接配置
3. 直接点击"发送提示词"
4. **预期结果**: 
   - 显示警告消息："请先选择一个连接配置"
   - 不会显示错误框

#### 测试场景 2: 网络请求失败
1. 打开 World Info Recommender
2. 选择一个无效的连接配置（或者断开网络）
3. 输入提示词并点击"发送提示词"
4. **预期结果**:
   - 按钮文本变为"生成中..."并禁用
   - 请求失败后，按钮变为"重新生成"（带刷新图标）
   - 按钮下方显示红色边框的错误提示框
   - 错误框中显示详细的错误信息

#### 测试场景 3: 重新生成功能
1. 在上一个场景的基础上
2. 点击"重新生成"按钮
3. **预期结果**:
   - 错误提示框消失
   - 按钮再次变为"生成中..."
   - 如果仍然失败，再次显示错误

#### 测试场景 4: CORS 错误
1. 配置一个会产生 CORS 错误的 API 端点
2. 发送请求
3. **预期结果**:
   - 错误信息中包含 CORS 相关的提示
   - 提供排查步骤的建议

### 4. 使用浏览器开发者工具

#### 查看控制台日志
1. 按 `F12` 打开开发者工具
2. 切换到"控制台"（Console）标签
3. 发送请求
4. 查看日志输出：
   - 应该看到 `[WorldInfoRecommender]` 前缀的日志
   - 错误信息应该包含详细的堆栈跟踪

#### 查看网络请求
1. 在开发者工具中切换到"网络"（Network）标签
2. 发送请求
3. 查看请求详情：
   - 请求 URL
   - 请求头
   - 响应状态码
   - 响应内容

### 5. 测试 New API / Zeabur 连接

#### 步骤 1: 验证 API 可访问性
在浏览器中访问：
```
https://your-api.zeabur.app/v1/models
```

应该返回模型列表或者 401 错误（表示需要认证）。

#### 步骤 2: 测试 API 请求
在浏览器控制台中运行：

```javascript
fetch('https://your-api.zeabur.app/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [{role: 'user', content: 'Hello'}],
    max_tokens: 10
  })
})
.then(response => {
  console.log('Status:', response.status);
  return response.json();
})
.then(data => {
  console.log('Response:', data);
})
.catch(error => {
  console.error('Error:', error);
});
```

#### 步骤 3: 检查 CORS
如果看到 CORS 错误，需要在 New API 中配置 CORS。

**对于 Zeabur 部署的 New API**：
1. 登录 Zeabur 控制台
2. 找到你的 New API 服务
3. 添加环境变量：
   ```
   CORS_ENABLED=true
   CORS_ALLOWED_ORIGINS=*
   ```
4. 重新部署服务

**或者在 New API 的配置文件中**：
```yaml
cors:
  enabled: true
  allowed_origins:
    - "*"
  allowed_methods:
    - "GET"
    - "POST"
    - "OPTIONS"
  allowed_headers:
    - "Content-Type"
    - "Authorization"
```

### 6. 常见问题排查

#### 问题: 按钮没有变化
**可能原因**: 
- 代码没有正确编译
- 浏览器缓存了旧版本

**解决方案**:
1. 清除浏览器缓存（Ctrl+Shift+Delete）
2. 硬刷新页面（Ctrl+F5）
3. 重新编译项目

#### 问题: 错误框不显示
**可能原因**:
- CSS 样式没有加载
- 错误状态没有正确设置

**解决方案**:
1. 检查浏览器控制台是否有 CSS 加载错误
2. 检查 `dist/style.css` 文件是否存在
3. 查看 React DevTools 中的组件状态

#### 问题: 请求一直超时
**可能原因**:
- API 端点不可访问
- 网络连接问题
- 防火墙阻止

**解决方案**:
1. 使用 curl 或 Postman 测试 API
2. 检查防火墙设置
3. 尝试使用代理

### 7. 启用调试模式

在浏览器控制台中运行：

```javascript
// 启用详细日志
localStorage.setItem('debug', 'true');

// 重新加载页面
location.reload();
```

这会显示更多的调试信息。

### 8. 报告问题

如果测试中发现问题，请提供以下信息：

1. **错误截图**
   - 包括错误提示框
   - 包括浏览器控制台的错误信息

2. **网络请求详情**
   - 从开发者工具的网络标签复制
   - 包括请求 URL、状态码、响应内容

3. **环境信息**
   - SillyTavern 版本
   - 浏览器类型和版本
   - 操作系统

4. **配置信息**（隐藏敏感信息）
   - 连接配置的 API 类型
   - API 端点 URL（可以隐藏域名）
   - 是否使用代理

5. **重现步骤**
   - 详细描述如何重现问题
   - 包括点击了哪些按钮、输入了什么内容

---

## 预期的改进效果

### 修复前
- ❌ 错误时没有重新生成按钮
- ❌ 错误信息不明显
- ❌ 无法区分不同类型的错误
- ❌ 没有详细的诊断信息

### 修复后
- ✅ 错误时自动显示重新生成按钮
- ✅ 错误信息显示在明显的红色边框框中
- ✅ 针对不同错误类型显示不同的提示
- ✅ 提供详细的错误信息和排查建议
- ✅ CORS 错误有专门的提示和解决方案

---

## 成功标准

测试通过的标准：

1. ✅ 错误时能看到"重新生成"按钮
2. ✅ 错误信息显示在带红色边框的框中
3. ✅ 点击"重新生成"可以重新发送请求
4. ✅ 不同类型的错误显示不同的提示信息
5. ✅ 浏览器控制台中有详细的错误日志
6. ✅ 网络请求失败时能看到具体的错误原因

---

## 需要帮助？

如果遇到问题，请查看：
- `NETWORK_TROUBLESHOOTING_CN.md` - 网络问题排查指南
- `CHANGES_SUMMARY_CN.md` - 修改详情
- 浏览器开发者工具的控制台和网络标签

