import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import Toolbar from './Toolbar';
import FloatingButton from './FloatingButton';
import VideoPlayer from './VideoPlayer';
import ExplanationViewer from './ExplanationViewer';
import LoadingModal from './LoadingModal';
import OCRSelectionOverlay from './OCRSelectionOverlay';
import OCRResultsSidebar from './OCRResultsSidebar';
import { mathVideoAPI, ocrAPI } from '../services/api';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const PdfViewer = () => {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [file, setFile] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  
  // PDF Loading and Caching states
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadedPages, setLoadedPages] = useState(new Set());
  const [pageCache, setPageCache] = useState(new Map());
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Video generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationMessage, setGenerationMessage] = useState('');
  const [currentTaskId, setCurrentTaskId] = useState(null);
  
  // Video display states
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');
  const [currentVideoTitle, setCurrentVideoTitle] = useState('');
  
  // Explanation display states
  const [showExplanationViewer, setShowExplanationViewer] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState('');
  const [currentExplanationTitle, setCurrentExplanationTitle] = useState('');
  
  // Backend status
  const [backendStatus, setBackendStatus] = useState('checking');
  
  // OCR functionality states
  const [ocrMode, setOcrMode] = useState(false);
  const [ocrResults, setOcrResults] = useState(null);
  const [showOcrSidebar, setShowOcrSidebar] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrBackendStatus, setOcrBackendStatus] = useState('checking');
  
  const containerRef = useRef(null);

  const onDocumentLoadSuccess = ({ numPages }) => {
    console.log(`📚 PDF loaded successfully! ${numPages} pages found.`);
    setNumPages(numPages);
    setError(null); // Clear any previous errors
    
    // Check memory usage and warn for large PDFs
    const memInfo = checkMemoryUsage();
    
    // Warn about very large PDFs
    if (numPages > 100) {
      setWarningMessage(`Large PDF detected (${numPages} pages). Loading may take time and use significant memory.`);
    }
    
    // Suggest alternatives for extremely large PDFs
    if (numPages > 500) {
      setWarningMessage(`Very large PDF (${numPages} pages). Consider using "Skip & View Now" for better performance.`);
    }
    
    // Start preloading all pages immediately
    try {
      preloadAllPages(numPages);
    } catch (error) {
      handlePdfError(error, 'Page preloading');
    }
  };
  
  const onDocumentLoadError = (error) => {
    console.error('📄 PDF load error:', error);
    handlePdfError(error, 'PDF document loading');
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      // Reset loading states
      setIsLoadingPdf(true);
      setLoadingProgress(0);
      setLoadedPages(new Set());
      setPageCache(new Map());
      setLoadingMessage('Loading PDF document...');
      
      setFile(selectedFile);
    }
  };

  // Track page loading promises and performance metrics
  const pageLoadPromises = useRef(new Map());
  const pageLoadStartTime = useRef(null);
  const [loadingStats, setLoadingStats] = useState({ startTime: null, pagesLoaded: 0, totalPages: 0 });
  
  // Error handling states
  const [error, setError] = useState(null);
  const [warningMessage, setWarningMessage] = useState('');
  const [memoryWarning, setMemoryWarning] = useState(false);
  
  // Handle individual page load success with performance tracking
  const handlePageLoadSuccess = useCallback((pageNumber) => {
    console.log(`📄 Page ${pageNumber} rendered successfully`);
    
    // Update loaded pages and progress
    setLoadedPages(prev => {
      const newSet = new Set(prev);
      newSet.add(pageNumber);
      
      // Update progress if we're in loading mode
      if (isLoadingPdf && numPages) {
        const progress = Math.round((newSet.size / numPages) * 100);
        setLoadingProgress(progress);
        setLoadingMessage(`Rendering pages... ${newSet.size}/${numPages} (${progress}%)`);
        
        // Update loading stats
        setLoadingStats(prev => ({ ...prev, pagesLoaded: newSet.size }));
        
        // Check if all pages are loaded
        if (newSet.size === numPages) {
          const loadTime = Date.now() - (pageLoadStartTime.current || Date.now());
          console.log(`✅ All ${numPages} pages rendered in ${loadTime}ms! (${(loadTime/numPages).toFixed(1)}ms/page)`);
          
          // Complete loading with brief delay to show 100%
          setTimeout(() => {
            setIsLoadingPdf(false);
            setLoadingMessage(`All pages ready! (${(loadTime/1000).toFixed(1)}s total)`);
            setTimeout(() => setLoadingMessage(''), 2500);
          }, 200);
        }
      }
      
      return newSet;
    });
    
    // Update page cache with performance data
    setPageCache(prev => {
      const newCache = new Map(prev);
      newCache.set(pageNumber, { 
        loaded: true, 
        timestamp: Date.now(),
        renderTime: Date.now() - (pageLoadStartTime.current || Date.now())
      });
      return newCache;
    });
    
    // Resolve page loading promise if exists
    if (pageLoadPromises.current.has(pageNumber)) {
      const resolve = pageLoadPromises.current.get(pageNumber);
      resolve(pageNumber);
      pageLoadPromises.current.delete(pageNumber);
    }
  }, [isLoadingPdf, numPages]);
  
  // Memory monitoring and error handling
  const checkMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memInfo = performance.memory;
      const usedMB = Math.round(memInfo.usedJSHeapSize / 1024 / 1024);
      const limitMB = Math.round(memInfo.jsHeapSizeLimit / 1024 / 1024);
      const usage = (usedMB / limitMB) * 100;
      
      console.log(`🧠 Memory Usage: ${usedMB}MB / ${limitMB}MB (${usage.toFixed(1)}%)`);
      
      if (usage > 80) {
        setMemoryWarning(true);
        setWarningMessage(`High memory usage: ${usage.toFixed(1)}%. Consider reducing PDF size or page count.`);
      } else if (usage > 60) {
        setWarningMessage(`Memory usage: ${usage.toFixed(1)}%. Performance may be affected with large PDFs.`);
      }
      
      return { usedMB, limitMB, usage };
    }
    return null;
  }, []);
  
  // Enhanced error handling for PDF operations
  const handlePdfError = useCallback((error, context = 'PDF operation') => {
    console.error(`❌ ${context} failed:`, error);
    
    let errorMessage = 'An unexpected error occurred.';
    let suggestions = [];
    
    if (error.name === 'InvalidPDFException') {
      errorMessage = 'Invalid or corrupted PDF file.';
      suggestions = [
        'Try a different PDF file',
        'Ensure the PDF is not password-protected',
        'Check if the file downloaded completely'
      ];
    } else if (error.name === 'MissingPDFException') {
      errorMessage = 'PDF file could not be loaded.';
      suggestions = [
        'Check your internet connection',
        'Verify the file path is correct',
        'Try uploading the file again'
      ];
    } else if (error.message?.includes('memory') || error.name === 'RangeError') {
      errorMessage = 'PDF is too large for available memory.';
      suggestions = [
        'Try a smaller PDF file',
        'Close other browser tabs to free memory',
        'Consider splitting the PDF into smaller parts',
        'Use the "Skip & View Now" option for faster loading'
      ];
      setMemoryWarning(true);
    } else if (error.name === 'UnexpectedResponseException') {
      errorMessage = 'Network error while loading PDF.';
      suggestions = [
        'Check your internet connection',
        'Try refreshing the page',
        'Upload the file locally instead'
      ];
    }
    
    setError({
      message: errorMessage,
      suggestions,
      timestamp: new Date().toISOString(),
      context
    });
  }, []);
  
  // Preload all PDF pages for instant display - uses actual page rendering events
  const preloadAllPages = async (totalPages) => {
    console.log(`🚀 Starting to preload ${totalPages} pages...`);
    pageLoadStartTime.current = Date.now();
    setIsLoadingPdf(true);
    setLoadingProgress(0);
    setLoadingMessage('Initializing page rendering...');
    
    // Initialize loading stats
    setLoadingStats({ startTime: Date.now(), pagesLoaded: 0, totalPages });
    
    // Clear previous state
    setLoadedPages(new Set());
    setPageCache(new Map());
    pageLoadPromises.current.clear();
    
    // Create promises that resolve when pages actually render
    const loadPromises = [];
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pagePromise = new Promise((resolve) => {
        pageLoadPromises.current.set(pageNum, resolve);
      });
      loadPromises.push(pagePromise);
    }
    
    try {
      setLoadingMessage(`Rendering ${totalPages} pages...`);
      
      // Add timeout fallback (45 seconds for very large PDFs)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Page loading timeout')), 45000);
      });
      
      // Wait for all pages to render or timeout
      await Promise.race([
        Promise.all(loadPromises),
        timeoutPromise
      ]);
      
    } catch (error) {
      console.error('❌ Error during page preloading:', error);
      const currentLoaded = loadedPages.size;
      setIsLoadingPdf(false);
      
      if (error.message === 'Page loading timeout') {
        setLoadingMessage(`Loaded ${currentLoaded}/${totalPages} pages. Others will load as needed.`);
      } else {
        setLoadingMessage('Loading error. Some pages may load slower.');
      }
      setTimeout(() => setLoadingMessage(''), 4000);
    }
  };

  const zoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.2, 3.0));
  };

  const zoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.2, 0.5));
  };

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    let selectedText = selection.toString().trim();
    
    // Fix spacing issues in selected text from PDF
    if (selectedText) {
      // Remove strange characters that might come from PDF parsing
      selectedText = selectedText.replace(/[♠♣♥♦]/g, ' ');
      // Add spaces before capital letters that follow lowercase letters
      selectedText = selectedText.replace(/([a-z])([A-Z])/g, '$1 $2');
      // Add spaces before numbers when they follow letters
      selectedText = selectedText.replace(/([a-zA-Z])(\d)/g, '$1 $2');
      // Add spaces after numbers when they're followed by letters
      selectedText = selectedText.replace(/(\d)([a-zA-Z])/g, '$1 $2');
      // Fix common mathematical terms that get concatenated
      selectedText = selectedText.replace(/([a-z])(cm|mm|m|kg|g|°|π)/g, '$1 $2');
      selectedText = selectedText.replace(/(cm|mm|m|kg|g|°|π)([a-zA-Z])/g, '$1 $2');
      // Add space before "and", "of", "the", "is", "to", etc. when they're concatenated
      selectedText = selectedText.replace(/([a-z])(and|of|the|is|to|in|by|with|for)/g, '$1 $2');
      // Clean up multiple spaces and trim
      selectedText = selectedText.replace(/\s+/g, ' ').trim();
    }
    
    if (selectedText && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      if (rect.width > 0 && rect.height > 0) {
        setSelectedText(selectedText);
        // Use viewport coordinates (fixed positioning)
        setSelectionPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 60 // Position above the selection
        });
        setShowFloatingButton(true);
      }
    } else {
      setShowFloatingButton(false);
      setSelectedText('');
    }
  }, []);

  useEffect(() => {
    let selectionTimeout;
    
    const handleSelectionChange = () => {
      // Clear previous timeout
      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
      }
      
      // Debounce the selection handling
      selectionTimeout = setTimeout(() => {
        handleTextSelection();
      }, 100); // 100ms delay
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    
    // Also handle mouseup events on the PDF container for better responsiveness
    const handleMouseUp = () => {
      setTimeout(handleTextSelection, 50);
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (container) {
        container.removeEventListener('mouseup', handleMouseUp);
      }
      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
      }
    };
  }, [handleTextSelection]);

  // Check backend status on component mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const status = await mathVideoAPI.checkSetup();
        setBackendStatus(status.status === 'ok' ? 'ready' : 'error');
        
        if (status.status !== 'ok') {
          console.warn('Backend setup issue:', status.message);
        }
      } catch (error) {
        setBackendStatus('offline');
        console.error('Backend is offline:', error);
      }
    };
    
    const checkOcrBackend = async () => {
      try {
        const status = await ocrAPI.checkStatus();
        setOcrBackendStatus(status.status === 'ready' ? 'ready' : 'error');
        
        if (status.status !== 'ready') {
          console.warn('OCR backend setup issue:', status.message);
        }
      } catch (error) {
        setOcrBackendStatus('offline');
        console.error('OCR backend is offline:', error);
      }
    };
    
    checkBackend();
    checkOcrBackend();
  }, []);

  const handleVisualize = async (options = {}) => {
    if (!selectedText.trim()) return;
    
    console.log('Starting video generation for:', selectedText);
    
    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      setGenerationMessage('Initializing video generation...');
      
      // Clear selection and hide floating button
      window.getSelection().removeAllRanges();
      setShowFloatingButton(false);
      
      // Start video generation
      const response = await mathVideoAPI.generateVideo(selectedText, options);
      setCurrentTaskId(response.task_id);
      
      // Poll for status updates
      pollGenerationStatus(response.task_id);
      
    } catch (error) {
      console.error('Error starting video generation:', error);
      setIsGenerating(false);
      setGenerationMessage('Failed to start video generation');
      
      // Show error notification
      alert('Failed to start video generation. Please make sure the backend is running.');
    }
  };

  const pollGenerationStatus = async (taskId) => {
    try {
      const status = await mathVideoAPI.checkStatus(taskId);
      
      setGenerationProgress(status.progress || 0);
      setGenerationMessage(status.message || 'Processing...');
      
      if (status.status === 'completed' && status.video_path) {
        // Generation completed successfully
        setIsGenerating(false);
        
        // Check if it's a video file or explanation file
        if (status.video_path.endsWith('.mp4')) {
          // It's a video file
          setCurrentVideoUrl(`http://localhost:5000/api/download/${encodeURIComponent(status.video_path)}`);
          setCurrentVideoTitle(selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : ''));
          setShowVideoPlayer(true);
        } else if (status.video_path.endsWith('.json')) {
          // It's an explanation file
          try {
            const response = await fetch(`http://localhost:5000/api/download/${encodeURIComponent(status.video_path)}`);
            const explanationData = await response.json();
            setCurrentExplanation(explanationData.explanation);
            setCurrentExplanationTitle(explanationData.topic);
            setShowExplanationViewer(true);
          } catch (error) {
            console.error('Error loading explanation:', error);
            alert('Error loading explanation');
          }
        }
        setSelectedText('');
        
      } else if (status.status === 'failed') {
        // Generation failed
        setIsGenerating(false);
        alert('Generation failed: ' + status.message);
        
      } else if (status.status === 'generating') {
        // Still generating, continue polling
        setTimeout(() => pollGenerationStatus(taskId), 2000);
        
      } else {
        // Unknown status or not found
        setIsGenerating(false);
        alert('Unknown error occurred during generation');
      }
      
    } catch (error) {
      console.error('Error checking generation status:', error);
      setIsGenerating(false);
      alert('Error checking generation status');
    }
  };

  const handleCancelGeneration = () => {
    setIsGenerating(false);
    setCurrentTaskId(null);
    setGenerationProgress(0);
    setGenerationMessage('');
  };

  const handleContainerClick = (e) => {
    // If clicking outside of selected text, clear selection
    if (showFloatingButton && !e.target.closest('button')) {
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection.toString().trim()) {
          setShowFloatingButton(false);
          setSelectedText('');
        }
      }, 10);
    }
  };

  const getCurrentPageNumber = () => {
    if (!containerRef.current || !numPages) return 1;
    
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    
    // Estimate which page is currently visible based on scroll position
    const pageHeight = containerHeight / scale;
    const currentPage = Math.floor(scrollTop / pageHeight) + 1;
    
    return Math.min(Math.max(currentPage, 1), numPages);
  };

  // OCR functionality states
  const [lastSelectionData, setLastSelectionData] = useState(null);

  // OCR functionality
  const toggleOcrMode = () => {
    console.log('🔄 OCR Mode Toggle:', !ocrMode ? 'ENABLING' : 'DISABLING');
    setOcrMode(!ocrMode);
    if (ocrMode) {
      // Exiting OCR mode
      setShowOcrSidebar(false);
      setOcrResults(null);
      setLastSelectionData(null);
      console.log('❌ OCR Mode DISABLED');
    } else {
      console.log('✅ OCR Mode ENABLED - Overlay should be visible');
    }
  };

  const performOcrExtraction = async (selectionData, preprocessingLevel = 'moderate') => {
    console.log('🔍 Starting OCR extraction...', {
      hasImageData: !!selectionData?.imageData,
      preprocessingLevel,
      selectionCoords: selectionData?.coordinates,
      currentStates: {
        ocrMode,
        showOcrSidebar,
        ocrLoading
      }
    });
    
    if (!selectionData.imageData) {
      console.error('❌ No image data provided to OCR extraction');
      return;
    }
    
    // Disable OCR overlay when processing starts
    console.log('🚫 Setting states: ocrMode=false, ocrLoading=true, showOcrSidebar=true');
    setOcrMode(false);
    setOcrLoading(true);
    setShowOcrSidebar(true);
    
    // Verify states were set
    setTimeout(() => {
      console.log('⏱️ State check after 100ms:', {
        ocrMode: document.querySelector('[data-ocr-mode]')?.dataset.ocrMode,
        sidebarVisible: document.querySelector('[data-sidebar-visible]')?.dataset.sidebarVisible,
        loadingVisible: document.querySelector('[data-loading-visible]')?.dataset.loadingVisible
      });
    }, 100);
    
    try {
      console.log('📡 Sending request to OCR API...');
      const results = await ocrAPI.extractContent(selectionData.imageData, preprocessingLevel);
      console.log('📥 OCR API Response:', results);
      
      // Always set results regardless of success status
      console.log('📋 Setting OCR results in state...');
      setOcrResults(results);
      
      if (results.success) {
        console.log('✅ OCR extraction successful:', {
          formulas: results.formulas?.length || 0,
          textBlocks: results.text_content?.length || 0,
          sidebarVisible: true
        });
      } else {
        console.log('⚠️ OCR extraction completed but no content found:', results.message);
      }
    } catch (error) {
      console.error('💥 OCR API error:', error);
      setOcrResults({
        formulas: [],
        text_content: [],
        raw_result: `API Error: ${error.message}`,
        success: false
      });
    } finally {
      setOcrLoading(false);
    }
  };

  const handleOcrSelection = async (selectionData) => {
    console.log('🎯 handleOcrSelection called with:', {
      hasImageData: !!selectionData?.imageData,
      imageDataLength: selectionData?.imageData?.length,
      coordinates: selectionData?.coordinates,
      currentOcrMode: ocrMode,
      currentShowSidebar: showOcrSidebar
    });
    
    setLastSelectionData(selectionData);
    
    console.log('📞 About to call performOcrExtraction...');
    await performOcrExtraction(selectionData, 'moderate');
    console.log('✅ performOcrExtraction completed');
  };

  const handleOcrReprocess = async (preprocessingLevel) => {
    if (lastSelectionData) {
      await performOcrExtraction(lastSelectionData, preprocessingLevel);
    }
  };

  const closeOcrSidebar = () => {
    console.log('🚫 Closing OCR sidebar - disabling OCR mode');
    setShowOcrSidebar(false);
    setOcrResults(null);
    setOcrLoading(false);
    // Disable OCR mode when sidebar closes to return to normal PDF viewing
    setOcrMode(false);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Toolbar 
        onFileChange={handleFileChange}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        currentPage={getCurrentPageNumber()}
        totalPages={numPages || 0}
        scale={scale}
        backendStatus={backendStatus}
        ocrMode={ocrMode}
        onToggleOcr={toggleOcrMode}
        ocrBackendStatus={ocrBackendStatus}
      />
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-200 relative"
        style={{ scrollBehavior: 'smooth', position: 'relative' }}
        onClick={handleContainerClick}
      >
        {file ? (
          <>
            {/* Enhanced Loading Progress Overlay */}
            {isLoadingPdf && (
              <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center backdrop-blur-sm">
                <div className="bg-white p-8 rounded-xl shadow-2xl max-w-lg w-full mx-4 transform transition-all duration-300 scale-100">
                  <div className="text-center">
                    {/* Enhanced Loading Animation */}
                    <div className="relative mb-6">
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-100 border-t-blue-500 mx-auto"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-pulse text-blue-500 text-xl font-bold">📄</div>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-800 mb-3">Optimizing PDF for Fast Viewing</h3>
                    <p className="text-sm text-gray-600 mb-6">{loadingMessage}</p>
                    
                    {/* Enhanced Progress Bar */}
                    <div className="relative w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full transition-all duration-500 ease-out shadow-inner"
                        style={{ width: `${loadingProgress}%` }}
                      ></div>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs mb-4">
                      <span className="text-gray-600">{loadingProgress}% Complete</span>
                      {numPages && (
                        <span className="text-gray-500">
                          {loadedPages.size} / {numPages} pages
                        </span>
                      )}
                    </div>
                    
                    {/* Performance Stats in Modal */}
                    {loadingStats.startTime && (
                      <div className="text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded">
                        <div>⚡ Loading Time: {((Date.now() - loadingStats.startTime) / 1000).toFixed(1)}s</div>
                        {numPages > 0 && (
                          <div>📊 Avg Speed: {((Date.now() - loadingStats.startTime) / loadedPages.size / 1000).toFixed(2)}s/page</div>
                        )}
                      </div>
                    )}
                    
                    {/* Skip Loading Option */}
                    <div className="flex space-x-3 mt-6">
                      <button
                        onClick={() => {
                          console.log('⏭️ User skipped preloading');
                          setIsLoadingPdf(false);
                          setLoadingMessage('Preloading skipped. Pages will load as needed.');
                          setTimeout(() => setLoadingMessage(''), 2000);
                        }}
                        className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200 text-sm font-medium"
                      >
                        Skip & View Now
                      </button>
                      <button
                        onClick={() => {
                          console.log('⏹️ User cancelled loading');
                          setIsLoadingPdf(false);
                          setLoadingMessage('');
                          // Reset file to allow reselection
                          setFile(null);
                          setNumPages(0);
                          setLoadedPages(new Set());
                        }}
                        className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors duration-200 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                    
                    {/* Loading Tips */}
                    <div className="mt-4 text-xs text-gray-400 bg-blue-50 p-2 rounded">
                      💡 Tip: We're loading all pages for instant scrolling. Large PDFs may take a moment.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {loadingMessage && !isLoadingPdf && (
              <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-40">
                {loadingMessage}
              </div>
            )}
            
            {/* Error Display */}
            {error && (
              <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-50 border-2 border-red-200 rounded-xl p-6 shadow-2xl z-50 max-w-md mx-4">
                <div className="text-center">
                  <div className="text-red-500 text-5xl mb-3">🚨</div>
                  <h3 className="text-xl font-bold text-red-800 mb-2">PDF Loading Error</h3>
                  <p className="text-red-700 mb-4">{error.message}</p>
                  
                  {error.suggestions && error.suggestions.length > 0 && (
                    <div className="text-left bg-red-100 p-3 rounded-lg mb-4">
                      <div className="font-semibold text-red-800 mb-2">💡 Suggestions:</div>
                      <ul className="text-sm text-red-700 space-y-1">
                        {error.suggestions.map((suggestion, index) => (
                          <li key={index}>• {suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setError(null);
                        setFile(null);
                        setNumPages(0);
                      }}
                      className="flex-1 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                    >
                      Try Another File
                    </button>
                    <button
                      onClick={() => setError(null)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Warning Messages */}
            {warningMessage && !error && (
              <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 shadow-lg z-40 max-w-md">
                <div className="flex items-center">
                  <div className="text-yellow-500 mr-2">⚠️</div>
                  <div className="text-sm text-yellow-800">{warningMessage}</div>
                  <button
                    onClick={() => setWarningMessage('')}
                    className="ml-2 text-yellow-500 hover:text-yellow-700"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
            
            {/* Memory Warning */}
            {memoryWarning && (
              <div className="fixed bottom-4 right-4 bg-orange-50 border border-orange-200 rounded-lg p-3 shadow-lg z-40 max-w-xs">
                <div className="flex items-start">
                  <div className="text-orange-500 mr-2 mt-0.5">🧠</div>
                  <div className="text-sm text-orange-800">
                    <div className="font-semibold">High Memory Usage</div>
                    <div>Consider closing other tabs or using a smaller PDF.</div>
                    <button
                      onClick={() => setMemoryWarning(false)}
                      className="text-orange-600 hover:text-orange-800 text-xs mt-1"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Performance Stats (Show when PDF is loaded) */}
            {numPages && !isLoadingPdf && loadingStats.startTime && (
              <div className="fixed bottom-4 left-4 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-lg z-30 max-w-xs">
                <div className="text-xs text-blue-700">
                  <div className="font-semibold mb-1">📊 Performance Stats</div>
                  <div>Pages: {numPages}</div>
                  <div>Loaded: {loadedPages.size}</div>
                  {loadingStats.startTime && (
                    <div>
                      Load Time: {((Date.now() - loadingStats.startTime) / 1000).toFixed(1)}s
                    </div>
                  )}
                  <div>Scale: {(scale * 100).toFixed(0)}%</div>
                </div>
              </div>
            )}
            
            <div className="flex flex-col items-center py-4">
              <Document
                file={file}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                className="max-w-full"
                loading={
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span className="ml-3 text-gray-600">Initializing PDF...</span>
                  </div>
                }
                error={
                  <div className="flex items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-center">
                      <div className="text-red-500 text-4xl mb-2">⚠️</div>
                      <div className="text-red-700 font-semibold">Failed to load PDF</div>
                      <div className="text-red-600 text-sm mt-1">Please check the file and try again</div>
                    </div>
                  </div>
                }
              >
                {numPages && Array.from(new Array(numPages), (el, index) => {
                  const pageNum = index + 1;
                  const isPageLoaded = loadedPages.has(pageNum);
                  
                  return (
                    <div key={`page_${pageNum}`} className="mb-4 shadow-lg relative">
                      {!isPageLoaded && (
                        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10 rounded border border-gray-300">
                          <div className="text-center">
                            <div className="animate-pulse bg-gray-300 h-4 w-4 rounded-full mx-auto mb-2"></div>
                            <span className="text-sm text-gray-500">Loading Page {pageNum}...</span>
                          </div>
                        </div>
                      )}
                      
                      <Page 
                        pageNumber={pageNum}
                        scale={scale}
                        className={`border border-gray-300 bg-white transition-opacity duration-300 ${
                          isPageLoaded ? 'opacity-100' : 'opacity-50'
                        }`}
                        renderTextLayer={!ocrMode && isPageLoaded} // Only render text layer when loaded and not in OCR mode
                        renderAnnotationLayer={!ocrMode && isPageLoaded}
                        onLoadSuccess={() => handlePageLoadSuccess(pageNum)} // Track when each page loads
                        onLoadError={(error) => {
                          console.error(`❌ Error loading page ${pageNum}:`, error);
                          // Still mark as "loaded" to prevent hanging
                          handlePageLoadSuccess(pageNum);
                        }}
                        loading={
                          <div className="flex items-center justify-center p-4 bg-gray-50 border border-gray-200 rounded">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                            <span className="ml-2 text-sm text-gray-600">Rendering page {pageNum}...</span>
                          </div>
                        }
                      />
                      
                      {isPageLoaded && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded opacity-75">
                          ✓ Ready
                        </div>
                      )}
                    </div>
                  );
                })}
              </Document>
            </div>

            {/* OCR Selection Overlay - positioned over the entire scrollable area */}
            {ocrMode && !showOcrSidebar && (
              <OCRSelectionOverlay
                isActive={ocrMode && !showOcrSidebar}
                onSelection={handleOcrSelection}
                containerRef={containerRef}
                scale={scale}
              />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <div className="text-6xl mb-4">📄</div>
                <p className="text-xl mb-2">No PDF selected</p>
                <p className="text-sm">Use the "Open PDF" button to load a document</p>
                
                {/* Debug button for testing OCR API */}
                <div className="mt-8">
                  <button
                    onClick={() => {
                      // Create a simple test image
                      const testCanvas = document.createElement('canvas');
                      testCanvas.width = 200;
                      testCanvas.height = 100;
                      const ctx = testCanvas.getContext('2d');
                      ctx.fillStyle = 'white';
                      ctx.fillRect(0, 0, 200, 100);
                      ctx.font = '20px Arial';
                      ctx.fillStyle = 'black';
                      ctx.fillText('f(x) = x² + 5', 40, 50);
                      
                      // Convert to base64
                      const imageData = testCanvas.toDataURL('image/png');
                      console.log('🧪 Testing OCR API with generated image');
                      
                      // Call API directly
                      ocrAPI.extractContent(imageData)
                        .then(result => console.log('✅ Test OCR result:', result))
                        .catch(err => console.error('❌ Test OCR error:', err));
                    }}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    🧪 Test OCR API
                  </button>
                </div>              {backendStatus === 'offline' && (
                <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-md max-w-md mx-auto">
                  <p className="text-sm text-red-800">
                    ⚠️ Backend is offline. Start the Flask server to enable video generation.
                  </p>
                </div>
              )}
              
              {backendStatus === 'error' && (
                <div className="mt-4 p-3 bg-yellow-100 border border-yellow-200 rounded-md max-w-md mx-auto">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Backend configuration issue. Check your environment setup.
                  </p>
                </div>
              )}
              
              {ocrBackendStatus === 'offline' && (
                <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-md max-w-md mx-auto">
                  <p className="text-sm text-red-800">
                    ⚠️ OCR Backend is offline. Start the OCR server to enable mathematical extraction.
                  </p>
                </div>
              )}
              
              {ocrBackendStatus === 'ready' && (
                <div className="mt-4 p-3 bg-green-100 border border-green-200 rounded-md max-w-md mx-auto">
                  <p className="text-sm text-green-800">
                    ✅ Mathematical OCR is ready!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {showFloatingButton && (
          <FloatingButton
            onVisualize={handleVisualize}
            position={selectionPosition}
            selectedText={selectedText}
          />
        )}
      </div>
      
      {/* Loading Modal for Video Generation */}
      <LoadingModal
        isVisible={isGenerating}
        progress={generationProgress}
        message={generationMessage}
        onCancel={handleCancelGeneration}
      />
      
      {/* Video Player Modal */}
      {showVideoPlayer && (
        <VideoPlayer
          videoUrl={currentVideoUrl}
          title={currentVideoTitle}
          onClose={() => setShowVideoPlayer(false)}
        />
      )}
      
      {/* Explanation Viewer Modal */}
      {showExplanationViewer && (
        <ExplanationViewer
          explanation={currentExplanation}
          title={currentExplanationTitle}
          onClose={() => setShowExplanationViewer(false)}
        />
      )}
      
      {/* OCR Results Sidebar */}
      <div 
        data-sidebar-visible={showOcrSidebar}
        data-loading-visible={ocrLoading}
        data-ocr-mode={ocrMode}
      >
        <OCRResultsSidebar
          isVisible={showOcrSidebar}
          results={ocrResults}
          isLoading={ocrLoading}
          onClose={closeOcrSidebar}
          onReprocess={handleOcrReprocess}
        />
      </div>
    </div>
  );
};

export default PdfViewer;
