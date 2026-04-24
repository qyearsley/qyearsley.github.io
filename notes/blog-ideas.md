# Blog Post Ideas

## How Embeddings Work
Follow the same structure as the Markov/Transformer post: start simple, build up.
- Start with word2vec's skip-gram model
- Show how context-free embeddings evolved into contextual ones (BERT, etc.)
- "King - man + woman = queen" as a concrete example
- Possible interactive demo: embedding visualizer plotting word similarities in 2D with t-SNE

## Tone Sandhi in Wu Chinese
Sequel to the 2015 Ningbonese Tones post.
- Show how citation tones from the 2015 table get modified in multi-syllable words
- The computational angle: tone sandhi rules are essentially a state machine operating on syllable sequences
- Audio examples if possible

## Tokenization Across Languages
Intersection of linguistics and LLMs.
- Why GPT needs 2-3x more tokens for the same Chinese text vs. English
- What BPE does differently than character-level tokenization
- Why this matters for cost and performance
- Use Ningbonese examples that nobody else would think to use
