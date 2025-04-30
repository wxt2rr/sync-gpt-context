import BasePlatform from './base.js';
import { handleGenericInput, tryUploadImage } from './utils.js';

/**
 * Claude平台策略实现
 */
class ClaudePlatform extends BasePlatform {
  /**
   * 平台标识
   * @type {string}
   */
  static id = 'claude';

  /**
   * 平台显示名称
   * @type {string}
   */
  static displayName = 'Claude';

  /**
   * 检查URL是否匹配Claude
   * @param {string} url - 要检查的URL
   * @returns {boolean} - 如果URL匹配Claude则返回true
   */
  static matchesUrl(url) {
    return url.includes('claude.ai');
  }

  /**
   * 从Claude界面提取对话标题
   * @returns {string} - 提取的标题
   */
  extractTitle() {
    try {
      // 尝试从页面标题获取
      const titleElement = document.querySelector('title');
      if (titleElement && titleElement.textContent) {
        const titleText = titleElement.textContent.trim();
        if (titleText && !titleText.includes('Claude')) {
          return titleText;
        }
      }
      
      // 尝试从对话标题获取
      const chatTitle = document.querySelector('.ChatInfoHeader_title__QCkFK, .conversation-title, .chat-title');
      if (chatTitle && chatTitle.textContent.trim()) {
        return chatTitle.textContent.trim();
      }
      
      // 回退到第一条消息
      const firstMessage = document.querySelector('.message:first-child .message-content, .human:first-child');
      if (firstMessage) {
        const text = firstMessage.textContent.trim();
        return text.length > 30 ? text.substring(0, 27) + '...' : text;
      }
    } catch (error) {
      console.error('Error extracting Claude title:', error);
    }
    
    return 'Claude对话';
  }

  /**
   * 从Claude界面提取对话内容
   * @returns {Promise<Array>} - 消息对象数组
   */
  async extractContext() {
    console.log('Extracting Claude context...');
    const messages = [];
    
    try {
      // 尝试查找所有消息元素
      const messageElements = document.querySelectorAll('.message, .chat-message, .chat-turn');
      console.log('Found message elements:', messageElements.length);
      
      messageElements.forEach(element => {
        // 确定是否为用户消息
        const isUser = element.classList.contains('human') || 
                      element.hasAttribute('data-user-message') ||
                      element.querySelector('.user-icon, .user-avatar') !== null;
        
        // 提取消息内容
        let content = '';
        const contentElement = element.querySelector('.message-content, .content, .text-content');
        
        if (contentElement) {
          content = contentElement.textContent.trim();
        } else {
          content = element.textContent.trim();
        }
        
        // 检查消息是否包含图片或文件
        const attachments = [];
        
        // 提取图片
        const images = element.querySelectorAll('img:not(.avatar):not(.icon)');
        images.forEach(img => {
          if (img.src && !img.src.includes('data:image/svg+xml')) {
            attachments.push({
              type: 'image',
              url: img.src,
              alt: img.alt || '图片',
              preview: img.outerHTML
            });
            console.log('Found image in Claude:', img.src);
          }
        });
        
        // 提取文件链接
        const fileLinks = element.querySelectorAll('a[href][download], a[href$=".pdf"], a[href$=".doc"], a[href$=".docx"], a[href$=".txt"], a[href$=".csv"]');
        fileLinks.forEach(link => {
          if (link.href) {
            attachments.push({
              type: 'file',
              url: link.href,
              name: link.textContent.trim() || link.download || '文件',
              preview: link.outerHTML
            });
            console.log('Found file in Claude:', link.href);
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
      console.error('Error extracting Claude context:', error);
    }
    
    return messages;
  }

  /**
   * 将上下文恢复到Claude界面
   * @param {Array} context - 要恢复的上下文
   * @param {string} sourcePlatform - 上下文来源平台
   * @returns {Promise<boolean>} - 如果成功则返回true
   */
  async restoreContext(context, sourcePlatform) {
    console.log('Restoring context to Claude from', sourcePlatform, 'context length:', context.length);
    
    try {
      // 检查是否有对话内容
      if (!context || context.length === 0) {
        console.error('Empty context, nothing to restore');
        return false;
      }
      
      // 尝试创建新对话
      try {
        const newChatButton = document.querySelector('a[href="/chat"], button[aria-label="New chat"], button.new-chat');
        if (newChatButton) {
          console.log('Clicking new chat button');
          newChatButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待页面加载
        }
      } catch (e) {
        console.warn('Failed to start new chat, continuing with current chat:', e);
      }
      
      // 查找输入区域
      const textarea = document.querySelector('textarea.ProseMirror, textarea[placeholder*="发送消息"], div[contenteditable="true"]');
      if (!textarea) {
        console.error('Claude input element not found');
        return false;
      }
      
      // 将聊天记录转换为适合Claude的文本格式
      let adaptedContext = `我正在恢复一个来自${sourcePlatform}的对话。请当作以下对话已经发生过，并继续对话：\n\n`;
      
      // 根据消息角色格式化对话
      context.forEach(message => {
        // 添加角色标签
        if (message.role === 'user') {
          adaptedContext += '用户: ';
        } else if (message.role === 'assistant') {
          adaptedContext += 'AI: ';
        } else if (message.role === 'system') {
          adaptedContext += '系统: ';
        } else {
          adaptedContext += '其他: ';
        }
        
        // 添加消息内容
        adaptedContext += message.content + '\n\n';
        
        // 如果有附件，添加附件描述
        if (message.attachments && message.attachments.length > 0) {
          message.attachments.forEach(attachment => {
            if (attachment.type === 'image') {
              adaptedContext += `[附图: ${attachment.alt || '图片'}]\n`;
              
              // 如果是用户消息，尝试上传图片
              if (message.role === 'user') {
                setTimeout(async () => {
                  try {
                    const uploadButton = document.querySelector('button[aria-label*="Upload"], input[type="file"]');
                    if (uploadButton) {
                      const success = await tryUploadImage(uploadButton, attachment.url);
                      console.log('Image upload attempt result:', success);
                    }
                  } catch (e) {
                    console.error('Failed to upload image:', e);
                  }
                }, 1000);
              }
            } else if (attachment.type === 'file') {
              adaptedContext += `[附件: ${attachment.name || '文件'}]\n`;
            }
          });
          adaptedContext += '\n';
        }
      });
      
      console.log('Adapted context for Claude:', adaptedContext.substring(0, 100) + '...');
      
      // 输入文本
      const success = await handleGenericInput(textarea, adaptedContext, sourcePlatform);
      if (!success) {
        console.error('Failed to input text to Claude');
        return false;
      }
      
      // 尝试点击发送按钮
      try {
        const sendButton = document.querySelector('button[aria-label="Send message"], button[aria-label="发送消息"]');
        if (sendButton && !sendButton.disabled) {
          console.log('Clicking send button');
          sendButton.click();
        } else {
          console.log('Send button not found or disabled, trying to press Enter');
          // 触发Enter键事件
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            which: 13,
            keyCode: 13,
            bubbles: true
          });
          textarea.dispatchEvent(enterEvent);
        }
      } catch (e) {
        console.warn('Failed to submit input, please press Enter manually:', e);
      }
      
      return true;
    } catch (error) {
      console.error('Error restoring context to Claude:', error);
      return false;
    }
  }
}

export default ClaudePlatform; 