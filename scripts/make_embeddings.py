"""
Build public/data/embeddings.json for the 3D embedding explorer.

Input: a CSV with columns `text` and `label` (label is one of ne, en, mixed).
       If you only have the token-level LID file, label each sentence as
       ne (all word tokens NE), en (all EN) or mixed (both present) before running this.

    pip install sentence-transformers umap-learn pandas
    python scripts/make_embeddings.py sentences.csv --n 1500

Output: {"placeholder": false, "model": ..., "umap": {...}, "points": [{"x","y","z","label","text"}]}
"""
import argparse
import json

import numpy as np
import pandas as pd
import umap
from sentence_transformers import SentenceTransformer

p = argparse.ArgumentParser()
p.add_argument("csv")
p.add_argument("--out", default="public/data/embeddings.json")
p.add_argument("--model", default="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
p.add_argument("--n", type=int, default=1500, help="max points (keep the JSON small)")
p.add_argument("--neighbors", type=int, default=15)
p.add_argument("--min-dist", type=float, default=0.1)
p.add_argument("--seed", type=int, default=42)
a = p.parse_args()

df = pd.read_csv(a.csv).dropna(subset=["text", "label"])
df["label"] = df["label"].str.lower().str.strip()
df = df[df["label"].isin(["ne", "en", "mixed"])]
# balanced sample so one class does not swamp the plot
per = max(1, a.n // df["label"].nunique())
df = df.groupby("label", group_keys=False).apply(lambda g: g.sample(min(len(g), per), random_state=a.seed))

emb = SentenceTransformer(a.model).encode(df["text"].tolist(), batch_size=64, show_progress_bar=True, normalize_embeddings=True)
xyz = umap.UMAP(n_components=3, n_neighbors=a.neighbors, min_dist=a.min_dist, metric="cosine", random_state=a.seed).fit_transform(emb)

# centre and scale into roughly [-1, 1]
xyz = xyz - xyz.mean(0)
xyz = xyz / np.abs(xyz).max()

points = [
    {"x": round(float(x), 4), "y": round(float(y), 4), "z": round(float(z), 4), "label": l, "text": t[:160]}
    for (x, y, z), l, t in zip(xyz, df["label"], df["text"])
]
json.dump(
    {"placeholder": False, "model": a.model,
     "umap": {"n_neighbors": a.neighbors, "min_dist": a.min_dist, "metric": "cosine"},
     "points": points},
    open(a.out, "w", encoding="utf-8"), ensure_ascii=False,
)
print(f"wrote {len(points)} points to {a.out}")
