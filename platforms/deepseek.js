import BasePlatform from './base.js';
import { handleGenericInput, tryUploadImage, safeInherit } from './utils.js';

/**
 * DeepSeek平台策略实现
 */
class DeepSeekPlatform {
  constructor() {
    // Use the safeInherit helper to inherit from BasePlatform
    safeInherit(this, BasePlatform, 'DeepSeekPlatform');
    
    // Set a flag for initialized state
    this.initialized = true;
    
    // Debug mode
    this.debug = true;

    // Add a handler for model switching
    this._setupModelSwitchDetection();
  }

  /**
   * 平台标识
   * @type {string}
   */
  static id = 'deepseek';

  /**
   * 平台显示名称
   * @type {string}
   */
  static displayName = 'DeepSeek';

  /**
   * 检查URL是否匹配DeepSeek
   * @param {string} url - 要检查的URL
   * @returns {boolean} - 如果URL匹配DeepSeek则返回true
   */
  static matchesUrl(url) {
    if (!url) return false;
    
    // DeepSeek URL patterns
    return url.includes('deepseek.com') || 
           url.includes('deepseek.ai') || 
           url.includes('chat.deepseek.') || 
           url.includes('chat-beta.deepseek.') ||
           url.includes('.deepseek.') ||
           url.match(/deepseek\.(com|ai|org|co|net)/i) !== null;
  }

  /**
   * 调试日志函数
   * @private
   */
  _log(...args) {
    if (this.debug) {
      console.log('[DeepSeekPlatform]', ...args);
    }
  }

  /**
   * 从DeepSeek界面提取对话标题
   * @returns {string} - 提取的标题
   */
  extractTitle() {
    try {
      // 尝试从页面标题获取
      const titleElement = document.querySelector('title');
      if (titleElement && titleElement.textContent) {
        const titleText = titleElement.textContent.trim();
        if (titleText && !titleText.includes('DeepSeek') && !titleText.includes('Chat')) {
          return titleText;
        }
      }
      
      // 尝试从对话标题获取
      const titleSelectors = [
        '.conversation-title', 
        '.chat-title', 
        '.title',
        'h1.title',
        '.header-title',
        '[aria-label="Chat title"]',
        '.chat-header-title'
      ];
      
      for (const selector of titleSelectors) {
        const chatTitle = document.querySelector(selector);
        if (chatTitle && chatTitle.textContent.trim()) {
          return chatTitle.textContent.trim();
        }
      }
      
      // 查找第一条用户消息
      const userMessageSelectors = [
        '.user-message', 
        '.human-message', 
        '.question',
        '.message-item.user',
        '[data-role="user"]',
        '[data-message-author-role="user"]'
      ];
      
      for (const selector of userMessageSelectors) {
        const firstUserMessage = document.querySelector(selector);
        if (firstUserMessage) {
          const text = firstUserMessage.textContent.trim();
          return text.length > 30 ? text.substring(0, 27) + '...' : text;
        }
      }
    } catch (error) {
      console.error('Error extracting DeepSeek title:', error);
    }
    
    return 'DeepSeek对话';
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
      const messageContainers = document.querySelectorAll('.message-item, .message, .chat-item, .chat-message');
      this._log('Message container count:', messageContainers.length);
      
      if (messageContainers.length > 0) {
        const firstContainer = messageContainers[0];
        this._log('First message container children count:', firstContainer.children.length);
        this._log('First message container class names:', firstContainer.className);
      }
      
      // 记录所有可能包含消息的元素
      const messageElements = [
        { name: 'Message-content', selector: '.content, .message-content, .text' },
        { name: 'User messages', selector: '.user, .question, .human' },
        { name: 'AI messages', selector: '.assistant, .answer, .ai' },
        { name: 'Content elements', selector: 'p.content, div.content' }
      ];
      
      messageElements.forEach(({ name, selector }) => {
        const elements = document.querySelectorAll(selector);
        this._log(`${name} count:`, elements.length);
        if (elements.length > 0) {
          this._log(`First ${name} text sample:`, elements[0].textContent.trim().substring(0, 50) + '...');
        }
      });
      
      this._log('==== End of Page Structure Logging ====');
    } catch (err) {
      this._log('Error logging page structure:', err);
    }
  }

  /**
   * 从DeepSeek界面提取对话内容
   * @returns {Promise<Array>} - 消息对象数组
   */
  async extractContext() {
    this._log('Extracting DeepSeek context...');
    
    // 记录页面结构信息，帮助调试
    this._logPageStructure();
    
    const messages = [];
    
    try {
      // Method 1: First try to find the message container in DeepSeek's DOM
      this._log('Method 1: Looking for DeepSeek message containers');
      
      // 尝试查找DeepSeek特有的消息容器
      const deepSeekSpecificContainers = document.querySelectorAll('.dad65929 > ._9663006 > .fbb737a4');
      if (deepSeekSpecificContainers.length > 0) {
        this._log(`Found ${deepSeekSpecificContainers.length} DeepSeek specific message containers`);
        
        // 处理每个DeepSeek特有的消息容器
        Array.from(deepSeekSpecificContainers).forEach((container, index) => {
          try {
            // DeepSeek特有的用户消息检测
            // 用户消息通常有编辑、复制按钮，这些按钮位于消息右侧
            const userControls = container.querySelector('div[style*="right: calc(100% + 18px)"]') || 
                               container.querySelector('.ds-icon-button') ||
                               container.querySelector('.ds-flex');
            
            const isUser = userControls !== null;
            const role = isUser ? 'user' : 'assistant';
            
            this._log(`DeepSeek container ${index} detected role: ${role} (based on control elements)`);
            
            // 消息内容就是容器本身的文本内容
            let content = container.textContent.trim();
            
            // 清理掉按钮文本
            if (isUser && userControls) {
              const buttonText = userControls.textContent.trim();
              content = content.replace(buttonText, '').trim();
            }
            
            // 添加消息
            if (content) {
              this._log(`Adding DeepSeek ${role} message: ${content.substring(0, 30)}...`);
              messages.push({
                role,
                content
              });
            }
          } catch (e) {
            console.warn(`Error processing DeepSeek container ${index}:`, e);
          }
        });
        
        if (messages.length > 0) {
          this._log(`Successfully extracted ${messages.length} messages using DeepSeek specific selectors`);
          return messages;
        }
      }
      
      // 方法2: 如果DeepSeek特有的选择器没有找到，尝试更通用的方法
      this._log('Method 2: General message container extraction');
      
      // 查找对话消息容器
      const messageContainerSelectors = [
        '.message-item', 
        '.message', 
        '.chat-item', 
        '.chat-message',
        '.message-container',
        '[data-testid="chat-message"]',
        '[role="listitem"]',
        '.fbb737a4',
        '.dad65929 > ._9663006 > .fbb737a4',
        '.ds-chat-message',
        '.ds-conversation-message'
      ];
      
      // 尝试各种选择器查找消息容器
      let messageContainers = [];
      for (const selector of messageContainerSelectors) {
        const containers = document.querySelectorAll(selector);
        if (containers.length > 0) {
          this._log(`Found ${containers.length} message containers with selector: ${selector}`);
          messageContainers = Array.from(containers);
          break;
        }
      }
      
      // 如果找不到消息容器，尝试查找包含消息的父容器
      if (messageContainers.length === 0) {
        this._log('No direct message containers found, trying to find conversation container');
        
        const conversationContainerSelectors = [
          '.conversation', 
          '.chat', 
          '.chat-container', 
          '.messages-container',
          'main',
          '.dad65929',
          '._9663006',
          '.ds-chat-thread',
          '.ds-conversation',
          '.ds-conversation-list'
        ];
        
        let conversationContainer = null;
        for (const selector of conversationContainerSelectors) {
          const container = document.querySelector(selector);
          if (container) {
            this._log(`Found conversation container with selector: ${selector}`);
            conversationContainer = container;
            break;
          }
        }
        
        if (conversationContainer) {
          // 在对话容器中查找消息元素
          const possibleMessages = conversationContainer.querySelectorAll('div > div, section > div');
          this._log(`Found ${possibleMessages.length} potential message divs in conversation container`);
          
          messageContainers = Array.from(possibleMessages).filter(div => {
            // 过滤出可能是消息的元素
            const hasText = div.textContent.trim().length > 10;
            const isNotToolbar = !div.querySelector('button[type="submit"]');
            const isNotInput = !div.querySelector('textarea, input');
            return hasText && isNotToolbar && isNotInput;
          });
          
          this._log(`Filtered to ${messageContainers.length} likely message containers`);
        }
      }
      
      this._log(`Processing ${messageContainers.length} message containers`);
      
      // 处理每个消息容器
      messageContainers.forEach((container, index) => {
        try {
          // 确定消息角色
          const isUser = 
            container.classList.contains('user') || 
            container.classList.contains('question') ||
            container.classList.contains('human') ||
            container.querySelector('.user-icon, .human-icon') !== null ||
            container.getAttribute('data-role') === 'user' ||
            container.querySelector('[data-role="user"]') !== null ||
            container.getAttribute('data-user') === 'true' ||
            container.querySelector('[data-user="true"]') !== null ||
            container.classList.contains('ds-user-message') ||
            container.classList.contains('ds-human-message') ||
            container.closest('.ds-user-message') !== null ||
            container.querySelector('.ds-icon-button') !== null ||
            container.querySelector('div[style*="right: calc(100% + 18px)"]') !== null;
          
          const role = isUser ? 'user' : 'assistant';
          this._log(`Container ${index} role: ${role}`);
          
          // 提取消息内容
          let content = '';
          
          // 尝试方法1：查找特定内容元素
          const contentElementSelectors = [
            '.content', 
            '.message-content', 
            '.text',
            'p.content',
            'div.content',
            '.markdown',
            'p',
            '.fbb737a4',
            '.ds-chat-message-content',
            '.ds-message-text'
          ];
          
          let contentElement = null;
          for (const selector of contentElementSelectors) {
            const element = container.querySelector(selector);
            if (element && element.textContent.trim()) {
              contentElement = element;
              break;
            }
          }
          
          if (contentElement) {
            content = contentElement.textContent.trim();
            this._log(`Found content using selector, length: ${content.length}`);
          } else {
            // 方法2：直接获取容器文本，并尝试清理
            content = container.textContent.trim();
            
            // 移除可能的UI元素文本
            const uiTexts = ['复制', 'Copy', '复制代码', '编辑', 'Edit', '删除', 'Delete', '点赞', 'Like'];
            uiTexts.forEach(text => {
              content = content.replace(new RegExp(text, 'g'), '');
            });
            
            this._log(`Used container text content, length after cleaning: ${content.length}`);
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
              this._log(`Found image: ${img.src}`);
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
              this._log(`Found file: ${link.href}`);
            }
          });
          
          // 只添加有内容或附件的消息
          if (content || attachments.length > 0) {
            this._log(`Adding message - role: ${role}, content preview: ${content.substring(0, 30)}...`);
            messages.push({
              role: role,
              content: content,
              attachments: attachments.length > 0 ? attachments : undefined
            });
          }
        } catch (err) {
          this._log(`Error processing message container ${index}:`, err);
        }
      });
      
      // 如果没有找到消息，尝试备用方法：扫描所有文本节点
      if (messages.length === 0) {
        this._log('No messages found with primary method, trying fallback text node scan');
        
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
            
            // 查找角色线索
            const isUserElem = 
              el.closest('.user') || 
              el.closest('.question') || 
              el.closest('[data-role="user"]') ||
              el.closest('[data-user="true"]') ||
              el.classList.contains('user') ||
              el.classList.contains('question') ||
              el.closest('.ds-user-message') ||
              el.closest('.fbb737a4:has(.ds-icon-button)') ||
              el.closest('div:has(div[style*="right: calc(100%"])');
            
            const isAssistantElem = 
              el.closest('.assistant') || 
              el.closest('.answer') || 
              el.closest('[data-role="assistant"]') ||
              el.classList.contains('assistant') ||
              el.classList.contains('answer') ||
              el.closest('.ds-assistant-message') ||
              el.closest('.fbb737a4:not(:has(.ds-icon-button))');
            
            if (isUserElem) {
              role = 'user';
            } else if (isAssistantElem) {
              role = 'assistant';
            } else {
              // 如果无法确定角色，通过位置推断
              const rect = el.getBoundingClientRect();
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
        
        // 移除重复内容
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
          this._log(`Adding fallback ${item.role} message ${index + 1}: ${item.content.substring(0, 30)}...`);
          messages.push({
            role: item.role,
            content: item.content
          });
        });
      }
      
      // Additional fallback specifically for DeepSeek
      if (messageContainers.length === 0 && messages.length === 0) {
        this._log('No message containers found using standard methods, trying DeepSeek fallback method');
        
        // 针对DeepSeek特殊结构的额外尝试
        const allDivs = document.querySelectorAll('div');
        const potentialMessages = Array.from(allDivs).filter(div => {
          // 过滤潜在的消息元素
          const text = div.textContent.trim();
          if (text.length < 10) return false;  // 太短不可能是消息
          
          // 消息通常不包含太多的嵌套元素和按钮
          const hasManyButtons = div.querySelectorAll('button').length > 3;
          const hasManyInputs = div.querySelectorAll('input, textarea').length > 0;
          
          return !hasManyButtons && !hasManyInputs;
        });
        
        this._log(`Found ${potentialMessages.length} potential message elements`);
        
        // 处理每个潜在的消息元素
        let lastRole = 'assistant';  // 跟踪角色交替
        potentialMessages.forEach((div, index) => {
          try {
            const text = div.textContent.trim();
            
            // 检查是否有用户消息的特征
            const hasUserControls = div.querySelector('.ds-icon-button') !== null || 
                                  div.querySelector('div[style*="right: calc(100%)"]') !== null;
            
            // 确定消息角色，在DeepSeek中用户消息通常有按钮，助手消息没有
            const thisRole = hasUserControls ? 'user' : 'assistant';
            
            // 避免连续相同角色的消息
            if (index > 0 && thisRole === lastRole) {
              // 如果与上一条消息角色相同，可能是一条消息的不同部分
              return;
            }
            
            lastRole = thisRole;
            
            this._log(`Fallback method: potential ${thisRole} message: ${text.substring(0, 30)}...`);
            messages.push({
              role: thisRole,
              content: text
            });
          } catch (e) {
            console.warn(`Error processing potential message div ${index}:`, e);
          }
        });
      }
    } catch (error) {
      console.error('Error extracting DeepSeek context:', error);
      return [{
        role: 'assistant',
        content: `提取DeepSeek上下文时发生错误: ${error.message}\n\n请刷新页面再试，或报告此问题。`
      }];
    }
    
    this._log(`Total messages extracted: ${messages.length}`);
    return messages;
  }

  /**
   * 将上下文恢复到DeepSeek界面
   * @param {Array} context - 要恢复的上下文
   * @param {string} sourcePlatform - 上下文来源平台
   * @returns {Promise<boolean>} - 如果成功则返回true
   */
  async restoreContext(context, sourcePlatform) {
    this._log('Restoring context to DeepSeek from', sourcePlatform, 'context length:', context.length);
    
    try {
      // 检查是否有对话内容
      if (!context || context.length === 0) {
        console.error('Empty context, nothing to restore');
        return false;
      }
      
      // 尝试创建新对话
      try {
        const newChatSelectors = [
          'button.new-chat', 
          'button[aria-label="New Chat"]', 
          'button.create-chat',
          'button[data-testid="new-chat"]',
          'a.new-chat'
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
        }
      } catch (e) {
        console.warn('Failed to start new chat, continuing with current chat:', e);
      }
      
      // 查找输入区域
      const inputSelectors = [
        'textarea', 
        'div[contenteditable="true"]', 
        '.chat-input textarea', 
        '.input-box textarea',
        '[placeholder*="提问"]',
        '[placeholder*="发送"]',
        '[placeholder*="Ask"]',
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
        this._log('No direct input element found, trying wider search');
        
        // 尝试更广泛的选择器
        const possibleInputs = document.querySelectorAll('input[type="text"], div[role="textbox"]');
        this._log('找到可能的输入元素:', possibleInputs.length);
        
        if (possibleInputs.length === 0) {
          throw new Error('找不到DeepSeek输入框');
        }
        
        // 使用第一个找到的输入元素
        inputElement = possibleInputs[0];
        this._log('Using alternative input element:', inputElement.tagName, inputElement.className);
      }
      
      this._log('Found DeepSeek input element:', inputElement.tagName, inputElement.className);
      const success = await handleGenericInput(inputElement, this.formatContextForDeepSeek(context, sourcePlatform), sourcePlatform);
      
      if (success) {
        this.trySubmitForm(inputElement);
      }
      
      return success;
    } catch (error) {
      console.error('Error restoring context to DeepSeek:', error);
      return false;
    }
  }
  
  /**
   * 格式化上下文为DeepSeek格式
   * @param {Array} context - 原始上下文
   * @param {string} sourcePlatform - 源平台
   * @returns {string} - 格式化后的上下文
   * @private
   */
  formatContextForDeepSeek(context, sourcePlatform) {
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
      formattedContext += "\n注意：原对话包含图片，我已经提供了图片链接。DeepSeek可能不支持直接查看这些图片，但您可以查看提供的链接。\n\n";
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
      const sendButtonSelectors = [
        'button[type="submit"]',
        'button.send-button',
        'button[aria-label*="Send"]',
        'button[aria-label*="发送"]',
        '[data-testid="send-button"]',
        'button.send',
        'button.submit'
      ];
      
      let sendButton = null;
      for (const selector of sendButtonSelectors) {
        sendButton = document.querySelector(selector);
        if (sendButton && !sendButton.disabled) {
          this._log(`Found send button using selector: ${selector}`);
          break;
        }
      }
      
      if (sendButton && !sendButton.disabled) {
        this._log('Clicking DeepSeek send button');
        sendButton.click();
      } else {
        this._log('Send button not found or disabled, trying to press Enter');
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

  /**
   * 设置模型切换检测
   * 监听模型选择变化，确保切换模型时保留上下文
   * @private
   */
  _setupModelSwitchDetection() {
    this._log('Setting up model switch detection');
    
    try {
      // Create a MutationObserver to detect when model selection changes
      const modelSwitchObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          // Check if a model selection occurred
          if (mutation.type === 'childList' || mutation.type === 'attributes') {
            const modelSelectors = document.querySelectorAll('[role="menuitem"], .model-option, .model-selector, [aria-label*="model"], [data-testid*="model"]');
            
            if (modelSelectors.length > 0) {
              this._log('Model selection detected, preparing to preserve context');
              
              // Capture current context before model switch
              this._preserveContextOnModelSwitch();
            }
          }
        }
      });
      
      // Start observing the document with the configured parameters
      modelSwitchObserver.observe(document.body, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        attributeFilter: ['aria-selected', 'class', 'data-selected']
      });
      
      this._log('Model switch detection setup complete');
    } catch (err) {
      console.error('Error setting up model switch detection:', err);
    }
  }
  
  /**
   * 在模型切换时保存并恢复上下文
   * @private
   */
  async _preserveContextOnModelSwitch() {
    this._log('Preserving context during model switch');
    
    try {
      // Extract current context before model switch
      const currentContext = await this.extractContext();
      
      if (currentContext && currentContext.length > 0) {
        this._log(`Extracted ${currentContext.length} messages before model switch`);
        
        // Setup an observer to detect when the model change is complete
        const loadCompleteObserver = new MutationObserver(async (mutations, observer) => {
          // Look for signs that the model switch is complete
          const isComplete = mutations.some(mutation => {
            return mutation.target.classList && 
                  (mutation.target.classList.contains('loaded') || 
                   !mutation.target.classList.contains('loading'));
          });
          
          if (isComplete) {
            this._log('Model switch completed, restoring context');
            observer.disconnect();
            
            // Wait a moment for the UI to settle
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Restore the context with the new model
            await this.restoreContext(currentContext, 'DeepSeek');
            
            this._log('Context restoration after model switch complete');
          }
        });
        
        // Start observing to detect when model switch is complete
        loadCompleteObserver.observe(document.body, { 
          childList: true, 
          subtree: true, 
          attributes: true,
          attributeFilter: ['class', 'data-state']
        });
        
        // Disconnect after a reasonable timeout
        setTimeout(() => {
          loadCompleteObserver.disconnect();
          this._log('Auto-disconnected model switch observer after timeout');
        }, 10000);
      }
    } catch (err) {
      console.error('Error preserving context during model switch:', err);
    }
  }

  /**
   * 处理模型变更 - 用户可直接调用此方法在切换模型时保留上下文
   * 即使自动检测失败，用户也可以手动触发此功能
   * @returns {Promise<boolean>} - 如果成功则返回true
   */
  async handleModelChange() {
    this._log('Manually handling model change');
    
    try {
      // 1. 提取当前上下文
      const currentContext = await this.extractContext();
      
      if (!currentContext || currentContext.length === 0) {
        this._log('No context to preserve during model change');
        return false;
      }
      
      this._log(`Extracted ${currentContext.length} messages for model change`);
      
      // 2. 等待一小段时间让模型切换完成
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 3. 恢复上下文
      const success = await this.restoreContext(currentContext, 'DeepSeek');
      
      // 4. 返回结果
      this._log(`Context restoration after model change ${success ? 'succeeded' : 'failed'}`);
      return success;
    } catch (error) {
      console.error('Error handling model change:', error);
      return false;
    }
  }
}

export default DeepSeekPlatform; 