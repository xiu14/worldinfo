# 网络问题故障排除指南

## 问题症状
- 点击"发送提示词"后没有响应
- 显示"请求超时"或"请求失败"错误
- 使用部署在 Zeabur 的 New API 无法连接

## 诊断步骤

### 1. 检查浏览器控制台
1. 按 `F12` 打开浏览器开发者工具
2. 切换到"控制台"（Console）标签
3. 尝试发送请求
4. 查看是否有红色错误信息

### 2. 检查网络请求
1. 在开发者工具中切换到"网络"（Network）标签
2. 尝试发送请求
3. 查找失败的请求（通常显示为红色）
4. 点击该请求查看详细信息：
   - **状态码**: 如果是 0 或者没有状态码，可能是 CORS 问题
   - **响应**: 查看服务器返回的错误信息
   - **请求头**: 确认 API 密钥等认证信息是否正确

### 3. 检查连接配置
在 SillyTavern 中：
1. 打开"连接管理器"（Connection Manager）
2. 检查你的配置文件：
   - **API URL**: 确保 URL 格式正确（例如：`https://your-api.zeabur.app/v1`）
   - **API 密钥**: 如果需要，确保已正确填写
   - **API 类型**: 选择正确的 API 类型（OpenAI、Claude 等）
3. 点击"测试连接"按钮验证配置

## 常见问题和解决方案

### 问题 1: CORS 错误
**错误信息**: `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**解决方案**:
1. 如果你控制 API 服务器，需要在服务器端配置 CORS 头：
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: POST, GET, OPTIONS
   Access-Control-Allow-Headers: Content-Type, Authorization
   ```

2. 如果使用 New API（OneAPI），在配置中添加：
   ```yaml
   cors:
     enabled: true
     allowed_origins:
       - "*"
   ```

3. 或者在 Zeabur 环境变量中设置：
   ```
   CORS_ENABLED=true
   CORS_ALLOWED_ORIGINS=*
   ```

### 问题 2: 连接超时
**错误信息**: `Request timed out. Please check your network or proxy settings.`

**解决方案**:
1. 检查网络连接是否稳定
2. 如果在国内，可能需要使用代理
3. 增加超时时间（在代码中修改 `REQUEST_TIMEOUT_MS`）
4. 检查 API 服务器是否正常运行

### 问题 3: 认证失败
**错误信息**: `401 Unauthorized` 或 `403 Forbidden`

**解决方案**:
1. 检查 API 密钥是否正确
2. 确认 API 密钥格式（有些需要 `Bearer ` 前缀）
3. 检查 API 密钥是否过期或被撤销
4. 确认账户是否有足够的额度

### 问题 4: 国内网络访问问题
**症状**: 请求长时间无响应或直接失败

**解决方案**:
1. **使用代理**:
   - 在 SillyTavern 设置中配置 HTTP/HTTPS 代理
   - 或在系统级别配置代理

2. **使用国内中转服务**:
   - 部署自己的 API 中转服务（如 New API）
   - 使用国内可访问的 API 端点

3. **检查防火墙设置**:
   - 确保防火墙没有阻止 SillyTavern 的网络请求
   - 临时禁用防火墙测试是否是防火墙问题

### 问题 5: Zeabur 部署的 New API 无法访问
**解决方案**:
1. **检查 Zeabur 部署状态**:
   - 登录 Zeabur 控制台
   - 确认服务状态为"运行中"
   - 查看部署日志是否有错误

2. **检查域名配置**:
   - 确认自定义域名已正确绑定
   - 测试域名是否可以在浏览器中访问
   - 尝试使用 Zeabur 提供的默认域名

3. **检查环境变量**:
   - 确认所有必需的环境变量已设置
   - 特别是 API 密钥、端口号等

4. **测试 API 连接**:
   ```bash
   curl -X POST https://your-api.zeabur.app/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}]}'
   ```

## 调试技巧

### 启用详细日志
在浏览器控制台中运行：
```javascript
localStorage.setItem('debug', 'true');
```
然后刷新页面，会看到更详细的调试信息。

### 检查请求详情
修改 `src/generate.ts` 中的注释行，启用日志输出：
```typescript
console.log("Sending messages:", messages);  // 取消注释
// ... 
console.log("Received content:", response.content);  // 取消注释
```

### 测试简单请求
在浏览器控制台中直接测试 API：
```javascript
fetch('https://your-api.zeabur.app/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [{role: 'user', content: 'Hello'}]
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## 获取帮助

如果以上方法都无法解决问题，请提供以下信息：

1. 完整的错误信息（从浏览器控制台复制）
2. 网络请求的详细信息（从开发者工具的网络标签）
3. 你的配置信息（隐藏敏感信息如 API 密钥）
4. SillyTavern 版本和扩展版本
5. 使用的 API 类型和服务商

## 更新日志

### 最新修复（当前版本）
- ✅ 修复了错误时重新生成按钮不显示的问题
- ✅ 改进了错误日志的显示样式
- ✅ 添加了更详细的网络错误诊断信息
- ✅ 改进了 CORS 和网络错误的提示信息

