import platformRegistry from './platforms/index.js';

// Language translations
const translations = {
  en: {
    title: 'AI Chat Context Sync',
    subtitle: 'Saved Contexts',
    saveButton: 'Save Current Context',
    restoreButton: 'Restore Selected Context',
    noContexts: 'No saved contexts yet',
    contextDetails: 'Context Details',
    previewMessages: 'Messages',
    previewPlatform: 'Platform',
    previewDate: 'Date',
    errorUnsupportedSite: 'Current site not supported:',
    errorLoadingComponents: 'Loading components...',
    errorComponentsFailed: 'Failed to load components, please refresh and try again',
    errorUnsupportedPlatform: 'Unsupported platform:',
    errorReconnecting: 'Reconnecting to page...',
    errorSelectContext: 'Please select a context first',
    errorContextNotFound: 'Selected context not found',
    successContextSaved: 'Context saved successfully!',
    successContextRestored: 'Context restored successfully!',
    successContextDeleted: 'Context deleted',
    successAllContextsDeleted: 'All contexts have been deleted',
    confirmDeleteAll: 'Are you sure you want to delete all saved contexts? This cannot be undone.'
  },
  zh: {
    title: 'AI对话上下文同步',
    subtitle: '已保存的上下文',
    saveButton: '保存当前上下文',
    restoreButton: '恢复所选上下文',
    noContexts: '还没有保存的上下文',
    contextDetails: '上下文详情',
    previewMessages: '消息列表',
    previewPlatform: '平台',
    previewDate: '日期',
    errorUnsupportedSite: '当前网站不支持此拓展:',
    errorLoadingComponents: '正在加载组件...',
    errorComponentsFailed: '加载组件失败，请刷新页面后重试',
    errorUnsupportedPlatform: '不支持的平台:',
    errorReconnecting: '正在重新连接页面...',
    errorSelectContext: '请先选择一个上下文',
    errorContextNotFound: '找不到所选的上下文',
    successContextSaved: '上下文保存成功！',
    successContextRestored: '上下文恢复成功！',
    successContextDeleted: '上下文已删除',
    successAllContextsDeleted: '所有上下文已被删除',
    confirmDeleteAll: '您确定要删除所有保存的上下文吗？此操作无法撤销。'
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const saveButton = document.getElementById('saveContext');
  const restoreButton = document.getElementById('restoreContext');
  const contextsList = document.getElementById('contextsList');
  const statusMessage = document.getElementById('statusMessage');
  const languageSelector = document.getElementById('languageSelector');
  const contextPreview = document.getElementById('contextPreview');
  const previewClose = document.getElementById('previewClose');
  const previewContent = document.getElementById('previewContent');
  const previewTitle = document.getElementById('previewTitle');
  const deleteAllBtn = document.getElementById('deleteAllContexts');
  
  let selectedContextId = null;
  let currentLanguage = 'zh'; // Default language

  // Load saved language preference
  chrome.storage.local.get('language', function(data) {
    if (data.language) {
      currentLanguage = data.language;
      languageSelector.value = currentLanguage;
    }
    updateLanguage(currentLanguage);
  });

  // Language selector event listener
  languageSelector.addEventListener('change', function() {
    currentLanguage = this.value;
    // Save language preference
    chrome.storage.local.set({ language: currentLanguage });
    updateLanguage(currentLanguage);
  });

  // Close preview panel when clicking the close button
  previewClose.addEventListener('click', function() {
    contextPreview.classList.remove('show');
  });

  // 在加载时检查内容脚本是否已注入
  checkAndInitContentScript();

  // Load saved contexts when popup opens
  loadSavedContexts();

  // Add event listeners
  saveButton.addEventListener('click', saveCurrentContext);
  restoreButton.addEventListener('click', restoreSelectedContext);
  languageSelector.addEventListener('change', function() {
    updateLanguage(this.value);
  });
  
  // Add event listener for delete all button
  deleteAllBtn.addEventListener('click', function() {
    // Ask for confirmation before deleting all contexts
    if (confirm(translations[currentLanguage].confirmDeleteAll || 'Are you sure you want to delete all saved contexts? This cannot be undone.')) {
      deleteAllContexts();
    }
  });

  // Function to update UI language
  function updateLanguage(lang) {
    const t = translations[lang];
    
    // Update UI elements
    document.getElementById('title').textContent = t.title;
    document.getElementById('subtitle').textContent = t.subtitle;
    saveButton.textContent = t.saveButton;
    restoreButton.textContent = t.restoreButton;
    previewTitle.textContent = t.contextDetails;
    
    // Refresh the contexts list to update its language
    loadSavedContexts();
  }

  // 检查并初始化内容脚本
  function checkAndInitContentScript() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || tabs.length === 0) return;

      const currentTab = tabs[0];
      console.log('Current tab:', currentTab.url);

      // 检查URL是否受支持
      const url = currentTab.url;
      const supportedPlatform = platformRegistry.getPlatformForUrl(url);
      const isSupported = !!supportedPlatform;

      if (!isSupported) {
        showStatus(translations[currentLanguage].errorUnsupportedSite + ' ' + new URL(url).hostname, 'error');
        saveButton.disabled = true;
        restoreButton.disabled = true;
        return;
      }

      // 检查内容脚本是否已加载
      chrome.runtime.sendMessage(
        { action: 'checkContentScript', tabId: currentTab.id },
        function (response) {
          if (chrome.runtime.lastError) {
            console.error('Error checking content script:', chrome.runtime.lastError);
            showStatus(chrome.runtime.lastError.message, 'error');
            return;
          }

          if (!response || !response.loaded) {
            console.log('Content script not loaded, injecting now');
            showStatus(translations[currentLanguage].errorLoadingComponents, 'error');

            // 注入内容脚本
            chrome.runtime.sendMessage(
              { action: 'injectContentScript', tabId: currentTab.id },
              function (injectResponse) {
                if (chrome.runtime.lastError || !injectResponse || !injectResponse.success) {
                  console.error('Failed to inject content script:',
                    chrome.runtime.lastError || (injectResponse?.error || 'Unknown error'));
                  showStatus(translations[currentLanguage].errorComponentsFailed, 'error');
                  saveButton.disabled = true;
                  restoreButton.disabled = true;
                } else {
                  console.log('Content script injected successfully');
                  showStatus(translations[currentLanguage].successContextSaved, 'success');
                }
              }
            );
          } else {
            console.log('Content script already loaded');
          }
        }
      );
    });
  }

  // Function to save current context
  function saveCurrentContext() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];
      const url = currentTab.url;
      
      // 使用平台注册表获取平台ID
      const platform = platformRegistry.getPlatformForUrl(url);
      
      if (!platform) {
        showStatus(translations[currentLanguage].errorUnsupportedPlatform + ' ' + new URL(url).hostname, 'error');
        console.error('Unsupported platform:', url);
        return;
      }
      
      const platformId = platform.constructor.id;
      console.log('Detected platform:', platformId);

      // First ensure content script is loaded
      ensureContentScriptLoaded(currentTab.id, function() {
        // Now that we've ensured the content script is loaded, proceed with getting context
        chrome.tabs.sendMessage(
          currentTab.id,
          { action: 'getContext', platform: platformId },
          function (response) {
            if (chrome.runtime.lastError) {
              const errorMsg = chrome.runtime.lastError.message;
              console.error('Chrome runtime error:', errorMsg);
              showStatus('Error: ' + errorMsg, 'error');
              return;
            }

            if (response && response.success) {
              const contextData = {
                id: Date.now().toString(),
                platform: platformId,
                title: response.title || 'Chat ' + new Date().toLocaleString(),
                content: response.context,
                timestamp: Date.now()
              };

              // 保存到浏览器存储
              chrome.storage.local.get('savedContexts', function (data) {
                const savedContexts = data.savedContexts || [];
                savedContexts.push(contextData);

                chrome.storage.local.set({ savedContexts: savedContexts }, function () {
                  showStatus(translations[currentLanguage].successContextSaved, 'success');
                  loadSavedContexts();
                  
                  // 更新徽章计数
                  chrome.runtime.sendMessage({ action: 'updateContextBadge' });
                });
              });
            } else {
              showStatus('Error: ' + (response?.message || 'Unknown error'), 'error');
              console.error('Get context failed:', response);
            }
          }
        );
      });
    });
  }

  // Function to restore selected context
  function restoreSelectedContext() {
    if (!selectedContextId) {
      showStatus(translations[currentLanguage].errorSelectContext, 'error');
      return;
    }

    chrome.storage.local.get('savedContexts', function (data) {
      const savedContexts = data.savedContexts || [];
      const contextToRestore = savedContexts.find(ctx => ctx.id === selectedContextId);

      if (!contextToRestore) {
        showStatus(translations[currentLanguage].errorContextNotFound, 'error');
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currentTab = tabs[0];
        const url = currentTab.url;
        
        // 使用平台注册表获取平台ID
        const platform = platformRegistry.getPlatformForUrl(url);
        
        if (!platform) {
          showStatus(translations[currentLanguage].errorUnsupportedPlatform + ' ' + new URL(url).hostname, 'error');
          console.error('Unsupported platform for restore:', url);
          return;
        }
        
        const currentPlatform = platform.constructor.id;
        console.log('Detected platform for restore:', currentPlatform);

        // First ensure content script is loaded
        ensureContentScriptLoaded(currentTab.id, function() {
          // Now that we've ensured the content script is loaded, proceed with restoring context
          chrome.tabs.sendMessage(
            currentTab.id,
            {
              action: 'restoreContext',
              context: contextToRestore.content,
              sourcePlatform: contextToRestore.platform,
              targetPlatform: currentPlatform
            },
            function (response) {
              if (chrome.runtime.lastError) {
                const errorMsg = chrome.runtime.lastError.message;
                console.error('Chrome runtime error:', errorMsg);
                showStatus('Error: ' + errorMsg, 'error');
                return;
              }

              if (response && response.success) {
                showStatus(translations[currentLanguage].successContextRestored, 'success');
              } else {
                showStatus('Error: ' + (response?.message || 'Unknown error'), 'error');
                console.error('Restore failed:', response);
              }
            }
          );
        });
      });
    });
  }

  // Ensure content script is loaded before proceeding
  function ensureContentScriptLoaded(tabId, callback, retryCount = 0) {
    const maxRetries = 3;
    
    // Show loading status on first attempt only
    if (retryCount === 0) {
      showStatus(translations[currentLanguage].errorLoadingComponents, 'error');
    }
    
    // First check if content script is already loaded
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, function(response) {
      if (chrome.runtime.lastError || !response) {
        console.log('Content script not loaded or not responding, attempt', retryCount + 1);
        
        // If we've exceeded max retries, show error and give up
        if (retryCount >= maxRetries) {
          console.error('Failed to load content script after', maxRetries, 'attempts');
          showStatus(translations[currentLanguage].errorComponentsFailed, 'error');
          return;
        }
        
        // Try injecting directly
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }, function() {
          if (chrome.runtime.lastError) {
            console.error('Failed to inject content script:', chrome.runtime.lastError);
            showStatus(translations[currentLanguage].errorComponentsFailed, 'error');
          } else {
            console.log('Content script injected successfully, waiting for it to initialize');
            // Allow time for the script to initialize
            setTimeout(function() {
              // Try again with increased retry count
              ensureContentScriptLoaded(tabId, callback, retryCount + 1);
            }, 1000); // Longer wait time for initialization
          }
        });
      } else {
        // Content script is loaded and responding
        console.log('Content script is loaded and responding properly');
        
        // Show success message and call the callback
        if (retryCount === 0) {
          // Only show success on first attempt, don't show on retry success
          showStatus(translations[currentLanguage].successContextSaved, 'success');
        }
        
        if (callback) {
          setTimeout(callback, 500); // Add a small delay before doing operations
        }
      }
    });
  }

  // Function to load saved contexts
  function loadSavedContexts() {
    chrome.storage.local.get('savedContexts', function (data) {
      const savedContexts = data.savedContexts || [];

      if (savedContexts.length === 0) {
        contextsList.innerHTML = `
          <div class="context-item" style="text-align: center; color: #666;">
            ${translations[currentLanguage].noContexts}
          </div>
        `;
        return;
      }

      // Sort by timestamp (newest first)
      savedContexts.sort((a, b) => b.timestamp - a.timestamp);

      // Clear the list
      contextsList.innerHTML = '';

      // Add each context to the list
      savedContexts.forEach(context => {
        const contextElement = document.createElement('div');
        contextElement.className = 'context-item';
        contextElement.dataset.id = context.id;

        if (context.id === selectedContextId) {
          contextElement.style.border = '2px solid #0078d7';
        }

        // Get platform display name
        const platformClass = platformRegistry.getPlatformById(context.platform);
        const platformDisplayName = platformClass?.constructor.displayName || 
                                   getPlatformDisplayName(context.platform);

        contextElement.innerHTML = `
          <span class="platform-tag tag-${context.platform}">${platformDisplayName}</span>
          <strong>${escapeHtml(context.title)}</strong>
          <br>
          <small>${new Date(context.timestamp).toLocaleString()}</small>
          <button class="delete-btn" data-id="${context.id}">×</button>
        `;

        // Add click event to select this context
        contextElement.addEventListener('click', function (e) {
          // Don't select if clicking the delete button
          if (e.target.classList.contains('delete-btn')) return;

          selectedContextId = context.id;

          // Highlight selected context
          document.querySelectorAll('.context-item').forEach(el => {
            el.style.border = 'none';
          });
          this.style.border = '2px solid #0078d7';
        });
        
        // 将mouseenter/mouseleave事件从整个contextElement转移到平台标签
        const platformTag = contextElement.querySelector('.platform-tag');
        if (platformTag) {
          // 平台标签的鼠标悬停事件
          platformTag.addEventListener('mouseenter', function(event) {
            // 阻止事件冒泡，避免触发contextElement的mouseenter
            event.stopPropagation();
            showContextPreview(context, event);
            
            // 为了更好的用户体验，添加一个指示这是可悬停的元素的样式
            this.style.cursor = 'pointer';
          });
          
          platformTag.addEventListener('mouseleave', function(event) {
            // 阻止事件冒泡，避免触发contextElement的mouseleave
            event.stopPropagation();
            
            // 检查鼠标是否移到预览面板
            const toElement = event.relatedTarget;
            if (!toElement || !contextPreview.contains(toElement)) {
              contextPreview.classList.remove('show');
            }
          });
        }
        
        // 保留整个上下文项目的悬停事件
        contextElement.addEventListener('mouseenter', function() {
          // 不立即显示预览，让用户有机会将鼠标移到平台标签上
        });
        
        // 修改mouseleave事件，检查鼠标是否移动到预览面板
        contextElement.addEventListener('mouseleave', function(e) {
          // 检查鼠标是否移到预览面板
          const toElement = e.relatedTarget;
          if (!toElement || !contextPreview.contains(toElement)) {
            contextPreview.classList.remove('show');
          }
        });

        contextsList.appendChild(contextElement);
      });

      // Add click events for delete buttons
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          const contextId = this.dataset.id;
          deleteContext(contextId);
        });
      });
      
      // Keep preview panel visible when mouse is over it
      contextPreview.addEventListener('mouseleave', function() {
        contextPreview.classList.remove('show');
      });
    });
  }
  
  // Function to show context preview
  function showContextPreview(context, event) {
    // Format the content for display
    const t = translations[currentLanguage];
    
    // 增强平台信息的展示
    const platformName = getPlatformDisplayName(context.platform);
    let platformInfo = `
      <div class="preview-platform-header">
        <div class="platform-icon ${context.platform}"></div>
        <h3>${platformName}</h3>
      </div>
    `;
    
    let previewHtml = `
      <div class="preview-info">
        ${platformInfo}
        <p><strong>${t.previewPlatform}:</strong> ${platformName}</p>
        <p><strong>${t.previewDate}:</strong> ${new Date(context.timestamp).toLocaleString()}</p>
        <p><strong>ID:</strong> ${context.platform}</p>
      </div>
      <h4>${t.previewMessages}:</h4>
    `;
    
    // Format messages in a clean JSON structure
    if (context.content && Array.isArray(context.content)) {
      previewHtml += '<div class="messages-container">';
      
      // 添加消息计数
      const userMessages = context.content.filter(msg => msg.role === 'user').length;
      const assistantMessages = context.content.filter(msg => msg.role === 'assistant').length;
      previewHtml += `<div class="message-stats">
        <span>${userMessages} 用户消息</span> | <span>${assistantMessages} 助手回复</span>
      </div>`;
      
      context.content.forEach((message, index) => {
        previewHtml += `
          <div class="message ${message.role}">
            <strong>${message.role === 'user' ? 'User' : 'Assistant'}:</strong>
            <div>${escapeHtml(message.content || '')}</div>
          </div>
        `;
        
        // Add attachments if any
        if (message.attachments && message.attachments.length > 0) {
          previewHtml += '<div class="attachments">';
          message.attachments.forEach(attachment => {
            if (attachment.type === 'image') {
              previewHtml += `<div class="attachment image">[Image: ${escapeHtml(attachment.alt || 'Attachment')}]</div>`;
            } else if (attachment.type === 'file') {
              previewHtml += `<div class="attachment file">[File: ${escapeHtml(attachment.name || 'File')}]</div>`;
            }
          });
          previewHtml += '</div>';
        }
      });
      
      previewHtml += '</div>';
    } else {
      previewHtml += '<div>No message content available</div>';
    }
    
    // Update and show the preview
    previewContent.innerHTML = previewHtml;
    contextPreview.classList.add('show');
    
    // 如果提供了event参数，根据鼠标位置定位预览面板
    if (event) {
      // 定位预览面板，使其靠近鼠标位置但仍在窗口内
      const previewRect = contextPreview.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      
      // 确保预览面板不会超出窗口底部
      const topPosition = Math.min(
        event.clientY + 10,
        windowHeight - previewRect.height - 10
      );
      
      // 确保预览面板不会超出窗口右侧
      const leftPosition = Math.min(
        event.clientX + 10,
        windowWidth - previewRect.width - 10
      );
      
      // 应用位置
      contextPreview.style.top = `${topPosition}px`;
      contextPreview.style.left = `${leftPosition}px`;
    } else {
      // 如果没有event参数，则默认居中显示
      contextPreview.style.top = '50%';
      contextPreview.style.left = '50%';
      contextPreview.style.transform = 'translate(-50%, -50%)';
    }
  }
  
  // 获取平台显示名称（回退方法）
  function getPlatformDisplayName(platformId) {
    const platformLabels = {
      'chatgpt': 'ChatGPT',
      'claude': 'Claude',
      'gemini': 'Gemini',
      'grok': 'Grok',
      'deepseek': 'DeepSeek',
      'tongyi': '通义千问',
      'doubao': '豆包'
    };
    return platformLabels[platformId] || platformId;
  }

  // Function to delete a context
  function deleteContext(contextId) {
    chrome.storage.local.get('savedContexts', function (data) {
      let savedContexts = data.savedContexts || [];
      savedContexts = savedContexts.filter(ctx => ctx.id !== contextId);

      chrome.storage.local.set({ savedContexts: savedContexts }, function () {
        if (selectedContextId === contextId) {
          selectedContextId = null;
        }
        loadSavedContexts();
        showStatus(translations[currentLanguage].successContextDeleted, 'success');
        
        // 更新徽章计数
        chrome.runtime.sendMessage({ action: 'updateContextBadge' });
      });
    });
  }

  // Function to show status messages
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;
    statusMessage.style.display = 'block';

    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  }

  // Helper function to escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Function to delete all contexts
  function deleteAllContexts() {
    chrome.storage.local.get('savedContexts', function (data) {
      let savedContexts = data.savedContexts || [];
      savedContexts = [];

      chrome.storage.local.set({ savedContexts: savedContexts }, function () {
        selectedContextId = null;
        loadSavedContexts();
        showStatus(translations[currentLanguage].successAllContextsDeleted, 'success');
        
        // 更新徽章计数
        chrome.runtime.sendMessage({ action: 'updateContextBadge' });
      });
    });
  }
}); 