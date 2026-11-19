/**
 * The speech coach's path (spec/12, extended): nine skills, each with a foundation lesson and a
 * stretch lesson. Every lesson teaches one technique, shows a weak and a strong version, then
 * asks the student to speak and judges that technique. Content is English only at launch.
 * CONFIRM with BGDI's debate coaches (DECISIONS.md D-015).
 */

export type SkillKey =
  | "opening"
  | "signposting"
  | "reasoning"
  | "evidence"
  | "rebuttal"
  | "closing"
  | "pace"
  | "fluency"
  | "timekeeping";

export type Skill = {
  key: SkillKey;
  area: "content" | "delivery";
  name: string;
  /** One line a student understands: what "good" sounds like. */
  goal: string;
  /** What the scoring model looks for (content skills only). */
  rubric?: string;
};

export const SKILLS: Skill[] = [
  {
    key: "opening",
    area: "content",
    name: "Strong opening",
    goal: "Grab attention and say clearly which side you are on.",
    rubric: "1 = starts with no stance or greeting only; 3 = states the side and motion clearly; 5 = a hook (question, fact or short story) followed by a clear stance and a preview.",
  },
  {
    key: "signposting",
    area: "content",
    name: "Clear structure",
    goal: "Tell the listener how many points you have and where you are.",
    rubric: "1 = ideas run together; 3 = points are separated (first, second…); 5 = previews the points, signposts each one, and links them back to the motion.",
  },
  {
    key: "reasoning",
    area: "content",
    name: "Reasons that make sense",
    goal: "Explain WHY your point is true, step by step.",
    rubric: "1 = claims with no reasons; 3 = each point has a reason; 5 = each point is explained with a clear chain (because… so… which means…) tied to the motion.",
  },
  {
    key: "evidence",
    area: "content",
    name: "Examples and evidence",
    goal: "Back each point with an example, fact or story.",
    rubric: "1 = no examples; 3 = at least one relevant example; 5 = specific, relevant examples for most points, explained, not just listed.",
  },
  {
    key: "rebuttal",
    area: "content",
    name: "Answering the other side",
    goal: "Name what the other side would say, then show why it is weaker.",
    rubric: "1 = ignores the other side; 3 = names an opposing argument and responds; 5 = states the strongest opposing argument fairly and answers it with a reason or example.",
  },
  {
    key: "closing",
    area: "content",
    name: "Strong finish",
    goal: "Sum up your points and end with a line people remember.",
    rubric: "1 = stops suddenly; 3 = a short summary or clear last line; 5 = summarises the points, restates the stance and ends with a memorable final line.",
  },
  { key: "pace", area: "delivery", name: "Steady pace", goal: "Speak at a speed people can follow: about 120–160 words a minute." },
  { key: "fluency", area: "delivery", name: "Smooth delivery", goal: "Fewer ums and long silences. Pause on purpose, not by accident." },
  { key: "timekeeping", area: "delivery", name: "Using your time", goal: "Use most of your time, and finish before the end." },
];

export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.key, s])) as Record<SkillKey, Skill>;

export type Lesson = {
  key: string;
  skill: SkillKey;
  level: 1 | 2;
  title: string;
  idea: string;
  why: string;
  steps: [string, string, string];
  example: { weak: string; strong: string; note: string };
  drill: {
    instruction: string;
    motion: string;
    side: "for" | "against" | "open";
    targetSeconds: number;
    /** For the scorer: what passing this drill looks like. */
    criteria: string;
    passScore: 3 | 4;
  };
};

export const LESSONS: Lesson[] = [
  {
    key: "opening-1",
    skill: "opening",
    level: 1,
    title: "Say your side in the first breath",
    idea: "Your first sentence should tell everyone which side you are on.",
    why: "Judges and listeners decide quickly. If they know your side at once, every point after it makes sense.",
    steps: [
      "Start with: \"I strongly agree that…\" or \"I disagree that…\", then say the motion in your own words.",
      "Add one sentence saying why it matters.",
      "Then say how many points you will make.",
    ],
    example: {
      weak: "Good morning everyone. So, um, today I want to talk about phones and school and stuff.",
      strong: "I strongly believe phones should be allowed in secondary schools, because they help us learn. I have two reasons.",
      note: "The strong version gives the side, the reason and the plan in two sentences.",
    },
    drill: {
      instruction: "Give a 45-second opening only: your side, why it matters, and how many points you will make.",
      motion: "This house believes that phones should be allowed in secondary schools",
      side: "for",
      targetSeconds: 45,
      criteria: "The first one or two sentences state the side clearly; the speaker says why it matters and previews the number of points.",
      passScore: 3,
    },
  },
  {
    key: "opening-2",
    skill: "opening",
    level: 2,
    title: "Open with a hook",
    idea: "Before your stance, catch attention with a question, a surprising fact or a ten-second story.",
    why: "A hook makes people want to listen. It also shows confidence.",
    steps: [
      "Pick one hook: a question (\"Have you ever…?\"), a fact, or a tiny story.",
      "Link it straight to the motion.",
      "Then give your side and your preview, as in the first lesson.",
    ],
    example: {
      weak: "I am against this motion. My first point is about money.",
      strong: "Last term, half of my class missed lessons because of the rain. That is why I oppose this motion: our schools need roofs before they need new uniforms. I have two points.",
      note: "A short real-life picture, then the stance, then the plan.",
    },
    drill: {
      instruction: "Give a one-minute opening that starts with a hook, then your side and your preview.",
      motion: "This house believes that school uniforms should be optional",
      side: "against",
      targetSeconds: 60,
      criteria: "Begins with a hook (question, fact or short story) that links to the motion, then states the side and previews the points.",
      passScore: 4,
    },
  },
  {
    key: "signposting-1",
    skill: "signposting",
    level: 1,
    title: "Number your points",
    idea: "Say \"My first point is…\", \"My second point is…\" so nobody gets lost.",
    why: "Listeners can only follow what they can hear. Signposts are road signs for their ears.",
    steps: [
      "Decide on two points before you start.",
      "Begin each one with \"My first point…\" / \"My second point…\".",
      "Finish each point before starting the next.",
    ],
    example: {
      weak: "Coding is good and also it gives jobs and girls can do it and it is fun and the future is technology.",
      strong: "My first point is jobs: coding opens jobs in every industry. My second point is confidence: building something that works shows a girl what she can do.",
      note: "Same ideas, but now each has a label and its own space.",
    },
    drill: {
      instruction: "Speak for 90 seconds with exactly two points. Number them out loud.",
      motion: "This house believes every girl should learn to code",
      side: "for",
      targetSeconds: 90,
      criteria: "Two points, each clearly introduced with a signpost (first/second), and each finished before the next begins.",
      passScore: 3,
    },
  },
  {
    key: "signposting-2",
    skill: "signposting",
    level: 2,
    title: "Preview, signpost, link back",
    idea: "Tell them what you'll say, say it with signposts, then link each point back to the motion.",
    why: "Linking back shows the judge exactly why each point wins the debate.",
    steps: [
      "Preview: \"I will talk about safety and cost.\"",
      "Signpost each point as you reach it.",
      "End each point with \"…and that is why [the motion] is right/wrong.\"",
    ],
    example: {
      weak: "Social media is bad. People are mean online. Also it wastes time.",
      strong: "I'll show you two harms: unkindness and lost sleep. First, unkindness… and that is why social media does more harm than good. Second, lost sleep…",
      note: "The listener always knows where they are and why it matters.",
    },
    drill: {
      instruction: "Two minutes: preview two points, signpost each, and link each back to the motion.",
      motion: "This house believes that social media does more harm than good for teenagers",
      side: "for",
      targetSeconds: 120,
      criteria: "Previews the points at the start, signposts each point, and explicitly links each point back to the motion.",
      passScore: 4,
    },
  },
  {
    key: "reasoning-1",
    skill: "reasoning",
    level: 1,
    title: "Say \"because\"",
    idea: "A point is only as strong as its reason. After every claim, say \"because…\".",
    why: "Anyone can say something is true. Debaters show why.",
    steps: [
      "Make your point in one sentence.",
      "Say \"because\" and give the reason.",
      "Check: would a friend who disagrees understand your reason?",
    ],
    example: {
      weak: "Debate should be taught in every school. It is very good.",
      strong: "Debate should be taught in every school because it teaches us to listen before we answer, and that helps in every subject.",
      note: "\"It is very good\" is a feeling; \"because it teaches us to listen\" is a reason.",
    },
    drill: {
      instruction: "Speak for 90 seconds. Give two points, and after each one say \"because\" and explain.",
      motion: "This house believes that debate should be taught in every school",
      side: "for",
      targetSeconds: 90,
      criteria: "Every point has a stated reason (because…), and the reasons are relevant to the motion.",
      passScore: 3,
    },
  },
  {
    key: "reasoning-2",
    skill: "reasoning",
    level: 2,
    title: "Build a chain: because… so… which means…",
    idea: "Strong reasons go step by step, from the claim to why it matters.",
    why: "A chain closes the gaps the other side would attack.",
    steps: [
      "Claim: what is true.",
      "Because: the reason.",
      "So / which means: the result for real people, linked to the motion.",
    ],
    example: {
      weak: "Students should help make school rules because it is fair.",
      strong: "Students should help decide school rules, because rules work best when people understand them. So students who help write a rule are more likely to keep it, which means fewer punishments and more learning time.",
      note: "Each step leads to the next, ending at a result everyone cares about.",
    },
    drill: {
      instruction: "Two minutes, two points. Use \"because… so… which means…\" for each point.",
      motion: "This house believes that students should help decide school rules",
      side: "for",
      targetSeconds: 120,
      criteria: "Each point is explained as a chain of reasoning (claim, reason, consequence) that ends with why it matters for the motion.",
      passScore: 4,
    },
  },
  {
    key: "evidence-1",
    skill: "evidence",
    level: 1,
    title: "Give an example for every point",
    idea: "After your reason, say \"For example…\" and give something real.",
    why: "Examples turn ideas into pictures people can see.",
    steps: [
      "Point, then reason.",
      "Then: \"For example…\" with something from school, home, the news or your community.",
      "Keep the example short: one or two sentences.",
    ],
    example: {
      weak: "Climate change affects people a lot.",
      strong: "Climate change already affects us. For example, last year flooding in Ibadan closed schools for a week.",
      note: "A place, a time and a result make it real.",
    },
    drill: {
      instruction: "Speak for 90 seconds with two points, each with \"For example…\".",
      motion: "This house believes that climate education should start in primary school",
      side: "for",
      targetSeconds: 90,
      criteria: "Each point is supported by a specific, relevant example introduced clearly.",
      passScore: 3,
    },
  },
  {
    key: "evidence-2",
    skill: "evidence",
    level: 2,
    title: "Explain your evidence",
    idea: "Don't just drop an example. Say what it proves.",
    why: "An example with no explanation leaves the judge to guess. Explaining it wins the point.",
    steps: [
      "Give the example.",
      "Say \"This shows that…\".",
      "Link it back to your point and the motion.",
    ],
    example: {
      weak: "My cousin learnt to code. So everyone should.",
      strong: "My cousin learnt to code at fifteen and now builds websites for shops in our area. This shows that coding gives young people real income, and that is why every girl should have the chance.",
      note: "\"This shows that…\" connects the story to the argument.",
    },
    drill: {
      instruction: "Two minutes: two points, each with an example and \"This shows that…\".",
      motion: "This house believes every girl should learn to code",
      side: "for",
      targetSeconds: 120,
      criteria: "Each example is specific and is followed by an explanation of what it proves for the point and the motion.",
      passScore: 4,
    },
  },
  {
    key: "rebuttal-1",
    skill: "rebuttal",
    level: 1,
    title: "Name what the other side will say",
    idea: "Use \"Some people say… but…\" to answer the other side before they speak.",
    why: "Answering an argument before it is made shows you have thought about both sides.",
    steps: [
      "Think: what is the other side's best point?",
      "Say it fairly: \"Some people say…\".",
      "Answer it: \"But…\" with a reason.",
    ],
    example: {
      weak: "The other side is wrong about everything.",
      strong: "Some people say phones distract students. But schools can set clear phone times, the same way they set times for break.",
      note: "Fair to the other side, then a calm answer with a reason.",
    },
    drill: {
      instruction: "Speak for 90 seconds AGAINST the motion. Include one \"Some people say… but…\".",
      motion: "This house believes that phones should be allowed in secondary schools",
      side: "against",
      targetSeconds: 90,
      criteria: "States at least one argument from the other side fairly and answers it with a reason.",
      passScore: 3,
    },
  },
  {
    key: "rebuttal-2",
    skill: "rebuttal",
    level: 2,
    title: "Take on their strongest point",
    idea: "Pick the other side's best argument, not the easiest one, and show why it still loses.",
    why: "Beating the strongest point wins debates; beating a weak one convinces nobody.",
    steps: [
      "State their strongest argument in one sentence.",
      "Answer with a reason AND an example.",
      "Show why your side still wins: \"Even if that is true…\".",
    ],
    example: {
      weak: "They might say uniforms are expensive but that is not important.",
      strong: "The other side's best point is cost: uniforms are expensive. But optional uniforms cost more, because families buy clothes to keep up. Even if uniforms cost money, they cost less than the pressure to compete.",
      note: "Fair, reasoned, with an \"even if\" that keeps the win.",
    },
    drill: {
      instruction: "Two minutes. Spend at least half of it answering the other side's strongest point.",
      motion: "This house believes that school uniforms should be optional",
      side: "for",
      targetSeconds: 120,
      criteria: "Identifies a strong opposing argument, answers it with reasoning and an example, and explains why the speaker's side still wins.",
      passScore: 4,
    },
  },
  {
    key: "closing-1",
    skill: "closing",
    level: 1,
    title: "Finish with a summary",
    idea: "End with \"So, …\" and repeat your points in one or two sentences.",
    why: "People remember the end. A summary makes sure they remember your points.",
    steps: [
      "Signal the end: \"To finish…\" or \"So…\".",
      "Repeat your points in a few words each.",
      "Say your side one last time.",
    ],
    example: {
      weak: "…and yeah, that's all. Thank you.",
      strong: "So, coding gives girls jobs and confidence. For both reasons, every girl should learn to code. Thank you.",
      note: "Two points and the stance in two sentences.",
    },
    drill: {
      instruction: "Give a 90-second speech that ends with a clear summary of your points.",
      motion: "This house believes that debate should be taught in every school",
      side: "for",
      targetSeconds: 90,
      criteria: "Ends with a clear signal, a summary of the points made, and a restated stance.",
      passScore: 3,
    },
  },
  {
    key: "closing-2",
    skill: "closing",
    level: 2,
    title: "End with a line they remember",
    idea: "After the summary, finish with a short, strong last line: a call to action, a picture, or a callback to your hook.",
    why: "The last line is what the judge writes down.",
    steps: [
      "Summarise, as in the first lesson.",
      "Then one short final line (under 15 words).",
      "Stop. Don't add \"so yeah\" after it.",
    ],
    example: {
      weak: "So that's why I agree. That's my speech, thank you, I think that's all.",
      strong: "So: jobs, confidence, a future. Give every girl a keyboard, and watch what she builds.",
      note: "A short summary, then a final line with a picture.",
    },
    drill: {
      instruction: "A two-minute speech that ends with a summary and a memorable final line.",
      motion: "This house believes every girl should learn to code",
      side: "for",
      targetSeconds: 120,
      criteria: "Ends with a summary and then a short, memorable final line (call to action, image, or callback to the opening).",
      passScore: 4,
    },
  },
  {
    key: "pace-1",
    skill: "pace",
    level: 1,
    title: "Find your steady speed",
    idea: "Aim for about 140 words a minute. Too fast and people miss your points; too slow and they drift away.",
    why: "A steady speed sounds confident and gives every point time to land.",
    steps: [
      "Check your scorecard: if your pace was over 160, breathe before each new point and slow your key words.",
      "If it was under 120, plan the first few words of each point so you never wait to start.",
      "Practise reading one short paragraph aloud in about 30 seconds.",
    ],
    example: {
      weak: "(Too fast) Myfirstpointisthatsocialmediaisbad… (Too slow) My… first… um… point… is…",
      strong: "My first point (breath) is unkindness. Online, people say things they would never say to your face.",
      note: "Ready first words and a breath between points give a steady, confident speed.",
    },
    drill: {
      instruction: "Speak for 90 seconds at a steady speed. Know your first words for each point, and breathe between points.",
      motion: "This house believes that social media does more harm than good for teenagers",
      side: "open",
      targetSeconds: 90,
      criteria: "Delivery only: pace between about 120 and 160 words per minute.",
      passScore: 4,
    },
  },
  {
    key: "pace-2",
    skill: "pace",
    level: 2,
    title: "Change speed for effect",
    idea: "Good speakers slow down for important lines and speed up a little for stories.",
    why: "Changing speed keeps people listening.",
    steps: [
      "Mark your most important sentence. Say it slowly.",
      "Tell your example a little faster, like a story.",
      "Keep the overall pace steady: 120–160 words a minute.",
    ],
    example: {
      weak: "Every sentence at exactly the same speed.",
      strong: "(Faster) Last week my friend's phone buzzed through the whole maths test… (slow) Phones… do not belong… in exams.",
      note: "Fast for the story, slow for the point.",
    },
    drill: {
      instruction: "Two minutes. Slow down for your main point; tell your example a little faster.",
      motion: "This house believes that phones should be allowed in secondary schools",
      side: "against",
      targetSeconds: 120,
      criteria: "Delivery only: overall pace between about 120 and 160 words per minute.",
      passScore: 4,
    },
  },
  {
    key: "fluency-1",
    skill: "fluency",
    level: 1,
    title: "Swap \"um\" for a pause",
    idea: "When you need to think, close your mouth and pause. Silence sounds confident; \"um\" sounds unsure.",
    why: "Fillers distract from your ideas. A one-second pause is invisible.",
    steps: [
      "Notice your filler words: um, uh, like, you know.",
      "When you feel one coming, stop and breathe instead.",
      "Plan your first words for each point so you never start with \"um\".",
    ],
    example: {
      weak: "Um, so, like, my first point is, you know, about, um, jobs.",
      strong: "My first point (pause) is jobs.",
      note: "Same message, half the words, twice the confidence.",
    },
    drill: {
      instruction: "Speak for 90 seconds. Every time you need to think, pause instead of saying \"um\".",
      motion: "This house believes that debate should be taught in every school",
      side: "for",
      targetSeconds: 90,
      criteria: "Delivery only: no more than about two filler words a minute and few long silences.",
      passScore: 4,
    },
  },
  {
    key: "fluency-2",
    skill: "fluency",
    level: 2,
    title: "Never get stuck: the three-word plan",
    idea: "Long silences happen when you lose your place. Keep three words in your head, one per part of your speech.",
    why: "A tiny plan stops you freezing, without reading from paper.",
    steps: [
      "Before you start, pick three words, for example \"jobs, confidence, future\".",
      "If you lose your place, say the next word and carry on.",
      "Use short pauses on purpose between parts.",
    ],
    example: {
      weak: "My second point is… (six seconds of silence) …sorry, I forgot.",
      strong: "My second point (thinks: \"confidence\") is confidence.",
      note: "The plan word gets you moving again in a second.",
    },
    drill: {
      instruction: "Two minutes with a three-word plan. No long silences.",
      motion: "This house believes every girl should learn to code",
      side: "for",
      targetSeconds: 120,
      criteria: "Delivery only: few fillers and no pauses longer than about two and a half seconds.",
      passScore: 4,
    },
  },
  {
    key: "timekeeping-1",
    skill: "timekeeping",
    level: 1,
    title: "Plan your minutes",
    idea: "In a two-minute speech: 20 seconds to open, about 40 seconds for each point, 20 seconds to close.",
    why: "Speeches that stop too early leave points unsaid; ones that run over get cut off.",
    steps: [
      "Split your time before you speak.",
      "Glance at the timer at the end of each point.",
      "If you are early, add another example; if late, go to your summary.",
    ],
    example: {
      weak: "A 35-second speech with one idea, then \"that's all\".",
      strong: "Opening (20 s), point one with example (40 s), point two with example (40 s), summary and final line (20 s).",
      note: "A plan for the minutes means you use all of them.",
    },
    drill: {
      instruction: "Give a full two-minute speech. Aim to finish between 1:45 and 2:05.",
      motion: "This house believes that climate education should start in primary school",
      side: "for",
      targetSeconds: 120,
      criteria: "Delivery only: total length close to two minutes.",
      passScore: 4,
    },
  },
  {
    key: "timekeeping-2",
    skill: "timekeeping",
    level: 2,
    title: "Fill your time with substance",
    idea: "Using your time means more reasons and examples, not repeating yourself.",
    why: "Judges reward depth. Repetition fills time but wins nothing.",
    steps: [
      "If you have spare time, add a second example or a rebuttal.",
      "Don't repeat the same sentence in new words.",
      "Finish on time with your final line.",
    ],
    example: {
      weak: "\"As I said before… like I said… again, as I said…\"",
      strong: "\"Another example is… and some people say… but…\"",
      note: "Spare time is a chance to add, not repeat.",
    },
    drill: {
      instruction: "Two minutes, no repeating. Use spare time for an extra example or a rebuttal.",
      motion: "This house believes that students should help decide school rules",
      side: "for",
      targetSeconds: 120,
      criteria: "Uses close to two minutes with new content throughout: no repeated points; extra time used for examples or rebuttal.",
      passScore: 4,
    },
  },
];

export const LESSON = Object.fromEntries(LESSONS.map((l) => [l.key, l])) as Record<string, Lesson>;

/** The first speech: a two-minute "let's hear you" that rates every skill. */
export const PLACEMENT = {
  motion: "This house believes that debate should be taught in every school",
  side: "for" as const,
  targetSeconds: 120,
};
