# Enchanted Garden - Game Design Document

## Overview
A click-based educational game for children (primarily ages 6-8) where players help magical creatures restore an enchanted garden by completing math and reading activities.

## Target Audience
- **Primary**: 7-year-old (simple addition/subtraction, reading short sentences)
- **Secondary**: 4-year-old (letter recognition, counting)

## Core Design Principles
- Click/tap only - no arrow keys or fast reflexes needed
- No time pressure - learn at own pace
- Visual rewards for motivation
- Beautiful, calming aesthetic
- Educational content seamlessly integrated into gameplay

---

## Game Concept

### Story
The Enchanted Garden has lost its magic. Magical creatures from around the world need the player's help to restore different areas of the garden by solving puzzles and completing learning activities.

### Win Condition
Restore all areas of the garden to their full magical beauty. The game is designed for ongoing play rather than a definitive "end."

---

## Magical Creatures

Each creature has a distinct personality and guards/helps with a specific garden area:

1. **Qilin** (Chinese)
   - Gentle, wise, brings prosperity
   - Area: Number Garden / Crystal Cave
   - Specialty: Math activities with visual counting

2. **Unicorn**
   - Classic, friendly, loves beauty
   - Area: Rainbow Flower Meadow
   - Specialty: Pattern recognition, simple addition

3. **Phoenix**
   - Warm, encouraging, symbol of renewal
   - Area: Enchanted Forest / Fire Garden
   - Specialty: Reading comprehension, rebirth themes

4. **Basilisk**
   - Misunderstood, actually helpful, patient
   - Area: Rock Garden / Crystal Cave
   - Specialty: Subtraction, problem-solving

5. **Kitsune** (Japanese fox spirit)
   - Playful, clever, loves games
   - Area: Puzzle Grove
   - Specialty: Word problems, patterns

6. **Small Dragon**
   - Friendly, hardworking, loves plants
   - Area: Fruit Orchard / Vegetable Garden
   - Specialty: Counting, simple word problems

7. **Pegasus**
   - Graceful, dreamy, gentle
   - Area: Sky Garden / Cloud Islands
   - Specialty: Reading activities

8. **Gryphon**
   - Noble, protective, rewards achievement
   - Area: Treasure Garden
   - Specialty: Gives rewards, achievement tracking

---

## Garden Areas

### Phase 1 (MVP - Prototype)
**Flower Meadow** - Starting area
- Colorful flowers that bloom
- Simple, open space
- Introduces basic mechanics
- Home to Unicorn

### Phase 2 (Future)
- **Crystal Cave** - Glowing crystals, darker background
- **Enchanted Forest** - Trees that grow and change
- **Sky Garden** - Floating islands, clouds, stars
- **Water Garden** - Fountains, lily pads, fish
- **Fruit Orchard** - Trees with magical fruits

### Phase 3 (Advanced)
- **Rock Garden** - Zen-like space with stones and moss
- **Treasure Garden** - Central hub, achievement display

---

## Game Mechanics

### Navigation
- **Hub Screen**: Garden overview where player clicks on different areas
- **Activity Screen**: Where learning activities take place
- **Reward Screen**: Shows what was earned
- Simple back/forward navigation buttons

### Activity Types

#### Math Activities (Primary Focus for 7-year-old)

1. **Visual Addition**
   - "The Unicorn needs flowers. She has 5 red roses and 4 pink tulips. How many flowers total?"
   - Shows pictures of flowers
   - Click answer from 3-4 choices

2. **Visual Subtraction**
   - "There were 12 butterflies. 5 flew away. How many are left?"
   - Shows butterflies, some fading/flying away
   - Click answer from 3-4 choices

3. **Word Problems**
   - Simple story-based math (1-2 sentences)
   - Numbers under 20
   - Real-world garden scenarios

#### Reading Activities

1. **Creature Requests**
   - Short sentences (5-10 words)
   - "The Phoenix wants red crystals for the cave."
   - Click on the correct item from choices

2. **Story Snippets**
   - Brief descriptions of garden events
   - Simple comprehension question
   - "What color are the new flowers?"

3. **Item Descriptions**
   - Reading labels and matching items
   - Vocabulary building with garden/nature words

#### Pattern Activities (Both Kids)
1. **Sequence Completion**
   - Visual patterns (colors, shapes)
   - Good for both age levels

2. **Letter Hunt** (For 4-year-old)
   - Find letters hidden in the scene
   - Click to collect
   - Optional mode

### Difficulty Progression

**Easy (Levels 1-5)**
- Addition/subtraction 1-10
- 3-5 word sentences
- Visual support for all problems
- Multiple choice with 2-3 options

**Medium (Levels 6-10)**
- Numbers 1-20
- 6-10 word sentences
- Less visual support
- 3-4 answer choices

**Advanced (Levels 11+)**
- Numbers up to 30 (optional)
- Two-step problems
- Longer reading passages
- Mix of activity types

---

## Reward Systems

### Immediate Rewards (After Each Correct Answer)
- ✨ Sparkle particle effects
- 🎵 Pleasant chime sound
- Positive text message from creature
- New decoration appears in garden

### Collection Systems

1. **Garden Catalog**
   - Shows all plants/decorations unlocked
   - Visual album/collection view
   - Completion percentage

2. **Creature Sticker Book**
   - Each creature has 5-10 stickers to collect
   - Unlock through activities and achievements
   - Can view full collection

3. **Achievement Badges**
   - "First Flower!" - Complete first activity
   - "Friend of [Creature]" - Complete 10 activities with creature
   - "Garden Helper" - 25 total activities
   - "Master Gardener" - Complete all areas

4. **Garden Customization**
   - Unlock color themes for different areas
   - Special decorations (fountains, statues, etc.)
   - Rare magical items (rainbow, shooting star, etc.)

### Progress Tracking
- Current level displayed
- Total activities completed
- Gardens restored (percentage)
- Next unlock preview

---

## Visual Style

### Art Direction
- Soft, watercolor-inspired backgrounds
- Bright, magical color palette
  - Purples, blues, pinks, teals, golds
  - Pastel tones for calm feeling
- Gentle animations (floating, glowing, growing)
- Age-appropriate but not too babyish
- Nature-focused with magical elements

### UI Design
- Large, clear buttons
- High contrast text
- Simple, uncluttered layouts
- Consistent placement of navigation
- Touch-friendly (50+ pixel targets)

### Animation Principles
- Smooth, slow animations (nothing jarring)
- Positive reinforcement animations
- Growing/blooming effects for rewards
- Particle effects for magic

---

## Technical Architecture

### Technology Stack
- HTML5
- CSS3 (with animations)
- Vanilla JavaScript (ES6+)
- LocalStorage for save data
- No external dependencies initially

### File Structure
```
enchanted-garden/
├── index.html
├── styles/
│   ├── main.css
│   ├── garden.css
│   └── animations.css
├── js/
│   ├── game.js          # Main game logic
│   ├── activities.js    # Activity generation
│   ├── rewards.js       # Reward system
│   ├── storage.js       # Save/load
│   └── creatures.js     # Creature data
├── assets/
│   ├── images/
│   │   ├── creatures/
│   │   ├── plants/
│   │   └── ui/
│   └── sounds/
│       ├── chime.mp3
│       └── sparkle.mp3
└── data/
    ├── activities.json  # Activity templates
    └── rewards.json     # Reward definitions
```

### Core Systems

1. **Activity System**
   - Generate math problems dynamically
   - Template-based for variety
   - Difficulty scaling
   - Answer validation

2. **Reward System**
   - Track unlocks
   - Trigger animations
   - Update garden visuals
   - Save progress

3. **Save System**
   - LocalStorage for persistence
   - Save after each activity
   - Progress tracking
   - Achievement data

4. **Garden Rendering**
   - Dynamic element placement
   - Show/hide based on unlocks
   - Smooth transitions

---

## MVP Features (Prototype - Phase 1)

### Must Have
- [ ] One garden area (Flower Meadow)
- [ ] One creature (Unicorn)
- [ ] Basic math activities (addition 1-10)
- [ ] Simple reward system (flowers appear)
- [ ] Visual feedback (sparkles, message)
- [ ] Basic save/load
- [ ] Mobile-friendly layout

### Nice to Have
- [ ] Sound effects
- [ ] Multiple activity types
- [ ] Sticker collection
- [ ] Achievement system

### Future Phases
- [ ] Additional garden areas
- [ ] More creatures
- [ ] Reading activities
- [ ] Advanced customization
- [ ] Seasonal events
- [ ] Parental dashboard

---

## Success Metrics

### Educational Goals
- Player completes activities with 70%+ accuracy
- Shows improvement over time
- Engages for 15+ minutes per session

### Engagement Goals
- Returns to game multiple times per week
- Explores reward systems
- Shows excitement about unlocks

### User Experience Goals
- No frustration or confusion
- Can play independently
- Positive emotional response

---

## Open Questions / Decisions Needed

1. Should there be any penalty for wrong answers, or just encouragement to try again?
2. How many activities before a new unlock/reward?
3. Should the 4-year-old have a separate "mode" or just participate in main game?
4. Voice acting for creature characters? (future consideration)
5. Should we include real animal/nature facts about gardens?
6. Parental reporting - what level of detail?

---

## Development Phases

### Phase 1: MVP Prototype (Current)
- Prove core gameplay loop
- Test with target audience
- Validate educational approach
- Get feedback on visual style

### Phase 2: Content Expansion
- Add 2-3 more garden areas
- Add 2-3 more creatures
- Expand activity types
- Polish animations and rewards

### Phase 3: Feature Complete
- All planned areas and creatures
- Full achievement system
- Comprehensive reward catalog
- Sound design
- Parental features

### Phase 4: Polish & Launch
- Performance optimization
- Cross-browser testing
- Accessibility features
- Documentation

---

## Notes
- Keep everything gentle and encouraging
- No ads or external links
- Privacy-focused (no data collection)
- Can be played offline once loaded
- Designed for repeated play over weeks/months
