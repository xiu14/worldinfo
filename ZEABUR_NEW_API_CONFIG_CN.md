# Zeabur 部署 New API 的 CORS 配置指南

## 1. 确认 New API 版本

首先需要确认你使用的 New API 版本，因为不同版本的配置方式可能不同。

### 检查方法
1. 登录 Zeabur 控制台
2. 找到你的 New API 服务
3. 查看部署日志或环境变量
4. 或者访问 `https://your-api.zeabur.app/` 查看版本信息

---

## 2. New API (OneAPI) 的 CORS 配置

### 方法 A: 环境变量配置（推荐）

在 Zeabur 中添加以下环境变量：

#### 对于较新版本的 New API：
```bash
# 基础配置
PORT=3000
SESSION_SECRET=random_string_here

# CORS 配置 - 尝试以下组合之一：

# 组合 1（最常见）
CORS_ALLOW_ORIGINS=*
CORS_ALLOW_CREDENTIALS=true

# 或者组合 2
ALLOWED_ORIGINS=*

# 或者组合 3
CORS_ENABLED=true
CORS_ORIGINS=*
```

#### 如何在 Zeabur 中添加环境变量：
1. 登录 Zeabur 控制台
2. 选择你的项目和服务
3. 点击"环境变量"（Environment Variables）标签
4. 添加上述变量
5. 点击"重新部署"（Redeploy）

### 方法 B: 配置文件

如果环境变量不起作用，需要修改配置文件：

#### 1. 克隆你的 New API 仓库到本地
```bash
git clone https://github.com/Calcium-Ion/new-api.git
cd new-api
```

#### 2. 创建或修改 `config.yaml`
```yaml
# config.yaml
server:
  port: 3000
  
cors:
  enabled: true
  allowed_origins:
    - "*"
  allowed_methods:
    - "GET"
    - "POST"
    - "PUT"
    - "DELETE"
    - "OPTIONS"
  allowed_headers:
    - "Content-Type"
    - "Authorization"
    - "X-Requested-With"
  exposed_headers:
    - "Content-Length"
  allow_credentials: true
  max_age: 86400
```

#### 3. 提交并推送到 GitHub
```bash
git add config.yaml
git commit -m "Add CORS configuration"
git push
```

#### 4. Zeabur 会自动重新部署

---

## 3. 验证 CORS 配置

### 方法 1: 使用 curl 测试
```bash
curl -I -X OPTIONS https://your-api.zeabur.app/v1/chat/completions \
  -H "Origin: http://localhost:8000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization"
```

**期望的响应头应该包含：**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### 方法 2: 在浏览器中测试
打开浏览器控制台（F12），运行：

```javascript
fetch('https://your-api.zeabur.app/v1/models', {
  method: 'OPTIONS',
  headers: {
    'Origin': window.location.origin,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'Content-Type, Authorization'
  }
})
.then(response => {
  console.log('Status:', response.status);
  console.log('CORS Headers:');
  console.log('  Allow-Origin:', response.headers.get('access-control-allow-origin'));
  console.log('  Allow-Methods:', response.headers.get('access-control-allow-methods'));
  console.log('  Allow-Headers:', response.headers.get('access-control-allow-headers'));
})
.catch(error => {
  console.error('Error:', error);
});
```

---

## 4. 常见问题

### 问题 1: 环境变量不生效
**原因**: 
- 变量名不正确
- 需要重新部署
- New API 版本不支持该变量

**解决方案**:
1. 检查 New API 的官方文档或源码
2. 尝试不同的变量名组合
3. 使用配置文件方式

### 问题 2: 配置文件不生效
**原因**:
- 配置文件路径不正确
- 配置文件格式错误
- 环境变量覆盖了配置文件

**解决方案**:
1. 检查配置文件是否在正确的位置
2. 验证 YAML 格式是否正确
3. 查看部署日志

### 问题 3: 仍然有 CORS 错误
**可能原因**:
- Zeabur 的代理层没有转发 CORS 头
- 需要在 Zeabur 的网络设置中配置

**解决方案**:
1. 在 Zeabur 项目设置中检查"网络"选项
2. 确认自定义域名的 SSL 证书正常
3. 尝试使用 Zeabur 提供的默认域名测试

---

## 5. New API 的其他重要配置

除了 CORS，还需要配置这些环境变量：

```bash
# 必需的环境变量
SESSION_SECRET=your_random_secret_here
SQL_DSN=your_database_connection_string

# OpenAI API 配置（如果需要）
OPENAI_API_KEY=your_openai_key
OPENAI_API_BASE=https://api.openai.com/v1

# 其他可选配置
ENABLE_QUOTA=true
INITIAL_ROOT_TOKEN=your_admin_token
```

---

## 6. 替代方案：使用 Cloudflare Workers

如果 Zeabur 的 CORS 配置一直有问题，可以考虑使用 Cloudflare Workers 作为代理：

### 创建 Cloudflare Worker
```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      }
    })
  }

  // 转发请求到 Zeabur API
  const url = new URL(request.url)
  url.hostname = 'your-api.zeabur.app'
  
  const modifiedRequest = new Request(url, {
    method: request.method,
    headers: request.headers,
    body: request.body
  })

  const response = await fetch(modifiedRequest)
  
  // 添加 CORS 头到响应
  const modifiedResponse = new Response(response.body, response)
  modifiedResponse.headers.set('Access-Control-Allow-Origin', '*')
  modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  modifiedResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  return modifiedResponse
}
```

然后在 SillyTavern 中使用 Cloudflare Worker 的 URL 而不是直接使用 Zeabur 的 URL。

---

## 7. 调试技巧

### 启用详细日志
在 New API 的环境变量中添加：
```bash
LOG_LEVEL=debug
DEBUG=*
```

### 查看 Zeabur 部署日志
1. 登录 Zeabur 控制台
2. 选择你的服务
3. 点击"日志"（Logs）标签
4. 查看是否有 CORS 相关的错误或警告

---

## 8. 联系支持

如果以上方法都不起作用：

1. **New API 项目**:
   - GitHub Issues: https://github.com/Calcium-Ion/new-api/issues
   - 查看已有的 CORS 相关 issue

2. **Zeabur 平台**:
   - Discord: https://discord.gg/zeabur
   - 文档: https://zeabur.com/docs

3. **提供以下信息**:
   - New API 版本
   - 完整的错误信息
   - 浏览器控制台的网络请求详情
   - Zeabur 部署日志

---

## 快速检查清单

- [ ] 确认 New API 版本
- [ ] 在 Zeabur 中添加 CORS 环境变量
- [ ] 重新部署服务
- [ ] 使用 curl 测试 CORS 响应头
- [ ] 在浏览器中测试实际请求
- [ ] 检查 Zeabur 部署日志
- [ ] 如果不行，尝试配置文件方式
- [ ] 如果还不行，考虑使用 Cloudflare Workers 代理





