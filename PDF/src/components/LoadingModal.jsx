import React from 'react';

const LoadingModal = ({ isVisible, progress, message, onCancel }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
          
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Generating Mathematical Visualization
          </h3>
          
          <p className="text-gray-600 mb-4">
            {message || 'Processing your mathematical content...'}
          </p>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress || 0}%` }}
            />
          </div>
          
          <div className="text-sm text-gray-500 mb-4">
            {progress || 0}% Complete
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
            <p className="text-sm text-yellow-800">
              🎬 AI is creating your personalized math video animation...
              <br />
              This may take 1-2 minutes depending on complexity.
            </p>
          </div>
          
          {onCancel && (
            <button
              onClick={onCancel}
              className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoadingModal;
