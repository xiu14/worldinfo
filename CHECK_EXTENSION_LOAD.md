# 检查扩展是否正确加载

请在Console中运行以下命令：

## 1. 检查扩展文件是否存在
```javascript
fetch('/scripts/extensions/third-party/SillyTavern-WorldInfo-Recommender/manifest.json')
  .then(r => r.json())
  .then(d => console.log('Manifest:', d))
  .catch(e => console.error('Manifest not found:', e));
```

## 2. 检查扩展是否在扩展列表中
```javascript
console.log('All extensions:', Object.keys(window.extensions || {}));
console.log('WorldInfo extension:', window.extensions?.['SillyTavern-WorldInfo-Recommender']);
```

## 3. 检查扩展JS是否加载
```javascript
const scripts = Array.from(document.querySelectorAll('script'));
const wirScript = scripts.find(s => s.src && s.src.includes('WorldInfo-Recommender'));
console.log('Extension script loaded:', wirScript?.src);
```

## 4. 检查扩展CSS是否加载
```javascript
const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
const wirStyle = styles.find(s => s.href && s.href.includes('WorldInfo-Recommender'));
console.log('Extension CSS loaded:', wirStyle?.href);
```

## 5. 检查扩展设置面板是否在DOM中
```javascript
const settingsPanel = document.querySelector('.worldInfoRecommender_settings');
console.log('Settings panel exists:', !!settingsPanel);
if (settingsPanel) {
  console.log('Panel parent:', settingsPanel.parentElement?.className);
  console.log('Panel HTML:', settingsPanel.outerHTML.substring(0, 300));
}
```

请运行这5个检查，并把所有输出发给我！
