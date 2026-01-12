# API连接问题诊断指南 / API Connectivity Troubleshooting

## 问题症状
- ✅ SillyTavern主程序可以正常与AI交互
- ❌ World Info Recommender插件返回 "API fail"
- 🌍 在海外服务器工作正常，在中国大陆服务器失败

## 原因分析

### 插件使用的两种API请求方式

插件在不同场景下使用了两种不同的API请求方法：

#### 1️⃣ **主要功能** (generate.ts - 第172行)
```typescript
globalContext.ConnectionManagerRequestService.sendRequest(
    profileId,
    messages,
    maxResponseToken,
)
```

#### 2️⃣ **结构化请求** (request.ts - 第33行)
```typescript
generator.generateRequest({
    profileId,
    prompt,
    maxTokens,
    custom: { stream, signal },
    overridePayload,
}, ...)
```

### 为什么会失败？

这两种方式可能：
1. 使用不同的网络端点
2. 发起额外的网络请求
3. 使用不同的代理或路由设置
4. 有不同的超时或重试逻辑

在中国大陆，某些API端点可能被防火墙阻断。

---

## 🔍 诊断步骤

### 步骤1：检查网络请求
打开浏览器开发者工具（F12） → Network标签页

1. 清除所有网络记录
2. 在SillyTavern中正常发送消息（应该成功）
3. 记录成功的请求URL和参数
4. 使用插件发送请求（会失败）
5. 对比两次请求的区别

**关键检查项**：
- 请求URL是否不同？
- 是否有额外的域名请求？
- 是否有被阻断的请求（状态码 ERR_BLOCKED 或超时）？

### 步骤2：查看详细错误
在Console中运行：
```javascript
// 启用详细日志
localStorage.setItem('debug', 'true');

// 重新加载页面后，使用插件
// 查看Console中的详细错误信息
```

### 步骤3：检查代理设置
确认你的代理是否覆盖所有请求：

```javascript
// 检查当前网络配置
console.log('Connection profiles:', SillyTavern.getContext().extensionSettings.connectionManager?.profiles);
```

---

## 💡 解决方案

### 方案A：使用完整代理
确保你的代理（如Clash、V2Ray）：
1. ✅ 覆盖所有HTTP/HTTPS请求
2. ✅ 没有排除localhost或127.0.0.1
3. ✅ 代理规则包含所有AI API域名

### 方案B：修改SillyTavern网络设置
1. 打开SillyTavern的 `config.yaml`
2. 添加或修改：
```yaml
enableCorsProxy: true
corsProxyUrl: "你的代理地址"
```

### 方案C：使用中转API
使用国内可访问的API中转服务：
1. 在SillyTavern的Connection配置中
2. 将API地址改为中转服务地址
3. 确保中转服务支持所有API功能

### 方案D：使用海外服务器的反向代理
1. 在海外服务器上设置一个反向代理
2. 将所有API请求转发到实际的API端点
3. 在SillyTavern中配置使用这个反向代理

---

## 🛠️ 调试代码

### 1. 测试Connection Manager
```javascript
const ctx = SillyTavern.getContext();
const testProfile = ctx.extensionSettings.connectionManager?.profiles[0];

// 测试直接请求
ctx.ConnectionManagerRequestService.sendRequest(
    testProfile.id,
    [{ role: 'user', content: 'Hello' }],
    100
).then(response => {
    console.log('Success:', response);
}).catch(error => {
    console.error('Failed:', error);
});
```

### 2. 检查实际API端点
```javascript
// 打开你使用的Connection Profile
// 查看它的实际配置
const profile = SillyTavern.getContext().extensionSettings.connectionManager?.profiles[0];
console.log('Profile details:', {
    id: profile.id,
    name: profile.name,
    api: profile.api,
    url: profile.url,
    // ... 其他配置
});
```

### 3. 抓包分析
使用抓包工具（如Wireshark、Charles）：
1. 记录正常请求的完整过程
2. 记录插件请求的完整过程
3. 对比差异：
   - DNS解析是否成功？
   - TCP连接是否建立？
   - TLS握手是否完成？
   - 在哪一步失败？

---

## 📊 常见失败原因

| 错误类型 | 可能原因 | 解决方法 |
|---------|---------|---------|
| `net::ERR_BLOCKED_BY_CLIENT` | 被广告拦截器阻止 | 禁用扩展或添加白名单 |
| `net::ERR_CONNECTION_TIMED_OUT` | 网络超时/被墙 | 使用代理或VPN |
| `net::ERR_NAME_NOT_RESOLVED` | DNS解析失败 | 更换DNS服务器 |
| `403 Forbidden` | API密钥或权限问题 | 检查API配置 |
| `429 Too Many Requests` | 请求频率限制 | 降低请求频率 |
| `CORS error` | 跨域请求被阻止 | 启用CORS代理 |

---

## 💬 报告问题时请提供

如果以上方法都无效，报告问题时请提供：

1. **网络环境**：
   - 是否使用VPN/代理？
   - 代理类型和配置
   - ISP和地理位置

2. **错误信息**：
   - Console中的完整错误堆栈
   - Network标签中失败请求的详情
   - 截图

3. **配置信息**：
   ```javascript
   // 运行此代码获取诊断信息（会自动脱敏）
   const ctx = SillyTavern.getContext();
   const profile = ctx.extensionSettings.connectionManager?.profiles[0];
   console.log({
       apiType: profile?.api,
       hasUrl: !!profile?.url,
       urlDomain: profile?.url ? new URL(profile.url).hostname : 'N/A',
   });
   ```

4. **对比测试**：
   - SillyTavern主程序的请求是否成功？
   - 其他扩展是否正常工作？
   - 在其他网络环境下是否正常？

---

## 🎯 快速测试清单

- [ ] 确认代理正常运行
- [ ] 测试能否访问API端点域名
- [ ] 检查Console是否有CORS错误
- [ ] 尝试在海外服务器上测试
- [ ] 检查SillyTavern版本（建议最新版）
- [ ] 检查插件版本（0.3.0+）
- [ ] 清除浏览器缓存后重试
- [ ] 禁用其他可能冲突的扩展
