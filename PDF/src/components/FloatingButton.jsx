import React, { useState } from 'react';

const FloatingButton = ({ onVisualize, position, selectedText }) => {
  const [showOptions, setShowOptions] = useState(false);
  const [difficulty, setDifficulty] = useState('intermediate');
  const [quality, setQuality] = useState('medium_quality');

  const handleVisualize = (customOptions = {}) => {
    const options = {
      difficulty,
      quality,
      duration: 45,
      ...customOptions
    };
    onVisualize(options);
    setShowOptions(false);
  };

  const handleQuickVisualize = () => {
    handleVisualize();
  };

  return (
    <div
      className="fixed z-50 transform -translate-x-1/2 pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {!showOptions ? (
        // Main button
        <div className="flex space-x-2 pointer-events-auto">
          <button
            onClick={handleQuickVisualize}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 border border-blue-500"
            title="Quick visualization"
          >
            ✨ Visualize
          </button>
          
          <button
            onClick={() => setShowOptions(true)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1.5 rounded-lg text-xs font-medium shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 border border-gray-500"
            title="More options"
          >
            ⚙️
          </button>
        </div>
      ) : (
        // Options panel
        <div className="bg-white rounded-lg shadow-xl border p-4 min-w-[280px] pointer-events-auto">
          <div className="mb-3">
            <h4 className="font-medium text-gray-800 text-sm mb-2">Video Generation Options</h4>
            <p className="text-xs text-gray-600 mb-3 max-w-[250px] truncate" title={selectedText}>
              "{selectedText}"
            </p>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Difficulty Level
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="beginner">🟢 Beginner</option>
                <option value="intermediate">🟡 Intermediate</option>
                <option value="advanced">🔴 Advanced</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Video Quality
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low_quality">📱 Low (Fast)</option>
                <option value="medium_quality">💻 Medium</option>
                <option value="high_quality">🎬 High (Slow)</option>
              </select>
            </div>
          </div>
          
          <div className="flex justify-between mt-4 pt-3 border-t border-gray-200">
            <button
              onClick={() => setShowOptions(false)}
              className="text-xs bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1.5 rounded transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={() => handleVisualize()}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-colors duration-200"
            >
              Generate Video 🎬
            </button>
          </div>
        </div>
      )}
      
      {/* Arrow pointing down */}
      {!showOptions && (
        <div className="absolute left-1/2 top-full transform -translate-x-1/2">
          <div className="w-0 h-0 border-l-3 border-r-3 border-t-3 border-l-transparent border-r-transparent border-t-blue-600"></div>
        </div>
      )}
    </div>
  );
};

export default FloatingButton;
