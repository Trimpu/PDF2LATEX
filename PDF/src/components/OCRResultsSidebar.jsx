import React, { useState } from 'react';

const OCRResultsSidebar = ({ 
  isVisible, 
  results, 
  isLoading, 
  onClose,
  onReprocess 
}) => {
  const [selectedPreprocessing, setSelectedPreprocessing] = useState('moderate');
  
  // Debug logging
  console.log('🎨 OCRResultsSidebar render:', {
    isVisible,
    isLoading,
    hasResults: !!results,
    shouldShow: isVisible || isLoading,
    props: { isVisible, isLoading, results }
  });
  
  if (!isVisible && !isLoading) {
    console.log('🚫 OCRResultsSidebar: Not rendering (isVisible=false, isLoading=false)');
    return null;
  }
  
  console.log('✅ OCRResultsSidebar: SHOULD BE VISIBLE NOW!', {
    isVisible,
    isLoading,
    results
  });

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 z-40 transform transition-transform duration-300">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">
              📐 Mathematical Content
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Confidence Score Display */}
          {results?.confidence_scores && (
            <div className="mb-3">
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-gray-600">Confidence:</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      results.confidence_scores.overall > 0.8 ? 'bg-green-500' :
                      results.confidence_scores.overall > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${(results.confidence_scores.overall * 100).toFixed(0)}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium">
                  {(results.confidence_scores.overall * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}
          
          {/* Preprocessing Controls */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Image Preprocessing:
            </label>
            <div className="flex space-x-1">
              {['none', 'minimal', 'moderate', 'aggressive'].map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setSelectedPreprocessing(level);
                    if (onReprocess) onReprocess(level);
                  }}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedPreprocessing === level || results?.preprocessing_level === level
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Extracting mathematical content...</p>
              </div>
            </div>
          ) : results ? (
            <div className="p-4 space-y-6">
              {/* Statistics Summary */}
              {results?.statistics && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Formulas:</span>
                      <span className="font-medium">{results.statistics.total_formulas}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Text blocks:</span>
                      <span className="font-medium">{results.statistics.total_text_blocks}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Formulas Section */}
              {results.formulas && results.formulas.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                    🧮 Mathematical Formulas
                    <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {results.formulas.length}
                    </span>
                    {results.confidence_scores?.formulas && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({(results.confidence_scores.formulas * 100).toFixed(0)}% confidence)
                      </span>
                    )}
                  </h3>
                  <div className="space-y-3">
                    {results.formulas.map((formula, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500">Formula {index + 1}</span>
                            {formula.type && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                {formula.type}
                              </span>
                            )}
                            {formula.confidence && (
                              <span className="text-xs text-gray-500">
                                {(formula.confidence * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(
                              typeof formula === 'string' ? formula : formula.latex
                            )}
                            className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors"
                          >
                            Copy LaTeX
                          </button>
                        </div>
                        <div className="font-mono text-sm bg-white p-2 rounded border break-all">
                          {typeof formula === 'string' ? formula : formula.latex}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Text Content Section */}
              {results.text_content && results.text_content.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                    📝 Text Content
                    <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      {results.text_content.length}
                    </span>
                    {results.confidence_scores?.text && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({(results.confidence_scores.text * 100).toFixed(0)}% confidence)
                      </span>
                    )}
                  </h3>
                  <div className="space-y-2">
                    {results.text_content.map((text, index) => (
                      <div key={index} className="bg-gray-50 p-2 rounded border">
                        <div className="flex items-center justify-between mb-1">
                          {typeof text === 'object' && text.type && (
                            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                              {text.type.replace('_', ' ')}
                            </span>
                          )}
                          {typeof text === 'object' && text.confidence && (
                            <span className="text-xs text-gray-500">
                              {(text.confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <p className="text-sm">
                          {typeof text === 'string' ? text : text.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw Result Section (Collapsible) */}
              {results.raw_result && (
                <details className="border rounded-lg">
                  <summary className="p-3 bg-gray-50 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-100">
                    🔍 Raw Extraction Result
                  </summary>
                  <div className="p-3 bg-white">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded border overflow-x-auto">
                      {results.raw_result}
                    </pre>
                  </div>
                </details>
              )}

              {/* Empty State */}
              {(!results.formulas || results.formulas.length === 0) && 
               (!results.text_content || results.text_content.length === 0) && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">🔍</div>
                  <p className="text-gray-500">No mathematical content detected</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Try selecting a different area or ensure it contains mathematical formulas
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-2">📐</div>
                <p>Select an area on the PDF to extract mathematical content</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500 text-center">
            Powered by Pix2Text • MFD-1.5 • MFR-1.5
          </div>
        </div>
      </div>
    </div>
  );
};

export default OCRResultsSidebar;