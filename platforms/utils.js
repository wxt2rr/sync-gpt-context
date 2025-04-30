/**
 * Utility functions for AI platform strategies
 */

/**
 * Attempt to upload an image to the platform
 * @param {HTMLElement} imageUploadButton - The upload button element
 * @param {string} imageUrl - URL of the image to upload
 * @returns {Promise<boolean>} - True if successful
 */
export async function tryUploadImage(imageUploadButton, imageUrl) {
  try {
    if (!imageUploadButton || !imageUrl) {
      console.log('Missing upload button or image URL');
      return false;
    }
    
    console.log('Attempting to upload image:', imageUrl);
    
    // 尝试获取图片数据
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error('Failed to fetch image:', response.status);
      return false;
    }
    
    const blob = await response.blob();
    
    // 创建文件对象
    const file = new File([blob], 'image.jpg', { type: blob.type });
    
    // 创建dataTransfer对象
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    
    // 创建自定义change事件
    const fileList = dataTransfer.files;
    const event = new Event('change', { bubbles: true });
    
    // 找到文件输入元素
    let fileInput = imageUploadButton.querySelector('input[type="file"]');
    
    // 如果按钮本身就是输入元素
    if (imageUploadButton.tagName === 'INPUT' && imageUploadButton.type === 'file') {
      fileInput = imageUploadButton;
    }
    
    // 如果找不到输入元素，尝试点击按钮触发文件选择器
    if (!fileInput) {
      console.log('No file input found, clicking button to trigger file selector');
      imageUploadButton.click();
      return false;
    }
    
    // 设置文件并触发事件
    Object.defineProperty(fileInput, 'files', {
      value: fileList,
      writable: false
    });
    
    fileInput.dispatchEvent(event);
    console.log('Image upload event dispatched');
    return true;
  } catch (error) {
    console.error('Error uploading image:', error);
    return false;
  }
}

/**
 * Capitalize the first letter of a string
 * @param {string} string - The input string
 * @returns {string} - The capitalized string
 */
export function capitalizeFirstLetter(string) {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Safely inherit from BasePlatform when constructing platform classes.
 * Handles issues with ES modules and 'new' requirement for class constructors.
 * 
 * @param {Object} instance - The instance ('this') of the inheriting class
 * @param {Function} BasePlatform - The BasePlatform class to inherit from
 * @param {string} className - Name of the class for logging purposes
 * @returns {boolean} - True if inheritance was successful, false otherwise
 */
export function safeInherit(instance, BasePlatform, className) {
  try {
    if (typeof BasePlatform === 'function') {
      // Inherit prototype methods
      Object.setPrototypeOf(Object.getPrototypeOf(instance), BasePlatform.prototype);
      
      // Safely call BasePlatform constructor 
      const baseInstance = new BasePlatform();
      
      // Copy properties from baseInstance to this instance
      Object.getOwnPropertyNames(baseInstance).forEach(prop => {
        instance[prop] = baseInstance[prop];
      });
      
      console.log(`${className} constructor with BasePlatform called successfully`);
      return true;
    } else {
      console.warn(`BasePlatform not available for ${className}, using standalone implementation`);
      instance.fallbackMode = true;
      return false;
    }
  } catch (error) {
    console.error(`Error in ${className} inheriting from BasePlatform:`, error);
    instance.fallbackMode = true;
    return false;
  }
}

/**
 * Generic input handler for text input elements
 * @param {HTMLElement} inputElement - The input element
 * @param {string} adaptedContext - The text to input
 * @param {string} sourcePlatform - Source platform ID
 * @returns {Promise<boolean>} - True if successful
 */
export async function handleGenericInput(inputElement, adaptedContext, sourcePlatform) {
  return new Promise((resolve) => {
    if (!inputElement) {
      console.error('Input element not found');
      resolve(false);
      return;
    }
    
    try {
      // 尝试聚焦输入框
      inputElement.focus();
      
      // 使用execCommand输入文本
      document.execCommand('insertText', false, adaptedContext);
      
      // 如果execCommand不可用，尝试设置value或innerText
      if (!inputElement.value && !inputElement.innerText) {
        if ('value' in inputElement) {
          inputElement.value = adaptedContext;
        } else {
          inputElement.innerText = adaptedContext;
        }
        
        // 模拟输入事件
        const inputEvent = new Event('input', { bubbles: true });
        inputElement.dispatchEvent(inputEvent);
      }
      
      console.log('Text input successful');
      resolve(true);
    } catch (error) {
      console.error('Error handling input:', error);
      resolve(false);
    }
  });
} 