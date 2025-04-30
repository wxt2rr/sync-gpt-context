// This file exports the platformRegistry for direct access by content scripts
// It creates a global window object that can be accessed by the content script

// Import platform classes
import platformRegistry from './index.js';
import ChatGPTPlatform from './chatgpt.js';
import ClaudePlatform from './claude.js';
import GeminiPlatform from './gemini.js';
import GrokPlatform from './grok.js';
import DeepSeekPlatform from './deepseek.js';
import TongyiPlatform from './tongyi.js';
import DoubaoPlatform from './doubao.js';

// 将platformRegistry导出，确保在window上可用
console.log('Exporting platform registry to window object...');

// 创建一个安全的TongyiPlatform包装器，确保可以安全实例化
const SafeTongyiPlatform = function() {
  try {
    // First check if we have access to the class
    if (typeof TongyiPlatform !== 'function') {
      throw new Error('TongyiPlatform class is not available');
    }
    
    // Try creating a new instance
    try {
      return new TongyiPlatform();
    } catch (instantiationError) {
      console.error('Error instantiating TongyiPlatform:', instantiationError);
      // Return a minimal viable platform object with fallback implementations
      return createFallbackPlatform('tongyi');
    }
  } catch (error) {
    console.error('Error in SafeTongyiPlatform:', error);
    return createFallbackPlatform('tongyi');
  }
};

// Helper function to create a fallback platform object
function createFallbackPlatform(platformId) {
  console.log(`Creating fallback platform for ${platformId}`);
  return {
    fallbackMode: true,
    extractTitle: function() { 
      return platformId === 'tongyi' ? '通义千问对话' : 'AI对话'; 
    },
    extractContext: async function() { 
      return [{
        role: 'assistant',
        content: `${platformId}平台加载出现问题，无法提取上下文。请尝试刷新页面或重新加载扩展。`
      }]; 
    },
    restoreContext: async function() { 
      console.log(`Using fallback restoreContext for ${platformId}`);
      return false; 
    }
  };
}

// 确保平台类在全局可用
try {
  // 直接将平台类暴露给window对象
  window.ChatGPTPlatform = ChatGPTPlatform;
  window.ClaudePlatform = ClaudePlatform;
  window.GeminiPlatform = GeminiPlatform;
  window.GrokPlatform = GrokPlatform;
  window.DeepSeekPlatform = DeepSeekPlatform;
  window.TongyiPlatform = TongyiPlatform;
  window.DoubaoPlatform = DoubaoPlatform;
  
  console.log('Platform classes exported to window successfully');
} catch (error) {
  console.error('Failed to export platform classes to window:', error);
}

// 在window上创建platform registry对象
try {
  // 创建一个完全自包含的registry对象
  window.platformRegistry = {
    // 将所有平台类添加到platforms属性中
    platforms: {
      ChatGPT: ChatGPTPlatform,
      Claude: ClaudePlatform,
      Gemini: GeminiPlatform,
      Grok: GrokPlatform,
      DeepSeek: DeepSeekPlatform,
      Tongyi: TongyiPlatform, 
      Doubao: DoubaoPlatform
    },
    
    // 实现所有必要的方法
    getPlatformForUrl: function(url) {
      console.log('Registry: getPlatformForUrl called for', url);
      
      // 遍历所有平台类，检查是否匹配URL
      for (const PlatformClass of Object.values(this.platforms)) {
        try {
          if (PlatformClass.matchesUrl && PlatformClass.matchesUrl(url)) {
            console.log('Platform match found for URL:', PlatformClass.id || PlatformClass.name);
            
            // 使用安全包装器处理通义平台
            if (PlatformClass.id === 'tongyi' || PlatformClass === TongyiPlatform) {
              return SafeTongyiPlatform();
            }
            
            return new PlatformClass();
          }
        } catch (e) {
          console.error('Error checking URL match for platform:', e);
        }
      }
      console.log('No platform found for URL');
      return null;
    },
    
    getPlatformById: function(id) {
      console.log('Registry: getPlatformById called for', id);
      
      try {
        // 创建ID到平台类的映射
        const idMap = {
          'chatgpt': this.platforms.ChatGPT,
          'claude': this.platforms.Claude,
          'gemini': this.platforms.Gemini,
          'grok': this.platforms.Grok,
          'deepseek': this.platforms.DeepSeek,
          'tongyi': this.platforms.Tongyi,
          'doubao': this.platforms.Doubao
        };
        
        const PlatformClass = idMap[id];
        if (PlatformClass) {
          console.log('Platform class found for ID:', id);
          
          // 对通义平台进行特殊处理
          if (id === 'tongyi') {
            console.log('Using safe wrapper for tongyi platform');
            return SafeTongyiPlatform();
          }
          
          // 确保平台类存在且可以被实例化
          if (typeof PlatformClass === 'function') {
            console.log('Creating new instance of platform:', id);
            try {
              const instance = new PlatformClass();
              console.log('Successfully created platform instance for:', id);
              return instance;
            } catch (error) {
              console.error('Error instantiating platform class:', error);
              
              // 尝试直接从原始导入创建实例
              if (id === 'tongyi') {
                console.log('Trying direct instantiation of TongyiPlatform');
                return SafeTongyiPlatform();
              }
            }
          } else {
            console.error('Platform class is not a constructor:', typeof PlatformClass);
          }
        }
        
        console.log('No platform found for ID:', id);
        return null;
      } catch (error) {
        console.error('Error in getPlatformById:', error);
        return null;
      }
    },
    
    getAllPlatformIds: function() {
      return ['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'tongyi', 'doubao'];
    }
  };
  
  console.log('platformRegistry created on window with methods:', 
             Object.keys(window.platformRegistry).filter(k => typeof window.platformRegistry[k] === 'function').join(', '));
} catch (error) {
  console.error('Failed to create platformRegistry on window:', error);
}

// Export for module usage
export { 
  platformRegistry as default,
  ChatGPTPlatform,
  ClaudePlatform,
  GeminiPlatform,
  GrokPlatform,
  DeepSeekPlatform,
  TongyiPlatform,
  DoubaoPlatform
}; 