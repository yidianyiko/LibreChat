# Social Media Sharing Images - 创建指南

## 当前状态

✅ **占位符已创建**：
- `og-image-placeholder.svg` (1200x630px) - Facebook/LinkedIn 用
- `twitter-card-placeholder.svg` (1200x675px) - Twitter 用

这些占位符是临时的，可以让你的网站正常工作，但建议尽快替换为专业设计的图片。

---

## 需要创建的最终图片

### 1. **Open Graph 图片** (Facebook, LinkedIn, WhatsApp)
- **文件名**: `og-image.jpg` 或 `og-image.png`
- **尺寸**: **1200 x 630** 像素 (严格遵守，否则会被裁剪)
- **纵横比**: 1.91:1
- **文件大小**: < 5 MB
- **格式**: JPG (推荐) 或 PNG
- **安全区**: 中心 1200x600px 是所有平台都显示的区域

### 2. **Twitter Card 图片**
- **文件名**: `twitter-card.jpg` 或 `twitter-card.png`
- **尺寸**: **1200 x 675** 像素 (或 1200x628, 都可以)
- **纵横比**: 16:9 或接近 2:1
- **文件大小**: < 5 MB
- **格式**: JPG (推荐) 或 PNG

---

## 设计建议

### 视觉元素
- **品牌颜色**: `#009688` (青绿色 - 你的主题色)
- **背景**: 深色 (`#0d0d0d` 或 `#1a1a1a`) 与你的网站保持一致
- **文字**:
  - 主标题: **keep4oforever** (大而醒目)
  - 副标题: **Free GPT-4o AI Chat** (强调核心价值)
  - 标语: "Access Advanced AI Today" 或 "Your Reliable AI Companion"

### 内容建议
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           keep4oforever

      Free GPT-4o AI Chat

  Access Advanced AI • Powered by OpenAI

         keep4oforever.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 注意事项
- ✅ 使用高对比度（深色背景 + 白色/青色文字）
- ✅ 字体要大且清晰（在小屏幕上也能看清）
- ✅ 避免边缘放重要信息（某些平台会裁剪）
- ✅ 保持简洁 - 不要放太多文字
- ❌ 不要使用太小的字体
- ❌ 不要依赖细节（缩略图会看不清）

---

## 创建方法

### 方法 1: 在线设计工具（推荐，最简单）

#### **Canva** (免费)
1. 访问 https://www.canva.com
2. 搜索 "Open Graph Image" 或 "Facebook Post" 模板
3. 使用模板或从空白画布开始
4. 设置画布尺寸：
   - 1200 x 630 (Open Graph)
   - 1200 x 675 (Twitter Card)
5. 添加你的文字和品牌元素
6. 下载为 JPG 或 PNG

#### **Figma** (免费，专业)
1. 访问 https://www.figma.com
2. 创建新文件
3. 创建 Frame:
   - Press `F` 键
   - 手动输入 1200 x 630
4. 设计你的图片
5. 导出: File → Export → JPG/PNG

#### **Adobe Express** (免费版可用)
1. 访问 https://www.adobe.com/express
2. 选择 "Social Post" → "Facebook Post"
3. 自定义设计
4. 下载

### 方法 2: 使用 AI 生成

#### **ChatGPT + DALL-E**
```
Prompt: Create a social media sharing image for "keep4oforever"
- Dark background (#0d0d0d)
- Main text: "keep4oforever" in large white bold font
- Subtitle: "Free GPT-4o AI Chat" in cyan (#009688)
- Modern, minimalist design
- Size: 1200x630px
```

#### **Midjourney** (需订阅)
```
/imagine social media banner, dark theme, tech startup,
"keep4oforever Free GPT-4o AI Chat", minimalist,
cyan accent color, --ar 1.91:1
```

### 方法 3: 代码生成（如果你会编程）

使用 Node.js + `canvas` 库:
```bash
npm install canvas
```

```javascript
const { createCanvas } = require('canvas');
const fs = require('fs');

const canvas = createCanvas(1200, 630);
const ctx = canvas.getContext('2d');

// 背景
ctx.fillStyle = '#0d0d0d';
ctx.fillRect(0, 0, 1200, 630);

// 主标题
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 72px Arial';
ctx.textAlign = 'center';
ctx.fillText('keep4oforever', 600, 250);

// 副标题
ctx.fillStyle = '#009688';
ctx.font = '36px Arial';
ctx.fillText('Free GPT-4o AI Chat', 600, 320);

// 保存
const buffer = canvas.toBuffer('image/jpeg');
fs.writeFileSync('./og-image.jpg', buffer);
```

---

## 部署步骤

### 步骤 1: 创建图片
使用上述任一方法创建两张图片。

### 步骤 2: 转换为 JPG（如果是 PNG）
```bash
# 使用 ImageMagick (如果已安装)
convert og-image.png -quality 85 og-image.jpg
convert twitter-card.png -quality 85 twitter-card.jpg
```

或使用在线工具:
- https://tinypng.com (压缩)
- https://squoosh.app (Google 的图片优化工具)

### 步骤 3: 替换占位符
将你的最终图片放到：
```
client/public/assets/og-image.jpg
client/public/assets/twitter-card.jpg
```

删除占位符文件（可选）：
```bash
rm client/public/assets/og-image-placeholder.svg
rm client/public/assets/twitter-card-placeholder.svg
```

### 步骤 4: 更新 HTML（如果需要）
检查 `client/index.html` 中的引用是否正确：
```html
<meta property="og:image" content="https://keep4oforever.com/assets/og-image.jpg" />
<meta name="twitter:image" content="https://keep4oforever.com/assets/twitter-card.jpg" />
```

### 步骤 5: 重新构建并部署
```bash
cd client
npm run build
# 然后使用你的部署流程
```

---

## 验证

部署后，使用这些工具测试你的社交分享图片：

### **Facebook/Open Graph**
https://developers.facebook.com/tools/debug/
输入: https://keep4oforever.com

### **Twitter Card**
https://cards-dev.twitter.com/validator
输入: https://keep4oforever.com

### **LinkedIn**
https://www.linkedin.com/post-inspector/
输入: https://keep4oforever.com

---

## 快速临时方案

如果你现在没时间设计，可以使用占位符 SVG：

1. 将 `index.html` 中的图片路径改为 `.svg`:
```html
<meta property="og:image" content="https://keep4oforever.com/assets/og-image-placeholder.svg" />
<meta name="twitter:image" content="https://keep4oforever.com/assets/twitter-card-placeholder.svg" />
```

2. 重新构建部署

⚠️ **注意**: SVG 不是所有平台都支持，建议尽快替换为 JPG/PNG。

---

## 参考资源

- **Facebook OG 规范**: https://developers.facebook.com/docs/sharing/webmasters/images/
- **Twitter Card 规范**: https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/summary-card-with-large-image
- **Open Graph Protocol**: https://ogp.me/

---

**需要帮助？** 如果你需要我帮你生成更具体的设计建议或代码，请告诉我！
