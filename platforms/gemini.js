import BasePlatform from './base.js';
import { handleGenericInput, tryUploadImage } from './utils.js';

/**
 * Gemini平台策略实现
 */
class GeminiPlatform extends BasePlatform {
  /**
   * 平台标识
   * @type {string}
   */
  static id = 'gemini';

  /**
   * 平台显示名称
   * @type {string}
   */
  static displayName = 'Gemini';

  /**
   * 检查URL是否匹配Gemini
   * @param {string} url - 要检查的URL
   * @returns {boolean} - 如果URL匹配Gemini则返回true
   */
  static matchesUrl(url) {
    return url.includes('gemini.google.com') || url.includes('bard.google.com');
  }

  /**
   * 从Gemini界面提取对话标题
   * @returns {string} - 提取的标题
   */
  extractTitle() {
    try {
      // 尝试从页面标题获取
      const titleElement = document.querySelector('title');
      if (titleElement && titleElement.textContent) {
        const titleText = titleElement.textContent.trim();
        if (titleText && !titleText.includes('Gemini') && !titleText.includes('Bard')) {
          return titleText;
        }
      }
      
      // 尝试从对话标题获取
      const chatTitle = document.querySelector('.conversation-title, .chat-title');
      if (chatTitle && chatTitle.textContent.trim()) {
        return chatTitle.textContent.trim();
      }
      
      // 查找第一条用户消息
      const firstUserMessage = document.querySelector('[data-message-id] [data-user-message], [data-conversation-id] [data-request-text]');
      if (firstUserMessage) {
        const text = firstUserMessage.textContent.trim();
        return text.length > 30 ? text.substring(0, 27) + '...' : text;
      }
    } catch (error) {
      console.error('Error extracting Gemini title:', error);
    }
    
    return 'Gemini对话';
  }

  /**
   * 从Gemini界面提取对话内容
   * @returns {Promise<Array>} - 消息对象数组
   */
  async extractContext() {
    console.log('Extracting Gemini context...');
    const messages = [];
    
    try {
      // 检测新版Gemini UI
      const newUIMessages = document.querySelectorAll('.chat-turn, .message-container, [data-testid="conversation-turn"], .chat-message-container');
      const isNewUI = newUIMessages.length > 0;
      console.log('检测到Gemini新UI:', isNewUI, '消息数:', newUIMessages.length);
      
      if (isNewUI) {
        // 处理新UI布局
        newUIMessages.forEach(container => {
          // 确定消息角色
          const isUser = container.classList.contains('user-message') || 
                        container.classList.contains('user-chat-turn') ||
                        container.querySelector('.user-icon, .user-avatar, [data-testid="user-message"]') !== null;
          
          // 提取文本内容
          let content = '';
          const contentElement = container.querySelector('.message-content, .text-content, .content, [data-testid="message-content"], .ql-editor');
          
          if (contentElement) {
            content = contentElement.textContent.trim();
          } else {
            content = container.textContent.trim();
          }
          
          // 收集附件
          const attachments = [];
          
          // 查找图片
          const images = container.querySelectorAll('img:not(.avatar):not(.user-icon):not(.bot-icon)');
          images.forEach(img => {
            if (img.src && !img.src.includes('data:image/svg+xml')) {
              attachments.push({
                type: 'image',
                url: img.src,
                alt: img.alt || '图片',
                preview: img.outerHTML
              });
              console.log('Found image in Gemini:', img.src);
            }
          });
          
          // 只添加有内容或附件的消息
          if (content || attachments.length > 0) {
            console.log('Found message - role:', isUser ? 'user' : 'assistant', 'content preview:', content.substring(0, 30));
            messages.push({
              role: isUser ? 'user' : 'assistant',
              content: content,
              attachments: attachments.length > 0 ? attachments : undefined
            });
          }
        });
        
        if (messages.length > 0) {
          return messages;
        }
      }
      
      // 回退到传统UI布局
      const messageContainers = document.querySelectorAll('[data-message-id], [data-conversation-id]');
      console.log('Found standard message containers:', messageContainers.length);
      
      messageContainers.forEach(container => {
        // 检查是用户消息还是AI回复
        const userMsg = container.querySelector('[data-user-message], [data-request-text]');
        const assistantMsg = container.querySelector('[data-model-response], [data-response-text]');
        let content = '';
        let role = '';
        const attachments = [];
        
        if (userMsg) {
          content = userMsg.textContent.trim();
          role = 'user';
          
          // 检查用户上传的图片
          const images = container.querySelectorAll('img, [data-type="user-image-preview"]');
          images.forEach(img => {
            if ((img.src && !img.src.includes('data:image/svg+xml')) || img.getAttribute('data-type') === 'user-image-preview') {
              const imgSrc = img.src || img.querySelector('img')?.src;
              if (imgSrc) {
                attachments.push({
                  type: 'image',
                  url: imgSrc,
                  alt: img.alt || '用户上传的图片',
                  preview: img.outerHTML
                });
                console.log('Found user image in Gemini:', imgSrc);
              }
            }
          });
          
        } else if (assistantMsg) {
          content = assistantMsg.textContent.trim();
          role = 'assistant';
          
          // 检查AI回复中的图片
          const images = assistantMsg.querySelectorAll('img');
          images.forEach(img => {
            if (img.src && !img.src.includes('data:image/svg+xml')) {
              attachments.push({
                type: 'image',
                url: img.src,
                alt: img.alt || 'AI生成的图片',
                preview: img.outerHTML
              });
              console.log('Found AI image in Gemini:', img.src);
            }
          });
        }
        
        if (content || attachments.length > 0) {
          console.log('Found message in standard UI - role:', role, 'attachments:', attachments.length);
          messages.push({ 
            role: role, 
            content: content,
            attachments: attachments.length > 0 ? attachments : undefined
          });
        }
      });
    } catch (error) {
      console.error('Error extracting Gemini context:', error);
    }
    
    return messages;
  }

  /**
   * 将上下文恢复到Gemini界面
   * @param {Array} context - 要恢复的上下文
   * @param {string} sourcePlatform - 上下文来源平台
   * @returns {Promise<boolean>} - 如果成功则返回true
   */
  async restoreContext(context, sourcePlatform) {
    console.log('Restoring context to Gemini from', sourcePlatform, 'context length:', context.length);
    
    try {
      // 检查是否有对话内容
      if (!context || context.length === 0) {
        console.error('Empty context, nothing to restore');
        return false;
      }
      
      // 尝试创建新对话
      try {
        const resetButton = document.querySelector('button[aria-label="Start new chat"], button[aria-label="重新开始"], button[aria-label="New chat"]');
        if (resetButton) {
          console.log('Clicking new chat button');
          resetButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待页面加载
        }
      } catch (e) {
        console.warn('Failed to start new chat, continuing with current chat:', e);
      }
      
      // 查找输入区域 - 尝试多种可能的选择器，包括最新的Gemini UI
      const textarea = document.querySelector('textarea[aria-label="Enter a prompt"], textarea[placeholder="发送消息"], textarea[placeholder="Message Gemini…"], .ql-editor[contenteditable="true"][aria-label="在此处输入提示"], .ql-editor[contenteditable="true"][role="textbox"], div[contenteditable="true"][role="textbox"][aria-label*="输入"]');
      
      if (!textarea) {
        console.error('无法找到Gemini输入框，尝试更多选择器');
        
        // 尝试查找任何可能的输入区域
        const possibleInputs = document.querySelectorAll('div[contenteditable="true"], textarea, div[role="textbox"]');
        console.log('找到可能的输入元素:', possibleInputs.length);
        
        if (possibleInputs.length === 0) {
          throw new Error('找不到Gemini输入框');
        }
        
        // 使用第一个找到的输入元素
        await this.handleGeminiInput(possibleInputs[0], context, sourcePlatform);
        return true;
      }
      
      console.log('Found Gemini textarea:', textarea);
      return await this.handleGeminiInput(textarea, context, sourcePlatform);
    } catch (error) {
      console.error('Error restoring context to Gemini:', error);
      return false;
    }
  }
  
  /**
   * 处理Gemini输入
   * @param {HTMLElement} inputElement - 输入元素
   * @param {Array} context - 上下文
   * @param {string} sourcePlatform - 源平台
   * @returns {Promise<boolean>} - 成功返回true
   * @private
   */
  async handleGeminiInput(inputElement, context, sourcePlatform) {
    // 检测是否有图片上传按钮
    const imageUploadButton = document.querySelector('button[aria-label="Add image"], button[aria-label="添加图片"], input[type="file"][accept="image/*"], button.image-upload-button');
    const hasImageUploadSupport = !!imageUploadButton;
    console.log('Gemini是否支持图片上传:', hasImageUploadSupport, imageUploadButton);
    
    // 准备恢复信息
    const summaryMessage = `我正在恢复一个来自${sourcePlatform}的对话。请当作以下对话已经发生过，并继续对话：\n\n`;
    
    // 格式化上下文为可读对话，处理图片
    let formattedContext = summaryMessage;
    let hasImageAttachments = false;
    let imageUrls = [];
    
    // 添加对图片和文件的描述
    context.forEach(message => {
      formattedContext += `${message.role === 'user' ? '用户' : 'AI助手'}: ${message.content || ''}\n`;
      
      // 添加附件信息并收集图片URL
      if (message.attachments && message.attachments.length > 0) {
        formattedContext += "\n[附件列表]\n";
        message.attachments.forEach((attachment, index) => {
          if (attachment.type === 'image') {
            formattedContext += `- 图片 ${index + 1}: ${attachment.alt || '图片'} (${attachment.url})\n`;
            imageUrls.push(attachment.url);
            hasImageAttachments = true;
          } else if (attachment.type === 'file') {
            formattedContext += `- 文件 ${index + 1}: ${attachment.name || '文件'} (${attachment.url})\n`;
          }
        });
        formattedContext += "\n";
      }
      
      formattedContext += "\n";
    });
    
    // 对于有图片的情况，添加特别说明
    if (hasImageAttachments) {
      formattedContext += "\n注意：原对话包含图片，我已经提供了图片链接。";
      if (hasImageUploadSupport) {
        formattedContext += "我会尝试在接下来上传一些图片。";
      } else {
        formattedContext += "此平台可能不支持直接查看图片，但您可以查看提供的链接。";
      }
      formattedContext += "\n\n";
    }
    
    // 设置值并触发输入事件 - 根据元素类型处理
    if (inputElement.tagName.toLowerCase() === 'div') {
      // 处理contenteditable div，特殊处理Gemini的ql-editor
      if (inputElement.classList.contains('ql-editor')) {
        // 对于ql-editor，我们需要创建和插入p元素
        const paragraph = document.createElement('p');
        paragraph.textContent = formattedContext;
        
        // 清空现有内容并插入新段落
        inputElement.innerHTML = '';
        inputElement.appendChild(paragraph);
        
        // 移除空白占位符类
        inputElement.classList.remove('ql-blank');
      } else {
        // 常规contenteditable div
        inputElement.textContent = formattedContext;
      }
      
      // 触发输入事件
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      // 模拟聚焦
      inputElement.focus();
    } else {
      // 处理标准textarea
      inputElement.value = formattedContext;
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // 寻找并点击发送按钮
    const sendButton = document.querySelector('button[aria-label="Send message"], button[aria-label="发送"], button[data-test-id="send-button"], button.send-button, button.submit');
    if (sendButton && !sendButton.disabled) {
      console.log('Clicking Gemini send button');
      // 等待内容渲染完成
      await new Promise(resolve => setTimeout(resolve, 500));
      sendButton.click();
      
      // 如果有图片附件并且平台支持图片上传，尝试上传第一张图片
      if (hasImageAttachments && hasImageUploadSupport && imageUrls.length > 0) {
        // 等待消息发送完成
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          // 尝试上传图片
          await tryUploadImage(imageUploadButton, imageUrls[0]);
        } catch (error) {
          console.error('上传图片失败:', error);
        }
      }
      
      return true;
    } else {
      console.warn('Gemini send button not found or disabled, trying to dispatch Enter key');
      // 如果找不到发送按钮，尝试按回车键
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      inputElement.dispatchEvent(enterEvent);
      return true;
    }
  }
}

export default GeminiPlatform; 