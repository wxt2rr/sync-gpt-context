// Background script for AI Chat Context Sync extension
import platformRegistry from './platforms/index.js';

// Initialize when the extension is installed
chrome.runtime.onInstalled.addListener(function() {
  console.log('AI Chat Context Sync extension installed');
  
  // Initialize storage with empty contexts if not already set
  chrome.storage.local.get('savedContexts', function(data) {
    if (!data.savedContexts) {
      chrome.storage.local.set({ savedContexts: [] });
    }
  });
  
  // Also initialize language preference if not set
  chrome.storage.local.get('language', function(data) {
    if (!data.language) {
      chrome.storage.local.set({ language: 'zh' }); // Default to Chinese
    }
  });
});

// 监听标签页更新，当页面加载完成时主动注入内容脚本
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // 只在页面加载完成时执行
  if (changeInfo.status === 'complete') {
    // 检查URL是否匹配我们支持的平台
    const url = tab.url;
    if (url && isSupportedUrl(url)) {
      console.log('Matched URL, injecting content script into tab:', tabId);
      
      // 检查脚本是否已注入
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, function(response) {
        if (chrome.runtime.lastError) {
          // 脚本未注入，现在注入
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }, function() {
            if (chrome.runtime.lastError) {
              console.error('Failed to inject content script:', chrome.runtime.lastError);
            } else {
              console.log('Content script injected successfully to tab:', tabId);
              // 更新扩展图标状态
              updateIconState(tabId, true);
            }
          });
        } else {
          // 脚本已注入
          console.log('Content script already exists in tab:', tabId);
          updateIconState(tabId, true);
        }
      });
    } else {
      // 不支持的URL，更新图标状态
      updateIconState(tabId, false);
    }
  }
});

// 监听标签页激活，更新图标状态
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (chrome.runtime.lastError) return;
    
    const url = tab.url;
    const isSupported = url && isSupportedUrl(url);
    
    updateIconState(activeInfo.tabId, isSupported);
  });
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'updateContextBadge') {
    updateBadgeCount();
    return false;
  }
  
  if (request.action === 'checkContentScript') {
    // 检查内容脚本是否已加载
    const tabId = request.tabId;
    
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, function(response) {
      if (chrome.runtime.lastError) {
        sendResponse({ loaded: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ loaded: true });
      }
    });
    
    return true; // 异步响应
  }
  
  if (request.action === 'injectContentScript') {
    const tabId = request.tabId;
    
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }, function() {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true });
      }
    });
    
    return true; // 异步响应
  }
  
  if (request.action === 'getPlatformRegistry') {
    // Provide the platform registry to content scripts
    try {
      // Create a serializable version of the registry with methods
      const platformIds = platformRegistry.getAllPlatformIds();
      
      // Send back a proper registry object that includes the necessary methods
      sendResponse({ 
        success: true, 
        registry: {
          getPlatformById: function(id) {
            return platformRegistry.getPlatformById(id);
          },
          getPlatformForUrl: function(url) {
            return platformRegistry.getPlatformForUrl(url);
          },
          getAllPlatformIds: function() {
            return platformIds;
          }
        }
      });
    } catch (error) {
      console.error('Error sending platform registry:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  return false;
});

// Function to update the badge with the count of saved contexts
function updateBadgeCount() {
  chrome.storage.local.get('savedContexts', function(data) {
    const count = (data.savedContexts || []).length;
    
    if (count > 0) {
      chrome.action.setBadgeText({ text: count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#4285F4' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  });
}

// 更新扩展图标状态
function updateIconState(tabId, isSupported) {
  if (isSupported) {
    chrome.action.enable(tabId);
    chrome.action.setTitle({ tabId: tabId, title: '保存或恢复AI对话上下文' });
  } else {
    chrome.action.disable(tabId);
    chrome.action.setTitle({ tabId: tabId, title: '当前网站不支持此扩展' });
  }
}

// 检查URL是否受支持
function isSupportedUrl(url) {
  try {
    // 使用平台注册表检查URL
    return !!platformRegistry.getPlatformForUrl(url);
  } catch (e) {
    console.error('Error checking URL support:', e);
    
    // 回退到传统的URL检查
    return url.includes('chat.openai.com') || 
      url.includes('chatgpt.com') || 
      url.includes('claude.ai') || 
      url.includes('gemini.google.com') || 
      url.includes('bard.google.com') ||
      url.includes('grok.x.ai') ||
      url.includes('x.ai/grok') ||
      url.includes('chat.deepseek.com') ||
      url.includes('tongyi.com') ||
      url.includes('tongyi.aliyun.com') ||
      url.includes('qianwen.aliyun.com') ||
      url.includes('doubao.com');
  }
} 