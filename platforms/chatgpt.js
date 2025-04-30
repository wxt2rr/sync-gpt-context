import BasePlatform from './base.js';
import { handleGenericInput, tryUploadImage } from './utils.js';

/**
 * ChatGPT platform strategy implementation
 */
class ChatGPTPlatform extends BasePlatform {
  /**
   * Platform identifier
   * @type {string}
   */
  static id = 'chatgpt';

  /**
   * Platform display name
   * @type {string}
   */
  static displayName = 'ChatGPT';

  /**
   * Check if URL matches ChatGPT
   * @param {string} url - URL to check
   * @returns {boolean} - True if URL matches ChatGPT
   */
  static matchesUrl(url) {
    return url.includes('chat.openai.com') || url.includes('chatgpt.com');
  }

  /**
   * Extract chat title from ChatGPT interface
   * @returns {string} - The extracted title
   */
  extractTitle() {
    try {
      // 尝试从标题获取
      const titleElement = document.querySelector('title');
      if (titleElement && titleElement.textContent) {
        const titleText = titleElement.textContent.trim();
        if (titleText && !titleText.includes('ChatGPT')) {
          return titleText;
        }
      }
      
      // 尝试从导航菜单获取当前对话标题
      const navTitle = document.querySelector('nav a.active span');
      if (navTitle && navTitle.textContent.trim()) {
        return navTitle.textContent.trim();
      }
      
      // 尝试从第一条用户消息获取
      const firstUserMessage = document.querySelector('[data-message-author-role="user"], [data-testid="user-message"]');
      if (firstUserMessage) {
        const text = firstUserMessage.textContent.trim();
        return text.length > 30 ? text.substring(0, 27) + '...' : text;
      }
    } catch (error) {
      console.error('Error extracting ChatGPT title:', error);
    }
    
    return 'ChatGPT对话';
  }

  /**
   * Extract chat context from ChatGPT interface
   * @returns {Promise<Array>} - Array of message objects
   */
  async extractContext() {
    console.log('Extracting ChatGPT context...');
    const messages = [];
    
    try {
      // 尝试新版ChatGPT的选择器
      const messageContainers = document.querySelectorAll('[data-message-author-role], [data-testid="conversation-turn"]');
      console.log('Found message containers:', messageContainers.length);
      
      messageContainers.forEach(element => {
        let role = '';
        let content = '';
        const attachments = [];
        
        // 检查各种可能的角色指示器
        if (element.hasAttribute('data-message-author-role')) {
          role = element.getAttribute('data-message-author-role');
        } else if (element.querySelector('[data-testid="agent-turn"]')) {
          role = 'assistant';
        } else if (element.querySelector('[data-testid="user-message"]')) {
          role = 'user';
        }
        
        // 提取文本内容
        const contentElement = element.querySelector('.markdown, [data-message-text], [data-testid="agent-turn-markdown"], [data-testid="user-message"]');
        if (contentElement) {
          content = contentElement.textContent.trim();
        } else {
          content = element.textContent.trim();
        }
        
        // 提取图片
        const images = element.querySelectorAll('img');
        images.forEach(img => {
          if (img.src && !img.src.includes('data:image/svg+xml') && !img.classList.contains('emoji')) {
            attachments.push({
              type: 'image',
              url: img.src,
              alt: img.alt || '图片',
              preview: img.outerHTML
            });
            console.log('Found image in ChatGPT:', img.src);
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
            console.log('Found file in ChatGPT:', link.href);
          }
        });
        
        // 只添加有内容或附件的消息
        if (content || attachments.length > 0) {
          console.log('Found message - role:', role, 'content preview:', content.substring(0, 30));
          messages.push({
            role: role,
            content: content,
            attachments: attachments.length > 0 ? attachments : undefined
          });
        }
      });
    } catch (error) {
      console.error('Error extracting ChatGPT context:', error);
    }
    
    return messages;
  }

  /**
   * Restore context to ChatGPT interface
   * @param {Array} context - The context to restore
   * @param {string} sourcePlatform - Platform the context was saved from
   * @returns {Promise<boolean>} - True if successful
   */
  async restoreContext(context, sourcePlatform) {
    console.log('Restoring context to ChatGPT from', sourcePlatform, 'context length:', context.length);
    
    try {
      // 检查是否有对话内容
      if (!context || context.length === 0) {
        console.error('Empty context, nothing to restore');
        return false;
      }
      
      // 首先尝试点击"New chat"按钮以确保在新对话中
      try {
        const newChatButton = document.querySelector('nav > a[href="/"], nav button:has-text("New chat")');
        if (newChatButton) {
          console.log('Clicking New chat button');
          newChatButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待页面加载
        }
      } catch (e) {
        console.warn('Failed to start new chat, continuing with current chat:', e);
      }
      
      // 查找输入区域
      let inputElement = document.querySelector('#prompt-textarea, [data-testid="chat-input-textbox"]');
      if (!inputElement) {
        console.error('ChatGPT input element not found');
        return false;
      }
      
      // 将聊天记录转换为适合ChatGPT的文本格式
      let adaptedContext = '';
      
      // 根据消息角色添加前缀
      context.forEach((message, index) => {
        // 跳过大多数AI回复，只保留最近的一个，因为我们要模拟用户输入
        if (message.role === 'assistant' && index < context.length - 2) {
          return;
        }
        
        // 根据角色添加前缀
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
              
              // 尝试上传图片
              if (message.role === 'user') {
                setTimeout(async () => {
                  try {
                    const uploadButton = document.querySelector('button[data-testid="attach-button"], input[type="file"], button.image-input');
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
      
      console.log('Adapted context for ChatGPT:', adaptedContext.substring(0, 100) + '...');
      
      // 输入文本
      const success = await handleGenericInput(inputElement, adaptedContext, sourcePlatform);
      if (!success) {
        console.error('Failed to input text to ChatGPT');
        return false;
      }
      
      // 尝试点击发送按钮
      try {
        const sendButton = document.querySelector('button[data-testid="send-button"]');
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
          inputElement.dispatchEvent(enterEvent);
        }
      } catch (e) {
        console.warn('Failed to submit input, please press Enter manually:', e);
      }
      
      return true;
    } catch (error) {
      console.error('Error restoring context to ChatGPT:', error);
      return false;
    }
  }
}

export default ChatGPTPlatform; 