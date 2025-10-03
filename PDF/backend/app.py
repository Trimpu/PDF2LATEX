#!/usr/bin/env python3
"""
MixTeX OCR Backend Server
Flask server that provides OCR API endpoints for the React PDF viewer.
Uses the MixTeX model for LaTeX OCR extraction.
"""

import os
import sys
import base64
import io
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import numpy as np
import traceback
import logging

# Add the mixtex path to the system path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'mixtexgui'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'mixtexgui', 'examples'))

# Import MixTeX core functionality
try:
    from mixtex_core import load_model, pad_image, stream_inference  # type: ignore
    print("✅ Successfully imported MixTeX core modules")
except ImportError as e:
    print(f"❌ Failed to import MixTeX modules: {e}")
    print("Current path:", sys.path)
    sys.exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Global model variable
model = None
model_loaded = False
model_error = None

def initialize_model():
    """Initialize the MixTeX model on server startup"""
    global model, model_loaded, model_error
    
    try:
        print("🔄 Initializing MixTeX model...")
        
        # Try to find the onnx model directory
        possible_paths = [
            os.path.join(os.path.dirname(__file__), '..', '..', 'mixtexgui', 'onnx'),
            os.path.join(os.path.dirname(__file__), '..', 'onnx'),
            os.path.join(os.path.dirname(__file__), 'onnx'),
        ]
        
        onnx_path = None
        for path in possible_paths:
            abs_path = os.path.abspath(path)
            if os.path.exists(abs_path):
                onnx_path = abs_path
                break
        
        if not onnx_path:
            raise FileNotFoundError(f"Could not find onnx model directory in any of: {possible_paths}")
        
        print(f"📁 Using model path: {onnx_path}")
        
        # Load the model
        model = load_model(onnx_path)
        model_loaded = True
        model_error = None
        
        print("✅ MixTeX model loaded successfully!")
        return True
        
    except Exception as e:
        error_msg = f"Failed to load MixTeX model: {str(e)}"
        print(f"❌ {error_msg}")
        print(f"📄 Traceback: {traceback.format_exc()}")
        model_loaded = False
        model_error = error_msg
        return False

def preprocess_image(image, preprocessing_level='moderate'):
    """
    Preprocess the image based on the specified level
    """
    try:
        if preprocessing_level == 'minimal':
            return image
        
        elif preprocessing_level == 'moderate':
            # Basic cleanup - resize to standard size and ensure RGB
            if image.mode != 'RGB':
                image = image.convert('RGB')
            return image
            
        elif preprocessing_level == 'aggressive':
            # More preprocessing - convert to grayscale, enhance contrast
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convert to grayscale for better OCR
            image = image.convert('L').convert('RGB')
            
            return image
        
        else:
            return image
            
    except Exception as e:
        logger.error(f"Error in image preprocessing: {e}")
        return image

def extract_latex_from_image(image, preprocessing_level='moderate'):
    """
    Extract LaTeX content from image using MixTeX model
    """
    global model, model_loaded
    
    if not model_loaded or model is None:
        raise Exception("MixTeX model is not loaded")
    
    try:
        # Preprocess the image
        processed_image = preprocess_image(image, preprocessing_level)
        
        # Pad image to required dimensions (448x448 for MixTeX)
        padded_image = pad_image(processed_image, (448, 448))
        
        # Extract LaTeX using MixTeX streaming inference
        latex_parts = []
        for piece in stream_inference(padded_image, model):
            latex_parts.append(piece)
        
        # Join all parts to get complete LaTeX
        full_latex = ''.join(latex_parts)
        
        # Clean up the output
        full_latex = full_latex.strip()
        
        # Replace common formatting
        full_latex = full_latex.replace('\\[', '\\begin{align*}').replace('\\]', '\\end{align*}')
        full_latex = full_latex.replace('%', '\\%')
        
        return full_latex
        
    except Exception as e:
        logger.error(f"Error in LaTeX extraction: {e}")
        raise

@app.route('/api/ocr/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ready' if model_loaded else 'error',
        'message': 'MixTeX OCR backend is running' if model_loaded else model_error,
        'model_loaded': model_loaded
    })

@app.route('/api/ocr/status', methods=['GET'])
def status_check():
    """Status check endpoint"""
    return jsonify({
        'status': 'ready' if model_loaded else 'error',
        'message': 'MixTeX model is ready' if model_loaded else model_error,
        'model_loaded': model_loaded,
        'backend': 'MixTeX'
    })

@app.route('/api/ocr/extract', methods=['POST'])
def extract_content():
    """
    Extract mathematical content from image data
    Expected JSON payload:
    {
        "image_data": "data:image/png;base64,iVBOR...",
        "preprocessing_level": "moderate"  // optional: minimal, moderate, aggressive
    }
    """
    try:
        # Check if model is loaded
        if not model_loaded:
            return jsonify({
                'success': False,
                'message': f'Model not loaded: {model_error}',
                'formulas': [],
                'text_content': [],
                'raw_result': ''
            }), 500
        
        # Get request data
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': 'No JSON data provided',
                'formulas': [],
                'text_content': [],
                'raw_result': ''
            }), 400
        
        # Extract image data
        image_data = data.get('image_data')
        if not image_data:
            return jsonify({
                'success': False,
                'message': 'No image_data provided',
                'formulas': [],
                'text_content': [],
                'raw_result': ''
            }), 400
        
        preprocessing_level = data.get('preprocessing_level', 'moderate')
        
        logger.info(f"Processing OCR request with preprocessing level: {preprocessing_level}")
        
        # Decode base64 image
        try:
            if image_data.startswith('data:image/'):
                # Remove data URL prefix
                image_data = image_data.split(',')[1]
            
            # Decode base64
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            logger.info(f"Image decoded successfully: {image.size} {image.mode}")
            
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'Failed to decode image: {str(e)}',
                'formulas': [],
                'text_content': [],
                'raw_result': ''
            }), 400
        
        # Extract LaTeX using MixTeX
        try:
            latex_result = extract_latex_from_image(image, preprocessing_level)
            
            logger.info(f"LaTeX extraction successful: {len(latex_result)} characters")
            
            # Format the response - MixTeX typically returns mathematical formulas
            if latex_result:
                # Check if it contains mathematical content
                is_formula = any(char in latex_result for char in ['\\', '{', '}', '^', '_', '$'])
                
                if is_formula:
                    formulas = [latex_result]
                    text_content = []
                else:
                    formulas = []
                    text_content = [latex_result]
                
                return jsonify({
                    'success': True,
                    'message': 'Content extracted successfully',
                    'formulas': formulas,
                    'text_content': text_content,
                    'raw_result': latex_result,
                    'preprocessing_level': preprocessing_level
                })
            else:
                return jsonify({
                    'success': False,
                    'message': 'No content detected in the image',
                    'formulas': [],
                    'text_content': [],
                    'raw_result': '',
                    'preprocessing_level': preprocessing_level
                })
                
        except Exception as e:
            logger.error(f"LaTeX extraction failed: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'OCR processing failed: {str(e)}',
                'formulas': [],
                'text_content': [],
                'raw_result': '',
                'preprocessing_level': preprocessing_level
            }), 500
            
    except Exception as e:
        logger.error(f"Unexpected error in extract_content: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'message': f'Unexpected error: {str(e)}',
            'formulas': [],
            'text_content': [],
            'raw_result': ''
        }), 500

@app.route('/api/ocr/test', methods=['GET'])
def test_endpoint():
    """Test endpoint to verify the API is working"""
    return jsonify({
        'message': 'MixTeX OCR backend is working!',
        'model_loaded': model_loaded,
        'endpoints': {
            'health': '/api/ocr/health',
            'status': '/api/ocr/status', 
            'extract': '/api/ocr/extract (POST)',
            'test': '/api/ocr/test'
        }
    })

if __name__ == '__main__':
    print("🚀 Starting MixTeX OCR Backend Server...")
    
    # Initialize the model
    if initialize_model():
        print("✅ Model initialization successful!")
    else:
        print("❌ Model initialization failed - server will run but OCR will not work")
    
    # Start the Flask server
    print("🌐 Starting Flask server on http://localhost:5001")
    print("📋 Available endpoints:")
    print("   GET  /api/ocr/health   - Health check")
    print("   GET  /api/ocr/status   - Status check")
    print("   POST /api/ocr/extract  - Extract LaTeX from image")
    print("   GET  /api/ocr/test     - Test endpoint")
    
    app.run(host='0.0.0.0', port=5001, debug=True)