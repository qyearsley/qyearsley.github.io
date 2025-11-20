/**
 * Decodable stories for reading comprehension activities
 * Stories are organized by difficulty level and designed to be:
 * - Age-appropriate for the target reading level
 * - Phonetically decodable using learned patterns
 * - Engaging with relatable scenarios
 */

/**
 * Explorer level stories (Ages 5-7)
 * Characteristics:
 * - Simple CVC words
 * - Short sentences (3-5 words)
 * - Concrete, familiar concepts
 * - High-frequency sight words
 */
export const EXPLORER_STORIES = [
  {
    text: "The cat sat. The cat ran.",
    question: "What did the cat do?",
    answer: "sat and ran",
    choices: ["sat and ran", "jumped", "slept"],
  },
  {
    text: "I see a red hat. I see a big hat.",
    question: "What color is the hat?",
    answer: "red",
    choices: ["red", "blue", "green"],
  },
  {
    text: "The dog can run. The dog can jump.",
    question: "What can the dog do?",
    answer: "run and jump",
    choices: ["run and jump", "swim", "fly"],
  },
  {
    text: "The sun is hot. The sun is big and yellow.",
    question: "What is hot?",
    answer: "the sun",
    choices: ["the sun", "the moon", "the snow"],
  },
  {
    text: "I have a pet. My pet is a bug. The bug is in a box.",
    question: "Where is the bug?",
    answer: "in a box",
    choices: ["in a box", "on a bed", "in a cup"],
  },
  {
    text: "Dad can fix the top. The top can spin.",
    question: "What can spin?",
    answer: "the top",
    choices: ["the top", "the dad", "the box"],
  },
  {
    text: "Mom has a red pen. She can write with the pen.",
    question: "What color is the pen?",
    answer: "red",
    choices: ["red", "black", "blue"],
  },
  {
    text: "The pig sat in mud. The pig is wet and happy.",
    question: "How does the pig feel?",
    answer: "happy",
    choices: ["happy", "sad", "mad"],
  },
  {
    text: "I have ten cups. My cups are on top of the box.",
    question: "How many cups are there?",
    answer: "ten",
    choices: ["ten", "two", "one"],
  },
  {
    text: "The fox ran fast. The fox ran into the den.",
    question: "Where did the fox run?",
    answer: "into the den",
    choices: ["into the den", "to the sun", "to the bag"],
  },
]

/**
 * Adventurer level stories (Ages 7-9)
 * Characteristics:
 * - CVCe words, digraphs, blends
 * - Longer sentences (5-10 words)
 * - More complex plots
 * - Past and future tense
 */
export const ADVENTURER_STORIES = [
  {
    text: "The boy rode his bike to the park. He played on the swings. Then he went home.",
    question: "Where did the boy go?",
    answer: "the park",
    choices: ["the park", "the store", "school"],
  },
  {
    text: "She made a cake for her friend. The cake was very good. They ate it together.",
    question: "Who was the cake for?",
    answer: "her friend",
    choices: ["her friend", "her mom", "herself"],
  },
  {
    text: "A ship sailed on the blue sea. The ship had white sails. A whale swam next to the ship.",
    question: "What swam next to the ship?",
    answer: "a whale",
    choices: ["a whale", "a fish", "a shark"],
  },
  {
    text: "Jake got a kite for his birthday. The kite was red and yellow. He flew it at the beach with his dad.",
    question: "Where did Jake fly the kite?",
    answer: "at the beach",
    choices: ["at the beach", "at home", "at school"],
  },
  {
    text: "The bird made a nest in the tree. She laid three eggs in the nest. Then she sat on the eggs to keep them warm.",
    question: "How many eggs did the bird lay?",
    answer: "three",
    choices: ["three", "two", "five"],
  },
  {
    text: "Mike and Jane went to the lake. They took a rope and swung into the water. The water was cold but fun.",
    question: "How was the water?",
    answer: "cold but fun",
    choices: ["cold but fun", "hot", "dirty"],
  },
  {
    text: "Mom went shopping for food. She got apples, bread, and fish. When she came home, she made lunch.",
    question: "What did Mom do after shopping?",
    answer: "made lunch",
    choices: ["made lunch", "went to sleep", "read a book"],
  },
  {
    text: "The train was late. Dad had to wait at the station. When the train came, he got on and went to work.",
    question: "Why did Dad wait?",
    answer: "the train was late",
    choices: ["the train was late", "he forgot something", "he was early"],
  },
  {
    text: "Grace likes to paint. She painted a picture of her home. It had a red door and white walls.",
    question: "What color was the door?",
    answer: "red",
    choices: ["red", "white", "blue"],
  },
  {
    text: "The chipmunk was looking for nuts. It found five nuts under a big tree. The chipmunk hid them for winter.",
    question: "Why did the chipmunk hide the nuts?",
    answer: "for winter",
    choices: ["for winter", "to play", "to share"],
  },
]

/**
 * Master level stories (Ages 9-11)
 * Characteristics:
 * - Multi-syllable words
 * - Complex vocabulary
 * - Inference questions
 * - Multiple clauses and conjunctions
 */
export const MASTER_STORIES = [
  {
    text: "The rabbit hopped quickly through the garden. It was looking for fresh carrots to eat. The farmer didn't see it.",
    question: "What was the rabbit looking for?",
    answer: "carrots",
    choices: ["carrots", "lettuce", "flowers"],
  },
  {
    text: "Before the storm came, the children played outside. They ran and laughed together. When the rain started, they hurried inside.",
    question: "What happened when the rain started?",
    answer: "they went inside",
    choices: ["they went inside", "they kept playing", "they cried"],
  },
  {
    text: "The scientist studied the night sky through her telescope. She discovered a bright comet that nobody had seen before. She was very excited to share her discovery.",
    question: "What did the scientist discover?",
    answer: "a comet",
    choices: ["a comet", "a planet", "a star"],
  },
  {
    text: "Marcus walked his dog every morning before school. Today, the dog stopped to sniff an interesting bush. They were almost late, but Marcus didn't mind.",
    question: "When does Marcus walk his dog?",
    answer: "every morning",
    choices: ["every morning", "after school", "at night"],
  },
  {
    text: "The library was quiet as students studied for their tests. Sarah needed a book about animals. The librarian helped her find the perfect one.",
    question: "Who helped Sarah find a book?",
    answer: "the librarian",
    choices: ["the librarian", "her teacher", "her friend"],
  },
  {
    text: "During art class, the teacher showed students how to mix colors. When you mix blue and yellow, you get green. The students practiced with their paints.",
    question: "What color do you get from mixing blue and yellow?",
    answer: "green",
    choices: ["green", "purple", "orange"],
  },
  {
    text: "The butterfly emerged from its cocoon in the garden. Its wings were still wet and crumpled. After an hour in the sun, the butterfly could finally fly.",
    question: "Why couldn't the butterfly fly at first?",
    answer: "its wings were wet",
    choices: ["its wings were wet", "it was scared", "it was sleeping"],
  },
  {
    text: "The soccer team practiced twice a week after school. They worked on passing and shooting goals. Their hard work paid off when they won the championship.",
    question: "What did the team win?",
    answer: "the championship",
    choices: ["the championship", "a trophy", "new uniforms"],
  },
  {
    text: "Grandma's recipe for cookies was a family secret. She used brown sugar, butter, and a special spice. Everyone agreed her cookies were the best in town.",
    question: "What was special about Grandma's recipe?",
    answer: "it was a family secret",
    choices: ["it was a family secret", "it was very old", "it was easy"],
  },
  {
    text: "The mountain climbers reached the summit just as the sun was rising. They were tired but proud. The view from the top was worth every difficult step.",
    question: "When did they reach the summit?",
    answer: "at sunrise",
    choices: ["at sunrise", "at sunset", "at noon"],
  },
]

/**
 * Get stories for a given difficulty level
 * @param {'explorer'|'adventurer'|'master'} difficulty - Difficulty level
 * @returns {Array} Array of story objects
 */
export function getStoriesForDifficulty(difficulty) {
  switch (difficulty) {
    case "explorer":
      return EXPLORER_STORIES
    case "adventurer":
      return ADVENTURER_STORIES
    case "master":
      return MASTER_STORIES
    default:
      return EXPLORER_STORIES
  }
}
