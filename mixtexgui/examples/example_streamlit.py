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
    import os
    # Get the absolute path to the onnx folder
    onnx_path = os.path.join(os.path.dirname(__file__), "..", "onnx")
    model = load_model(onnx_path)

    uploaded_file = st.file_uploader("Choose image file", type=["png", "jpg", "jpeg"])

    if st.button("Paste image from clipboard"):
        try:
            img = ImageGrab.grabclipboard()
            if img:
                st.image(img, caption="Clipboard image preview")
                run_inference(model, img)
            else:
                st.warning("No image available in clipboard")
        except Exception as e:
            st.error(str(e))

    if uploaded_file:
        img = Image.open(uploaded_file).convert("RGB")
        st.image(img, caption="Uploaded image preview")
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
