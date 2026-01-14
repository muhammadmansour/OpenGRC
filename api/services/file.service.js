/**
 * File Service
 * Handles file upload, processing, and management
 */

const config = require('../config');
const authService = require('./auth.service');

class FileService {
  /**
   * Validate file before upload
   */
  validateFile(fileName, fileSize) {
    // Check file size
    if (fileSize > config.maxFileSizeBytes) {
      return {
        valid: false,
        error: `File size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum limit of 100MB`
      };
    }
    
    // Check file extension
    const fileExtension = fileName.toLowerCase().split('.').pop();
    if (!config.allowedFileExtensions.includes(fileExtension)) {
      return {
        valid: false,
        error: `File type '${fileExtension}' is not supported. Allowed: ${config.allowedFileExtensions.join(', ')}`
      };
    }
    
    return { valid: true };
  }

  /**
   * Generate upload URL for file
   */
  async generateUploadUrl(fileName, fileSize, contentType, collectionId) {
    const targetCollectionId = collectionId || config.defaultCollectionId;

    console.log('Generating file upload URL...', { fileName, fileSize, collectionId: targetCollectionId });

    const params = new URLSearchParams();
    params.append('file_name', fileName);
    params.append('file_size', fileSize.toString());
    params.append('collection_id', targetCollectionId);

    const response = await authService.makeAuthenticatedRequest(
      `${config.llmApiUrl}/v1/generate-file-upload-url`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate upload URL: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Upload URL generated successfully:', { documentId: result.document?.id });

    return result;
  }

  /**
   * Process uploaded file
   */
  async processFile(fileId) {
    console.log('Processing file with ID:', fileId);

    const response = await authService.makeAuthenticatedRequest(
      `${config.llmApiUrl}/v1/process-file?file_id=${fileId}`,
      { method: 'POST' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to process file: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('File processed successfully:', result);
    return result;
  }

  /**
   * Get file status
   */
  async getFileStatus(fileId) {
    console.log('Getting file status for ID:', fileId);

    const response = await authService.makeAuthenticatedRequest(
      `${config.llmApiUrl}/v1/get-file?file_id=${fileId}&return_raw_text=false&return_formatted_markdown_pages=false&return_formatted_html_pages=false`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get file status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('File status:', { fileId, status: result.status });
    return result;
  }

  /**
   * Wait for file to be ready
   */
  async waitForFileReady(fileId, onProgress) {
    const maxAttempts = 120;
    let attempts = 0;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;

    console.log(`🔄 Starting file processing wait for fileId: ${fileId}`);

    while (attempts < maxAttempts) {
      try {
        const fileStatus = await this.getFileStatus(fileId);
        consecutiveErrors = 0;

        const progress = Math.min(90 + (attempts / maxAttempts) * 9, 99);
        
        if (onProgress) {
          let stage = 'Processing';
          if (attempts < 10) stage = 'Analyzing content';
          else if (attempts < 30) stage = 'Processing data';
          else if (attempts < 60) stage = 'Training model';
          else stage = 'Optimizing';
          
          onProgress(progress, stage);
        }

        if (fileStatus.status === 'Ready') {
          console.log(`✅ File is ready after ${attempts + 1} attempts`);
          if (onProgress) onProgress(100, 'Complete');
          return fileStatus;
        }

        if (fileStatus.status === 'Failed' || fileStatus.status === 'Error') {
          const failureDetails = fileStatus.error_details || fileStatus.message || 'Unknown error';
          throw new Error(`File processing failed: ${fileStatus.status} - ${failureDetails}`);
        }

        console.log(`📊 File status: ${fileStatus.status}, attempt ${attempts + 1}/${maxAttempts}`);

        const waitTime = attempts < 20 ? 3000 : attempts < 60 ? 5000 : 7000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        attempts++;
      } catch (error) {
        console.error(`⚠️ Error checking file status (attempt ${attempts + 1}):`, error.message);
        consecutiveErrors++;
        attempts++;

        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(`File processing failed - too many consecutive errors: ${error.message}`);
        }

        const errorWaitTime = Math.min(consecutiveErrors * 2000, 10000);
        await new Promise(resolve => setTimeout(resolve, errorWaitTime));
      }
    }

    throw new Error('File processing timeout - file did not become ready within 10 minutes');
  }

  /**
   * List files by collection ID
   */
  async listFilesByCollectionId(collectionId, page = 1, pageSize = 100, orderBy = 'updated_at', orderDirection = 'desc') {
    const queryParams = new URLSearchParams();
    queryParams.append('collection_id', collectionId);
    queryParams.append('page', page.toString());
    queryParams.append('page_size', pageSize.toString());
    queryParams.append('order_by', orderBy);
    queryParams.append('order_direction', orderDirection);
    queryParams.append('return_file_urls', 'true');

    console.log('📋 Listing files for collection:', { collectionId, page, pageSize });

    const response = await authService.makeAuthenticatedRequest(
      `${config.llmApiUrl}/v1/list-files-by-collection-id?${queryParams.toString()}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list files: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // Handle different response structures
    if (result.files && Array.isArray(result.files)) {
      return result;
    } else if (result.items && Array.isArray(result.items)) {
      return { files: result.items, total: result.total || result.items.length, page: result.page || 1, page_size: result.page_size || result.items.length };
    } else if (result.data && Array.isArray(result.data)) {
      return { files: result.data, total: result.total || result.data.length, page: result.page || 1, page_size: result.page_size || result.data.length };
    } else if (Array.isArray(result)) {
      return { files: result, total: result.length, page: 1, page_size: result.length };
    }
    
    return result;
  }

  /**
   * Get file info
   */
  async getFile(fileId) {
    console.log('Getting file info:', { fileId });

    const response = await authService.makeAuthenticatedRequest(
      `${config.llmApiUrl}/v1/get-file/${fileId}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get file: ${response.status}`);
    }

    return await response.json();
  }
}

// Singleton instance
const fileService = new FileService();

module.exports = fileService;
