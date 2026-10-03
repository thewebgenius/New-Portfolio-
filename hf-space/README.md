---
title: Nepali English LID
emoji: 🔤
colorFrom: blue
colorTo: red
sdk: docker
app_port: 7860
---

# Nepali-English code-switch tagger (API for the portfolio playground)

1. Create a new Space on Hugging Face, choose **Docker** as the SDK.
2. Upload `app.py`, `Dockerfile` and this README.
3. Either upload your fine-tuned model folder as `model/` (config.json, model.safetensors,
   tokenizer files), or push the model to the Hub and set the Space variable
   `MODEL_ID=your-name/nepali-english-lid`.
4. Optional: set `ALLOWED_ORIGINS=https://your-portfolio.netlify.app` to restrict CORS.
5. The Space URL looks like `https://your-name-nepali-english-lid.hf.space`. Put it in the
   portfolio's `.env` as `REACT_APP_TAGGER_ENDPOINT=...` and rebuild.

The label names come from `model.config.id2label`, so they must be `NE`, `EN` and `OTHER`.
