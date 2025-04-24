# -*- mode: python ; coding: utf-8 -*-
import os

# 创建DPI感知的清单文件
manifest = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity type="win32" name="MixTeX" version="3.2.4.0" processorArchitecture="*"/>
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" 
                        processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"/>
    </dependentAssembly>
  </dependency>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2, PerMonitor</dpiAwareness>
    </windowsSettings>
  </application>
</assembly>'''

# 写入临时清单文件
manifest_path = 'app.manifest'
with open(manifest_path, 'w') as f:
    f.write(manifest)

# 修改 Analysis 配置部分
a = Analysis(
    ['mixtex_ui.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('donate.png', '.'), 
        ('icon.png', '.'), 
        ('icon_gray.png', '.'),
    ],
    excludes = [
        # 完全排除 PyTorch 相关库，因为使用ONNX运行时
        'torch', 'torchvision', 'torchaudio',
        
        # 排除其他机器学习框架
        'tensorflow',
        'jax',
        'flax',
        'keras',
        
        # 排除训练相关模块
        'transformers.trainer',
        'transformers.training_args',
    ],
    hiddenimports=[
        # transformers 基础模块
        'transformers',
        'transformers.models',
        'transformers.models.roberta',
        'transformers.models.vit',

        # === RoBERTa 必要模块 ===
        'transformers.models.roberta.tokenization_roberta',
        'transformers.models.roberta.tokenization_roberta_fast',
        
        # === ViT 必要模块 ===
        'transformers.models.vit.image_processing_vit',
        
        # === 通用工具类 ===
        'transformers.tokenization_utils',
        'transformers.tokenization_utils_base',
        'transformers.image_processing_utils',
        'transformers.image_utils',
        'transformers.configuration_utils',
        'transformers.utils',
        'transformers.file_utils',
        'transformers.modeling_utils',
        
        # === ONNX 运行时依赖 ===
        'onnxruntime',
        'onnxruntime.capi.onnxruntime_pybind11_state',
        'PIL',
        'pystray',
        'numpy',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='MixTeX',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['icon.ico'],
    manifest=manifest_path,  # 添加清单文件路径
    uac_admin=False,
)

# 清理临时清单文件
if os.path.exists(manifest_path):
    try:
        os.remove(manifest_path)
    except:
        pass