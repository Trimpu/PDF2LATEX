from mixtex_core import (
    load_model,
    pad_image,
    stream_inference,
    # convert_align_to_equations,
)
from PIL import Image

import streamlit as st
from PIL import ImageGrab


def main():
    st.set_page_config(page_title="MixTeX LaTeX OCR", page_icon="../icon.ico")
    st.title("MixTeX LaTeX OCR")
    model = load_model("onnx")

    uploaded_file = st.file_uploader("选择图片文件", type=["png", "jpg", "jpeg"])

    if st.button("从剪贴板粘贴图片"):
        try:
            img = ImageGrab.grabclipboard()
            if img:
                st.image(img, caption="剪贴板图片预览")
                run_inference(model, img)
            else:
                st.warning("剪贴板没有可用图片")
        except Exception as e:
            st.error(str(e))

    if uploaded_file:
        img = Image.open(uploaded_file).convert("RGB")
        st.image(img, caption="上传图片预览")
        run_inference(model, img)


def run_inference(model, img):
    img_padded = pad_image(img)
    partial_result = ""
    output_area = st.empty()
    for piece in stream_inference(img_padded, model):
        partial_result += piece
        output_area.code(partial_result, language="latex")


if __name__ == "__main__":
    main()
