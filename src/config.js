// Site configuration. Values can be overridden with environment variables at build time
// (create a .env file in the project root, see README).
export const config = {
  githubUser: process.env.REACT_APP_GITHUB_USER || 'thewebgenius',
  // Optional: your Hugging Face username, for the models/datasets count.
  hfUser: process.env.REACT_APP_HF_USER || '',
  // URL of the deployed code-switch tagger (Hugging Face Space). Leave empty until deployed;
  // the playground then falls back to a clearly labelled rule-based baseline.
  // Example: https://your-name-nepali-lid.hf.space
  taggerEndpoint: process.env.REACT_APP_TAGGER_ENDPOINT || '',
  // K-Means playground links. Replace with the exact LinkedIn post URL and the GitHub repo.
  kmeansPostUrl: process.env.REACT_APP_KMEANS_POST_URL || 'https://www.linkedin.com/in/shubham-shah-b6a03b296/recent-activity/all/',
  kmeansRepoUrl: process.env.REACT_APP_KMEANS_REPO_URL || 'https://github.com/thewebgenius',
};
