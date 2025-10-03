# Renqing Luo
# Commercial use prohibited
import tkinter as tk
from PIL import Image, ImageTk
import pystray
from pystray import MenuItem as item
import threading
from transformers import RobertaTokenizer, ViTImageProcessor
import onnxruntime as ort
import numpy as np
from PIL import ImageGrab
import pyperclip
import time
import sys
import os
import csv
import re
import ctypes

if hasattr(sys, '_MEIPASS'):
    base_path = sys._MEIPASS  # type: ignore # PyInstaller attribute
else:
    base_path = os.path.abspath(".")

class MixTeXApp:
    def __init__(self, root):
        self.root = root
        
        # 添加 DPI 感知支持 (解决高分屏模糊问题)
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(1)  # 启用 DPI 感知
            self.dpi_scale = ctypes.windll.shcore.GetScaleFactorForDevice(0) / 100
            self.root.tk.call('tk', 'scaling', self.dpi_scale)
        except Exception as e:
            print(f"DPI 设置失败: {e}")
            self.dpi_scale = 1.0
        
        self.root.title('MixTeX')
        self.root.resizable(False, False)
        self.root.overrideredirect(True)
        self.root.wm_attributes('-topmost', 1)
        self.root.attributes('-alpha', 0.85)
        self.TRANSCOLOUR = '#a9abc6'
        self.is_only_parse_when_show = False
        self.icon = self.load_scaled_image(os.path.join(base_path, "icon.png"))
        self.icon_tk = ImageTk.PhotoImage(self.icon)

        self.main_frame = tk.Frame(self.root, bg=self.TRANSCOLOUR)
        self.main_frame.pack(fill=tk.BOTH, expand=True)

        self.icon_label = tk.Label(self.main_frame, image=self.icon_tk, bg=self.TRANSCOLOUR)
        self.icon_label.pack(pady=self.scale_size(10))

        self.text_frame = tk.Frame(self.main_frame, bg='white', bd=1, relief=tk.SOLID)
        self.text_frame.pack(padx=self.scale_size(5), pady=self.scale_size(5), fill=tk.BOTH, expand=True)

        # 使用缩放后的字体大小
        font_size = self.scale_size(9)
        self.text_box = tk.Text(self.text_frame, wrap=tk.WORD, bg='white', fg='black', 
                               height=6, width=30, font=('Arial', font_size))
        self.text_box.pack(padx=self.scale_size(2), pady=self.scale_size(2), fill=tk.BOTH, expand=True)

        self.icon_label.bind('<ButtonPress-1>', self.start_move)
        self.icon_label.bind('<B1-Motion>', self.do_move)
        self.icon_label.bind('<ButtonPress-3>', self.show_menu)
        self.data_folder = "data"
        self.metadata_file = os.path.join(self.data_folder, "metadata.csv")
        self.use_dollars_for_inline_math = False
        self.convert_align_to_equations_enabled = False
        self.ocr_paused = False
        self.annotation_window = None
        self.current_image = None
        self.output = None
        if not os.path.exists(self.data_folder):
            os.makedirs(self.data_folder)

        if not os.path.exists(self.metadata_file):
            with open(self.metadata_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['file_name', 'text', 'feedback'])

        # Create the menu
        self.menu = tk.Menu(self.root, tearoff=0)
        settings_menu = tk.Menu(self.menu, tearoff=0)
        settings_menu.add_checkbutton(label="$ Inline Math $", onvalue=1, offvalue=0, command=self.toggle_latex_replacement, variable=tk.BooleanVar(value=self.use_dollars_for_inline_math))
        settings_menu.add_checkbutton(label="$$ Single Line Formula $$", onvalue=1, offvalue=0, command=self.toggle_convert_align_to_equations, variable=tk.BooleanVar(value=self.convert_align_to_equations_enabled))
        self.menu.add_cascade(label="Settings", menu=settings_menu)
        self.menu.add_command(label="Feedback", command=self.show_feedback_options)
        self.menu.add_command(label="Minimize", command=self.minimize)
        self.menu.add_command(label="About", command=self.show_about)
        self.menu.add_command(label="Donate", command=self.show_donate)
        self.menu.add_command(label="Exit", command=self.quit)
        if sys.platform == 'darwin':  # macOS
            self.root.config(menu=self.menu)
        else:  # Windows/Linux
            self.root.bind('<Button-3>', self.show_menu)
            self.root.wm_attributes("-transparentcolor", self.TRANSCOLOUR)

        self.create_tray_icon()

        self.model = self.load_model('onnx')
        if self.model is None:
            self.log("Model loading failed, some features will be unavailable")
            self.ocr_paused = True  # Pause OCR functionality
        else:
            self.ocr_thread = threading.Thread(target=self.ocr_loop, daemon=True)
            self.ocr_thread.start()

        self.donate_window = None

        self.is_only_parse_when_show = False
    
    def scale_size(self, size):
        """根据DPI缩放尺寸"""
        return int(size * self.dpi_scale)
    
    def load_scaled_image(self, image_path, custom_scale=None):
        """按DPI比例加载图像"""
        # 使用自定义缩放因子或系统DPI缩放
        scale = custom_scale if custom_scale is not None else getattr(self, 'dpi_scale', 1.0)
        
        # 确保路径存在
        if not os.path.exists(image_path):
            # 尝试查找替代路径
            alt_path = os.path.join(os.path.dirname(sys.executable), os.path.basename(image_path))
            if os.path.exists(alt_path):
                image_path = alt_path
            else:
                print(f"找不到图像文件: {image_path}")
                # 创建一个空白图像替代
                return Image.new('RGB', (64, 64), (200, 200, 200))
        
        # 加载原始图像
        original = Image.open(image_path)
        
        # 如果需要缩放
        if scale > 1.0:
            # 计算新尺寸
            new_size = (int(original.width * scale), int(original.height * scale))
            # 使用高质量缩放
            return original.resize(new_size, Image.Resampling.LANCZOS)
        return original

    def start_move(self, event):
        self.x = event.x
        self.y = event.y

    def do_move(self, event):
        deltax = event.x - self.x
        deltay = event.y - self.y
        x = self.root.winfo_x() + deltax
        y = self.root.winfo_y() + deltay
        self.root.geometry(f"+{x}+{y}")

    def show_menu(self, event):
        self.menu.tk_popup(event.x_root, event.y_root)

    def save_data(self, image, text, feedback):
        file_name = f"{int(time.time())}.png"
        file_path = os.path.join(self.data_folder, file_name)
        image.save(file_path, 'PNG')

        rows = []
        with open(self.metadata_file, 'r', newline='', encoding='utf-8') as f:
            reader = csv.reader(f)
            rows = list(reader)

        updated = False
        for row in rows[1:]:
            if row[1] == text:
                row[2] = feedback
                updated = True
                break

        if not updated:
            rows.append([file_name, text, feedback])

        with open(self.metadata_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(rows)

    def toggle_latex_replacement(self):
        self.use_dollars_for_inline_math = not self.use_dollars_for_inline_math

    def toggle_convert_align_to_equations(self):
        self.convert_align_to_equations_enabled = not self.convert_align_to_equations_enabled

    def minimize(self):
        self.root.withdraw()
        self.tray_icon.visible = True

    def show_about(self):
        about_text = "MixTeX\n版本: 3.2.4b \n作者: lrqlrqlrq \nQQ群：612725068 \nB站：bilibili.com/8922788 \nGithub:github.com/RQLuo"
        self.text_box.delete(1.0, tk.END)
        self.text_box.insert(tk.END, about_text)

    def show_donate(self):
        donate_text = "\n!!!感谢您的支持!!!\n"
        self.text_box.delete(1.0, tk.END)
        self.text_box.insert(tk.END, donate_text)

        donate_frame = tk.Frame(self.main_frame, bg='white')
        donate_frame.pack(padx=self.scale_size(5), pady=self.scale_size(5), fill=tk.BOTH, expand=True)

        # 加载并缩放打赏图像
        donate_size = self.scale_size(400)
        donate_image = self.load_scaled_image(os.path.join(base_path, "donate.png"))
        donate_image = donate_image.resize((donate_size, donate_size), Image.Resampling.LANCZOS)
        donate_photo = ImageTk.PhotoImage(donate_image)

        image_label = tk.Label(donate_frame, image=donate_photo)
        image_label.image = donate_photo  # type: ignore # Keep reference to prevent garbage collection
        image_label.pack(expand=True, fill=tk.BOTH)

        close_button = tk.Button(donate_frame, text="☒", 
                                command=lambda: donate_frame.destroy())
        close_button.place(relx=1.0, rely=0.0, 
                          x=-self.scale_size(15), 
                          y=self.scale_size(5), 
                          width=self.scale_size(12), 
                          height=self.scale_size(12), 
                          anchor="ne")

    def quit(self):
        self.tray_icon.stop()
        self.root.quit()

    def only_parse_when_show(self):
        self.is_only_parse_when_show = not self.is_only_parse_when_show
        
    def create_tray_icon(self):
        menu = pystray.Menu(
            item('Show', self.show_window),
            item("Toggle Parse Only When Maximized", self.only_parse_when_show),
            item('Exit', self.quit)
        )

        self.tray_icon = pystray.Icon("MixTeX", self.icon, "MixTeX", menu)
        threading.Thread(target=self.tray_icon.run, daemon=True).start()

    def show_window(self):
        self.root.deiconify()
        self.tray_icon.visible = False

    def load_model(self, path):
        try:
            # 检查模型文件是否存在，优先查找外部onnx文件夹
            model_paths = [
                path,  # 原始路径（相对路径）
                os.path.join(os.path.dirname(sys.executable), 'onnx'),  # exe同目录下的onnx文件夹
                os.path.abspath("onnx")  # 当前运行目录下的onnx文件夹
            ]
            
            # 寻找第一个有效的模型路径
            valid_path = None
            for model_path in model_paths:
                if os.path.exists(model_path):
                    # 检查必要文件是否都存在
                    required_files = [
                        os.path.join(model_path, "encoder_model.onnx"),
                        os.path.join(model_path, "decoder_model_merged.onnx"),
                        os.path.join(model_path, "tokenizer.json"),
                        os.path.join(model_path, "vocab.json")
                    ]
                    
                    all_files_exist = all(os.path.exists(file_path) for file_path in required_files)
                    if all_files_exist:
                        valid_path = model_path
                        self.log(f"Using model path: {valid_path}")
                        break
            
            if valid_path is None:
                self.log("Cannot find valid model files")
                # Show error dialog
                import ctypes
                ctypes.windll.user32.MessageBoxW(0, 
                    "Cannot find required model files\nPlease ensure the onnx folder in the exe directory contains complete model files.", 
                    "Model Loading Error", 0)
                return None
                    
            tokenizer = RobertaTokenizer.from_pretrained(valid_path)
            feature_extractor = ViTImageProcessor.from_pretrained(valid_path)
            encoder_session = ort.InferenceSession(f"{valid_path}/encoder_model.onnx")
            decoder_session = ort.InferenceSession(f"{valid_path}/decoder_model_merged.onnx")
            self.log('\n===Model loaded successfully===\n')
            return (tokenizer, feature_extractor, encoder_session, decoder_session)
        except Exception as e:
            self.log(f"Model loading failed: {e}")
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, 
                f"模型加载失败: {str(e)}\n请确保exe同目录下的onnx文件夹包含完整的模型文件。", 
                "模型加载错误", 0)
            return None

    def show_feedback_options(self):
        feedback_menu = tk.Menu(self.menu, tearoff=0)
        feedback_menu.add_command(label="Perfect", command=lambda: self.handle_feedback("Perfect"))
        feedback_menu.add_command(label="Good", command=lambda: self.handle_feedback("Normal"))
        feedback_menu.add_command(label="Mistake", command=lambda: self.handle_feedback("Mistake"))
        feedback_menu.add_command(label="Error", command=lambda: self.handle_feedback("Error"))
        feedback_menu.add_command(label="Annotate", command=self.add_annotation)
        feedback_menu.tk_popup(self.root.winfo_pointerx(), self.root.winfo_pointery())

    def handle_feedback(self, feedback_type):
        image = self.current_image
        text = self.output
        if image and text:
            if self.check_repetition(text):
                self.log("Feedback recorded: Repeat")
            else:
                self.save_data(image, text, feedback_type)
                self.log(f"Feedback recorded: {feedback_type}")
        else:
            self.log("Cannot record feedback: Missing image or inference output")

    def add_annotation(self):
        if self.annotation_window is not None:
            return  # If there's already an annotation window, do nothing

        self.annotation_window = tk.Toplevel(self.root)
        self.annotation_window.wm_attributes("-alpha", 0.85)
        self.annotation_window.overrideredirect(True)
        self.annotation_window.wm_attributes('-topmost', 1)

        self.update_annotation_position()

        # 使用缩放后的字体
        font_size = self.scale_size(11)
        entry = tk.Entry(self.annotation_window, width=45, font=('Arial', font_size))
        entry.pack(padx=self.scale_size(10), pady=self.scale_size(10))
        entry.focus_set()

        confirm_button = tk.Button(self.annotation_window, text="Confirm",
                                   command=lambda: self.confirm_annotation(entry))
        confirm_button.pack(pady=(0, self.scale_size(10)))

        # Close the window on moving the main window
        self.root.bind('<Configure>', lambda e: self.update_annotation_position())

    def confirm_annotation(self, entry):
        annotation = entry.get()
        image = self.current_image
        text = self.output
        if annotation and image and text:
            self.handle_feedback(f"Annotation: {annotation}")
            self.log(f"Annotation added: {annotation}")
        else:
            self.log("Cannot record feedback: Missing image, inference output, or annotation input.")
        self.close_annotation()

    def update_annotation_position(self):
        if self.annotation_window:
            x = self.root.winfo_x() + self.scale_size(10)
            y = self.root.winfo_y() + self.root.winfo_height() + self.scale_size(10)
            self.annotation_window.geometry(f"+{x}+{y}")

    def close_annotation(self):
        if self.annotation_window:
            self.annotation_window.destroy()
        self.annotation_window = None

    def check_repetition(self, s, repeats=12):
        for pattern_length in range(1, len(s) // repeats + 1):
            for start in range(len(s) - repeats * pattern_length + 1):
                pattern = s[start:start + pattern_length]
                if s[start:start + repeats * pattern_length] == pattern * repeats:
                    return True
        return False

    def mixtex_inference(self, max_length, num_layers, hidden_size, num_attention_heads, batch_size):
        if self.model is None:
            return ""
        tokenizer, feature_extractor, encoder_session, decoder_session = self.model  # type: ignore
        try:
            generated_text = ""
            head_size = hidden_size // num_attention_heads
            inputs = feature_extractor(self.current_image, return_tensors="np").pixel_values
            encoder_outputs = encoder_session.run(None, {"pixel_values": inputs})[0]
            
         
            num_layers = 6  # 修改为6层而不是3层
            
            decoder_inputs = {
                "input_ids": tokenizer("<s>", return_tensors="np").input_ids.astype(np.int64),
                "encoder_hidden_states": encoder_outputs,
                "use_cache_branch": np.array([True], dtype=bool),
                **{f"past_key_values.{i}.{t}": np.zeros((batch_size, num_attention_heads, 0, head_size), dtype=np.float32) 
                for i in range(num_layers) for t in ["key", "value"]}
            }
            for _ in range(max_length):
                decoder_outputs = decoder_session.run(None, decoder_inputs)
                next_token_id = np.argmax(decoder_outputs[0][:, -1, :], axis=-1)  # type: ignore
                generated_text += tokenizer.decode(next_token_id, skip_special_tokens=True)
                self.log(tokenizer.decode(next_token_id, skip_special_tokens=True), end="")
                if self.check_repetition(generated_text, 21):
                    self.log('\n===?!Repetition detected!?===\n')
                    self.save_data(self.current_image, generated_text, 'Repeat')
                    break
                if next_token_id == tokenizer.eos_token_id:
                    self.log('\n===Successfully copied to clipboard===\n')
                    break

                decoder_inputs.update({
                    "input_ids": next_token_id[:, None],
                    **{f"past_key_values.{i}.{t}": decoder_outputs[i*2+1+j] 
                    for i in range(num_layers) for j, t in enumerate(["key", "value"])}
                })
            if self.convert_align_to_equations_enabled:
                generated_text = self.convert_align_to_equations(generated_text)
            return generated_text
        except Exception as e:
            self.log(f"Error during OCR: {e}")
            return ""

    def convert_align_to_equations(self, text):
        text = re.sub(r'\\begin\{align\*\}|\\end\{align\*\}', '', text).replace('&','')
        equations = text.strip().split('\\\\')
        converted = []
        for eq in equations:
            eq = eq.strip().replace('\\[','').replace('\\]','').replace('\n','')
            if eq:
                converted.append(f"$$ {eq} $$")
        return '\n'.join(converted)

    def pad_image(self, img, out_size):
        x_img, y_img = out_size
        background = Image.new('RGB', (x_img, y_img), (255, 255, 255))
        width, height = img.size
        if width < x_img and height < y_img:
            x = (x_img - width) // 2
            y = (y_img - height) // 2
            background.paste(img, (x, y))
        else:
            scale = min(x_img / width, y_img / height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            x = (x_img - new_width) // 2
            y = (y_img - new_height) // 2
            background.paste(img_resized, (x, y))
        return background

    def ocr_loop(self):
        while True:
            if not self.ocr_paused and (self.tray_icon.visible or not self.is_only_parse_when_show):
                try:
                    image = ImageGrab.grabclipboard()
                    if image is not None and type(image) != list:
                        self.current_image = self.pad_image(image.convert("RGB"), (448,448))  # type: ignore
                        result = self.mixtex_inference(512, 6, 768, 12, 1)  # Updated to 6 layers
                        result = result.replace('\\[', '\\begin{align*}').replace('\\]', '\\end{align*}').replace('%', '\\%')
                        self.output = result
                        if self.use_dollars_for_inline_math:
                            result = result.replace('\\(', '$').replace('\\)', '$')
                        pyperclip.copy(result)
                except Exception as e:
                    self.log(f"Error: {e}")
                time.sleep(0.1)

    def toggle_ocr(self, event=None):
        self.ocr_paused = not self.ocr_paused
        self.root.after(0, self.update_icon)

    def update_icon(self):
        if self.ocr_paused:
            new_icon = self.load_scaled_image(os.path.join(base_path, "icon_gray.png"))
        else:
            new_icon = self.load_scaled_image(os.path.join(base_path, "icon.png"))
        self.icon = new_icon
        self.icon_tk = ImageTk.PhotoImage(self.icon)
        self.icon_label.config(image=self.icon_tk)
        self.tray_icon.icon = self.icon

    def log(self, message, end='\n'):
        self.text_box.insert(tk.END, message + end)
        self.text_box.see(tk.END)

if __name__ == '__main__':
    try:
        root = tk.Tk()
        app = MixTeXApp(root)
        root.mainloop()
    except Exception as e:
        # 创建错误日志文件
        with open('error_log.txt', 'w') as f:
            import traceback
            f.write(str(e) + '\n')
            f.write(traceback.format_exc())
        # 显示错误窗口
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, f"程序启动失败: {str(e)}\n详细信息已保存到error_log.txt", "错误", 0)