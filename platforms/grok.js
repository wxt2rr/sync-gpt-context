import BasePlatform from './base.js';
import { handleGenericInput, tryUploadImage, safeInherit } from './utils.js';

/**
 * Grok平台策略实现
 */
class GrokPlatform {
  constructor() {
    // Use the safeInherit helper to inherit from BasePlatform
    safeInherit(this, BasePlatform, 'GrokPlatform');
    
    // Set a flag for initialized state
    this.initialized = true;
    
    // Debug mode
    this.debug = true;
  }

  /**
   * 平台标识
   * @type {string}
   */
  static id = 'grok';

  /**
   * 平台显示名称
   * @type {string}
   */
  static displayName = 'Grok';

  /**
   * 检查URL是否匹配Grok
   * @param {string} url - 要检查的URL
   * @returns {boolean} - 如果URL匹配Grok则返回true
   */
  static matchesUrl(url) {
    if (!url) return false;
    return url.includes('grok.x.ai') || 
           url.includes('x.ai/grok') || 
           url.includes('grok.com');
  }

  /**
   * 调试日志函数
   * @private
   */
  _log(...args) {
    if (this.debug) {
      console.log('[GrokPlatform]', ...args);
    }
  }

  /**
   * 从Grok界面提取对话标题
   * @returns {string} - 提取的标题
   */
  extractTitle() {
    try {
      // 尝试从页面标题获取
      const titleElement = document.querySelector('title');
      if (titleElement && titleElement.textContent) {
        const titleText = titleElement.textContent.trim();
        if (titleText && !titleText.includes('Grok')) {
          return titleText;
        }
      }

      // 尝试从URL获取标题
      const pathSegments = window.location.pathname.split('/');
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment && lastSegment.length > 8) {
        return `Grok对话 ${lastSegment.substring(0, 8)}...`;
      }

      // 尝试从对话标题获取
      const selectors = [
        '.conversation-title', 
        '.chat-title',
        '.topic-title',
        'h1.title',
        '.header-title',
        '[aria-label="Chat title"]'
      ];
      
      for (const selector of selectors) {
        const chatTitle = document.querySelector(selector);
        if (chatTitle && chatTitle.textContent.trim()) {
          return chatTitle.textContent.trim();
        }
      }

      // 查找第一条用户消息
      const userMessageSelectors = [
        '.user-message', 
        '.human-message', 
        '.message.user',
        '[data-user="true"]',
        '[data-testid="user-message"]',
        '.message[data-message-author-role="user"]',
        '.whitespace-pre-wrap'
      ];
      
      for (const selector of userMessageSelectors) {
        const firstUserMessage = document.querySelector(selector);
        if (firstUserMessage) {
          const text = firstUserMessage.textContent.trim();
          return text.length > 30 ? text.substring(0, 27) + '...' : text;
        }
      }
    } catch (error) {
      console.error('Error extracting Grok title:', error);
    }

    return 'Grok对话';
  }

  /**
   * 记录页面DOM结构信息以便调试
   * @private
   */
  _logPageStructure() {
    try {
      this._log('==== Logging Page Structure for Debugging ====');
      
      // 记录页面URL
      this._log('Page URL:', window.location.href);
      
      // 记录主要容器
      const containers = [
        { name: 'Body', selector: 'body' },
        { name: 'Main', selector: 'main' },
        { name: 'App Root', selector: '#root, #app' },
        { name: 'Chat Container', selector: '.chat-container, .conversation-container' }
      ];
      
      containers.forEach(({ name, selector }) => {
        const element = document.querySelector(selector);
        this._log(`${name} exists:`, !!element, element ? `with ${element.children.length} children` : '');
      });
      
      // 记录消息容器
      const messageContainers = document.querySelectorAll('.flex.flex-col.items-center');
      this._log('Message container count:', messageContainers.length);
      
      if (messageContainers.length > 0) {
        const firstContainer = messageContainers[0];
        this._log('First message container children count:', firstContainer.children.length);
        this._log('First message container class names:', firstContainer.className);
      }
      
      // 记录所有可能包含消息的元素
      const messageElements = [
        { name: 'Whitespace-pre-wrap', selector: '.whitespace-pre-wrap' },
        { name: 'Break-words', selector: 'p.break-words' },
        { name: 'Message-bubble', selector: '.message-bubble' },
        { name: 'User messages', selector: '.items-end' },
        { name: 'AI messages', selector: '.items-start' },
        { name: 'Prose elements', selector: '.prose' }
      ];
      
      messageElements.forEach(({ name, selector }) => {
        const elements = document.querySelectorAll(selector);
        this._log(`${name} count:`, elements.length);
        if (elements.length > 0) {
          this._log(`First ${name} text sample:`, elements[0].textContent.trim().substring(0, 50) + '...');
        }
      });
      
      // 检查内容标记
      if (document.documentElement.innerHTML.includes('whitespace-pre-wrap')) {
        this._log('Found whitespace-pre-wrap in HTML source');
      }
      
      this._log('==== End of Page Structure Logging ====');
    } catch (err) {
      this._log('Error logging page structure:', err);
    }
  }

  /**
   * 从Grok界面提取对话内容
   * @returns {Promise<Array>} - 消息对象数组
   */
  async extractContext() {
    this._log('Extracting Grok context...');
    
    // 记录页面结构信息，帮助调试
    this._logPageStructure();
    
    const messages = [];

    try {
      // 方法1: 直接使用document.querySelectorAll抓取所有的消息元素
      this._log('Method 1: Direct querySelector extraction');
      
      // 用户消息元素的选择器
      const userSelectors = [
        '.items-end .whitespace-pre-wrap',
        '.items-end [class*="whitespace-pre-wrap"]',
        '[data-user="true"]',
        '[data-testid="user-message"]',
        '.message-bubble',
        '.group .items-end',
        '.flex.flex-col.items-end'
      ];
      
      // AI助手消息元素的选择器
      const assistantSelectors = [
        '.items-start .prose',
        '.items-start .whitespace-pre-wrap',
        '.items-start p.break-words',
        '[data-testid="assistant-message"]',
        '.prose',
        '.group .items-start',
        '.flex.flex-col.items-start'
      ];
      
      // 查找所有消息元素，不区分角色
      const allMessageElements = [];
      const messageSelectors = [
        '.whitespace-pre-wrap',
        '.prose p',
        '.break-words',
        '.message-bubble',
        '.group',
        '[class*="chat-message"]',
        '[class*="message-content"]'
      ];
      
      // 通用查找消息
      for (const selector of messageSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          this._log(`Found ${elements.length} potential messages with selector: ${selector}`);
          
          // 为每个消息确定角色并添加到列表
          elements.forEach(element => {
            try {
              // 尝试确定消息角色
              let role = null;
              let current = element;
              let depth = 0;
              
              // 向上查找父元素以确定角色
              while (current && depth < 5 && !role) {
                const classList = current.className || '';
                const attributes = current.attributes ? Array.from(current.attributes).map(a => a.name + '=' + a.value).join(' ') : '';
                
                // 检查是否有用户消息标记
                if (
                  classList.includes('items-end') || 
                  attributes.includes('data-user="true"') ||
                  classList.includes('message-bubble') ||
                  (current.closest && current.closest('.items-end'))
                ) {
                  role = 'user';
                  break;
                } 
                // 检查是否有AI消息标记
                else if (
                  classList.includes('items-start') || 
                  classList.includes('prose') ||
                  (current.closest && current.closest('.items-start')) ||
                  (current.closest && current.closest('.prose'))
                ) {
                  role = 'assistant';
                  break;
                }
                
                current = current.parentElement;
                depth++;
              }
              
              // 如果无法确定角色，跳过该元素
              if (!role) {
                return;
              }
              
              // 提取消息内容
              let content = element.textContent.trim();
              if (!content) {
                return;
              }
              
              // 获取元素在页面中的位置（用于后续排序）
              const rect = element.getBoundingClientRect();
              
              // 将消息添加到列表
              allMessageElements.push({
                element,
                role,
                position: rect.top,
                content
              });
              
              this._log(`Identified ${role} message: ${content.substring(0, 30)}...`);
            } catch (err) {
              this._log(`Error processing element:`, err);
            }
          });
          
          // 如果找到了足够的消息，跳出循环
          if (allMessageElements.length >= 2) {
            break;
          }
        }
      }
      
      // 如果通用查找失败，尝试分别查找用户和助手消息
      if (allMessageElements.length < 2) {
        this._log('Generic message finding yielded insufficient results, trying role-specific selectors');
        
        // 查找所有用户消息
        let userMessages = [];
        for (const selector of userSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            this._log(`Found ${elements.length} user messages with selector: ${selector}`);
            
            elements.forEach(elem => {
              try {
                const content = elem.textContent.trim();
                if (content) {
                  const rect = elem.getBoundingClientRect();
                  userMessages.push({
                    element: elem,
                    role: 'user',
                    position: rect.top,
                    content: content
                  });
                }
              } catch (err) {
                this._log('Error processing user message:', err);
              }
            });
            
            if (userMessages.length > 0) {
              break;
            }
          }
        }
        
        // 查找所有AI助手消息
        let assistantMessages = [];
        for (const selector of assistantSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            this._log(`Found ${elements.length} assistant messages with selector: ${selector}`);
            
            elements.forEach(elem => {
              try {
                const content = elem.textContent.trim();
                if (content) {
                  const rect = elem.getBoundingClientRect();
                  assistantMessages.push({
                    element: elem,
                    role: 'assistant',
                    position: rect.top,
                    content: content
                  });
                }
              } catch (err) {
                this._log('Error processing assistant message:', err);
              }
            });
            
            if (assistantMessages.length > 0) {
              break;
            }
          }
        }
        
        // 将用户和AI消息合并
        allMessageElements.push(...userMessages, ...assistantMessages);
      }
      
      // 处理找到的消息元素
      if (allMessageElements.length > 0) {
        // 根据元素在页面中的位置排序
        allMessageElements.sort((a, b) => a.position - b.position);
        
        this._log(`Total sorted messages: ${allMessageElements.length}`);
        
        // 提取消息内容并添加到结果数组
        allMessageElements.forEach((item, index) => {
          if (item.content) {
            this._log(`Adding ${item.role} message ${index + 1}: ${item.content.substring(0, 30)}...`);
            messages.push({
              role: item.role,
              content: item.content
            });
          }
        });
        
        if (messages.length > 0) {
          this._log(`Method 1 succeeded with ${messages.length} messages`);
          return messages;
        }
      }
      
      // 如果方法1失败，尝试方法2：查找消息组
      this._log('Method 1 failed. Trying Method 2: Finding message groups');
      
      // 查找所有可能的消息组容器
      const containerSelectors = [
        '.group',
        '.chat-message',
        '.flex.items-end, .flex.items-start',
        '[data-message]',
        '.message'
      ];
      
      let messageGroups = [];
      for (const selector of containerSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          this._log(`Found ${elements.length} potential message groups with selector: ${selector}`);
          messageGroups = Array.from(elements);
          break;
        }
      }
      
      // 如果找到了消息组
      if (messageGroups.length > 0) {
        // 遍历每个消息组
        messageGroups.forEach((group, index) => {
          try {
            // 判断是用户消息还是AI消息
            const isUserMessage = 
              group.classList.contains('items-end') || 
              group.querySelector('.items-end') !== null ||
              group.hasAttribute('data-user') ||
              group.querySelector('[data-user="true"]') !== null;
            
            const role = isUserMessage ? 'user' : 'assistant';
            
            // 尝试提取消息内容
            let content = '';
            
            // 方法一：直接获取文本内容
            content = group.textContent.trim();
            
            // 方法二：查找特定元素
            if (!content || content.length < 5) {
              const contentElement = group.querySelector('.whitespace-pre-wrap, .prose p, .break-words');
              if (contentElement) {
                content = contentElement.textContent.trim();
              }
            }
            
            // 方法三：对于AI消息，尝试获取所有段落
            if (role === 'assistant' && (!content || content.length < 5)) {
              const paragraphs = group.querySelectorAll('p');
              if (paragraphs.length > 0) {
                content = Array.from(paragraphs)
                  .map(p => p.textContent.trim())
                  .filter(text => text)
                  .join('\n\n');
              }
            }
            
            this._log(`Group ${index} identified as ${role} message with content length: ${content.length}`);
            
            // 添加消息
            if (content && content.length > 0) {
              messages.push({
                role: role,
                content: content
              });
            }
          } catch (err) {
            this._log(`Error processing group ${index}:`, err);
          }
        });
        
        if (messages.length > 0) {
          this._log(`Method 2 succeeded with ${messages.length} messages`);
          return messages;
        }
      }
      
      // 方法3：通过DOM查找所有文本节点
      this._log('Method 2 failed. Trying Method 3: Scanning all text elements');
      
      const textElements = document.querySelectorAll('p, div, span');
      const potentialMessages = Array.from(textElements)
        .filter(el => {
          const text = el.textContent.trim();
          // 忽略太短或空的文本，以及菜单、按钮等
          return text.length > 10 && 
                 !el.closest('button') && 
                 !el.closest('header') && 
                 !el.closest('nav') &&
                 !el.className.includes('menu');
        })
        .map(el => {
          // 尝试确定角色
          let role = 'unknown';
          let current = el;
          let depth = 0;
          
          while (current && depth < 5 && role === 'unknown') {
            const classList = current.className || '';
            
            if (classList.includes('items-end') || current.closest('.items-end')) {
              role = 'user';
            } else if (classList.includes('items-start') || current.closest('.items-start') || classList.includes('prose')) {
              role = 'assistant';
            }
            
            current = current.parentElement;
            depth++;
          }
          
          // 如果仍然无法确定角色，通过位置和视觉特征推断
          if (role === 'unknown') {
            const rect = el.getBoundingClientRect();
            // 在视觉上，用户消息通常靠右，AI消息靠左
            if (rect.left > window.innerWidth / 2) {
              role = 'user';
            } else {
              role = 'assistant';
            }
          }
          
          return {
            element: el,
            role: role,
            position: el.getBoundingClientRect().top,
            content: el.textContent.trim()
          };
        });
      
      this._log(`Found ${potentialMessages.length} potential messages by scanning text elements`);
      
      // 根据位置排序
      potentialMessages.sort((a, b) => a.position - b.position);
      
      // 移除重复内容（子元素可能导致重复）
      const uniqueMessages = [];
      const seenContents = new Set();
      
      potentialMessages.forEach(msg => {
        // 使用内容的前30个字符作为唯一标识
        const contentKey = msg.content.substring(0, 30);
        if (!seenContents.has(contentKey)) {
          seenContents.add(contentKey);
          uniqueMessages.push(msg);
        }
      });
      
      this._log(`Filtered to ${uniqueMessages.length} unique messages`);
      
      // 将消息添加到结果数组
      uniqueMessages.forEach((item, index) => {
        this._log(`Adding ${item.role} message ${index + 1}: ${item.content.substring(0, 30)}...`);
        messages.push({
          role: item.role,
          content: item.content
        });
      });
      
      if (messages.length > 0) {
        this._log(`Method 3 succeeded with ${messages.length} messages`);
        return messages;
      }
      
      // 如果所有方法都失败，返回错误消息
      this._log('All methods failed to extract messages. Returning error message.');
      return [{
        role: 'assistant',
        content: '无法从Grok页面提取消息。此问题已记录，请尝试在不同的对话中保存或联系开发者。'
      }];
    } catch (error) {
      console.error('Error extracting Grok context:', error);
      return [{
        role: 'assistant',
        content: `提取Grok上下文时发生错误: ${error.message}\n\n请刷新页面再试，或报告此问题。`
      }];
    }
  }

  /**
   * 将上下文恢复到Grok界面
   * @param {Array} context - 要恢复的上下文
   * @param {string} sourcePlatform - 上下文来源平台
   * @returns {Promise<boolean>} - 如果成功则返回true
   */
  async restoreContext(context, sourcePlatform) {
    this._log('Restoring context to Grok from', sourcePlatform, 'context length:', context.length);

    try {
      // 检查是否有对话内容
      if (!context || context.length === 0) {
        console.error('Empty context, nothing to restore');
        return false;
      }

      // 尝试创建新对话
      try {
        const newChatSelectors = [
          'button[aria-label="New chat"]', 
          'button[aria-label="新对话"]', 
          '.new-chat-button',
          'button.new-chat',
          'a.new-chat',
          'button[data-testid="new-chat"]'
        ];
        
        let newChatButton = null;
        for (const selector of newChatSelectors) {
          newChatButton = document.querySelector(selector);
          if (newChatButton) {
            this._log(`Found new chat button using selector: ${selector}`);
            break;
          }
        }
        
        if (newChatButton) {
          this._log('Clicking new chat button');
          newChatButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待页面加载
        } else {
          this._log('No new chat button found, continuing with current chat');
        }
      } catch (e) {
        console.warn('Failed to start new chat, continuing with current chat:', e);
      }

      // 查找输入区域
      const inputSelectors = [
        'textarea', 
        '[contenteditable="true"]', 
        '.input-area textarea', 
        '.message-input', 
        '.chat-input textarea',
        '[placeholder*="Message"]',
        '[placeholder*="Send a message"]',
        '[aria-label="Chat input"]'
      ];
      
      let inputElement = null;
      for (const selector of inputSelectors) {
        inputElement = document.querySelector(selector);
        if (inputElement) {
          this._log(`Found input element using selector: ${selector}`);
          break;
        }
      }

      if (!inputElement) {
        console.error('无法找到Grok输入框，尝试更多选择器');
        // 尝试更多的选择器
        const possibleInputs = document.querySelectorAll('input[type="text"], div[role="textbox"]');
        this._log('找到可能的输入元素:', possibleInputs.length);

        if (possibleInputs.length === 0) {
          throw new Error('找不到Grok输入框');
        }

        // 使用第一个找到的输入元素
        inputElement = possibleInputs[0];
        this._log('Using alternative input element:', inputElement.tagName, inputElement.className);
      }

      this._log('Found Grok input element:', inputElement.tagName, inputElement.className);
      return await this.handleGrokInput(inputElement, context, sourcePlatform);
    } catch (error) {
      console.error('Error restoring context to Grok:', error);
      return false;
    }
  }

  /**
   * 处理Grok输入
   * @param {HTMLElement} inputElement - 输入元素
   * @param {Array} context - 上下文
   * @param {string} sourcePlatform - 源平台
   * @returns {Promise<boolean>} - 成功返回true
   * @private
   */
  async handleGrokInput(inputElement, context, sourcePlatform) {
    // 检测是否有图片上传按钮
    const imageUploadSelectors = [
      'button[aria-label="Upload image"]', 
      'button[title*="上传图片"]', 
      'input[type="file"]', 
      'button.upload-button',
      '[data-testid="image-upload"]'
    ];
    
    let imageUploadButton = null;
    for (const selector of imageUploadSelectors) {
      imageUploadButton = document.querySelector(selector);
      if (imageUploadButton) {
        this._log(`Found image upload button using selector: ${selector}`);
        break;
      }
    }
    
    const hasImageUploadSupport = !!imageUploadButton;
    this._log('Grok是否支持图片上传:', hasImageUploadSupport, imageUploadButton);

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

    // 设置输入值并触发事件
    try {
      this._log('Setting input value, length:', formattedContext.length);
      
      // 使用工具函数处理输入
      const success = await handleGenericInput(inputElement, formattedContext, sourcePlatform);
      if (!success) {
        console.error('Failed to set input value using handleGenericInput');
        return false;
      }
      
      // 查找发送按钮
      const sendButtonSelectors = [
        'button[type="submit"]',
        'button.send',
        'button.submit',
        'button[aria-label="Send message"]',
        '[data-testid="send-button"]'
      ];
      
      let sendButton = null;
      for (const selector of sendButtonSelectors) {
        sendButton = document.querySelector(selector);
        if (sendButton) {
          this._log(`Found send button using selector: ${selector}`);
          break;
        }
      }
      
      if (sendButton && !sendButton.disabled) {
        this._log('Clicking send button');
        sendButton.click();
      } else {
        this._log('Send button not found or disabled, trying Enter key');
        // 触发Enter键发送
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          which: 13,
          keyCode: 13,
          bubbles: true,
          cancelable: true
        });
        inputElement.dispatchEvent(enterEvent);
        this._log('Enter key event dispatched');
      }
      
      return true;
    } catch (error) {
      console.error('Error handling Grok input:', error);
      return false;
    }
  }
}

export default GrokPlatform; 