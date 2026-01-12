# 调试检查清单

请按以下步骤检查：

## 1. 检查扩展是否正确加载

打开浏览器开发者工具（F12），在Console中运行：

```javascript
console.log(document.querySelector('.worldInfoRecommender_settings'));
```

**预期结果**：应该返回一个HTMLElement对象

---

## 2. 检查React组件是否挂载

```javascript
console.log(document.querySelector('.world-info-recommender-settings'));
```

**预期结果**：应该返回一个HTMLElement对象（React组件的根div）

---

## 3. 检查语言选择框是否存在

```javascript
console.log(document.querySelector('.settings-language'));
console.log(document.querySelector('#world-info-recommender-language-select'));
```

**预期结果**：都应该返回HTMLElement对象

---

## 4. 检查语言切换按钮是否存在

```javascript
console.log(document.querySelector('.language-toggle'));
console.log(document.querySelectorAll('.language-toggle').length);
```

**预期结果**：应该找到2个按钮（设置页面1个 + 主弹窗1个）

---

## 5. 检查是否有React错误

在Console标签页查看是否有红色错误信息，特别是：
- React相关错误
- 组件渲染错误
- 找不到模块的错误

---

## 6. 检查CSS是否加载

```javascript
console.log(document.querySelector('link[href*="WorldInfo-Recommender"]'));
```

或检查：
```javascript
const styles = Array.from(document.styleSheets).find(s => s.href && s.href.includes('WorldInfo-Recommender'));
console.log(styles);
```

---

## 7. 检查当前设置值

```javascript
// 需要先打开设置面板
console.log(SillyTavern.getContext().extensionSettings.worldInfoRecommender);
```

查看 `language` 字段的值

---

## 8. 完整的DOM结构检查

```javascript
const container = document.querySelector('.worldInfoRecommender_settings');
if (container) {
    console.log('Container HTML:', container.innerHTML);
} else {
    console.log('Container not found!');
}
```

---

## 请将以上所有检查结果截图或复制文本发给我

特别是如果某个检查返回 `null` 或报错，那就是问题所在！
