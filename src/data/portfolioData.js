// All site content lives here. Edit this file to update text, numbers and links.

export const profile = {
  name: 'Shivam Kumar Sah',
  shortName: 'Shivam',
  role: 'ML student working on low-resource NLP and applied deep learning',
  summary:
    'I am a final-year B.Tech CSE (AI/ML) student at DIT University. Most of my work is on Nepali-English code-switched language, where data is scarce and off-the-shelf models struggle. I also train image classifiers for medical and environmental problems, and I try to report what my models actually do, including where the numbers are weaker than they first look.',
  email: 'shubhamshah2078@gmail.com',
  phones: ['+91 70177 13815', '+977 970 990 4698'],
  location: 'Dehradun, India and Kathmandu, Nepal',
  links: {
    github: 'https://github.com/thewebgenius',
    linkedin: 'https://www.linkedin.com/in/shubham-shah-b6a03b296/',
    resume: '/resume/Shivam_Kumar_Sah_Resume.pdf',
  },
  photo: '/images/profileimage/profile-pic.jpeg',
};

// A real code-switched sentence, tagged the way the LID model tags it.
// Shown in the hero. Translation: "I build models that understand text mixing Nepali and English."
export const heroSentence = {
  tokens: [
    ['Ma', 'NE'], ['Nepali', 'NE'], ['ra', 'NE'], ['English', 'EN'], ['mix', 'EN'],
    ['bhayeko', 'NE'], ['text', 'EN'], ['bujhne', 'NE'], ['models', 'EN'], ['banauchhu', 'NE'], ['.', 'OTHER'],
  ],
  translation: 'I build models that understand text mixing Nepali and English.',
};

export const researchInterests = [
  {
    name: 'Code-switched NLP',
    text: 'Token-level language identification and downstream tasks for romanized Nepali-English text.',
  },
  {
    name: 'Speech for low-resource languages',
    text: 'ASR and voice interfaces that keep working when the language, the accent or the network is poorly supported.',
  },
  {
    name: 'Evaluation you can trust',
    text: 'Leakage checks, duplicate audits and grouped splits, so a reported accuracy means what it says.',
  },
];

export const skills = [
  { group: 'Languages', items: ['Python', 'C', 'Java', 'SQL (MySQL)', 'HTML/CSS'] },
  { group: 'Deep learning', items: ['PyTorch', 'Keras / TensorFlow', 'Hugging Face Transformers', 'XLM-RoBERTa', 'EfficientNet', 'ResNet', 'OpenCV'] },
  { group: 'ML and data', items: ['scikit-learn', 'NumPy', 'Pandas', 'NLTK', 'Matplotlib', 'RAG pipelines'] },
  { group: 'Tooling', items: ['Git / GitHub', 'Kaggle GPUs', 'Google Colab', 'Jupyter', 'FastAPI', 'AWS', 'Firebase'] },
  { group: 'Hardware', items: ['Microcontrollers', 'Sensors', 'IoT automation'] },
];

export const education = [
  {
    place: 'DIT University, Dehradun',
    period: '2023 – 2027',
    detail: 'B.Tech, Computer Science Engineering (AI/ML). CGPA 7.80 / 10.',
  },
  {
    place: 'Uniglobe High School, Kathmandu',
    period: '2021 – 2023',
    detail: 'Science stream (Computer Science). GPA 3.24 / 4.0.',
  },
];

export const experience = [
  {
    role: 'Intern',
    org: 'IT Training Nepal Centre, Kathmandu',
    period: '3 months',
    detail:
      'Worked with a technical team on ML tooling and real IT projects in a shared development setup. First time using ML outside coursework.',
  },
  {
    role: 'Independent research',
    org: 'Nepali-English NLP',
    period: 'Ongoing',
    detail:
      'Building a token-level language identification dataset and model for romanized Nepali-English text, and writing it up as a paper with my advisor.',
  },
];

// status: 'paper' | 'completed' | 'pending' | 'paused'
export const projects = [
  {
    slug: 'nepali-lid',
    title: 'Token-level language identification for romanized Nepali-English text',
    status: 'paper',
    statusText: 'Paper in preparation',
    stack: ['XLM-RoBERTa', 'Hugging Face', 'PyTorch', 'scikit-learn'],
    abstract:
      'Nepali speakers write online in a mix of Nepali (in Latin script) and English, often inside one sentence. Most code-switching work covers Hindi-, Spanish- or Arabic-English; Nepali-English has very little. I re-annotated 8,560 sentences (121,519 tokens) from an existing Nepali-English sentiment corpus at the token level with three labels — Nepali (NE), English (EN) and Other (punctuation, numbers, symbols) — and fine-tuned XLM-RoBERTa base for token classification.',
    method: [
      'Tried a dictionary lookup first and dropped it: words like "malai", "garnu" and "cha" are spelled entirely in English letters, so a dictionary gives no signal.',
      'Tried CRF silver-labelling from a small hand-labelled seed set; its predictions were not reliable enough to keep.',
      'Final labels: LLM-assisted tagging of English tokens, rules for numbers, punctuation and emoji, everything else defaults to NE. Then I manually checked ~500 tokens with positional sampling across the corpus.',
      'That check found a systematic error: all 947 numeric tokens and common loanwords such as "video" (196 times) and "youtube" were labelled NE. I fixed them and retrained on the same seed-fixed split.',
      'Found that seqeval assumes BIO span tags and was silently dropping the OTHER class from evaluation; switched to scikit-learn\'s per-token report.',
    ],
    results: {
      caption: 'Test set: 12,166 tokens. Same sentence split before and after the label fix.',
      columns: ['', 'Original labels', 'Corrected labels'],
      rows: [
        ['NE F1', '0.9963', '0.9963'],
        ['EN F1', '0.9901', '0.9902'],
        ['OTHER F1', '0.9997', '1.0000'],
        ['Accuracy', '99.53%', '99.54%'],
      ],
    },
    takeaway:
      'Fixing the labels barely moved the score, which is the point: the model was not getting its accuracy from the labelling mistake. The ~56 remaining errors are almost all NE↔EN confusions, many on words that are valid in both languages, like "sir".',
    limitations:
      'One annotator, with LLM assistance, and no inter-annotator agreement score yet. All sentences come from one existing social-media corpus (credited in the paper). No simple non-transformer baseline yet. All three are on the list before submission.',
    links: [{ label: 'Try the tagger', href: '#playground' }],
  },
  {
    slug: 'smartbinx',
    title: 'SmartBinX: waste image classification with EfficientNet-B2',
    status: 'completed',
    statusText: 'Completed, Oct 2026',
    stack: ['TensorFlow / Keras', 'EfficientNet-B2', 'Kaggle 2× T4'],
    abstract:
      'The vision module for a smart dustbin: classify a photo of waste as organic, recyclable or hazardous. My earlier CNN trained from scratch reached 73.21% test accuracy. Replacing it with an ImageNet-pretrained EfficientNet-B2, fine-tuned on the same split, brought it to 96.44%. Before writing that number down I audited the dataset, and the audit changed what the number means.',
    method: [
      'Fine-tuned EfficientNet-B2 (7.77M parameters) and picked the checkpoint by validation accuracy. Training diverged to NaN after epoch 21, so the saved model is the epoch-21 checkpoint.',
      'Hashed every file to look for exact duplicates. Of 42,281 readable images only about 34,200 are unique, and 6,553 hazardous files are pre-augmented copies.',
      '1,229 of the 3,458 test images (35.5%) are byte-identical to images in train or validation, so I report accuracy on the unseen test images separately.',
    ],
    results: {
      caption: 'Held-out test split. 95% confidence intervals in brackets.',
      columns: ['Measure', 'Value'],
      rows: [
        ['Accuracy, full test split (n = 3,458)', '96.44% [95.77–97.01]'],
        ['Accuracy, test images not seen in train/val (n = 2,229)', '94.75% [93.75–95.60]'],
        ['Previous CNN from scratch, same split', '73.21%'],
        ['Recyclable recall (no duplicates in this class)', '89.93%'],
        ['Macro F1, full test split', '96.45%'],
        ['Inference speed', '12.1 ms / image on a Tesla T4'],
      ],
    },
    takeaway:
      'The honest headline is about 95% on images the model has not seen. Most remaining errors are recyclable items predicted as organic (86 of 1,112).',
    limitations:
      'Hazardous-class results cannot be verified: 944 of 945 hazardous test images duplicate training images. The duplicate check only catches exact copies, so near-duplicates may still inflate the 94.75%. Speed was measured on a GPU, not on bin hardware.',
    links: [],
  },
  {
    slug: 'skin-cancer',
    title: 'Skin lesion classification on HAM10000 with EfficientNet-B4',
    status: 'completed',
    statusText: 'Completed',
    stack: ['PyTorch', 'torchvision', 'EfficientNet-B4', 'Kaggle GPU'],
    abstract:
      'Classifying 10,015 dermatoscopic images into seven lesion types (melanocytic nevi, melanoma, benign keratosis, basal cell carcinoma, actinic keratosis, dermatofibroma, vascular lesions). The data is heavily imbalanced: 6,705 images are nevi and only 115 are dermatofibroma, so plain accuracy is misleading and I selected models by balanced accuracy.',
    method: [
      'Split 80/20 with GroupShuffleSplit on lesion_id, so the same lesion never appears in both train (7,991) and validation (2,024). Verified zero overlap.',
      'Class-weighted cross-entropy (weights from inverse frequency), augmentation with flips, rotation, colour jitter and occasional greyscale.',
      'Training in phases: head only with the backbone frozen, then full fine-tuning with a lower learning rate, then differential learning rates for backbone (3e-5) and head (1e-4) with cosine decay and early stopping. Mixed precision throughout.',
    ],
    results: {
      caption: 'Lesion-grouped validation set, 2,024 images, 7 classes.',
      columns: ['Measure', 'Value'],
      rows: [
        ['Balanced accuracy (best checkpoint)', '70.4%'],
        ['Overall accuracy', '73%'],
        ['Weighted F1', '0.75'],
        ['Macro F1', '0.60'],
      ],
    },
    figure: {
      src: '/images/projects/skin-cancer-training-history.png',
      alt: 'Loss, accuracy and balanced accuracy curves for train and validation across all training phases.',
      caption: 'Loss, accuracy and balanced accuracy across all three training phases.',
    },
    takeaway:
      'The lesion-grouped split makes these numbers lower than many HAM10000 results online, which often let images of the same lesion leak between train and test.',
    limitations:
      'A screening experiment, not a diagnostic tool. Minority classes are still weak (macro F1 0.60). Trained only on dermatoscopic images, so it will not transfer to phone photos.',
    links: [],
  },
  {
    slug: 'mvbs',
    title: 'Multilingual Voice Banking Sahayak (MVBS)',
    status: 'pending',
    statusText: 'Pending — in progress',
    stack: ['Whisper Large-v3', 'IndicConformer', 'ASR'],
    abstract:
      'A voice banking assistant for Nepali speakers who mix Nepali and English ("NepGlish") when they talk. I have written the full technical research paper and system design; implementation is in progress.',
    method: [
      'ASR pipeline built around Whisper Large-v3 and IndicConformer for code-switched speech.',
      'Confirmation and safety checks before any destructive banking action, such as a transfer or closing an account.',
      'Designed to degrade gracefully on weak networks and low-resource conditions instead of failing outright.',
    ],
    results: null,
    takeaway: 'No results yet. I will add evaluation numbers here once the prototype is running.',
    limitations: null,
    links: [],
  },
  {
    slug: 'smart-bin',
    title: 'Smart IoT dustbin',
    status: 'paused',
    statusText: 'Not completed',
    stack: ['Microcontroller', 'Sensors', 'IoT'],
    abstract:
      'In my third year I worked with my professor on a sensor-driven smart dustbin, meant to eventually pair with the SmartBinX classifier above. We worked on the hardware side, but ran out of time before the full system worked end to end.',
    method: [
      'Microcontroller and sensor setup for detecting and handling waste automatically.',
      'Planned to connect the bin to the image classifier so it could sort waste on its own.',
    ],
    results: null,
    takeaway:
      'It did not reach a working prototype in the time we had. The image classifier (SmartBinX, above) is the part I carried forward.',
    limitations: null,
    links: [],
  },
];

// Commands for the palette and the chat assistant reuse the slugs above.
export const projectAliases = {
  'nepali-lid': ['lid', 'nlp', 'paper', 'code-switch', 'codeswitch', 'xlm', 'nepali'],
  smartbinx: ['smartbin', 'waste', 'image-classification', 'efficientnet-b2'],
  'skin-cancer': ['ham10000', 'skin', 'cancer', 'derm'],
  mvbs: ['voice', 'banking', 'sahayak', 'asr'],
  'smart-bin': ['iot', 'dustbin', 'hardware'],
};
