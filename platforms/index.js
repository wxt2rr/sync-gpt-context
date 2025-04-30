import platformRegistry from './registry.js';
import ChatGPTPlatform from './chatgpt.js';
import ClaudePlatform from './claude.js';
import GeminiPlatform from './gemini.js';
import GrokPlatform from './grok.js';
import DeepSeekPlatform from './deepseek.js';
import TongyiPlatform from './tongyi.js';
import DoubaoPlatform from './doubao.js';

// Register all platform strategies
platformRegistry.register(ChatGPTPlatform);
platformRegistry.register(ClaudePlatform);
platformRegistry.register(GeminiPlatform);
platformRegistry.register(GrokPlatform);
platformRegistry.register(DeepSeekPlatform);
platformRegistry.register(TongyiPlatform);
platformRegistry.register(DoubaoPlatform);

// Export the registry for use in content script
export default platformRegistry;

// Export platform classes for direct use if needed
export { 
  ChatGPTPlatform,
  ClaudePlatform,
  GeminiPlatform,
  GrokPlatform,
  DeepSeekPlatform,
  TongyiPlatform,
  DoubaoPlatform
}; 