import onnxruntime as ort
import numpy as np
from PIL import Image
import re
from transformers import AutoTokenizer, AutoImageProcessor


def load_model(model_dir):
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    feature_extractor = AutoImageProcessor.from_pretrained(model_dir)
    encoder_sess = ort.InferenceSession(f"{model_dir}/encoder_model.onnx")
    decoder_sess = ort.InferenceSession(f"{model_dir}/decoder_model_merged.onnx")
    return tokenizer, feature_extractor, encoder_sess, decoder_sess


def pad_image(img, out_size=(448, 448)):
    x_img, y_img = out_size
    bg = Image.new("RGB", (x_img, y_img), (255, 255, 255))
    w, h = img.size
    if w < x_img and h < y_img:
        x = (x_img - w) // 2
        y = (y_img - h) // 2
        bg.paste(img, (x, y))
    else:
        scale = min(x_img / w, y_img / h)
        nw, nh = int(w * scale), int(h * scale)
        img_resized = img.resize((nw, nh), Image.LANCZOS)
        x = (x_img - nw) // 2
        y = (y_img - nh) // 2
        bg.paste(img_resized, (x, y))
    return bg


def check_repetition(s, repeats=12):
    for pattern_length in range(1, len(s) // repeats + 1):
        for start in range(len(s) - repeats * pattern_length + 1):
            pattern = s[start : start + pattern_length]
            if s[start : start + repeats * pattern_length] == pattern * repeats:
                return True
    return False


def convert_align_to_equations(text):
    text = re.sub(r"\\begin\{align\*\}|\\end\{align\*\}", "", text).replace("&", "")
    eqs = text.strip().split("\\\\")
    return "\n".join(f"$$ {eq.strip()} $$" for eq in eqs if eq.strip())


def stream_inference(
    image, model, max_length=512, num_layers=3, hidden_size=768, heads=12, batch_size=1
):
    tokenizer, feature_extractor, enc_session, dec_session = model
    head_size = hidden_size // heads
    inputs = feature_extractor(image, return_tensors="np").pixel_values
    enc_out = enc_session.run(None, {"pixel_values": inputs})[0]
    dec_in = {
        "input_ids": tokenizer("<s>", return_tensors="np").input_ids.astype(np.int64),
        "encoder_hidden_states": enc_out,
        "use_cache_branch": np.array([True], dtype=bool),
        **{
            f"past_key_values.{i}.{t}": np.zeros(
                (batch_size, heads, 0, head_size), dtype=np.float32
            )
            for i in range(num_layers)
            for t in ["key", "value"]
        },
    }
    generated = ""
    for _ in range(max_length):
        outs = dec_session.run(None, dec_in)
        next_id = np.argmax(outs[0][:, -1, :], axis=-1)
        token_text = tokenizer.decode(next_id, skip_special_tokens=True)
        yield token_text  # 流式输出
        generated += token_text
        if check_repetition(generated, 21) or next_id == tokenizer.eos_token_id:
            break
        dec_in.update(
            {
                "input_ids": next_id[:, None],
                **{
                    f"past_key_values.{i}.{t}": outs[i * 2 + 1 + j]
                    for i in range(num_layers)
                    for j, t in enumerate(["key", "value"])
                },
            }
        )
