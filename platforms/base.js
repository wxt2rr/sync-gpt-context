/**
 * BasePlatform - Abstract base class for all AI platform strategies
 */
class BasePlatform {
  constructor() {
    console.log('BasePlatform constructor called');
    // Set base properties that all platforms should have
    this.fallbackMode = false;
    this.initialized = true;
  }

  /**
   * Extract the chat title from the current page
   * @returns {string} - The extracted title
   */
  extractTitle() {
    console.warn('Method extractTitle() not implemented');
    return 'AI对话';
  }

  /**
   * Extract the chat context from the current page
   * @returns {Promise<Array>} - Array of message objects
   */
  async extractContext() {
    console.warn('Method extractContext() not implemented');
    return [];
  }

  /**
   * Restore saved context to this platform
   * @param {Array} context - The context to restore
   * @param {string} sourcePlatform - Platform the context was saved from
   * @returns {Promise<boolean>} - True if successful
   */
  async restoreContext(context, sourcePlatform) {
    console.warn('Method restoreContext() not implemented');
    return false;
  }

  /**
   * Check if the current URL matches this platform
   * @param {string} url - The URL to check
   * @returns {boolean} - True if the URL belongs to this platform
   */
  static matchesUrl(url) {
    console.warn('Static method matchesUrl() not implemented');
    return false;
  }
  
  /**
   * Check if this platform is in fallback mode
   * @returns {boolean} - True if in fallback mode
   */
  isFallback() {
    return this.fallbackMode === true;
  }
}

export default BasePlatform; 