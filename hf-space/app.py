"""
FastAPI server for the Nepali-English code-switch tagger, for a Hugging Face Docker Space.

POST /predict  {"text": "Malai yo video ekdam funny lagyo"}
-> {"tokens": [{"token": "Malai", "label": "NE", "score": 0.998}, ...]}

Set MODEL_ID to your fine-tuned model on the Hub (or copy the model folder into ./model).
"""
import os
import re

import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoModelForTokenClassification, AutoTokenizer

MODEL_ID = os.environ.get("MODEL_ID", "./model")
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")

# Same tokenizer used to build the dataset.
TOKEN_RE = re.compile(r"[A-Za-z0-9]+(?:'[A-Za-z]+)?|[^\w\s]")

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForTokenClassification.from_pretrained(MODEL_ID).eval()
id2label = model.config.id2label

app = FastAPI(title="Nepali-English LID")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["POST", "GET"], allow_headers=["*"])


class Req(BaseModel):
    text: str


@app.get("/")
def health():
    return {"ok": True, "model": MODEL_ID}


@app.post("/predict")
def predict(req: Req):
    words = TOKEN_RE.findall(req.text[:400])
    if not words:
        return {"tokens": []}
    enc = tokenizer(words, is_split_into_words=True, return_tensors="pt", truncation=True, max_length=256)
    with torch.no_grad():
        probs = model(**enc).logits.softmax(-1)[0]
    # Label each word by its first sub-word, matching how the model was trained.
    out, seen = [], set()
    for i, wid in enumerate(enc.word_ids()):
        if wid is None or wid in seen:
            continue
        seen.add(wid)
        p, idx = probs[i].max(-1)
        out.append({"token": words[wid], "label": id2label[int(idx)], "score": round(float(p), 4)})
    return {"tokens": out}
