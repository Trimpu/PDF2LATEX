from mixtex_core import (
    load_model,
    pad_image,
    stream_inference,
    # convert_align_to_equations,
)
from PIL import Image

if __name__ == "__main__":
    model = load_model("onnx")
    img = Image.open("test.png").convert("RGB")
    img_padded = pad_image(img)
    partial_result = []
    for piece in stream_inference(img_padded, model):
        print(piece, end="", flush=True)  # 流式输出
        partial_result.append(piece)

    # result_text = convert_align_to_equations("".join(partial_result))
    # print("\n最终结果:\n", result_text)
