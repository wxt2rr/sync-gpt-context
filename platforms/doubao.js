import BasePlatform from './base.js';
import { handleGenericInput, tryUploadImage } from './utils.js';

/**
 * 豆包平台策略实现
 */
class DoubaoPlatform extends BasePlatform {
  /**
   * 平台标识
   * @type {string}
   */
  static id = 'doubao';

  /**
   * 平台显示名称
   * @type {string}
   */
  static displayName = '豆包';

  /**
   * 检查URL是否匹配豆包
   * @param {string} url - 要检查的URL
   * @returns {boolean} - 如果URL匹配豆包则返回true
   */
  static matchesUrl(url) {
    return url.includes('doubao.com');
  }

  /**
   * 从豆包界面提取对话标题
   * @returns {string} - 提取的标题
   */
  extractTitle() {
    try {
      // 尝试从页面标题获取
      const titleElement = document.querySelector('title');
      if (titleElement && titleElement.textContent) {
        const titleText = titleElement.textContent.trim();
        if (titleText && !titleText.includes('豆包') && !titleText.includes('Doubao')) {
          return titleText;
        }
      }
      
      // 尝试从对话标题获取
      const chatTitle = document.querySelector('.conversation-title, .chat-title, .title');
      if (chatTitle && chatTitle.textContent.trim()) {
        return chatTitle.textContent.trim();
      }
      
      // 查找第一条用户消息
      const firstUserMessage = document.querySelector('.message.user, .message.human, .human-message');
      if (firstUserMessage) {
        const text = firstUserMessage.textContent.trim();
        return text.length > 30 ? text.substring(0, 27) + '...' : text;
      }
    } catch (error) {
      console.error('Error extracting Doubao title:', error);
    }
    
    return '豆包对话';
  }

  /**
   * 从豆包界面提取对话内容
   * @returns {Promise<Array>} - 消息对象数组
   */
  async extractContext() {
    console.log('Extracting Doubao context...');
    const messages = [];
    
    try {
      // 查找对话消息容器
      const messageContainers = document.querySelectorAll('.message, .chat-item, .chat-bubble');
      console.log('Found Doubao message containers:', messageContainers.length);
      
      messageContainers.forEach(container => {
        // 确定消息角色
        const isUser = container.classList.contains('user') || 
                      container.classList.contains('question') ||
                      container.classList.contains('human') ||
                      container.classList.contains('user-message');
        
        // 提取消息内容
        let content = '';
        const contentElement = container.querySelector('.content, .message-content, .text, .message-text');
        
        if (contentElement) {
          content = contentElement.textContent.trim();
        } else {
          content = container.textContent.trim();
        }
        
        // 收集附件
        const attachments = [];
        
        // 查找图片
        const images = container.querySelectorAll('img:not(.avatar):not(.icon)');
        images.forEach(img => {
          if (img.src && !img.src.includes('data:image/svg+xml')) {
            attachments.push({
              type: 'image',
              url: img.src,
              alt: img.alt || '图片',
              preview: img.outerHTML
            });
            console.log('Found image in Doubao:', img.src);
          }
        });
        
        // 查找文件链接
        const fileLinks = container.querySelectorAll('a[href][download], a[href$=".pdf"], a[href$=".doc"], a[href$=".docx"], a[href$=".txt"], a[href$=".csv"]');
        fileLinks.forEach(link => {
          if (link.href) {
            attachments.push({
              type: 'file',
              url: link.href,
              name: link.textContent.trim() || link.download || '文件',
              preview: link.outerHTML
            });
            console.log('Found file in Doubao:', link.href);
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
    } catch (error) {
      console.error('Error extracting Doubao context:', error);
    }
    
    return messages;
  }

  /**
   * 将上下文恢复到豆包界面
   * @param {Array} context - 要恢复的上下文
   * @param {string} sourcePlatform - 上下文来源平台
   * @returns {Promise<boolean>} - 如果成功则返回true
   */
  async restoreContext(context, sourcePlatform) {
    console.log('Restoring context to Doubao from', sourcePlatform, 'context length:', context.length);
    
    try {
      // 检查是否有对话内容
      if (!context || context.length === 0) {
        console.error('Empty context, nothing to restore');
        return false;
      }
      
      // 尝试创建新对话
      try {
        const newChatButton = document.querySelector('button.new-chat, button[title*="新对话"], button.create-button');
        if (newChatButton) {
          console.log('Clicking new chat button');
          newChatButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待页面加载
        }
      } catch (e) {
        console.warn('Failed to start new chat, continuing with current chat:', e);
      }
      
      // 查找输入区域
      const textarea = document.querySelector('textarea, div[contenteditable="true"], .chat-input textarea, [placeholder*="问点什么"]');
      if (!textarea) {
        console.error('无法找到豆包输入框，尝试更多选择器');
        
        // 尝试更多的选择器
        const possibleInputs = document.querySelectorAll('input[type="text"], div[role="textbox"], [placeholder*="提问"], [placeholder*="发送"]');
        console.log('找到可能的输入元素:', possibleInputs.length);
        
        if (possibleInputs.length === 0) {
          throw new Error('找不到豆包输入框');
        }
        
        // 使用第一个找到的输入元素
        const success = await handleGenericInput(possibleInputs[0], this.formatContextForDoubao(context, sourcePlatform), sourcePlatform);
        
        if (success) {
          this.trySubmitForm(possibleInputs[0]);
        }
        
        return success;
      }
      
      console.log('Found Doubao textarea:', textarea);
      const success = await handleGenericInput(textarea, this.formatContextForDoubao(context, sourcePlatform), sourcePlatform);
      
      if (success) {
        this.trySubmitForm(textarea);
      }
      
      return success;
    } catch (error) {
      console.error('Error restoring context to Doubao:', error);
      return false;
    }
  }
  
  /**
   * 格式化上下文为豆包格式
   * @param {Array} context - 原始上下文
   * @param {string} sourcePlatform - 源平台
   * @returns {string} - 格式化后的上下文
   * @private
   */
  formatContextForDoubao(context, sourcePlatform) {
    // 准备恢复信息
    const summaryMessage = `我正在恢复一个来自${sourcePlatform}的对话。请当作以下对话已经发生过，并继续对话：\n\n`;
    
    // 格式化上下文为可读对话
    let formattedContext = summaryMessage;
    let hasImageAttachments = false;
    
    // 添加对话内容
    context.forEach(message => {
      formattedContext += `${message.role === 'user' ? '用户' : 'AI助手'}: ${message.content || ''}\n`;
      
      // 添加附件信息
      if (message.attachments && message.attachments.length > 0) {
        formattedContext += "\n[附件列表]\n";
        message.attachments.forEach((attachment, index) => {
          if (attachment.type === 'image') {
            formattedContext += `- 图片 ${index + 1}: ${attachment.alt || '图片'} (${attachment.url})\n`;
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
      formattedContext += "\n注意：原对话包含图片，我已经提供了图片链接。豆包支持图片，如果需要可以尝试手动上传相关图片。\n\n";
    }
    
    return formattedContext;
  }
  
  /**
   * 尝试提交表单
   * @param {HTMLElement} inputElement - 输入元素
   * @private
   */
  trySubmitForm(inputElement) {
    try {
      // 寻找并点击发送按钮
      const sendButton = document.querySelector('button[type="submit"], button.send-button, button[aria-label*="发送"], button.submit');
      if (sendButton && !sendButton.disabled) {
        console.log('Clicking Doubao send button');
        sendButton.click();
      } else {
        console.log('Send button not found or disabled, trying to press Enter');
        // 触发Enter键事件
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          which: 13,
          keyCode: 13,
          bubbles: true,
          cancelable: true
        });
        inputElement.dispatchEvent(enterEvent);
      }
    } catch (e) {
      console.warn('Failed to submit input:', e);
    }
  }
}

export default DoubaoPlatform; 