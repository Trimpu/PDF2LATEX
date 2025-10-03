import React, { useState, useRef, useCallback } from 'react';

const OCRSelectionOverlay = ({ 
  isActive, 
  onSelection, 
  containerRef,
  scale 
}) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentSelection, setCurrentSelection] = useState(null);
  const overlayRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    if (!isActive) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsSelecting(true);
    setStartPoint({ x, y });
    setCurrentSelection({ x, y, width: 0, height: 0 });
  }, [isActive]);

  const handleMouseMove = useCallback((e) => {
    if (!isSelecting || !startPoint) return;
    
    e.preventDefault();
    const rect = overlayRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const selection = {
      x: Math.min(startPoint.x, currentX),
      y: Math.min(startPoint.y, currentY),
      width: Math.abs(currentX - startPoint.x),
      height: Math.abs(currentY - startPoint.y)
    };
    
    setCurrentSelection(selection);
  }, [isSelecting, startPoint]);

  const handleMouseUp = useCallback((e) => {
    if (!isSelecting || !currentSelection) return;
    
    e.preventDefault();
    setIsSelecting(false);
    
    // Only process selections that are reasonably sized
    if (currentSelection.width > 20 && currentSelection.height > 20) {
      // Capture the selected area
      captureSelection(currentSelection);
    }
    
    // Clear selection after a brief delay
    setTimeout(() => {
      setCurrentSelection(null);
      setStartPoint(null);
    }, 500);
  }, [isSelecting, currentSelection]);

  const captureSelection = async (selection) => {
    console.log('📸 Starting selection capture...', selection);
    
    try {
      // Get the PDF canvas elements - try multiple selectors for react-pdf
      let pdfPages = containerRef.current?.querySelectorAll('canvas[data-page-number]');
      
      if (!pdfPages || pdfPages.length === 0) {
        // Try alternative selectors for react-pdf
        pdfPages = containerRef.current?.querySelectorAll('.react-pdf__Page__canvas');
      }
      
      if (!pdfPages || pdfPages.length === 0) {
        // Try generic canvas selector
        pdfPages = containerRef.current?.querySelectorAll('canvas');
      }
      
      console.log('🔍 Found PDF pages:', pdfPages?.length || 0);
      
      if (!pdfPages || pdfPages.length === 0) {
        console.error('❌ No PDF canvas elements found');
        // Log all elements to debug
        console.log('🔍 Container children:', containerRef.current?.children);
        console.log('🔍 All canvases in document:', document.querySelectorAll('canvas'));
        return;
      }

      // Find which page the selection is on - using viewport-based detection
      let targetCanvas = null;
      let relativeY = selection.y;
      let relativeX = selection.x;
      let candidateCanvases = [];
      
      console.log('🔍 Searching for target canvas...', {
        selectionRect: selection,
        totalCanvases: pdfPages.length
      });
      
      // First, find all canvases that could contain the selection
      for (let i = 0; i < pdfPages.length; i++) {
        const canvas = pdfPages[i];
        const canvasRect = canvas.getBoundingClientRect();
        
        // Check if this canvas is visible in viewport and could contain the selection
        const isCanvasVisible = canvasRect.bottom > 0 && canvasRect.top < window.innerHeight;
        const selectionInViewport = selection.y >= 0 && selection.y <= window.innerHeight;
        
        console.log('📐 Canvas bounds check:', {
          canvasIndex: i,
          pageNumber: i + 1, // Page numbers are 1-indexed
          canvasTop: Math.round(canvasRect.top),
          canvasLeft: Math.round(canvasRect.left),
          canvasBottom: Math.round(canvasRect.bottom),
          canvasRight: Math.round(canvasRect.right),
          selectionY: selection.y,
          selectionX: selection.x,
          isCanvasVisible,
          selectionInViewport,
          // Check if selection coordinates overlap with canvas viewport position
          couldContainSelection: (
            selection.x >= canvasRect.left && 
            selection.x <= canvasRect.right &&
            selection.y >= canvasRect.top && 
            selection.y <= canvasRect.bottom
          )
        });
        
        // If selection coordinates fall within this canvas's viewport bounds
        if (selection.x >= canvasRect.left && selection.x <= canvasRect.right &&
            selection.y >= canvasRect.top && selection.y <= canvasRect.bottom) {
          
          candidateCanvases.push({
            canvas,
            index: i,
            pageNumber: i + 1,
            rect: canvasRect,
            isVisible: isCanvasVisible,
            relativeX: selection.x - canvasRect.left,
            relativeY: selection.y - canvasRect.top
          });
        }
      }
      
      console.log('🔍 Found candidate canvases:', candidateCanvases.map(c => ({
        pageNumber: c.pageNumber,
        isVisible: c.isVisible,
        relativePos: `${Math.round(c.relativeX)}, ${Math.round(c.relativeY)}`
      })));
      
      // Choose the best candidate (prefer visible canvases, then the first match)
      if (candidateCanvases.length > 0) {
        const visibleCandidates = candidateCanvases.filter(c => c.isVisible);
        const chosenCandidate = visibleCandidates.length > 0 ? visibleCandidates[0] : candidateCanvases[0];
        
        targetCanvas = chosenCandidate.canvas;
        relativeY = chosenCandidate.relativeY;
        relativeX = chosenCandidate.relativeX;
        
        console.log('🎯 Found target canvas:', {
          pageNumber: chosenCandidate.pageNumber,
          relativeX: Math.round(relativeX),
          relativeY: Math.round(relativeY),
          canvasSize: { width: targetCanvas.width, height: targetCanvas.height },
          canvasPosition: chosenCandidate.rect,
          selectionOriginal: { x: selection.x, y: selection.y, width: selection.width, height: selection.height },
          calculatedRelative: { relativeX, relativeY },
          isVisible: chosenCandidate.isVisible
        });
        
        // CRITICAL: Log which page we're actually capturing from
        console.log('🚨 CRITICAL PAGE CHECK:', {
          detectedPageNumber: chosenCandidate.pageNumber,
          canvasElement: targetCanvas,
          isThisTheRightPage: `Selected page ${chosenCandidate.pageNumber} - is this correct for your math formulas?`,
          canvasIndex: chosenCandidate.index,
          totalCanvases: pdfPages.length,
          isVisible: chosenCandidate.isVisible,
          candidatesFound: candidateCanvases.length
        });
        
        // Force check - warn if this seems wrong
        if (chosenCandidate.pageNumber !== 21) {
          console.warn('🚨 POSSIBLE PAGE MISMATCH! You expected page 21, but we detected page', chosenCandidate.pageNumber);
          console.warn('🔍 This could be because:', {
            reason1: 'You are scrolled to a different page than expected',
            reason2: 'The selection coordinates are being calculated relative to the wrong viewport',
            reason3: 'Multiple pages are visible and we chose the wrong one',
            suggestion: 'Please scroll so that page 21 is clearly visible and try again'
          });
        }
      }

      if (!targetCanvas) {
        console.error('❌ No target canvas found for selection');
        console.error('🔍 Selection details:', selection);
        console.error('📊 All canvas checks failed - selection may be outside all page boundaries');
        return;
      }

      console.log('✅ Target canvas found:', targetCanvas.width + 'x' + targetCanvas.height);

      // Create a temporary canvas to capture the selection
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      // Calculate the actual coordinates on the PDF canvas
      const canvasRect = targetCanvas.getBoundingClientRect();
      console.log('🔍 Canvas size details:', {
        targetCanvasWidth: targetCanvas.width,
        targetCanvasHeight: targetCanvas.height,
        boundingRectWidth: canvasRect.width,
        boundingRectHeight: canvasRect.height,
        scale,
        selection
      });
      
      // Calculate the scale factor between displayed size and actual size
      const scaleX = targetCanvas.width / canvasRect.width;
      const scaleY = targetCanvas.height / canvasRect.height;
      
      console.log('🔢 Scale calculations:', {
        canvasActualSize: { width: targetCanvas.width, height: targetCanvas.height },
        canvasDisplayedSize: { width: canvasRect.width, height: canvasRect.height },
        scaleFactors: { scaleX, scaleY },
        relativeCoords: { relativeX, relativeY },
        selectionSize: { width: selection.width, height: selection.height }
      });
      
      // Calculate actual coordinates on the canvas using relative positions
      // Note: relativeX/Y are already in canvas coordinates, so we just need to scale them
      const actualX = Math.max(0, Math.round(relativeX * scaleX));
      const actualY = Math.max(0, Math.round(relativeY * scaleY));
      const actualWidth = Math.min(targetCanvas.width - actualX, Math.round(selection.width * scaleX));
      const actualHeight = Math.min(targetCanvas.height - actualY, Math.round(selection.height * scaleY));
      
      // Check if the capture area is valid
      if (actualWidth <= 0 || actualHeight <= 0) {
        console.error('❌ Invalid capture area dimensions', { actualWidth, actualHeight });
        return;
      }
      
      console.log('✅ Capturing area from canvas:', { 
        actualX, 
        actualY, 
        actualWidth, 
        actualHeight,
        originalSelection: selection,
        canvasSize: { width: targetCanvas.width, height: targetCanvas.height },
        scaleFactors: { scaleX, scaleY },
        percentageOfCanvas: {
          xPercent: (actualX / targetCanvas.width * 100).toFixed(1) + '%',
          yPercent: (actualY / targetCanvas.height * 100).toFixed(1) + '%',
          widthPercent: (actualWidth / targetCanvas.width * 100).toFixed(1) + '%',
          heightPercent: (actualHeight / targetCanvas.height * 100).toFixed(1) + '%'
        }
      });
      
      // Validate if coordinates seem reasonable for mathematical content (should be in middle/lower area of page)
      const yPercentage = (actualY / targetCanvas.height) * 100;
      if (yPercentage < 10) {
        console.warn('⚠️ WARNING: Capturing from top 10% of page - this might be header/title area, not math content');
      }
      
      // Additional debug: Check if this canvas actually contains different content than expected
      console.log('🔍 CANVAS CONTENT DEBUG:', {
        canvasDataUrl: targetCanvas.toDataURL('image/png', 0.1), // Low quality for debugging
        canvasId: targetCanvas.id,
        canvasClass: targetCanvas.className
      });
      
      // Set canvas size to match selection
      tempCanvas.width = actualWidth;
      tempCanvas.height = actualHeight;
      
      // Draw the selected portion
      try {
        tempCtx.drawImage(
          targetCanvas,
          actualX, actualY, actualWidth, actualHeight,
          0, 0, actualWidth, actualHeight
        );
        
        // Verify that pixels were actually drawn
        const pixelData = tempCtx.getImageData(0, 0, 5, 5).data;
        const hasData = Array.from(pixelData).some(val => val !== 0);
        console.log(`📊 Canvas data check: ${hasData ? '✅ Has pixel data' : '❌ Empty canvas'}`);
        
        // Additional debugging: check canvas content statistics
        if (hasData) {
          const fullPixelData = tempCtx.getImageData(0, 0, actualWidth, actualHeight);
          const nonZeroPixels = Array.from(fullPixelData.data).filter(val => val !== 0).length;
          console.log(`📈 Canvas statistics: ${nonZeroPixels}/${fullPixelData.data.length} non-zero pixels (${(nonZeroPixels/fullPixelData.data.length*100).toFixed(1)}%)`);
        }
        
      } catch (e) {
        console.error('❌ Error drawing selection to canvas:', e);
        return;
      }
      
      // Convert to base64
      const imageData = tempCanvas.toDataURL('image/png');
      console.log('📦 Image captured:', {
        actualSize: `${actualWidth}x${actualHeight}`,
        dataLength: imageData.length,
        isValidBase64: imageData.startsWith('data:image/png;base64,'),
        base64Preview: imageData.substring(0, 100) + '...'
      });
      
      // Debug: Create a downloadable link to inspect the captured image
      const debugLink = document.createElement('a');
      debugLink.href = imageData;
      debugLink.download = `ocr-capture-${Date.now()}.png`;
      debugLink.textContent = 'Download Captured Image';
      debugLink.style.cssText = 'position:fixed; top:10px; left:10px; z-index:9999; background:red; color:white; padding:5px; text-decoration:none;';
      document.body.appendChild(debugLink);
      
      // Auto-remove the link after 10 seconds
      setTimeout(() => {
        if (debugLink.parentNode) {
          debugLink.parentNode.removeChild(debugLink);
        }
      }, 10000);
      
      console.log('🔍 Debug: Added download link for captured image inspection');
      
      // Send to parent component
      const selectionData = {
        imageData,
        coordinates: {
          x: actualX,
          y: actualY,
          width: actualWidth,
          height: actualHeight
        },
        selectionRect: selection
      };
      
      console.log('🚀 Sending selection data to parent component');
      onSelection(selectionData);
      
    } catch (error) {
      console.error('Error capturing selection:', error);
    }
  };

  if (!isActive) {
    console.log('🚫 OCR Overlay: isActive=false, not rendering');
    return null;
  }

  console.log('✅ OCR Overlay: isActive=true, rendering overlay');

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50"
      style={{
        cursor: 'crosshair',
        backgroundColor: 'rgba(0, 100, 255, 0.15)',
        pointerEvents: 'auto'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Always show OCR mode indicator */}
      <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-2 rounded-lg shadow-lg z-60">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="font-medium">OCR Mode Active</span>
        </div>
        <div className="text-xs opacity-90 mt-1">
          Drag to select area for mathematical extraction
        </div>
      </div>
      
      {currentSelection && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-30"
          style={{
            left: currentSelection.x,
            top: currentSelection.y,
            width: currentSelection.width,
            height: currentSelection.height
          }}
        >
          <div className="absolute -top-8 left-0 bg-blue-500 text-white px-2 py-1 text-sm rounded">
            {currentSelection.width}×{currentSelection.height}px
          </div>
        </div>
      )}
    </div>
  );
};

export default OCRSelectionOverlay;