/**
 * PlatformRegistry - Manages all AI platform strategies
 */
class PlatformRegistry {
  constructor() {
    this.platforms = [];
  }

  /**
   * Register a platform strategy
   * @param {class} PlatformClass - The platform strategy class to register
   */
  register(PlatformClass) {
    this.platforms.push(PlatformClass);
  }

  /**
   * Get the appropriate platform strategy for the current URL
   * @param {string} url - The URL to match
   * @returns {BasePlatform|null} - An instance of the matched platform or null
   */
  getPlatformForUrl(url) {
    if (!url) return null;
    
    for (const PlatformClass of this.platforms) {
      try {
        if (PlatformClass.matchesUrl && PlatformClass.matchesUrl(url)) {
          try {
            console.log(`Creating platform instance for: ${PlatformClass.id || PlatformClass.name}`);
            return new PlatformClass();
          } catch (instantiationError) {
            console.error(`Error instantiating platform for ${PlatformClass.id || PlatformClass.name}:`, instantiationError);
            // Create a fallback platform instance
            return this._createFallbackPlatform(PlatformClass.id || 'unknown');
          }
        }
      } catch (matchError) {
        console.error(`Error checking URL match for platform:`, matchError);
      }
    }
    return null;
  }

  /**
   * Get a platform by its ID
   * @param {string} platformId - The platform identifier
   * @returns {BasePlatform|null} - An instance of the platform or null
   */
  getPlatformById(platformId) {
    for (const PlatformClass of this.platforms) {
      try {
        if (PlatformClass.id === platformId) {
          try {
            console.log(`Creating platform instance for ID: ${platformId}`);
            return new PlatformClass();
          } catch (instantiationError) {
            console.error(`Error instantiating platform for ID ${platformId}:`, instantiationError);
            // Create a fallback platform instance
            return this._createFallbackPlatform(platformId);
          }
        }
      } catch (error) {
        console.error(`Error checking platform ID:`, error);
      }
    }
    return null;
  }

  /**
   * Get all registered platform IDs
   * @returns {Array<string>} - Array of platform IDs
   */
  getAllPlatformIds() {
    try {
      return this.platforms.map(PlatformClass => PlatformClass.id).filter(Boolean);
    } catch (error) {
      console.error('Error getting platform IDs:', error);
      return [];
    }
  }
  
  /**
   * Create a fallback platform for when instantiation fails
   * @private
   * @param {string} platformId - The platform ID
   * @returns {Object} - A minimal viable platform object
   */
  _createFallbackPlatform(platformId) {
    console.log(`Creating fallback platform for ${platformId}`);
    return {
      fallbackMode: true,
      extractTitle: function() { 
        if (platformId === 'tongyi') return '通义千问对话';
        if (platformId === 'chatgpt') return 'ChatGPT对话';
        if (platformId === 'claude') return 'Claude对话';
        if (platformId === 'gemini') return 'Gemini对话';
        if (platformId === 'grok') return 'Grok对话';
        if (platformId === 'deepseek') return 'DeepSeek对话';
        if (platformId === 'doubao') return '豆包对话';
        return 'AI对话';
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
}

// Create and export a singleton instance
const platformRegistry = new PlatformRegistry();
export default platformRegistry; 