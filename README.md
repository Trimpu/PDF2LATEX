# PDF2LATEX 📄➡️📐

**Transform PDF formulas into LaTeX code instantly using AI-powered OCR**

PDF2LATEX is a comprehensive OCR system that converts mathematical formulas and equations from PDF documents into clean LaTeX code. Built on the MixTeX model, it offers multiple interfaces for different use cases: desktop GUI, web application, and React-based PDF viewer.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React](https://img.shields.io/badge/react-18.0+-61dafb.svg)](https://reactjs.org/)

## ✨ Features

- **🖥️ Desktop GUI**: System tray application with clipboard monitoring
- **🌐 Web Interface**: Streamlit-based browser application  
- **📑 PDF Viewer**: React app with region selection and batch OCR
- **🔧 REST API**: Flask backend for integration with other applications
- **🎯 High Accuracy**: MixTeX ONNX models optimized for mathematical formulas
- **🚀 Fast Processing**: Efficient inference pipeline with 6-layer architecture

## 🚀 Quick Start

### Prerequisites

- Python 3.11 or higher
- Node.js 16+ (for PDF viewer)
- Git LFS (for model files)

### Installation

1. **Clone the repository**:
```bash
git clone https://github.com/Trimpu/PDF2LATEX.git
cd PDF2LATEX
```

2. **Install Python dependencies**:
```bash
pip install -r requirements.txt
```

3. **Install additional GUI dependencies** (for desktop app):
```bash
cd mixtexgui
pip install -r requirements.txt
```

4. **Install React dependencies** (for PDF viewer):
```bash
cd PDF
npm install
```

## 🎯 Usage

### Desktop Application

Launch the system tray application:
```bash
cd mixtexgui
python mixtex_ui.py
```

**Features**:
- Auto clipboard monitoring for images
- System tray integration
- Drag & drop image support
- Instant LaTeX output

### Web Interface

Start the Streamlit web application:
```bash
cd mixtexgui/examples
streamlit run example_streamlit.py
```

Access at `http://localhost:8501`

**Features**:
- Browser-based interface
- File upload support
- Real-time preview
- Download LaTeX results

### PDF Viewer with OCR

1. **Start the Flask backend**:
```bash
cd PDF/backend
python app.py
```

2. **Start the React frontend**:
```bash
cd PDF
npm start
```

Access at `http://localhost:3000`

**Features**:
- PDF document viewer
- Region selection for OCR
- Batch processing
- LaTeX export options

## 🏗️ Architecture

```
PDF2LATEX/
├── mixtexgui/              # Desktop & Web Applications
│   ├── mixtex_ui.py       # Main GUI application
│   ├── onnx/              # MixTeX ONNX models (LFS)
│   └── examples/          # Streamlit web app
├── PDF/                   # React PDF Viewer
│   ├── src/               # React components
│   ├── backend/           # Flask API server
│   └── public/            # Static assets
└── demo/                  # Documentation & demos
```

## 🔧 API Reference

### Flask Backend Endpoints

- `GET /api/health` - Health check
- `GET /api/status` - Model status
- `POST /api/ocr/extract` - Extract LaTeX from image

**Example**:
```bash
curl -X POST http://localhost:5001/api/ocr/extract \
  -H "Content-Type: application/json" \
  -d '{"image": "base64_encoded_image"}'
```

## 📊 Model Information

- **Encoder Model**: 192MB ONNX format
- **Decoder Model**: 307MB ONNX format  
- **Total Size**: ~499MB (stored with Git LFS)
- **Architecture**: 6-layer transformer optimized for LaTeX
- **Input**: Images (PNG, JPG, JPEG)
- **Output**: LaTeX mathematical expressions

## 🛠️ Development

### Requirements

- Python 3.11+
- transformers>=4.35.0
- onnxruntime>=1.15.0
- pillow>=10.0.0
- flask>=2.3.0
- streamlit>=1.25.0

### Building from Source

1. Clone and install dependencies (see Installation)
2. Models are automatically downloaded via Git LFS
3. Run any interface using the usage instructions above

## 📝 Examples

**Input Image**: Formula screenshot from PDF  
**Output LaTeX**: 
```latex
\frac{d}{dx}\left(\int_{a}^{x} f(t) dt\right) = f(x)
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on the MixTeX model architecture
- Uses ONNX runtime for efficient inference
- React PDF viewer with PDF.js integration
- Streamlit for rapid web prototyping

## 📞 Support

- Create an [Issue](https://github.com/Trimpu/PDF2LATEX/issues) for bug reports
- Check [Discussions](https://github.com/Trimpu/PDF2LATEX/discussions) for Q&A
- Star ⭐ the repo if you find it helpful!

---

**Made with ❤️ for the LaTeX community**
