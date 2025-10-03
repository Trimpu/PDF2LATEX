import React from 'react';

const ExplanationViewer = ({ explanation, title, onClose }) => {
  if (!explanation) return null;

  const formatExplanation = (text) => {
    // Split by common section headers and format
    return text.split('\n').map((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        // Bold headers
        return (
          <h3 key={index} className="text-lg font-bold text-blue-700 mt-4 mb-2">
            {trimmedLine.replace(/\*\*/g, '')}
          </h3>
        );
      } else if (trimmedLine.includes(':') && trimmedLine.length < 100) {
        // Section headers
        return (
          <h4 key={index} className="font-semibold text-gray-800 mt-3 mb-1">
            {trimmedLine}
          </h4>
        );
      } else if (trimmedLine.match(/^\d+\./)) {
        // Numbered steps
        return (
          <div key={index} className="bg-blue-50 p-3 rounded-md my-2">
            <p className="text-gray-800">{trimmedLine}</p>
          </div>
        );
      } else if (trimmedLine.includes('=') || trimmedLine.includes('≈')) {
        // Mathematical equations
        return (
          <div key={index} className="bg-gray-100 p-2 rounded-md my-1 font-mono text-center">
            <p className="text-gray-900">{trimmedLine}</p>
          </div>
        );
      } else if (trimmedLine) {
        // Regular paragraphs
        return (
          <p key={index} className="text-gray-700 mb-2 leading-relaxed">
            {trimmedLine}
          </p>
        );
      }
      return null;
    }).filter(Boolean);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] w-full mx-4 overflow-auto">
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">
            📚 Mathematical Explanation
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>
        
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-blue-600 mb-2">Problem:</h3>
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
            <p className="text-gray-800">{title}</p>
          </div>
        </div>
        
        <div className="prose max-w-none">
          <h3 className="text-lg font-semibold text-green-600 mb-3">Solution:</h3>
          <div className="space-y-2">
            {formatExplanation(explanation)}
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end space-x-2">
          <button
            onClick={() => {
              const content = `Problem: ${title}\n\nSolution:\n${explanation}`;
              navigator.clipboard.writeText(content);
              alert('Explanation copied to clipboard!');
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
          >
            📋 Copy Explanation
          </button>
          <button
            onClick={onClose}
            className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExplanationViewer;
