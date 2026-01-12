# 如何使用Network标签页诊断API问题

## 📋 第一步：正确打开Network标签页

1. 按 **F12** 打开开发者工具
2. 点击顶部的 **"Network"** 或 **"网络"** 标签
3. 如果Network是空的，刷新页面（F5）

## 🔍 第二步：查看完整信息

### 如果看不到URL列

Network标签页应该有多列信息，如果你看不到URL，可能是列太窄了：

**操作方法**：
1. 在Network标签页的表头区域（Name、Status、Type等）**右键**
2. 勾选以下列：
   - ✅ **Name**（名称）- 这就是请求的URL！
   - ✅ **Status**（状态）
   - ✅ **Type**（类型）
   - ✅ **Size**（大小）
   - ✅ **Time**（时间）
   - ✅ **Domain**（域名）- 非常重要！

3. **拖动列宽**：把Name列拉宽，这样就能看到完整URL了

## 🎯 第三步：筛选API请求

Network标签页会显示**所有**网络请求（包括图片、CSS、JS等），我们只需要看API请求：

### 方法A：使用过滤器
在Network标签页的过滤栏（Filter）输入：
```
-png -jpg -css -js -woff -svg
```
或者点击：
- **Fetch/XHR** 按钮（只显示API请求）

### 方法B：搜索关键词
在过滤栏输入：
```
chat
```
或
```
completions
```
或
```
api
```

## 📊 第四步：对比请求

### 测试1：SillyTavern主程序（成功的）

1. **清空记录**：点击 Network 标签页左上角的 🚫 图标
2. **发送消息**：在SillyTavern主界面发一条消息给AI
3. **查看结果**：
   - 找到 **Status = 200** 的请求
   - 看 **Name** 列，应该类似：
     - `chat/completions`
     - `v1/chat/completions`
     - `generate`
   - **重要**：点击这个请求，右侧会显示详情
   - 点击 **Headers** 标签，查看：
     ```
     Request URL: https://xxxx/v1/chat/completions
     ```
   - **记录下这个完整的URL！**

### 测试2：World Info Recommender插件（失败的）

1. **清空记录**：再次点击 🚫 图标
2. **使用插件**：在World Info Recommender中点击"Send Prompt"
3. **查看结果**：
   - 找**所有**出现的请求
   - 特别注意：
     - ❌ **Status = (failed)** 的请求
     - ❌ **Status = 0** 的请求
     - ❌ **红色**的请求
     - ⚠️ **Status = 403/429/500** 的请求
   
4. **查看失败请求的详情**：
   - 点击失败的请求
   - 查看右侧的信息：
     ```
     Request URL: ?????
     Status Code: ?????
     Error: ?????
     ```

## 🔴 特殊情况：如果没有任何请求

如果使用插件后Network标签页**完全没有新请求**出现：

### 检查Console

切换到 **Console** 标签页，查找错误信息：
- 红色的错误文字
- 可能是：
  - `Failed to fetch`
  - `Network error`
  - `CORS error`
  - `Connection refused`

**截图或复制错误信息！**

## 📸 需要提供的信息

请运行以下代码并**截图**或**复制结果**：

### 代码1：检查配置
```javascript
const ctx = SillyTavern.getContext();
const profile = ctx.extensionSettings.connectionManager?.profiles?.[0];
console.log('=== API配置信息 ===');
console.log('Profile ID:', profile?.id);
console.log('Profile Name:', profile?.name);
console.log('API Type:', profile?.api);
console.log('API URL:', profile?.url);
console.log('Has Proxy:', !!profile?.proxyUrl);
console.log('==================');
```

### 代码2：查看所有配置
```javascript
const ctx = SillyTavern.getContext();
console.log('所有Connection Profiles:');
ctx.extensionSettings.connectionManager?.profiles?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} (${p.api})`);
    console.log('   URL:', p.url);
});
```

### 代码3：测试直接请求
```javascript
// 先获取你的profile ID（从上面的代码1获得）
const profileId = 'YOUR_PROFILE_ID_HERE'; // 替换成实际的

const ctx = SillyTavern.getContext();
console.log('开始测试API请求...');

ctx.ConnectionManagerRequestService.sendRequest(
    profileId,
    [{ role: 'user', content: 'Hi' }],
    10
).then(response => {
    console.log('✅ 成功！响应:', response);
}).catch(error => {
    console.error('❌ 失败！错误:', error);
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    console.error('完整错误:', error);
});
```

## 🎯 最可能的情况

根据你说的"都是status 200"，可能的情况：

### 情况A：所有请求都成功了？
如果所有请求都是200，但插件还是报错，说明：
- ✅ 网络连接正常
- ❌ 但响应内容有问题

**请查看**：
1. 点击那个200的请求
2. 右侧点击 **Response** 标签
3. 看返回的内容是什么
4. 可能是错误信息的JSON：
   ```json
   {
     "error": "...",
     "message": "..."
   }
   ```

### 情况B：没看到URL列
- 需要拖宽 **Name** 列
- 或者点击请求查看 **Headers** → **Request URL**

### 情况C：过滤器设置问题
- 清除所有过滤器
- 只点击 **Fetch/XHR** 按钮

## 📝 请提供以下信息

为了帮你诊断，请提供：

1. **Console输出**：运行上面3个代码的结果
2. **请求详情**：
   - 成功请求（主程序）的 Request URL
   - 失败请求（插件）的 Request URL
   - 如果都是200，那么两个Response的内容
3. **截图**（如果方便）：
   - Network标签页的整个界面
   - Console中的错误信息

## 💡 快速测试

**最简单的方法**：

打开Console，直接运行：
```javascript
// 一键诊断
(async () => {
    const ctx = SillyTavern.getContext();
    const profile = ctx.extensionSettings.connectionManager?.profiles?.[0];
    
    console.log('%c=== 诊断开始 ===', 'color: blue; font-weight: bold');
    console.log('Profile:', profile?.name);
    console.log('API:', profile?.api);
    console.log('URL:', profile?.url);
    
    console.log('%c测试请求...', 'color: orange');
    try {
        const result = await ctx.ConnectionManagerRequestService.sendRequest(
            profile.id,
            [{ role: 'user', content: 'test' }],
            5
        );
        console.log('%c✅ 成功！', 'color: green; font-weight: bold');
        console.log('响应:', result);
    } catch (error) {
        console.log('%c❌ 失败！', 'color: red; font-weight: bold');
        console.error('错误:', error);
    }
    console.log('%c=== 诊断结束 ===', 'color: blue; font-weight: bold');
})();
```

把Console输出的所有内容发给我！
