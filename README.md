# 🧠 AI Chat Context Sync Extension
# 🧠 AI 聊天上下文同步扩展

> *"Seamless conversations across AI platforms"*  
> *"跨 AI 平台的无缝对话"*

This browser extension enables you to synchronize conversation contexts between different AI platforms. It allows you to continue your conversations seamlessly when switching from one AI service to another, preserving the entire dialogue history.

这个浏览器扩展使您能够在不同的AI平台之间同步对话上下文。它允许您在从一个AI服务切换到另一个时无缝地继续对话，保留整个对话历史。

## ✨ Key Features | 主要功能

This Chrome extension transfers your conversations between different AI platforms with precision and reliability, creating a unified experience across services.

这个Chrome扩展可靠精确地在不同AI平台之间传输您的对话，创造跨服务统一的体验。

### 🚀 Capabilities | 核心能力

- **Context Preservation** | **上下文保存**: Extract and preserve entire conversations including text, images, and files
  提取并保存包括文本、图片和文件在内的完整对话内容

- **Cross-Platform Compatibility** | **跨平台兼容**: Transfer conversations between different AI platforms
  在不同AI平台之间传输对话

- **History Management** | **历史管理**: Access and restore your past conversations
  访问和恢复您过去的对话

- **Media Support** | **媒体支持**: Transfer images across platforms (where supported)
  在支持的平台之间传输图像

- **Model Continuity** | **模型连续性**: Maintain context when switching between models on platforms like DeepSeek
  在像DeepSeek这样的平台上切换模型时保持上下文

## 🤖 Supported Platforms | 支持的平台

| Platform | Website | Compatibility |
| 平台 | 网站 | 兼容性 |
|----------|---------|-------|
| ChatGPT | chat.openai.com | Full conversation support 完整对话支持 |
| Claude | claude.ai | Images supported 支持图像 |
| Gemini | gemini.google.com | Text conversations 文本对话 |
| Grok | grok.com | Complete message extraction 完整消息提取 |
| DeepSeek | chat.deepseek.com | Model switching support 支持模型切换 |
| 通义千问 | tongyi.com/qianwen.aliyun.com | Chinese language support 中文支持 |
| 豆包 | doubao.com | Full conversation support 完整对话支持 |

## 🧩 Technical Architecture | 技术架构

The extension implements a modular design using the strategy pattern:

该扩展使用策略模式实现模块化设计：

- **platforms/base.js**: Base interface that all platform implementations extend
  所有平台实现扩展的基础接口

- **platforms/registry.js**: Central registry managing all platform strategies
  管理所有平台策略的中央注册表

- **platforms/index.js**: Entry point exporting the registry and platform classes
  导出注册表和平台类的入口点

- **platforms/[platform].js**: Platform-specific implementations
  平台特定实现

- **content.js**: Content script for webpage DOM interaction
  用于网页DOM交互的内容脚本

- **background.js**: Background script managing extension lifecycle
  管理扩展生命周期的后台脚本

- **popup.html/js**: User interface for context management
  用于上下文管理的用户界面

## 🔄 Usage Instructions | 使用说明

1. **Save Context** | **保存上下文**: While using an AI platform, click the extension and save your conversation
   在使用AI平台时，点击扩展并保存您的对话

2. **Change Platforms** | **更换平台**: Navigate to a different AI service
   导航到不同的AI服务

3. **Select History** | **选择历史**: Click the extension icon and select your saved conversation
   点击扩展图标并选择您保存的对话

4. **Restore** | **恢复**: The conversation will be restored in the new platform
   对话将在新平台中恢复

## 💻 Developer Information | 开发者信息

For contributions or customization:

对于贡献或自定义开发：

```bash
# Repository clone | 仓库克隆
git clone https://github.com/yourusername/ai-chat-context-sync.git

# Chrome installation | Chrome安装
1. Navigate to chrome://extensions | 导航至chrome://extensions
2. Enable Developer mode | 启用开发者模式
3. Select "Load unpacked" and choose the project folder | 选择"加载已解压的扩展程序"并选择项目文件夹
```

### Extending Platform Support | 扩展平台支持

To add support for additional platforms, create a new implementation file in the `platforms` directory following the established pattern. Reference existing implementations for guidance.

要添加对其他平台的支持，请在`platforms`目录中创建一个新的实现文件，遵循已建立的模式。参考现有实现以获取指导。

## 📝 License | 许可证

MIT License - Open for modification and distribution with attribution.

MIT许可证 - 允许在注明出处的情况下修改和分发。

---

Developed for seamless AI interaction across multiple platforms.

为跨多平台的无缝AI交互而开发。 