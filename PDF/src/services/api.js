// API service for communicating with Flask backend
const API_BASE_URL = 'http://localhost:5000/api';
const OCR_API_BASE_URL = 'http://localhost:5001/api/ocr';

export const mathVideoAPI = {
  // Generate video from selected text
  generateVideo: async (selectedText, options = {}) => {
    try {
      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: selectedText,
          difficulty: options.difficulty || 'intermediate',
          duration: options.duration || 45,
          quality: options.quality || 'medium_quality'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error generating video:', error);
      throw error;
    }
  },

  // Check generation status
  checkStatus: async (taskId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/status/${taskId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking status:', error);
      throw error;
    }
  },

  // Download video
  downloadVideo: (videoPath) => {
    const downloadUrl = `${API_BASE_URL}/download/${encodeURIComponent(videoPath)}`;
    window.open(downloadUrl, '_blank');
  },

  // Check if backend is properly set up
  checkSetup: async () => {
    try {
      // Check OCR backend since that's what we're actually using
      const response = await fetch(`${OCR_API_BASE_URL}/health`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking setup:', error);
      return { status: 'error', message: 'Backend unavailable' };
    }
  },

  // List all generated videos
  listVideos: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/videos`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error listing videos:', error);
      return [];
    }
  }
};

export const ocrAPI = {
  // Extract mathematical content from image data
  extractContent: async (imageData, preprocessingLevel = 'moderate') => {
    try {
      console.log('🚀 API Service: Sending extraction request', {
        endpoint: `${OCR_API_BASE_URL}/extract`,
        imageDataLength: imageData?.length || 0,
        preprocessingLevel,
        imageDataValid: !!imageData && imageData.startsWith('data:image/'),
        imageDataPreview: imageData?.substring(0, 50) + '...'
      });
      
      // Prepare the request payload
      const requestPayload = {
        image_data: imageData,
        preprocessing_level: preprocessingLevel
      };
      
      console.log('📋 Request payload:', {
        payloadSize: JSON.stringify(requestPayload).length,
        hasImageData: !!requestPayload.image_data,
        preprocessingLevel: requestPayload.preprocessing_level
      });
      
      const response = await fetch(`${OCR_API_BASE_URL}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
      });

      console.log('📡 API Service: Received response', {
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ API Service: Parsed JSON response', {
        success: data.success,
        hasFormulas: Array.isArray(data.formulas) && data.formulas.length > 0,
        hasText: Array.isArray(data.text_content) && data.text_content.length > 0,
        formulasCount: Array.isArray(data.formulas) ? data.formulas.length : 0,
        textCount: Array.isArray(data.text_content) ? data.text_content.length : 0,
        message: data.message || 'No message',
        rawResultLength: data.raw_result?.length || 0
      });
      
      // Log the actual response for debugging
      console.log('🔍 Full API Response:', data);
      
      return data;
    } catch (error) {
      console.error('💥 API Service Error:', error);
      throw error;
    }
  },

  // Check OCR system status
  checkStatus: async () => {
    try {
      const response = await fetch(`${OCR_API_BASE_URL}/status`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking OCR status:', error);
      return { status: 'error', message: 'OCR backend unavailable' };
    }
  }
};