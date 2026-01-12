# 故障排除 / Troubleshooting

## 如果按钮样式仍然不正确

### 方法1：强制清除缓存
1. 完全关闭 SillyTavern
2. 删除浏览器缓存（Ctrl+Shift+Delete）
3. 删除扩展文件夹：
   ```
   [SillyTavern]/data/default-user/extensions/third-party/SillyTavern-WorldInfo-Recommender
   ```
4. 重新启动 SillyTavern
5. 重新安装扩展：
   ```
   https://github.com/xiu14/SillyTavern-WorldInfo-Recommender
   ```
6. 再次重启 SillyTavern

### 方法2：检查CSS是否加载
打开浏览器开发者工具（F12），运行：
```javascript
// 检查CSS文件是否加载
const cssLink = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
  .find(l => l.href.includes('WorldInfo-Recommender'));
console.log('CSS loaded:', cssLink?.href);

// 检查按钮的实际样式
const button = document.querySelector('.world-info-recommender-settings button');
if (button) {
  const styles = window.getComputedStyle(button);
  console.log('Button styles:', {
    background: styles.background,
    color: styles.color,
    flexDirection: styles.flexDirection,
    display: styles.display
  });
}
```

### 方法3：手动注入CSS（临时解决方案）
如果以上方法都不行，在Console中运行：
```javascript
const style = document.createElement('style');
style.textContent = `
  .world-info-recommender-settings button,
  .world-info-recommender-settings .menu_button,
  #worldInfoRecommenderPopup button,
  #worldInfoRecommenderPopup .menu_button {
    display: inline-flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: center !important;
    background: linear-gradient(135deg, #1b1b1b, #2f2f2f) !important;
    color: #f5f5f5 !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    white-space: nowrap !important;
    gap: 6px !important;
  }
  
  .world-info-recommender-settings button i,
  .world-info-recommender-settings button span,
  #worldInfoRecommenderPopup button i,
  #worldInfoRecommenderPopup button span {
    color: #f5f5f5 !important;
    display: inline !important;
  }
`;
document.head.appendChild(style);
console.log('Emergency styles injected!');
```

### 方法4：确认版本
运行此命令确认版本：
```javascript
fetch('/scripts/extensions/third-party/SillyTavern-WorldInfo-Recommender/manifest.json')
  .then(r => r.json())
  .then(m => console.log('Installed version:', m.version));
```
应该显示 `0.3.0` 或更高版本。

## 常见问题

### Q: 按钮还是绿色的
A: SillyTavern可能有非常强的默认样式。尝试方法3的临时解决方案。

### Q: 按钮文字还是竖着的
A: 确保清除了所有缓存并重新安装。有时候浏览器会缓存旧的CSS文件。

### Q: 中文文本没有显示
A: 检查Settings中的语言设置，确保选择了"中文"。

## 联系支持

如果以上方法都无效，请提供：
1. SillyTavern版本
2. 浏览器类型和版本
3. 扩展版本（通过方法4确认）
4. Console中的错误信息截图
