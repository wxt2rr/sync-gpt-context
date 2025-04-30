// Content script for AI Chat Context Sync extension

// Add a global variable to hold the registry once we receive it
let platformRegistry = null;

// 临时平台实现，如果模块导入失败可用作后备
const TempPlatforms = {
  chatgpt: {
    extractTitle: function() {
      console.log('Using temporary ChatGPT implementation for extractTitle');
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
        console.error('Error in temp ChatGPT extractTitle:', error);
      }
      
      return 'ChatGPT对话';
    },
    
    extractContext: async function() {
      console.log('Using temporary ChatGPT implementation for extractContext');
      const messages = [];
      
      try {
        // 尝试新版ChatGPT的选择器
        const messageContainers = document.querySelectorAll('[data-message-author-role], [data-testid="conversation-turn"]');
        console.log('Found message containers:', messageContainers.length);
        
        messageContainers.forEach(element => {
          let role = '';
          let content = '';
          
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
          
          // 只添加有内容的消息
          if (content) {
            console.log('Found message - role:', role, 'content preview:', content.substring(0, 30));
            messages.push({
              role: role,
              content: content
            });
          }
        });
      } catch (error) {
        console.error('Error in temp ChatGPT extractContext:', error);
      }
      
      return messages;
    },
    
    restoreContext: async function(context, sourcePlatform) {
      console.log('Using temporary ChatGPT implementation for restoreContext');
      try {
        // 查找输入区域
        let inputElement = document.querySelector('#prompt-textarea, [data-testid="chat-input-textbox"]');
        if (!inputElement) {
          console.error('ChatGPT input element not found');
          return false;
        }
        
        // 构建要输入的文本
        let inputText = '';
        
        // 添加说明
        inputText += '请继续以下对话\n\n';
        
        // 添加消息
        context.forEach((message, index) => {
          const role = message.role === 'user' ? '用户' : 
                      message.role === 'assistant' ? 'AI' : 
                      message.role === 'system' ? '系统' : '其他';
          
          inputText += `${role}: ${message.content}\n\n`;
        });
        
        // 设置输入值
        inputElement.value = inputText;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        
        // 触发Enter键发送
        setTimeout(() => {
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          inputElement.dispatchEvent(enterEvent);
          console.log('Context restored and sent');
        }, 500);
        
        return true;
      } catch (error) {
        console.error('Error in temp ChatGPT restoreContext:', error);
        return false;
      }
    }
  },
  
  claude: {
    extractTitle: function() {
      console.log('Using temporary Claude implementation for extractTitle');
      try {
        // 尝试从标题栏获取
        const chatTitle = document.querySelector('.chat-header-app-title, .conversation-header h1');
        if (chatTitle && chatTitle.textContent.trim()) {
          return chatTitle.textContent.trim();
        }
        
        // 尝试从第一个用户消息获取
        const firstUserMessage = document.querySelector('.message.user div.content');
        if (firstUserMessage) {
          const text = firstUserMessage.textContent.trim();
          return text.length > 30 ? text.substring(0, 27) + '...' : text;
        }
      } catch (error) {
        console.error('Error in temp Claude extractTitle:', error);
      }
      
      return 'Claude对话';
    },
    
    extractContext: async function() {
      console.log('Using temporary Claude implementation for extractContext');
      const messages = [];
      
      try {
        // 查找所有消息
        const messageElements = document.querySelectorAll('.message-content-wrapper, .message, .chat-message');
        console.log('Found Claude message elements:', messageElements.length);
        
        messageElements.forEach(element => {
          let role = '';
          let content = '';
          
          // 确定角色
          if (element.classList.contains('user') || element.querySelector('.user')) {
            role = 'user';
          } else if (element.classList.contains('assistant') || element.querySelector('.assistant')) {
            role = 'assistant';
          } else {
            // 继续检查其他类名
            const parent = element.closest('.message');
            if (parent) {
              if (parent.classList.contains('user')) role = 'user';
              else if (parent.classList.contains('assistant')) role = 'assistant';
            }
          }
          
          // 没找到角色就跳过
          if (!role) return;
          
          // 获取内容
          const contentElement = element.querySelector('.content, .message-body, .chat-message-text');
          if (contentElement) {
            content = contentElement.textContent.trim();
          } else {
            content = element.textContent.trim();
          }
          
          // 只添加有内容的消息
          if (content) {
            console.log('Found Claude message - role:', role, 'content preview:', content.substring(0, 30));
            messages.push({
              role: role,
              content: content
            });
          }
        });
      } catch (error) {
        console.error('Error in temp Claude extractContext:', error);
      }
      
      return messages;
    },
    
    restoreContext: async function(context, sourcePlatform) {
      console.log('Using temporary Claude implementation for restoreContext');
      try {
        // 查找输入区域
        let inputElement = document.querySelector('textarea.ProseMirror, .chat-input-panel textarea, [data-testid="chat-input"]');
        if (!inputElement) {
          console.error('Claude input element not found');
          return false;
        }
        
        // 构建要输入的文本
        let inputText = '';
        
        // 添加说明
        inputText += '请继续以下对话\n\n';
        
        // 添加消息
        context.forEach((message, index) => {
          const role = message.role === 'user' ? '用户' : 
                      message.role === 'assistant' ? 'AI' : 
                      message.role === 'system' ? '系统' : '其他';
          
          inputText += `${role}: ${message.content}\n\n`;
        });
        
        // 设置输入值
        inputElement.value = inputText;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        
        // 查找发送按钮
        const sendButton = document.querySelector('button[type="submit"], button.send-button, [data-testid="send-button"]');
        if (sendButton) {
          setTimeout(() => {
            sendButton.click();
            console.log('Context restored and sent via button');
          }, 500);
        } else {
          // 触发Enter键发送
          setTimeout(() => {
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            inputElement.dispatchEvent(enterEvent);
            console.log('Context restored and sent via Enter key');
          }, 500);
        }
        
        return true;
      } catch (error) {
        console.error('Error in temp Claude restoreContext:', error);
        return false;
      }
    }
  },
  
  grok: {
    extractTitle: function() {
      console.log('Using temporary Grok implementation for extractTitle');
      try {
        // 尝试从标题获取
        const titleElement = document.querySelector('title');
        if (titleElement && titleElement.textContent) {
          const titleText = titleElement.textContent.trim();
          if (titleText && !titleText.includes('Grok')) {
            return titleText;
          }
        }
        
        // 尝试从对话标题获取
        const conversationTitle = document.querySelector('.conversation-header h1, .thread-title');
        if (conversationTitle && conversationTitle.textContent.trim()) {
          return conversationTitle.textContent.trim();
        }
        
        // 尝试从第一条消息获取
        const firstUserMessage = document.querySelector('.message-user, .message[data-role="user"]');
        if (firstUserMessage) {
          const contentEl = firstUserMessage.querySelector('.message-content');
          const text = contentEl ? contentEl.textContent.trim() : firstUserMessage.textContent.trim();
          return text.length > 30 ? text.substring(0, 27) + '...' : text;
        }
      } catch (error) {
        console.error('Error in temp Grok extractTitle:', error);
      }
      
      return 'Grok对话';
    },
    
    extractContext: async function() {
      console.log('Using temporary Grok implementation for extractContext');
      const messages = [];
      
      try {
        // 查找所有消息元素
        const messageElements = document.querySelectorAll('.message, .chat-message, .conversation-message');
        console.log('Found Grok message elements:', messageElements.length);
        
        messageElements.forEach(element => {
          let role = '';
          let content = '';
          
          // 确定角色
          if (element.classList.contains('user') || 
              element.getAttribute('data-role') === 'user' ||
              element.classList.contains('message-user')) {
            role = 'user';
          } else if (element.classList.contains('assistant') || 
                     element.getAttribute('data-role') === 'assistant') {
            role = 'assistant';
          } else if (element.classList.contains('system') || 
                     element.getAttribute('data-role') === 'system') {
            role = 'system';
          } else {
            // 尝试查找角色标识元素
            const roleIndicator = element.querySelector('.message-role, .role-indicator');
            if (roleIndicator) {
              const roleText = roleIndicator.textContent.toLowerCase();
              if (roleText.includes('user')) role = 'user';
              else if (roleText.includes('grok') || roleText.includes('assistant')) role = 'assistant';
              else if (roleText.includes('system')) role = 'system';
            }
          }
          
          // 没找到角色就跳过
          if (!role) return;
          
          // 获取内容
          const contentElement = element.querySelector('.message-content, .content, .message-text');
          if (contentElement) {
            content = contentElement.textContent.trim();
          } else {
            content = element.textContent.trim();
          }
          
          // 只添加有内容的消息
          if (content) {
            console.log('Found Grok message - role:', role, 'content preview:', content.substring(0, 30));
            messages.push({
              role: role,
              content: content
            });
          }
        });
      } catch (error) {
        console.error('Error in temp Grok extractContext:', error);
      }
      
      return messages;
    },
    
    restoreContext: async function(context, sourcePlatform) {
      console.log('Using temporary Grok implementation for restoreContext');
      try {
        // 查找输入区域
        let inputElement = document.querySelector('textarea.input-message, .input-box textarea, [contenteditable="true"]');
        if (!inputElement) {
          console.error('Grok input element not found');
          return false;
        }
        
        // 构建要输入的文本
        let inputText = '';
        
        // 添加说明
        inputText += '请继续以下对话\n\n';
        
        // 添加消息
        context.forEach((message, index) => {
          const role = message.role === 'user' ? '用户' : 
                      message.role === 'assistant' ? 'AI' : 
                      message.role === 'system' ? '系统' : '其他';
          
          inputText += `${role}: ${message.content}\n\n`;
        });
        
        // 设置输入值
        if (inputElement.getAttribute('contenteditable') === 'true') {
          // 对于contenteditable元素
          inputElement.innerHTML = inputText.replace(/\n/g, '<br>');
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          // 对于textarea元素
          inputElement.value = inputText;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // 查找发送按钮
        const sendButton = document.querySelector('button.send-button, button[aria-label="Send message"], button.submit-button');
        if (sendButton) {
          setTimeout(() => {
            sendButton.click();
            console.log('Context restored and sent via button');
          }, 500);
        } else {
          // 触发Enter键发送
          setTimeout(() => {
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            inputElement.dispatchEvent(enterEvent);
            console.log('Context restored and sent via Enter key');
          }, 500);
        }
        
        return true;
      } catch (error) {
        console.error('Error in temp Grok restoreContext:', error);
        return false;
      }
    }
  },
  
  // 添加其他常用平台的临时实现
  gemini: {
    extractTitle: function() {
      console.log('Using temporary Gemini implementation for extractTitle');
      try {
        // 尝试从标题获取
        const titleElement = document.querySelector('title');
        if (titleElement && titleElement.textContent) {
          const titleText = titleElement.textContent.trim();
          if (titleText && !titleText.includes('Gemini')) {
            return titleText;
          }
        }
        
        // 尝试从对话标题获取
        const conversationTitle = document.querySelector('.conversation-title, .chat-title');
        if (conversationTitle && conversationTitle.textContent.trim()) {
          return conversationTitle.textContent.trim();
        }
        
        // 尝试从第一条消息获取
        const firstUserMessage = document.querySelector('[data-sender-type="USER"], .user-query');
        if (firstUserMessage) {
          const text = firstUserMessage.textContent.trim();
          return text.length > 30 ? text.substring(0, 27) + '...' : text;
        }
      } catch (error) {
        console.error('Error in temp Gemini extractTitle:', error);
      }
      
      return 'Gemini对话';
    },
    
    extractContext: async function() {
      console.log('Using temporary Gemini implementation for extractContext');
      const messages = [];
      
      try {
        // 查找所有用户消息
        const userMessages = document.querySelectorAll('[data-sender-type="USER"], .user-query');
        console.log('Found Gemini user message elements:', userMessages.length);
        
        userMessages.forEach(element => {
          const content = element.textContent.trim();
          if (content) {
            console.log('Found Gemini user message - content preview:', content.substring(0, 30));
            messages.push({
              role: 'user',
              content: content
            });
          }
        });
        
        // 查找所有AI回复
        const aiMessages = document.querySelectorAll('[data-sender-type="MODEL"], .model-response');
        console.log('Found Gemini AI message elements:', aiMessages.length);
        
        aiMessages.forEach(element => {
          const content = element.textContent.trim();
          if (content) {
            console.log('Found Gemini AI message - content preview:', content.substring(0, 30));
            messages.push({
              role: 'assistant',
              content: content
            });
          }
        });
        
        // 按顺序排列消息
        // 假设DOM顺序与对话顺序一致，否则可能需要更复杂的排序逻辑
      } catch (error) {
        console.error('Error in temp Gemini extractContext:', error);
      }
      
      return messages;
    },
    
    restoreContext: async function(context, sourcePlatform) {
      console.log('Using temporary Gemini implementation for restoreContext');
      try {
        // 查找输入区域
        let inputElement = document.querySelector('textarea, [contenteditable="true"], .input-area textarea');
        if (!inputElement) {
          console.error('Gemini input element not found');
          return false;
        }
        
        // 构建要输入的文本
        let inputText = '';
        
        // 添加说明
        inputText += '请继续以下对话\n\n';
        
        // 添加消息
        context.forEach((message, index) => {
          const role = message.role === 'user' ? '用户' : 
                      message.role === 'assistant' ? 'AI' : 
                      message.role === 'system' ? '系统' : '其他';
          
          inputText += `${role}: ${message.content}\n\n`;
        });
        
        // 设置输入值
        if (inputElement.getAttribute('contenteditable') === 'true') {
          // 对于contenteditable元素
          inputElement.innerHTML = inputText.replace(/\n/g, '<br>');
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          // 对于textarea元素
          inputElement.value = inputText;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // 查找发送按钮
        const sendButton = document.querySelector('button[aria-label="Send message"], .send-button');
        if (sendButton) {
          setTimeout(() => {
            sendButton.click();
            console.log('Context restored and sent via button');
          }, 500);
        } else {
          // 触发Enter键发送
          setTimeout(() => {
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            inputElement.dispatchEvent(enterEvent);
            console.log('Context restored and sent via Enter key');
          }, 500);
        }
        
        return true;
      } catch (error) {
        console.error('Error in temp Gemini restoreContext:', error);
        return false;
      }
    }
  },
  
  deepseek: {
    extractTitle: function() {
      console.log('Using temporary DeepSeek implementation for extractTitle');
      try {
        // 尝试从标题获取
        const titleElement = document.querySelector('title');
        if (titleElement && titleElement.textContent) {
          const titleText = titleElement.textContent.trim();
          if (titleText && !titleText.includes('DeepSeek')) {
            return titleText;
          }
        }
        
        // 尝试从UI中获取对话标题
        const conversationTitle = document.querySelector('.chat-title, .conversation-title, h1.title');
        if (conversationTitle && conversationTitle.textContent.trim()) {
          return conversationTitle.textContent.trim();
        }
        
        // 尝试从历史记录中获取当前对话标题
        const activeConversation = document.querySelector('.conversation.active, .chat-item.active');
        if (activeConversation) {
          const titleSpan = activeConversation.querySelector('.title, .name');
          if (titleSpan && titleSpan.textContent.trim()) {
            return titleSpan.textContent.trim();
          }
        }
        
        // 尝试从第一条用户消息获取
        const firstUserMessage = document.querySelector('.message.user, .user-message, [data-role="user"]');
        if (firstUserMessage) {
          const contentEl = firstUserMessage.querySelector('.content, .message-content');
          const text = contentEl ? contentEl.textContent.trim() : firstUserMessage.textContent.trim();
          return text.length > 30 ? text.substring(0, 27) + '...' : text;
        }
      } catch (error) {
        console.error('Error in temp DeepSeek extractTitle:', error);
      }
      
      return 'DeepSeek对话';
    },
    
    extractContext: async function() {
      console.log('Using temporary DeepSeek implementation for extractContext');
      const messages = [];
      
      try {
        // 尝试不同的选择器来找到消息元素
        const selectors = [
          '.message', 
          '.chat-message', 
          '.message-item',
          '[data-role]'
        ];
        
        // 尝试不同的选择器直到找到消息
        let messageElements = [];
        for (const selector of selectors) {
          messageElements = document.querySelectorAll(selector);
          if (messageElements.length > 0) {
            console.log(`Found DeepSeek message elements with selector "${selector}":`, messageElements.length);
            break;
          }
        }
        
        // 处理找到的消息元素
        messageElements.forEach(element => {
          let role = '';
          let content = '';
          
          // 尝试通过多种方式确定角色
          if (element.classList.contains('user') || 
              element.getAttribute('data-role') === 'user' ||
              element.querySelector('.user, .user-message')) {
            role = 'user';
          } else if (element.classList.contains('assistant') || 
                     element.classList.contains('ai') ||
                     element.getAttribute('data-role') === 'assistant' ||
                     element.querySelector('.assistant, .ai')) {
            role = 'assistant';
          } else if (element.classList.contains('system') || 
                     element.getAttribute('data-role') === 'system') {
            role = 'system';
          }
          
          // 如果以上方法没找到角色，尝试其他方法
          if (!role) {
            // 尝试查找角色标识元素
            const avatar = element.querySelector('.avatar');
            if (avatar) {
              const avatarTitle = avatar.getAttribute('title') || avatar.getAttribute('alt') || '';
              if (avatarTitle.toLowerCase().includes('user')) role = 'user';
              else if (avatarTitle.toLowerCase().includes('assistant') || 
                       avatarTitle.toLowerCase().includes('ai') ||
                       avatarTitle.toLowerCase().includes('deepseek')) role = 'assistant';
            }
          }
          
          // 没找到角色就跳过
          if (!role) return;
          
          // 获取内容
          const contentSelectors = [
            '.content', 
            '.message-content', 
            '.text-content',
            '.markdown-body',
            '.markdown-content'
          ];
          
          // 尝试不同的选择器获取内容
          for (const selector of contentSelectors) {
            const contentElement = element.querySelector(selector);
            if (contentElement) {
              content = contentElement.textContent.trim();
              break;
            }
          }
          
          // 如果还没找到内容，使用元素自己的文本
          if (!content) {
            content = element.textContent.trim();
          }
          
          // 只添加有内容和角色的消息
          if (content && role) {
            console.log('Found DeepSeek message - role:', role, 'content preview:', content.substring(0, 30));
            messages.push({
              role: role,
              content: content
            });
          }
        });
      } catch (error) {
        console.error('Error in temp DeepSeek extractContext:', error);
      }
      
      return messages;
    },
    
    restoreContext: async function(context, sourcePlatform) {
      console.log('Using temporary DeepSeek implementation for restoreContext');
      try {
        // 尝试不同的选择器找到输入区域
        const inputSelectors = [
          'textarea',
          '[contenteditable="true"]',
          '.chat-input textarea',
          '.input-box textarea',
          '.input-area textarea'
        ];
        
        let inputElement = null;
        for (const selector of inputSelectors) {
          inputElement = document.querySelector(selector);
          if (inputElement) {
            console.log(`Found DeepSeek input element with selector "${selector}"`);
            break;
          }
        }
        
        if (!inputElement) {
          console.error('DeepSeek input element not found');
          return false;
        }
        
        // 构建要输入的文本
        let inputText = '';
        
        // 添加说明
        inputText += '请继续以下对话\n\n';
        
        // 添加消息
        context.forEach((message, index) => {
          const role = message.role === 'user' ? '用户' : 
                      message.role === 'assistant' ? 'AI' : 
                      message.role === 'system' ? '系统' : '其他';
          
          inputText += `${role}: ${message.content}\n\n`;
        });
        
        // 设置输入值
        if (inputElement.getAttribute('contenteditable') === 'true') {
          // 对于contenteditable元素
          inputElement.innerHTML = inputText.replace(/\n/g, '<br>');
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          // 对于textarea元素
          inputElement.value = inputText;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // 查找发送按钮
        const buttonSelectors = [
          'button.send-button',
          'button[type="submit"]',
          'button.submit',
          'button.chat-submit',
          'button[aria-label="Send message"]',
          'button.primary'
        ];
        
        let sendButton = null;
        for (const selector of buttonSelectors) {
          sendButton = document.querySelector(selector);
          if (sendButton) {
            console.log(`Found DeepSeek send button with selector "${selector}"`);
            break;
          }
        }
        
        if (sendButton) {
          setTimeout(() => {
            sendButton.click();
            console.log('Context restored and sent via button');
          }, 500);
        } else {
          // 触发Enter键发送
          setTimeout(() => {
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            inputElement.dispatchEvent(enterEvent);
            console.log('Context restored and sent via Enter key');
          }, 500);
        }
        
        return true;
      } catch (error) {
        console.error('Error in temp DeepSeek restoreContext:', error);
        return false;
      }
    }
  },
  
  // 通用实现，可以作为最后的后备方案
  generic: {
    extractTitle: function() {
      console.log('Using generic implementation for extractTitle');
      try {
        // 尝试从标题获取
        const titleElement = document.querySelector('title');
        if (titleElement && titleElement.textContent) {
          return titleElement.textContent.trim();
        }
        
        // 尝试各种可能的标题元素
        const titleSelectors = [
          'h1', 
          '.conversation-title', 
          '.chat-title', 
          '.title',
          '.thread-title',
          '.header-title'
        ];
        
        for (const selector of titleSelectors) {
          const titleEl = document.querySelector(selector);
          if (titleEl && titleEl.textContent.trim()) {
            return titleEl.textContent.trim();
          }
        }
      } catch (error) {
        console.error('Error in generic extractTitle:', error);
      }
      
      return '对话 ' + new Date().toLocaleString();
    },
    
    extractContext: async function() {
      console.log('Using generic implementation for extractContext');
      const messages = [];
      
      try {
        // 尝试各种可能的消息元素选择器
        const messageSelectors = [
          '.message',
          '.chat-message',
          '.conversation-message',
          '.thread-message',
          '[data-message]',
          '[data-role]'
        ];
        
        let messageElements = [];
        for (const selector of messageSelectors) {
          messageElements = document.querySelectorAll(selector);
          if (messageElements.length > 0) {
            console.log(`Found message elements with selector "${selector}":`, messageElements.length);
            break;
          }
        }
        
        // 处理找到的消息元素
        messageElements.forEach(element => {
          let role = '';
          let content = '';
          
          // 尝试确定角色
          if (element.classList.contains('user') || 
              element.getAttribute('data-role') === 'user' ||
              element.querySelector('.user')) {
            role = 'user';
          } else if (element.classList.contains('assistant') || 
                     element.classList.contains('ai') ||
                     element.getAttribute('data-role') === 'assistant' ||
                     element.querySelector('.assistant, .ai')) {
            role = 'assistant';
          } else if (element.classList.contains('system') || 
                     element.getAttribute('data-role') === 'system') {
            role = 'system';
          }
          
          // 如果还没确定角色，尝试查找可能的角色标识
          if (!role) {
            const text = element.textContent.toLowerCase();
            if (text.includes('user:') || text.includes('human:') || text.includes('me:')) {
              role = 'user';
            } else if (text.includes('assistant:') || text.includes('ai:') || text.includes('bot:')) {
              role = 'assistant';
            }
          }
          
          // 获取内容
          const contentSelectors = ['.content', '.message-content', '.text'];
          for (const selector of contentSelectors) {
            const contentElement = element.querySelector(selector);
            if (contentElement) {
              content = contentElement.textContent.trim();
              break;
            }
          }
          
          // 如果还没找到内容，使用元素自己的文本
          if (!content) {
            content = element.textContent.trim();
          }
          
          // 添加有内容的消息
          if (content && role) {
            console.log('Found message - role:', role, 'content preview:', content.substring(0, 30));
            messages.push({
              role: role,
              content: content
            });
          }
        });
      } catch (error) {
        console.error('Error in generic extractContext:', error);
      }
      
      return messages;
    },
    
    restoreContext: async function(context, sourcePlatform) {
      console.log('Using generic implementation for restoreContext');
      try {
        // 尝试找到输入元素
        const inputSelectors = [
          'textarea', 
          '[contenteditable="true"]', 
          '.chat-input',
          '.input-box',
          '.input-area'
        ];
        
        let inputElement = null;
        for (const selector of inputSelectors) {
          inputElement = document.querySelector(selector);
          if (inputElement) {
            console.log(`Found input element with selector "${selector}"`);
            break;
          }
        }
        
        if (!inputElement) {
          console.error('Input element not found');
          return false;
        }
        
        // 构建要输入的文本
        let inputText = '';
        
        // 添加说明
        inputText += '请继续以下对话\n\n';
        
        // 添加消息
        context.forEach((message, index) => {
          const role = message.role === 'user' ? '用户' : 
                      message.role === 'assistant' ? 'AI' : 
                      message.role === 'system' ? '系统' : '其他';
          
          inputText += `${role}: ${message.content}\n\n`;
        });
        
        // 设置输入值
        if (inputElement.getAttribute('contenteditable') === 'true') {
          // 对于contenteditable元素
          inputElement.innerHTML = inputText.replace(/\n/g, '<br>');
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          // 对于textarea元素
          inputElement.value = inputText;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // 查找发送按钮
        const buttonSelectors = [
          'button[type="submit"]',
          'button.send',
          'button.submit',
          '.send-button',
          'button[aria-label="Send"]',
          'button[aria-label="Send message"]'
        ];
        
        let sendButton = null;
        for (const selector of buttonSelectors) {
          sendButton = document.querySelector(selector);
          if (sendButton) {
            console.log(`Found send button with selector "${selector}"`);
            break;
          }
        }
        
        if (sendButton) {
          setTimeout(() => {
            sendButton.click();
            console.log('Context restored and sent via button');
          }, 500);
        } else {
          // 触发Enter键发送
          setTimeout(() => {
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            inputElement.dispatchEvent(enterEvent);
            console.log('Context restored and sent via Enter key');
          }, 500);
        }
        
        return true;
      } catch (error) {
        console.error('Error in generic restoreContext:', error);
        return false;
      }
    }
  }
};

// Function to inject the platforms registry
function injectPlatformRegistry() {
  console.log('Injecting platform registry script');
  
  try {
    // Create a script element to execute code in the extension context
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('platforms/registry-export.js');
    script.type = 'module';
    script.onload = function() {
      // Once loaded, we can access the registry from the page context
      console.log('Platform registry script loaded successfully');
      
      // Wait a bit for the script to execute and set up the window object
      setTimeout(() => {
        // Check if window.platformRegistry is available
        if (window.platformRegistry && window.platformRegistry.platforms) {
          platformRegistry = window.platformRegistry;
          console.log('Window platform registry available with platforms:', 
                     Object.keys(window.platformRegistry.platforms).join(', '));
        } else {
          console.error('Window platform registry not available or incomplete after script load');
          
          if (window.platformRegistry) {
            console.log('Partial window.platformRegistry found:', window.platformRegistry);
          }
          
          // Fall back to message-based approach
          requestRegistryFromBackground();
        }
      }, 1000); // Increase timeout to ensure script is fully executed
    };
    
    script.onerror = function(error) {
      console.error('Failed to load platform registry script:', error);
      requestRegistryFromBackground();
    };
    
    (document.head || document.documentElement).appendChild(script);
    console.log('Platform registry script injected into page');
  } catch (error) {
    console.error('Error during script injection:', error);
    requestRegistryFromBackground();
  }
}

// Use a message-based approach to get platformRegistry
function requestRegistryFromBackground() {
  console.log('Requesting platform registry from background script');
  
  chrome.runtime.sendMessage({ action: 'getPlatformRegistry' }, function(response) {
    if (response && response.success && response.registry) {
      console.log('Platform registry received from background, processing...');
      
      // Store the received registry
      platformRegistry = response.registry;
      
      // Log what we received for debugging
      if (platformRegistry.getAllPlatformIds) {
        console.log('Platform IDs available:', platformRegistry.getAllPlatformIds());
      }
      
      console.log('Platform registry initialized with methods:', 
                 Object.keys(platformRegistry).filter(k => typeof platformRegistry[k] === 'function').join(', '));
    } else {
      console.error('Failed to get platform registry from background:', response?.error || 'Unknown error');
    }
  });
}

// Initialize by injecting the necessary scripts
injectPlatformRegistry();

// 添加调试信息
console.log('AI Chat Context Sync content script loaded on:', window.location.href);

// 监听ping消息，用于检测脚本是否已加载
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Received message:', request);
  
  if (request.action === 'ping') {
    console.log('Responding to ping');
    sendResponse({ success: true, message: 'Content script is loaded' });
    return true;
  }
  
  if (request.action === 'getContext') {
    console.log('Getting context for platform:', request.platform);
    console.log('Current platformRegistry status:', platformRegistry ? 'available' : 'not available');
    
    // 先尝试直接从window对象获取
    if (!platformRegistry && window.platformRegistry) {
      console.log('Using window.platformRegistry instead');
      platformRegistry = window.platformRegistry;
    }
    
    // 增加重试逻辑
    let retryCount = 0;
    const maxRetries = 3;
    
    function tryGetContext() {
      // Ensure we have the platform registry
      if (!platformRegistry) {
        console.error('Platform registry not available, attempt', retryCount + 1);
        
        if (retryCount < maxRetries) {
          retryCount++;
          // 重新尝试获取registry
          requestRegistryFromBackground();
          
          // 延迟后再试
          setTimeout(tryGetContext, 500);
          return;
        }
        
        sendResponse({ 
          success: false, 
          message: 'Platform registry not initialized after multiple attempts.' 
        });
        return;
      }
      
      getContext(request.platform)
        .then(result => {
          console.log('Context extracted:', result);
          sendResponse(result);
        })
        .catch(error => {
          console.error('Error getting context:', error);
          sendResponse({ 
            success: false, 
            message: error.message || 'Unknown error during context extraction'
          });
        });
    }
    
    tryGetContext();
    return true; // Indicates async response
  } else if (request.action === 'restoreContext') {
    console.log('Restoring context from', request.sourcePlatform, 'to', request.targetPlatform);
    console.log('Current platformRegistry status:', platformRegistry ? 'available' : 'not available');
    
    // 先尝试直接从window对象获取
    if (!platformRegistry && window.platformRegistry) {
      console.log('Using window.platformRegistry directly');
      platformRegistry = window.platformRegistry;
    }
    
    // 增加重试逻辑
    let retryCount = 0;
    const maxRetries = 3;
    
    function tryRestoreContext() {
      // Ensure we have the platform registry
      if (!platformRegistry) {
        console.error('Platform registry not available, attempt', retryCount + 1);
        
        if (retryCount < maxRetries) {
          retryCount++;
          // 重新尝试获取registry
          requestRegistryFromBackground();
          
          // 延迟后再试
          setTimeout(tryRestoreContext, 500);
          return;
        }
        
        sendResponse({ 
          success: false, 
          message: 'Platform registry not initialized after multiple attempts.' 
        });
        return;
      }
      
      restoreContext(request.context, request.sourcePlatform, request.targetPlatform)
        .then(result => {
          console.log('Context restore result:', result);
          sendResponse(result);
        })
        .catch(error => {
          console.error('Error restoring context:', error);
          sendResponse({ 
            success: false, 
            message: error.message || 'Unknown error during context restoration'
          });
        });
    }
    
    tryRestoreContext();
    return true; // Indicates async response
  }
});

/**
 * Extracts the chat context from the current page
 * @param {string} platformId - The platform identifier (chatgpt, claude, gemini, etc.)
 * @returns {Promise<Object>} - Object containing success status, context, and title
 */
async function getContext(platformId) {
  try {
    // Get current URL
    const currentUrl = window.location.href;
    
    // Debugging
    console.log('Starting context extraction for:', platformId);
    console.log('Current URL:', currentUrl);
    
    // 尝试使用临时平台实现
    if (TempPlatforms[platformId]) {
      console.log('Using temporary platform implementation for:', platformId);
      const tempPlatform = TempPlatforms[platformId];
      const context = await tempPlatform.extractContext();
      const title = tempPlatform.extractTitle();
      
      console.log('Extracted context using temporary implementation:', 
                 { messageCount: context.length, title: title });
      
      return {
        success: true,
        context: context,
        title: title
      };
    }
    
    // 尝试直接访问window上的对象
    if (!platformRegistry && window.platformRegistry) {
      console.log('Using window.platformRegistry directly');
      platformRegistry = window.platformRegistry;
    }
    
    // 如果仍然没有registry，尝试直接构建platform
    if (!platformRegistry || !platformRegistry.platforms) {
      console.error('No valid platform registry available, checking for global platform classes');
      
      // 检查全局平台类
      let platformClass = null;
      let platformInstance = null;
      
      // 根据ID选择平台类
      if (platformId === 'chatgpt' && window.ChatGPTPlatform) {
        console.log('Found global ChatGPTPlatform class');
        platformClass = window.ChatGPTPlatform;
      } else if (platformId === 'claude' && window.ClaudePlatform) {
        console.log('Found global ClaudePlatform class');
        platformClass = window.ClaudePlatform;
      } else if (platformId === 'gemini' && window.GeminiPlatform) {
        console.log('Found global GeminiPlatform class');
        platformClass = window.GeminiPlatform;
      } else if (platformId === 'grok' && window.GrokPlatform) {
        console.log('Found global GrokPlatform class');
        platformClass = window.GrokPlatform;
      } else if (platformId === 'deepseek' && window.DeepSeekPlatform) {
        console.log('Found global DeepSeekPlatform class');
        platformClass = window.DeepSeekPlatform;
      } else if (platformId === 'tongyi' && window.TongyiPlatform) {
        console.log('Found global TongyiPlatform class');
        platformClass = window.TongyiPlatform;
      } else if (platformId === 'doubao' && window.DoubaoPlatform) {
        console.log('Found global DoubaoPlatform class');
        platformClass = window.DoubaoPlatform;
      } else {
        // 尝试通过URL匹配
        console.log('No matching platform class found by ID, trying URL matching');
        if (window.ChatGPTPlatform && window.ChatGPTPlatform.matchesUrl && window.ChatGPTPlatform.matchesUrl(currentUrl)) {
          platformClass = window.ChatGPTPlatform;
        } else if (window.ClaudePlatform && window.ClaudePlatform.matchesUrl && window.ClaudePlatform.matchesUrl(currentUrl)) {
          platformClass = window.ClaudePlatform;
        } else if (window.GeminiPlatform && window.GeminiPlatform.matchesUrl && window.GeminiPlatform.matchesUrl(currentUrl)) {
          platformClass = window.GeminiPlatform;
        } else if (window.GrokPlatform && window.GrokPlatform.matchesUrl && window.GrokPlatform.matchesUrl(currentUrl)) {
          platformClass = window.GrokPlatform;
        } else if (window.DeepSeekPlatform && window.DeepSeekPlatform.matchesUrl && window.DeepSeekPlatform.matchesUrl(currentUrl)) {
          platformClass = window.DeepSeekPlatform;
        } else if (window.TongyiPlatform && window.TongyiPlatform.matchesUrl && window.TongyiPlatform.matchesUrl(currentUrl)) {
          platformClass = window.TongyiPlatform;
        } else if (window.DoubaoPlatform && window.DoubaoPlatform.matchesUrl && window.DoubaoPlatform.matchesUrl(currentUrl)) {
          platformClass = window.DoubaoPlatform;
        }
      }
      
      // 如果找到了平台类，创建实例
      if (platformClass) {
        try {
          console.log('Creating platform instance from class');
          platformInstance = new platformClass();
        } catch (err) {
          console.error('Error creating platform instance:', err);
        }
      }
      
      if (!platformInstance) {
        // 尝试使用临时平台实现作为最后手段
        if (TempPlatforms[platformId]) {
          console.log('Falling back to temporary platform implementation after module failure');
          const tempPlatform = TempPlatforms[platformId];
          const context = await tempPlatform.extractContext();
          const title = tempPlatform.extractTitle();
          
          if (context.length > 0) {
            console.log('Successfully extracted context using temporary implementation:', 
                      { messageCount: context.length, title: title });
            
            return {
              success: true,
              context: context,
              title: title
            };
          } else {
            console.error('Temporary platform implementation failed to extract any messages');
          }
        }
        
        // 最后尝试通用平台实现
        if (TempPlatforms.generic) {
          console.log('Using generic platform implementation as last resort');
          const tempPlatform = TempPlatforms.generic;
          const context = await tempPlatform.extractContext();
          const title = tempPlatform.extractTitle();
          
          if (context.length > 0) {
            console.log('Successfully extracted context using generic implementation:', 
                      { messageCount: context.length, title: title });
            
            return {
              success: true,
              context: context,
              title: title
            };
          } else {
            console.error('Generic implementation failed to extract any messages');
          }
        }
        
        // Instead of throwing an error, create a fallback response
        console.error('Failed to create platform instance for: ' + (platformId || currentUrl) + ', using fallback response');
        return {
          success: true,
          context: [{
            role: 'assistant',
            content: '无法加载平台实例，请尝试刷新页面或重新加载扩展。'
          }],
          title: '对话 ' + new Date().toLocaleString()
        };
      }
      
      // 使用创建的实例
      console.log('Using directly created platform instance');
      const context = await platformInstance.extractContext();
      const title = platformInstance.extractTitle();
      
      return {
        success: true,
        context: context,
        title: title
      };
    }
    
    // 以下是使用platformRegistry的代码
    console.log('Using platformRegistry for context extraction');
    
    // Get platform strategy
    let platform = null;
    
    // Try using the window.platformRegistry directly if available
    if (window.platformRegistry) {
      if (platformId) {
        platform = window.platformRegistry.getPlatformById(platformId);
      } else {
        platform = window.platformRegistry.getPlatformForUrl(currentUrl);
      }
    }
    
    // If platform is still null, try manually creating platform instances
    if (!platform) {
      console.log('Platform not found via registry, attempting manual instantiation');
      if (platformId) {
        // Create platform instance based on ID
        try {
          if (platformId === 'chatgpt' && window.platformRegistry.platforms.ChatGPT) {
            console.log('Creating ChatGPT platform manually');
            platform = new window.platformRegistry.platforms.ChatGPT();
          } else if (platformId === 'claude' && window.platformRegistry.platforms.Claude) {
            console.log('Creating Claude platform manually');
            platform = new window.platformRegistry.platforms.Claude();
          } else if (platformId === 'gemini' && window.platformRegistry.platforms.Gemini) {
            console.log('Creating Gemini platform manually');
            platform = new window.platformRegistry.platforms.Gemini();
          } else if (platformId === 'grok' && window.platformRegistry.platforms.Grok) {
            console.log('Creating Grok platform manually');
            platform = new window.platformRegistry.platforms.Grok();
          } else if (platformId === 'deepseek' && window.platformRegistry.platforms.DeepSeek) {
            console.log('Creating DeepSeek platform manually');
            platform = new window.platformRegistry.platforms.DeepSeek();
          } else if (platformId === 'tongyi' && window.platformRegistry.platforms.Tongyi) {
            console.log('Creating Tongyi platform manually');
            try {
              // Try to create a Tongyi platform with error handling
              const createSafeTongyiInstance = function() {
                try {
                  const instance = new window.platformRegistry.platforms.Tongyi();
                  console.log('Tongyi platform created successfully for restoration');
                  return instance;
                } catch (e) {
                  console.error('Failed to create Tongyi platform instance for restoration:', e);
                  
                  // Try with global class
                  if (window.TongyiPlatform) {
                    try {
                      const instance = new window.TongyiPlatform();
                      console.log('Tongyi platform created from global class successfully');
                      return instance;
                    } catch (e2) {
                      console.error('Failed to create Tongyi platform from global class:', e2);
                    }
                  }
                  
                  // Return minimal viable platform object
                  console.log('Creating minimal viable Tongyi platform');
                  return {
                    extractTitle: function() { return '通义千问对话'; },
                    extractContext: async function() { 
                      return [{
                        role: 'assistant',
                        content: '通义千问平台加载出现问题，无法提取上下文。请尝试刷新页面或重新加载扩展。'
                      }]; 
                    },
                    restoreContext: async function() { return false; }
                  };
                }
              };
              
              platform = createSafeTongyiInstance();
            } catch (error) {
              console.error('Critical error in Tongyi platform creation:', error);
            }
          } else if (platformId === 'doubao' && window.platformRegistry.platforms.Doubao) {
            console.log('Creating Doubao platform manually');
            platform = new window.platformRegistry.platforms.Doubao();
          }
        } catch (error) {
          console.error('Error during manual platform creation:', error);
        }
      } else {
        // Auto-detect platform from URL
        console.log('Attempting to auto-detect platform from URL');
        try {
          for (const [name, PlatformClass] of Object.entries(window.platformRegistry.platforms)) {
            if (PlatformClass.matchesUrl && PlatformClass.matchesUrl(currentUrl)) {
              console.log('Platform match found for URL:', name);
              try {
                platform = new PlatformClass();
                console.log('Successfully created platform instance for:', name);
                break;
              } catch (error) {
                console.error('Error instantiating platform class for', name, ':', error);
              }
            }
          }
        } catch (error) {
          console.error('Error during auto-detect platform:', error);
        }
      }
    }
    
    if (!platform) {
      // 最后尝试临时平台实现
      if (TempPlatforms[platformId]) {
        console.log('All registry methods failed, using temporary platform implementation as last resort');
        const tempPlatform = TempPlatforms[platformId];
        const context = await tempPlatform.extractContext();
        const title = tempPlatform.extractTitle();
        
        return {
          success: true,
          context: context,
          title: title
        };
      }
      
      // 最后尝试通用平台实现
      if (TempPlatforms.generic) {
        console.log('Using generic platform implementation as final resort');
        const tempPlatform = TempPlatforms.generic;
        const context = await tempPlatform.extractContext();
        const title = tempPlatform.extractTitle();
        
        if (context.length > 0) {
          console.log('Successfully extracted context using generic implementation:', 
                    { messageCount: context.length, title: title });
          
          return {
            success: true,
            context: context,
            title: title
          };
        } else {
          console.error('Generic implementation failed to extract any messages');
        }
      }
      
      // Instead of throwing an error, create a fallback response
      console.error('Failed to create platform instance for: ' + (platformId || currentUrl) + ', using fallback response');
      return {
        success: true,
        context: [{
          role: 'assistant',
          content: '无法加载平台实例，请尝试刷新页面或重新加载扩展。'
        }],
        title: '对话 ' + new Date().toLocaleString()
      };
    }
    
    // Extract context and title using the platform strategy
    const context = await platform.extractContext();
    const title = platform.extractTitle();
    
    return {
      success: true,
      context: context,
      title: title
    };
  } catch (error) {
    console.error('Error getting context:', error);
    
    // 尝试使用临时平台实现
    if (TempPlatforms[platformId]) {
      try {
        console.log('Error occurred, attempting to use temporary platform implementation');
        const tempPlatform = TempPlatforms[platformId];
        const context = await tempPlatform.extractContext();
        const title = tempPlatform.extractTitle();
        
        return {
          success: true,
          context: context,
          title: title
        };
      } catch (tempError) {
        console.error('Temporary platform implementation also failed:', tempError);
      }
    }
    
    // 最后的努力 - 尝试通用实现
    try {
      console.log('All other methods failed, attempting to use generic implementation');
      if (TempPlatforms.generic) {
        const genericPlatform = TempPlatforms.generic;
        const context = await genericPlatform.extractContext();
        const title = genericPlatform.extractTitle();
        
        if (context.length > 0) {
          return {
            success: true,
            context: context,
            title: title
          };
        }
      }
    } catch (genericError) {
      console.error('Generic implementation also failed:', genericError);
    }
    
    // Instead of throwing an error, create a fallback response
    console.error('Failed to create platform instance for: ' + (platformId || currentUrl) + ', using fallback response');
    return {
      success: true,
      context: [{
        role: 'assistant',
        content: '无法加载平台实例，请尝试刷新页面或重新加载扩展。'
      }],
      title: '对话 ' + new Date().toLocaleString()
    };
  }
}

/**
 * Restores a saved context to the current chat
 * @param {Array} context - The context to restore
 * @param {string} sourcePlatform - Platform the context was saved from
 * @param {string} targetPlatform - Platform to restore the context to
 * @returns {Promise<Object>} - Object containing success status
 */
async function restoreContext(context, sourcePlatform, targetPlatform) {
  try {
    // Get current URL
    const currentUrl = window.location.href;
    
    // Debugging
    console.log('Starting context restoration for platform:', targetPlatform);
    console.log('Current URL:', currentUrl);
    
    // 尝试使用临时平台实现
    if (TempPlatforms[targetPlatform]) {
      console.log('Using temporary platform implementation for restoration:', targetPlatform);
      const tempPlatform = TempPlatforms[targetPlatform];
      const success = await tempPlatform.restoreContext(context, sourcePlatform);
      
      if (success) {
        console.log('Context restored successfully using temporary implementation');
        return { success: true };
      } else {
        console.error('Temporary implementation failed to restore context');
      }
    }
    
    // 尝试直接访问window上的对象
    if (!platformRegistry && window.platformRegistry) {
      console.log('Using window.platformRegistry directly');
      platformRegistry = window.platformRegistry;
    }
    
    // 如果仍然没有registry，尝试直接构建platform
    if (!platformRegistry || !platformRegistry.platforms) {
      console.error('No valid platform registry available, checking for global platform classes');
      
      // 检查全局平台类
      let platformClass = null;
      let platformInstance = null;
      
      // 根据ID选择平台类
      if (targetPlatform === 'chatgpt' && window.ChatGPTPlatform) {
        console.log('Found global ChatGPTPlatform class');
        platformClass = window.ChatGPTPlatform;
      } else if (targetPlatform === 'claude' && window.ClaudePlatform) {
        console.log('Found global ClaudePlatform class');
        platformClass = window.ClaudePlatform;
      } else if (targetPlatform === 'gemini' && window.GeminiPlatform) {
        console.log('Found global GeminiPlatform class');
        platformClass = window.GeminiPlatform;
      } else if (targetPlatform === 'grok' && window.GrokPlatform) {
        console.log('Found global GrokPlatform class');
        platformClass = window.GrokPlatform;
      } else if (targetPlatform === 'deepseek' && window.DeepSeekPlatform) {
        console.log('Found global DeepSeekPlatform class');
        platformClass = window.DeepSeekPlatform;
      } else if (targetPlatform === 'tongyi' && window.TongyiPlatform) {
        console.log('Found global TongyiPlatform class');
        try {
          platformClass = window.TongyiPlatform;
          console.log('TongyiPlatform class type:', typeof platformClass);
          
          // Try to instantiate to verify it works
          platformInstance = new platformClass();
          console.log('Successfully created TongyiPlatform instance directly');
        } catch (error) {
          console.error('Failed to instantiate TongyiPlatform directly:', error);
          
          // Try alternative approach
          if (window.platformRegistry && window.platformRegistry.platforms && window.platformRegistry.platforms.Tongyi) {
            console.log('Attempting to use platformRegistry.platforms.Tongyi');
            try {
              platformClass = window.platformRegistry.platforms.Tongyi;
              platformInstance = new platformClass();
              console.log('Successfully created TongyiPlatform from registry');
            } catch (e2) {
              console.error('Failed to create TongyiPlatform from registry:', e2);
            }
          }
        }
      } else if (targetPlatform === 'doubao' && window.DoubaoPlatform) {
        console.log('Found global DoubaoPlatform class');
        platformClass = window.DoubaoPlatform;
      } else {
        // 尝试通过URL匹配
        console.log('No matching platform class found by ID, trying URL matching');
        if (window.ChatGPTPlatform && window.ChatGPTPlatform.matchesUrl && window.ChatGPTPlatform.matchesUrl(currentUrl)) {
          platformClass = window.ChatGPTPlatform;
        } else if (window.ClaudePlatform && window.ClaudePlatform.matchesUrl && window.ClaudePlatform.matchesUrl(currentUrl)) {
          platformClass = window.ClaudePlatform;
        } else if (window.GeminiPlatform && window.GeminiPlatform.matchesUrl && window.GeminiPlatform.matchesUrl(currentUrl)) {
          platformClass = window.GeminiPlatform;
        } else if (window.GrokPlatform && window.GrokPlatform.matchesUrl && window.GrokPlatform.matchesUrl(currentUrl)) {
          platformClass = window.GrokPlatform;
        } else if (window.DeepSeekPlatform && window.DeepSeekPlatform.matchesUrl && window.DeepSeekPlatform.matchesUrl(currentUrl)) {
          platformClass = window.DeepSeekPlatform;
        } else if (window.TongyiPlatform && window.TongyiPlatform.matchesUrl && window.TongyiPlatform.matchesUrl(currentUrl)) {
          platformClass = window.TongyiPlatform;
        } else if (window.DoubaoPlatform && window.DoubaoPlatform.matchesUrl && window.DoubaoPlatform.matchesUrl(currentUrl)) {
          platformClass = window.DoubaoPlatform;
        }
      }
      
      // 如果找到了平台类，创建实例
      if (platformClass) {
        try {
          console.log('Creating platform instance from class');
          platformInstance = new platformClass();
        } catch (err) {
          console.error('Error creating platform instance:', err);
        }
      }
      
      if (!platformInstance) {
        // 尝试使用临时平台实现作为最后手段
        if (TempPlatforms[targetPlatform]) {
          console.log('Falling back to temporary platform implementation for restore after module failure');
          const tempPlatform = TempPlatforms[targetPlatform];
          const success = await tempPlatform.restoreContext(context, sourcePlatform);
          
          if (success) {
            return { success: true };
          } else {
            console.error('Temporary platform implementation failed to restore context');
          }
        }
        
        // 最后尝试通用平台实现
        if (TempPlatforms.generic) {
          console.log('Using generic platform implementation for restore as last resort');
          const tempPlatform = TempPlatforms.generic;
          const success = await tempPlatform.restoreContext(context, sourcePlatform);
          
          if (success) {
            console.log('Context restored successfully using generic implementation');
            return { success: true };
          } else {
            console.error('Generic implementation failed to restore context');
          }
        }
        
        // Instead of throwing an error, create a fallback response
        console.error('Failed to create platform instance for: ' + (targetPlatform || currentUrl) + ', using fallback response');
        return {
          success: false,
          message: '无法加载平台实例，请尝试刷新页面或重新加载扩展。'
        };
      }
      
      // 使用创建的实例
      console.log('Using directly created platform instance for restoration');
      const success = await platformInstance.restoreContext(context, sourcePlatform);
      
      if (!success) {
        throw new Error('Platform restore operation returned failure');
      }
      
      return {
        success: true
      };
    }
    
    // 以下是使用platformRegistry的代码
    console.log('Using platformRegistry for context restoration');
    
    // Get platform strategy
    let platform = null;
    
    // Try using the window.platformRegistry directly if available
    if (window.platformRegistry) {
      if (targetPlatform) {
        // Special handling for Tongyi platform
        if (targetPlatform === 'tongyi') {
          console.log('Using safe creation method for Tongyi platform');
          try {
            // Create a safe wrapper function
            const createSafeTongyiInstance = function() {
              try {
                if (window.platformRegistry.platforms && window.platformRegistry.platforms.Tongyi) {
                  const instance = new window.platformRegistry.platforms.Tongyi();
                  console.log('Tongyi platform created successfully from registry');
                  return instance;
                } else if (window.TongyiPlatform) {
                  const instance = new window.TongyiPlatform();
                  console.log('Tongyi platform created from global class');
                  return instance;
                } else {
                  throw new Error('No Tongyi platform class found');
                }
              } catch (e) {
                console.error('Failed to create Tongyi platform instance:', e);
                
                // Return minimal viable platform
                console.log('Creating minimal viable Tongyi platform');
                return {
                  extractTitle: function() { return '通义千问对话'; },
                  extractContext: async function() { 
                    return [{
                      role: 'assistant',
                      content: '通义千问平台加载出现问题，无法提取上下文。请尝试刷新页面或重新加载扩展。'
                    }]; 
                  },
                  restoreContext: async function() { 
                    console.log('Using fallback restoreContext for Tongyi');
                    return false;
                  }
                };
              }
            };
            
            platform = createSafeTongyiInstance();
          } catch (error) {
            console.error('Critical error in Tongyi platform creation:', error);
          }
        } else {
          platform = window.platformRegistry.getPlatformById(targetPlatform);
        }
      } else {
        platform = window.platformRegistry.getPlatformForUrl(currentUrl);
      }
    }
    
    if (!platform) {
      // 最后尝试临时平台实现
      if (TempPlatforms[targetPlatform]) {
        console.log('All registry methods failed, using temporary platform implementation for restore');
        const tempPlatform = TempPlatforms[targetPlatform];
        const success = await tempPlatform.restoreContext(context, sourcePlatform);
        
        if (success) {
          console.log('Context restored successfully using temporary implementation');
          return { success: true };
        } else {
          console.error('Temporary platform implementation failed to restore context');
        }
      }
      
      // 最后尝试通用平台实现
      if (TempPlatforms.generic) {
        console.log('Using generic platform implementation for restore as final resort');
        const genericPlatform = TempPlatforms.generic;
        const success = await genericPlatform.restoreContext(context, sourcePlatform);
        
        if (success) {
          console.log('Context restored successfully using generic implementation');
          return { success: true };
        } else {
          console.error('Generic implementation failed to restore context');
        }
      }
      
      // Instead of throwing an error, create a fallback response
      console.error('Failed to create platform instance for: ' + (targetPlatform || currentUrl) + ', using fallback response');
      return {
        success: false,
        message: '无法加载平台实例，请尝试刷新页面或重新加载扩展。'
      };
    }
    
    // Restore context using the platform strategy
    const success = await platform.restoreContext(context, sourcePlatform);
    
    if (!success) {
      throw new Error('Failed to restore context');
    }
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Error restoring context:', error);
    
    // 最后的尝试，使用临时平台实现
    if (TempPlatforms[targetPlatform]) {
      try {
        console.log('Error occurred, attempting to use temporary platform implementation for restore');
        const tempPlatform = TempPlatforms[targetPlatform];
        const success = await tempPlatform.restoreContext(context, sourcePlatform);
        
        if (success) {
          return { success: true };
        }
      } catch (tempError) {
        console.error('Temporary platform implementation also failed to restore context:', tempError);
      }
    }
    
    // 最后的努力 - 尝试通用实现
    try {
      console.log('All other methods failed, attempting to use generic implementation for restore');
      if (TempPlatforms.generic) {
        const genericPlatform = TempPlatforms.generic;
        const success = await genericPlatform.restoreContext(context, sourcePlatform);
        
        if (success) {
          console.log('Context restored successfully using generic implementation');
          return { success: true };
        } else {
          console.error('Generic implementation failed to restore context');
        }
      }
    } catch (genericError) {
      console.error('Generic implementation also failed for restore:', genericError);
    }
    
    // Instead of throwing an error, create a fallback response
    console.error('Failed to create platform instance for: ' + (targetPlatform || currentUrl) + ', using fallback response');
    return {
      success: false,
      message: '无法加载平台实例，请尝试刷新页面或重新加载扩展。'
    };
  }
} 