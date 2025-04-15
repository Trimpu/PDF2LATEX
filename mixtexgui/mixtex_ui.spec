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

# 修改 spec 文件，添加缺失的依赖
a = Analysis(
    ['mixtex_ui.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('donate.png', '.'), 
        ('icon.png', '.'), 
        ('icon_gray.png', '.'),
        ('onnx', 'onnx')  # 确保包含整个onnx文件夹
    ],
    hiddenimports=[
        'onnxruntime',
        'transformers',
        'PIL',
        'pystray',
        'numpy',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
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
