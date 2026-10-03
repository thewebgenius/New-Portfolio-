// A small, fully client-side assistant. No API key, no backend.
// It matches the visitor's message to a topic, remembers what was just discussed so
// follow-ups like "how accurate?" or "tell me more" work, and replies in plain, short sentences.
import { profile, projects, education, experience } from '../data/portfolioData';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const P = Object.fromEntries(projects.map((p) => [p.slug, p]));

// ---------------- matching helpers ----------------
const normalise = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s+#.-]/g, ' ').replace(/\s+/g, ' ').trim();

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

// keyword can be a single word (typo-tolerant) or a phrase (substring match)
function hits(text, words, keywords) {
  let score = 0;
  keywords.forEach((k) => {
    if (k.includes(' ')) { if (text.includes(k)) score += 3; return; }
    if (words.includes(k)) { score += 2; return; }
    if (k.length >= 5 && words.some((w) => w.length >= 4 && (w.startsWith(k) || lev(w, k) <= 1))) score += 1.5;
  });
  return score;
}

// ---------------- topics ----------------
const PROJECT_KEYS = {
  'nepali-lid': ['lid', 'language identification', 'code switch', 'code-switch', 'codeswitch', 'code mixed', 'xlm', 'roberta', 'xlm-r', 'paper', 'nlp', 'nepali english', 'token', 'research paper', 'tagger', 'research', 'main research'],
  smartbinx: ['smartbinx', 'waste', 'garbage', 'recyclable', 'organic', 'hazardous', 'efficientnet-b2', 'b2', 'image classification', 'classifier', '42000', '42,000'],
  'skin-cancer': ['skin', 'cancer', 'ham10000', 'lesion', 'melanoma', 'dermatology', 'medical', 'b4', 'efficientnet-b4'],
  mvbs: ['mvbs', 'voice', 'banking', 'sahayak', 'speech', 'asr', 'whisper', 'bank'],
  'smart-bin': ['iot', 'dustbin', 'hardware', 'arduino', 'sensor', 'sensors', 'microcontroller', 'smart bin', 'embedded'],
};

const TOPICS = [
  { id: 'greet', keys: ['hi', 'hello', 'hey', 'namaste', 'yo', 'hii', 'good morning', 'good evening', 'sup'] },
  { id: 'thanks', keys: ['thanks', 'thank', 'thx', 'dhanyabad', 'cool', 'great', 'nice', 'awesome'] },
  { id: 'bye', keys: ['bye', 'goodbye', 'see you', 'later', 'cya'] },
  { id: 'who', keys: ['who', 'about', 'yourself', 'introduce', 'background', 'shivam', 'tell me about him'] },
  { id: 'bot', keys: ['are you a bot', 'are you human', 'are you real', 'chatgpt', 'gpt', 'robot', 'are you shivam'] },
  { id: 'projects', keys: ['projects', 'project', 'work', 'built', 'portfolio', 'done'] },
  { id: 'skills', keys: ['skills', 'skill', 'stack', 'tools', 'languages', 'python', 'pytorch', 'tensorflow', 'framework', 'know'] },
  { id: 'education', keys: ['education', 'study', 'university', 'college', 'degree', 'cgpa', 'gpa', 'dit', 'btech', 'b.tech', 'school', 'graduate', 'graduation'] },
  { id: 'experience', keys: ['experience', 'intern', 'internship', 'job', 'worked'] },
  { id: 'contact', keys: ['contact', 'email', 'mail', 'reach', 'phone', 'call', 'linkedin', 'connect', 'number'] },
  { id: 'hire', keys: ['open to internships', 'internships', 'open to work', 'hire', 'hiring', 'available', 'availability', 'opportunity', 'position', 'role', 'open to', 'looking for', 'collaborate', 'collaboration'] },
  { id: 'resume', keys: ['resume', 'cv', 'résumé'] },
  { id: 'github', keys: ['github', 'code', 'repo', 'repository', 'source'] },
  { id: 'location', keys: ['where', 'location', 'based', 'live', 'country', 'nepal', 'india', 'dehradun', 'kathmandu'] },
  { id: 'interests', keys: ['interest', 'interests', 'research interests', 'focus', 'passion', 'why ml', 'goal', 'goals', 'future'] },
  { id: 'best', keys: ['best project', 'favourite', 'favorite', 'proudest', 'most proud', 'strongest'] },
  { id: 'kmeans', keys: ['kmeans', 'k-means', 'k means', 'compression', 'compress', 'colour', 'color', 'colors', 'colours', 'quantization', 'linkedin post', 'lab', 'image compression'] },
  { id: 'demo', keys: ['demo', 'try', 'playground', 'test the model'] },
  { id: 'help', keys: ['help', 'what can you', 'options', 'menu', 'what do you know'] },
];

// follow-up intents that depend on the current project in context
const FOLLOW = [
  { id: 'results', keys: ['accuracy', 'accurate', 'result', 'results', 'score', 'f1', 'metric', 'metrics', 'performance', 'numbers', 'how good', 'how well'] },
  { id: 'method', keys: ['how did', 'how was', 'how does', 'how is it', 'method', 'approach', 'build', 'built', 'train', 'trained', 'training', 'architecture', 'model', 'pipeline', 'dataset', 'data'] },
  { id: 'limits', keys: ['limitation', 'limitations', 'weakness', 'problem', 'problems', 'issue', 'issues', 'wrong', 'downside', 'caveat', 'fail', 'failed'] },
  { id: 'more', keys: ['more', 'tell me more', 'go on', 'continue', 'details', 'detail', 'elaborate'] },
  { id: 'status', keys: ['status', 'done', 'finished', 'complete', 'completed', 'pending', 'when'] },
];

// ---------------- answers ----------------
const shortTitle = {
  'nepali-lid': 'the Nepali-English language ID paper',
  smartbinx: 'SmartBinX, the waste classifier',
  'skin-cancer': 'the HAM10000 skin lesion classifier',
  mvbs: 'the voice banking assistant (MVBS)',
  'smart-bin': 'the smart IoT dustbin',
};

function projectIntro(slug) {
  switch (slug) {
    case 'nepali-lid':
      return "That's his main research right now. People in Nepal type Nepali in English letters and mix in English words, often in the same sentence. He built a dataset of 8,560 sentences (about 121k tokens) labelled word by word as Nepali, English or Other, and fine-tuned XLM-RoBERTa on it. It's being written up as a paper with his advisor.";
    case 'smartbinx':
      return 'SmartBinX sorts a photo of waste into organic, recyclable or hazardous. He swapped his old from-scratch CNN (73%) for a fine-tuned EfficientNet-B2 and got 96.44% on the test split. The interesting part is what he did next: he checked for duplicate images and found about a third of the test set was copied from training data.';
    case 'skin-cancer':
      return 'This one classifies dermatoscopic images from HAM10000 into seven lesion types with EfficientNet-B4 in PyTorch. The dataset is very imbalanced (two-thirds of images are one class), so he used class weights and judged the model by balanced accuracy instead of plain accuracy.';
    case 'mvbs':
      return "MVBS is a voice banking assistant for people who speak a Nepali-English mix. It's still pending: he's written the full technical paper and system design, built around Whisper Large-v3 and IndicConformer, and is working on the implementation now.";
    case 'smart-bin':
      return "In third year he worked with his professor on a sensor-based smart dustbin. Honestly, it didn't get finished: they ran out of time before the whole system worked end to end. The image classifier (SmartBinX) is the part he carried forward.";
    default: return '';
  }
}

function projectResults(slug) {
  switch (slug) {
    case 'nepali-lid':
      return '99.54% token accuracy on a 12,166-token test set. F1 is 0.996 for Nepali, 0.990 for English and 1.0 for Other. Before that he found and fixed a labelling mistake (numbers and loanwords like "video" marked as Nepali); the score barely changed, which shows the model wasn\'t leaning on the mistake.';
    case 'smartbinx':
      return '96.44% on the full test split, but he reports 94.75% as the honest number, because that\'s the accuracy on the 2,229 test images that don\'t also appear in training. Recyclable recall is about 90%; the most common error is recyclable predicted as organic.';
    case 'skin-cancer':
      return 'About 70.4% balanced accuracy and 73% overall accuracy on 2,024 validation images. That\'s lower than many HAM10000 numbers you see online, mostly because he split by lesion ID, so the same lesion never shows up in both train and validation.';
    case 'mvbs':
      return "No results yet. It's still being built, and he'd rather not quote numbers before there's a working prototype.";
    case 'smart-bin':
      return "There aren't results to share. It never reached a working prototype.";
    default: return '';
  }
}

function projectMethod(slug) {
  const p = P[slug];
  if (!p?.method?.length) return projectIntro(slug);
  const steps = p.method.slice(0, 3).map((m) => m.replace(/\.$/, ''));
  return `Roughly: ${steps.map((s, i) => (i === 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s.charAt(0).toLowerCase() + s.slice(1))).join('; then ')}.`;
}

function projectLimits(slug) {
  const p = P[slug];
  if (p?.limitations) return `He's upfront about this. ${p.limitations}`;
  if (slug === 'mvbs') return "The big one: it isn't built yet, so nothing has been tested on real users or real speech data.";
  return "Mainly that it didn't get finished in the time they had.";
}

const SUGGEST = {
  start: ["What's his main research?", 'Show me his projects', 'How do I contact him?'],
  project: ['How accurate is it?', 'How did he build it?', 'Any limitations?'],
  general: ['What are his skills?', 'Is he open to internships?', 'Where is he based?'],
};

export function greeting() {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return {
    text: `${part} 👋 I'm a small assistant that knows Shivam's work. Ask me about his research, a project, or how to reach him.`,
    suggestions: SUGGEST.start,
  };
}

// state: { topic: projectSlug | null, turns: number }
export function reply(message, state) {
  const text = normalise(message);
  const words = text.split(' ');
  const next = { ...state, turns: (state.turns || 0) + 1 };

  if (!text) return { text: 'Go ahead, type a question.', state: next };

  // 1. Which project, if any, is mentioned?
  let projectHit = null; let projectScore = 0;
  Object.entries(PROJECT_KEYS).forEach(([slug, keys]) => {
    const s = hits(text, words, keys);
    if (s > projectScore) { projectScore = s; projectHit = slug; }
  });

  // 2. Is it a follow-up about a project (accuracy / method / limits)?
  let follow = null; let followScore = 0;
  FOLLOW.forEach((f) => { const s = hits(text, words, f.keys); if (s > followScore) { followScore = s; follow = f.id; } });

  // 3. General topics
  let topic = null; let topicScore = 0;
  TOPICS.forEach((t) => { const s = hits(text, words, t.keys); if (s > topicScore) { topicScore = s; topic = t.id; } });

  const slug = projectHit && projectScore >= 1.5 ? projectHit : null;
  const ctx = slug || state.topic;

  // Specific project question
  if (slug || (ctx && followScore >= 1.5 && followScore >= topicScore)) {
    next.topic = ctx;
    const mode = followScore >= 1.5 ? follow : 'intro';
    const opener = slug && slug !== state.topic ? '' : pick(['', 'Sure. ', 'Good question. ', '']);
    let body;
    if (mode === 'results') body = projectResults(ctx);
    else if (mode === 'method') body = projectMethod(ctx);
    else if (mode === 'limits') body = projectLimits(ctx);
    else if (mode === 'status') body = `${P[ctx].statusText}. ${mode === 'status' && ctx === 'mvbs' ? 'He\'s actively working on it.' : ''}`.trim();
    else if (mode === 'more') {
      const asked = state.asked || {};
      body = !asked.results ? projectResults(ctx) : !asked.method ? projectMethod(ctx) : !asked.limits ? projectLimits(ctx) : `That's most of it. The full write-up is in the Research section, and you can open it with Ctrl+K → "run --project ${ctx}".`;
      const done = !asked.results ? 'results' : !asked.method ? 'method' : 'limits';
      next.asked = { ...asked, [done]: true };
    } else body = projectIntro(ctx);
    if (mode !== 'more') next.asked = { ...(state.topic === ctx ? state.asked : {}), [mode === 'intro' ? 'intro' : mode]: true };
    if (slug && slug !== state.topic) next.asked = { [mode === 'intro' ? 'intro' : mode]: true };
    return {
      text: opener + body,
      state: next,
      suggestions: SUGGEST.project,
      action: mode === 'intro' && slug ? { label: 'Open this project', project: ctx } : null,
    };
  }

  next.topic = topicScore >= 1.5 && ['projects', 'best'].includes(topic) ? state.topic : (topicScore >= 2 ? null : state.topic);

  switch (topicScore >= 1.5 ? topic : null) {
    case 'greet':
      return { text: pick(['Hey! What would you like to know about Shivam?', 'Hi there. Ask me anything about his work — research, projects, or how to get in touch.', 'Hello! Happy to help. Research, projects or contact details?']), state: next, suggestions: SUGGEST.start };
    case 'thanks':
      return { text: pick(['Glad that helped.', 'Anytime.', 'No problem! Anything else?']), state: next, suggestions: SUGGEST.general };
    case 'bye':
      return { text: pick(['Bye! If you want to reach him, the email is ' + profile.email + '.', 'Take care. Thanks for stopping by.']), state: next };
    case 'bot':
      return { text: "I'm a small scripted assistant, not Shivam and not a large language model. Everything runs in your browser. For anything I can't answer, email him directly at " + profile.email + '.', state: next, suggestions: SUGGEST.start };
    case 'who':
      return { text: `Shivam is a final-year B.Tech CSE (AI/ML) student at DIT University, from Nepal. Most of his work is NLP for Nepali-English code-mixed text, plus image classification for medical and environmental problems. What stands out is that he checks his own numbers — duplicate audits, leakage-free splits — before reporting them.`, state: next, suggestions: SUGGEST.start };
    case 'projects':
    case 'best': {
      const lines = projects.map((p) => `• ${shortTitle[p.slug]} (${p.statusText.toLowerCase()})`).join('\n');
      return { text: (topic === 'best' ? "I'd point you to the language ID paper first. It's his most original work. Here's everything:\n" : "Here's what he's worked on:\n") + lines + '\n\nWhich one should I tell you about?', state: next, suggestions: ['The language ID paper', 'SmartBinX', 'Skin cancer model'] };
    }
    case 'skills':
      return { text: "Mostly Python. For deep learning he uses PyTorch and Keras/TensorFlow, Hugging Face Transformers (XLM-RoBERTa for the NLP work) and EfficientNet/ResNet for vision. Plus scikit-learn, Pandas and NumPy for the usual data work, and C and Java from coursework. He trains on Kaggle and Colab GPUs.", state: next, suggestions: SUGGEST.general };
    case 'education':
      return { text: `${education[0].place}, ${education[0].detail.replace('.', '')} (${education[0].period}). Before that, ${education[1].detail.toLowerCase().replace('.', '')} at ${education[1].place}.`, state: next, suggestions: SUGGEST.general };
    case 'experience':
      return { text: `He did a 3-month internship at ${experience[0].org}, working on ML tooling and real IT projects with a team. Since then most of his experience is independent research, mainly the Nepali-English NLP paper.`, state: next, suggestions: ['Tell me about the paper', 'Is he open to internships?'] };
    case 'contact':
      return { text: `Email is best: ${profile.email}. You can also find him on LinkedIn and GitHub (links are at the top and bottom of the page), or call ${profile.phones[0]}.`, state: next, action: { label: 'Write an email', href: `mailto:${profile.email}` } };
    case 'hire':
      return { text: `Yes. He's looking for research internships and collaborations, especially in NLP for low-resource languages. The quickest route is an email to ${profile.email}.`, state: next, action: { label: 'Write an email', href: `mailto:${profile.email}` }, suggestions: ['Can I see his résumé?', "What's his main research?"] };
    case 'resume':
      return { text: 'Sure, here it is as a PDF.', state: next, action: { label: 'Download résumé', href: profile.links.resume, download: true } };
    case 'github':
      return { text: 'His code is on GitHub under thewebgenius. There\'s also a live summary of his repositories further down this page.', state: next, action: { label: 'Open GitHub', href: profile.links.github, external: true } };
    case 'location':
      return { text: `He splits his time between ${profile.location.replace(' and ', ' (studying) and ')} (home).`, state: next, suggestions: SUGGEST.general };
    case 'interests':
      return { text: "Three things, mostly: NLP for code-switched text like Nepali-English, speech systems for low-resource languages, and evaluation you can actually trust — leakage checks, grouped splits, that sort of thing.", state: next, suggestions: SUGGEST.start };
    case 'kmeans':
      return { text: "That's his K-Means colour compression experiment. It started as a LinkedIn post (132,666 colours down to 16) that got over 211K impressions. There's now a playground page where you can drop in your own photo and slide K from 2 to 64 — it all runs in your browser.", state: next, action: { label: 'Open the playground', href: '/lab/kmeans' } };
    case 'demo':
      return { text: 'There\'s a tagger demo on this page. Type a Nepali-English sentence and each word gets tagged. Right now it runs a simple baseline until the trained model is hosted.', state: next, action: { label: 'Go to the demo', section: 'playground' } };
    case 'help':
      return { text: 'I can tell you about his research and projects, results and limitations of each one, his skills and education, and how to contact him. Or press Ctrl+K to jump anywhere on the page.', state: next, suggestions: SUGGEST.start };
    default:
      break;
  }

  // Fallback: be honest, offer a way forward.
  return {
    text: pick([
      "I'm not sure about that one — I only know about Shivam's work. Try asking about a project, his skills, or how to reach him.",
      "Hmm, that's outside what I know. For anything specific, emailing him is the best bet: " + profile.email + '.',
      "I didn't quite catch that. You could ask things like \"how accurate is the paper's model?\" or \"is he open to internships?\"",
    ]),
    state: next,
    suggestions: SUGGEST.start,
  };
}
