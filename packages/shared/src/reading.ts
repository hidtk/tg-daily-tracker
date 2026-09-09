/**
 * Original IELTS-style Academic Reading mini-tests (13 questions each).
 * Texts are written for this project — no copyrighted exam material is reproduced.
 */

export type QuestionType = 'tfng' | 'mcq' | 'gap';

export interface ReadingQuestion {
  n: number;
  type: QuestionType;
  prompt: string;
  /** mcq only */
  options?: string[];
  /** canonical answer: 'TRUE'|'FALSE'|'NOT GIVEN' | 'A'..'D' | word */
  answer: string;
  /** extra accepted spellings for gap answers */
  accept?: string[];
  explain: string;
}

export interface ReadingTest {
  id: string;
  title: string;
  topic: string;
  minutes: number;
  /** paragraphs; first char + '. ' prefix is the paragraph label */
  paragraphs: string[];
  questions: ReadingQuestion[];
}

export const READING_TESTS: ReadingTest[] = [
  {
    id: 'rt-01',
    title: 'The Return of the Tram',
    topic: 'Urban transport',
    minutes: 15,
    paragraphs: [
      'A. For most of the twentieth century, the tram was treated as an embarrassment. Between 1930 and 1960, cities across Europe and North America tore up thousands of kilometres of rail embedded in their streets, arguing that fixed tracks were inflexible, that maintenance was expensive, and above all that the future belonged to the private car. Buses could be rerouted overnight; trams could not. By 1962, London, which had once operated one of the largest networks in the world, had removed its last tram line. The decision was widely applauded at the time.',
      'B. The reversal, when it came, was driven less by nostalgia than by arithmetic. A modern tram of thirty metres carries roughly 200 passengers and occupies the road space of about three cars. Planners in the 1980s, facing congestion that no amount of new road building seemed to relieve, began to calculate how much street space each mode of transport actually consumed per traveller. The results were uncomfortable for the car. In Grenoble, France, where a new line opened in 1987, the city found that the corridor served by the tram moved more people after the tracks were laid than it had when the same street was given over entirely to traffic.',
      'C. Grenoble’s line mattered for another reason: it was the first in the world designed from the outset with a low floor, allowing passengers to step directly from the pavement into the vehicle without climbing steps. The innovation had been proposed for decades, but it required engineers to redesign the axles and motors that had traditionally sat beneath the passenger compartment. Once solved, the low floor changed who used trams. Parents with pushchairs, elderly passengers and wheelchair users, all of whom had found the older vehicles difficult, became a visible part of the ridership.',
      'D. Cost remains the strongest argument against the tram. A kilometre of new tramway in Europe typically costs between 15 and 30 million euros, several times the price of a bus lane with comparable capacity. Supporters answer that the comparison is misleading, because the two investments do not produce the same effects. Property values along tram corridors tend to rise, and the rise is measurable: studies in several German and French cities have recorded increases of between 5 and 15 per cent for homes within 500 metres of a stop. Critics reply, reasonably enough, that this is a transfer of wealth to existing landowners rather than the creation of new value.',
      'E. What is less disputed is the effect on driver behaviour. Because tram tracks are permanent, businesses and residents treat them as a commitment in a way that they do not treat a bus route, which a transport authority can cancel at short notice. Surveys in Bordeaux and Nottingham have found that a significant minority of new tram passengers previously travelled by car, whereas new bus services in the same cities drew most of their passengers from people who had been walking, cycling or not travelling at all. The tram appears to be unusually good at persuading drivers to leave the car behind — though researchers caution that the effect may owe as much to the accompanying restrictions on parking as to the vehicle itself.',
      'F. The current generation of projects is quieter about revolution. Rather than replacing the car, most new lines are designed to link the fragments of a city that other modes serve badly: a hospital on a ring road, a university campus, a district of new housing built on former industrial land. Whether that modest ambition justifies the expense is a political question rather than a technical one, and cities continue to answer it in opposite ways. Bergen built; Edinburgh built, expensively and late; other cities of similar size have looked at the figures and decided that a good bus is enough.',
    ],
    questions: [
      { n: 1, type: 'tfng', prompt: 'London removed its last tram line before 1960.', answer: 'FALSE', explain: 'Paragraph A: the last line went by 1962, not before 1960.' },
      { n: 2, type: 'tfng', prompt: 'In the mid-twentieth century buses were considered more flexible than trams.', answer: 'TRUE', explain: 'Paragraph A: "Buses could be rerouted overnight; trams could not."' },
      { n: 3, type: 'tfng', prompt: 'The Grenoble line of 1987 was the first tramway to be built in France.', answer: 'NOT GIVEN', explain: 'The text calls it the first in the world with a low floor, but says nothing about it being France’s first tramway.' },
      { n: 4, type: 'tfng', prompt: 'The low-floor design required mechanical parts to be moved from under the passenger area.', answer: 'TRUE', explain: 'Paragraph C: engineers had to redesign the axles and motors that had sat beneath the passenger compartment.' },
      { n: 5, type: 'tfng', prompt: 'A kilometre of tramway costs less than a bus lane of similar capacity.', answer: 'FALSE', explain: 'Paragraph D: it costs several times the price of a bus lane.' },
      { n: 6, type: 'mcq', prompt: 'According to paragraph B, what did planners in the 1980s begin to calculate?', options: ['The total number of cars registered in city centres', 'How much street space each traveller used, by mode of transport', 'The cost of building new urban motorways', 'The average speed of buses in traffic'], answer: 'B', explain: 'They calculated street space consumed per traveller by each mode.' },
      { n: 7, type: 'mcq', prompt: 'What criticism is made of the rise in property values near tram stops?', options: ['The rise has never been measured reliably', 'It proves that trams create new wealth', 'It moves wealth to existing owners rather than creating it', 'It happens only in German cities'], answer: 'C', explain: 'Paragraph D: critics call it a transfer of wealth to existing landowners.' },
      { n: 8, type: 'mcq', prompt: 'In Bordeaux and Nottingham, most passengers on new bus services previously:', options: ['drove cars', 'walked, cycled or did not travel', 'used the tram', 'came from outside the city'], answer: 'B', explain: 'Paragraph E contrasts tram users (ex-drivers) with bus users (ex-walkers/cyclists/non-travellers).' },
      { n: 9, type: 'mcq', prompt: 'What does the writer suggest about the newest tram projects?', options: ['They intend to remove cars from city centres', 'They have more limited aims than earlier schemes', 'They are considerably cheaper to build', 'They have been abandoned by most cities'], answer: 'B', explain: 'Paragraph F: they are "quieter about revolution" and aim to link poorly served fragments.' },
      { n: 10, type: 'gap', prompt: 'A thirty-metre tram uses roughly the road space of three ______.', answer: 'cars', explain: 'Paragraph B.' },
      { n: 11, type: 'gap', prompt: 'Researchers warn that part of the effect on drivers may come from restrictions on ______.', answer: 'parking', explain: 'Paragraph E.' },
      { n: 12, type: 'gap', prompt: 'Unlike a bus route, a tram line is treated by local businesses as a ______.', answer: 'commitment', explain: 'Paragraph E.' },
      { n: 13, type: 'gap', prompt: 'New lines are built to connect parts of a city that other modes ______ badly.', answer: 'serve', accept: ['served'], explain: 'Paragraph F: "link the fragments of a city that other modes serve badly".' },
    ],
  },
  {
    id: 'rt-02',
    title: 'How Honeybees Find Their Way',
    topic: 'Animal behaviour',
    minutes: 15,
    paragraphs: [
      'A. A honeybee that discovers a good source of nectar may be several kilometres from home, yet it returns to a hive entrance a few centimetres wide, and it usually does so directly rather than by retracing the meandering path of its outward journey. How this is possible has occupied biologists since the 1940s, when Karl von Frisch showed that returning foragers perform a repetitive "waggle dance" on the vertical comb, and that the angle and the duration of the dance encode the direction and the distance of the food.',
      'B. Von Frisch’s central claim was that the bee measures direction relative to the sun. Because the dance takes place inside a dark hive on a vertical surface, the insect must translate a horizontal angle into a vertical one: a run straight up the comb means "fly towards the sun", and a run forty degrees to the left of vertical means "fly forty degrees to the left of the sun". The proposal met scepticism for many years, partly because it credited an insect with a symbolic communication system, and partly because the sun moves. A dance performed at nine in the morning would, if read literally three hours later, send a recruit in the wrong direction.',
      'C. Bees solve the second problem by compensating for the sun’s movement. Foragers kept in darkness for several hours and then released adjust their dances by roughly fifteen degrees for every hour of confinement, which corresponds to the sun’s apparent motion across the sky. The correction is not worked out individually from scratch; young bees that have never foraged already show a rough version of it, refining the estimate as they gain experience of the local sky.',
      'D. On cloudy days the sun is often invisible, and yet foraging continues. The explanation lies in a property of light that humans cannot see. Sunlight scattered by the atmosphere becomes polarised in a pattern that circles the sun, and this pattern is still present in patches of blue sky between clouds. A specialised region at the top of the bee’s compound eye is sensitive to the direction of polarisation, so a small window of sky is enough to locate the sun indirectly.',
      'E. Direction alone is insufficient; a forager must also know how far it has flown. For a long time researchers assumed that bees measured effort — the energy consumed on the outward trip. An elegant experiment made this unlikely. Bees were trained to fly along a narrow tunnel whose walls were lined with vertical stripes. When the stripes were made narrower, the pattern flowed past the insect’s eyes more rapidly, and on returning to the hive the bees danced as though the tunnel had been far longer than it was. What the bee appears to count is not fuel or wingbeats but the amount of visual motion crossing its eyes, a measure known as optic flow.',
      'F. The system, impressive as it is, is easily fooled, and this may prove useful. Because distance is judged visually, a landscape of uniform fields offers fewer visual features than a hedgerow-rich one, and bees flying over it report shorter distances than they have actually travelled. Some researchers suggest that the resulting errors in recruitment could be one of several reasons why colonies fare poorly in intensively farmed landscapes, though the evidence remains circumstantial.',
    ],
    questions: [
      { n: 1, type: 'tfng', prompt: 'Von Frisch’s explanation of the waggle dance was accepted by biologists straight away.', answer: 'FALSE', explain: 'Paragraph B: the proposal met scepticism for many years.' },
      { n: 2, type: 'tfng', prompt: 'A dance run pointing straight up the comb indicates food in the direction of the sun.', answer: 'TRUE', explain: 'Paragraph B states this directly.' },
      { n: 3, type: 'tfng', prompt: 'Bees held in the dark change the angle of their dance to allow for the sun’s movement.', answer: 'TRUE', explain: 'Paragraph C: about fifteen degrees per hour of confinement.' },
      { n: 4, type: 'tfng', prompt: 'Young bees learn sun compensation entirely by copying experienced foragers.', answer: 'FALSE', explain: 'Paragraph C: bees that have never foraged already show a rough version of the correction.' },
      { n: 5, type: 'tfng', prompt: 'Bees fly more slowly on cloudy days than in bright sunshine.', answer: 'NOT GIVEN', explain: 'The passage discusses navigation under cloud but never compares flight speed.' },
      { n: 6, type: 'mcq', prompt: 'What does the tunnel experiment suggest about how bees judge distance?', options: ['They measure the energy they consume', 'They count their wingbeats', 'They measure the visual motion passing their eyes', 'They measure the time the flight takes'], answer: 'C', explain: 'Paragraph E: optic flow, not fuel or wingbeats.' },
      { n: 7, type: 'mcq', prompt: 'Why did narrower stripes change the bees’ dances?', options: ['The tunnel was harder to enter', 'The pattern appeared to pass them more quickly', 'The bees tired more quickly', 'The light inside was dimmer'], answer: 'B', explain: 'Paragraph E: narrower stripes made the pattern flow past faster.' },
      { n: 8, type: 'mcq', prompt: 'What does the writer say about uniform farmland?', options: ['It has been proved to cause colony collapse', 'It leads bees to underestimate the distance flown', 'It blocks polarised light', 'It has no measurable effect on bees'], answer: 'B', explain: 'Paragraph F: fewer visual features, so reported distances are shorter than the real ones.' },
      { n: 9, type: 'mcq', prompt: 'Which part of the eye detects the direction of polarisation?', options: ['The lower edge of the eye', 'The entire compound eye', 'A specialised region at the top', 'The cells that detect colour'], answer: 'C', explain: 'Paragraph D.' },
      { n: 10, type: 'gap', prompt: 'The dance encodes both the direction of the food and its ______.', answer: 'distance', explain: 'Paragraph A.' },
      { n: 11, type: 'gap', prompt: 'Confined bees adjust their dance by about fifteen degrees for every ______ of confinement.', answer: 'hour', explain: 'Paragraph C.' },
      { n: 12, type: 'gap', prompt: 'The polarisation of scattered sunlight forms a pattern that circles the ______.', answer: 'sun', explain: 'Paragraph D.' },
      { n: 13, type: 'gap', prompt: 'The measure of visual motion used by bees is called optic ______.', answer: 'flow', explain: 'Paragraph E.' },
    ],
  },
  {
    id: 'rt-03',
    title: 'The Business of Bottled Water',
    topic: 'Economics and environment',
    minutes: 15,
    paragraphs: [
      'A. Bottled water is one of the strangest commercial successes of the last fifty years. In most wealthy countries a household can draw drinking water from a tap at a cost of roughly one-tenth of a cent per litre. The same litre, placed in a plastic bottle and moved to a supermarket shelf, sells for between five hundred and a thousand times that amount, and demand has grown in almost every year since 1980. Explaining the gap between what the product costs to supply and what people willingly pay for it has become a small industry in itself.',
      'B. Part of the answer is straightforward. In many countries the tap water is not in fact safe, and bottled water is bought for the same reason as any other reliable good. But the fastest growth in recent decades has been in places where the public supply is closely monitored and demonstrably safe. In these markets, surveys repeatedly find that consumers rate bottled water as purer than tap water, even though blind taste tests generally fail to show a consistent preference, and even though a substantial share of the bottled water sold is itself drawn from municipal supplies and then filtered.',
      'C. Marketing accounts for much of the difference in perception. The imagery used on labels — glaciers, springs, mountains — associates the contents with landscapes that are remote and untouched, while the language of purification borrows from medicine. Regulators in several countries have restricted the most obvious claims, but the pictures remain, and pictures are difficult to regulate. There is also a plain matter of convenience: a sealed bottle can be carried anywhere, whereas refilling a container from a tap requires both a container and a tap, neither of which is always at hand.',
      'D. The environmental case against the industry has grown steadily louder. Producing a one-litre plastic bottle requires several times that volume of water and a quantity of energy that varies with the resin used and the distance travelled. Recycling rates are lower than the industry’s own figures often suggest, because those figures usually count bottles collected rather than bottles that re-enter production. In response, several large producers have committed to increasing the recycled content of their packaging — a change that reduces the demand for new plastic without reducing the number of bottles in circulation.',
      'E. Municipal responses have varied. A number of universities, and a smaller number of cities, have banned the sale of bottled water on their premises, generally combining the ban with the installation of drinking fountains. Evaluations of these schemes are mixed: consumption of bottled water falls, as intended, but in at least one well-documented case the sale of other bottled drinks, including sugary ones, rose by more than the fall in water sales. The lesson drawn by some researchers is that removing an option changes behaviour in ways that are hard to predict, and that providing an attractive alternative matters more than prohibition.',
      'F. The industry’s own view of its future is revealing. Company reports increasingly describe the competition not as tap water but as other packaged drinks, a framing under which bottled water appears as the healthy choice. Measured against a fizzy drink rather than a tap, the product looks quite different — which is presumably the point.',
    ],
    questions: [
      { n: 1, type: 'tfng', prompt: 'Bottled water can cost several hundred times more per litre than tap water.', answer: 'TRUE', explain: 'Paragraph A: five hundred to a thousand times more.' },
      { n: 2, type: 'tfng', prompt: 'Blind taste tests usually show a clear preference for bottled water.', answer: 'FALSE', explain: 'Paragraph B: such tests generally fail to show a consistent preference.' },
      { n: 3, type: 'tfng', prompt: 'Some bottled water comes from public water systems.', answer: 'TRUE', explain: 'Paragraph B: a substantial share is drawn from municipal supplies and filtered.' },
      { n: 4, type: 'tfng', prompt: 'Most countries have banned mountain and glacier imagery on water labels.', answer: 'FALSE', explain: 'Paragraph C: some claims are restricted, but the pictures remain.' },
      { n: 5, type: 'tfng', prompt: 'Sales of bottled water have grown faster in Asia than in Europe.', answer: 'NOT GIVEN', explain: 'No regional comparison of growth appears in the passage.' },
      { n: 6, type: 'mcq', prompt: 'What does the writer say about the industry’s recycling figures?', options: ['They are generally accurate', 'They count bottles collected rather than bottles reused', 'They exclude bottles sold abroad', 'They have improved every year since 1980'], answer: 'B', explain: 'Paragraph D.' },
      { n: 7, type: 'mcq', prompt: 'What happened in at least one place where bottled water sales were banned?', options: ['Total drink sales fell sharply', 'Sales of other bottled drinks increased', 'The drinking fountains were removed', 'Students began bringing water from home'], answer: 'B', explain: 'Paragraph E: sales of other bottled drinks, including sugary ones, rose.' },
      { n: 8, type: 'mcq', prompt: 'According to the final paragraph, the industry now presents its competition as:', options: ['tap water', 'other packaged drinks', 'home filtration systems', 'imported mineral water'], answer: 'B', explain: 'Paragraph F.' },
      { n: 9, type: 'mcq', prompt: 'Which practical advantage of bottled water does the writer mention?', options: ['It is cheaper in the long run', 'It contains added minerals', 'It is sealed and can be carried anywhere', 'It tastes better than tap water'], answer: 'C', explain: 'Paragraph C: convenience of a sealed, portable bottle.' },
      { n: 10, type: 'gap', prompt: 'Using recycled material reduces demand for new ______.', answer: 'plastic', explain: 'Paragraph D.' },
      { n: 11, type: 'gap', prompt: 'Bans were usually combined with the installation of drinking ______.', answer: 'fountains', explain: 'Paragraph E.' },
      { n: 12, type: 'gap', prompt: 'The vocabulary used to describe purification is borrowed from ______.', answer: 'medicine', explain: 'Paragraph C.' },
      { n: 13, type: 'gap', prompt: 'Researchers argue that offering an attractive ______ works better than prohibition.', answer: 'alternative', explain: 'Paragraph E.' },
    ],
  },
  {
    id: 'rt-04',
    title: 'Sleep and Memory',
    topic: 'Psychology',
    minutes: 15,
    paragraphs: [
      'A. The idea that sleep does something for memory is old, and for most of its history it rested on a simple observation: material learned before a night’s sleep is remembered better than material learned before an equivalent period awake. The obvious explanation was that sleep protects memories passively, by preventing new experiences from interfering with them. Recent work suggests that something more active is going on.',
      'B. Sleep is not uniform. It cycles through stages, of which two matter most here: slow-wave sleep, which dominates the first half of the night and is marked by large, synchronised waves of electrical activity, and rapid eye movement (REM) sleep, which occupies a growing share of each cycle towards morning. Experiments that wake volunteers selectively, allowing one stage while suppressing the other, find different effects. Loss of slow-wave sleep chiefly damages memory for facts and events; loss of REM sleep interferes more with skills and with emotional material.',
      'C. The most direct evidence for an active process comes from recordings made in the brains of rats. While an animal runs through a maze, particular cells in the hippocampus fire in a particular sequence as it passes particular places. During the slow-wave sleep that follows, the same cells fire in the same order, but compressed — the sequence runs perhaps twenty times faster than the original experience. This "replay" occurs more often after difficult sessions than after easy ones, and its frequency predicts how well the animal performs the next day.',
      'D. Replay appears to serve a transfer function. The hippocampus learns quickly but stores little; the cortex learns slowly but stores a great deal. Repeated replay during sleep is thought to train the cortex gradually on material that the hippocampus captured in a single episode, which would explain why memories become progressively less dependent on the hippocampus as they age. Damage to that structure typically destroys recent memories while leaving distant ones intact.',
      'E. If replay can be measured, it can perhaps be encouraged. In one widely repeated experiment, volunteers learned the positions of objects on a screen while a particular odour was present. When the same odour was released during slow-wave sleep that night, recall the following morning was better than when it was not. The same has been shown with sounds paired with individual items: presenting a sound quietly during sleep improves memory for the item associated with it and, more strikingly, appears to do so at the expense of items that were not cued.',
      'F. The practical conclusions are more modest than the headlines that usually accompany them. Cueing works only for material that has already been learned, the improvement is measured in percentage points rather than transformations, and the effect has not been shown to last for months. What the research does establish is negative but useful: a night of shortened sleep before an examination is not a neutral trade, because the hours lost are drawn disproportionately from the stages that consolidate what was studied.',
    ],
    questions: [
      { n: 1, type: 'tfng', prompt: 'The traditional explanation was that sleep protects memories by preventing interference.', answer: 'TRUE', explain: 'Paragraph A.' },
      { n: 2, type: 'tfng', prompt: 'REM sleep takes up a larger share of sleep cycles towards the morning.', answer: 'TRUE', explain: 'Paragraph B.' },
      { n: 3, type: 'tfng', prompt: 'Losing slow-wave sleep mainly damages memory for physical skills.', answer: 'FALSE', explain: 'Paragraph B: slow-wave loss damages memory for facts and events; skills are affected by REM loss.' },
      { n: 4, type: 'tfng', prompt: 'During replay, the sequence of firing runs at the same speed as the original experience.', answer: 'FALSE', explain: 'Paragraph C: it is compressed, perhaps twenty times faster.' },
      { n: 5, type: 'tfng', prompt: 'Replay has been recorded in human subjects using the same technique as in rats.', answer: 'NOT GIVEN', explain: 'The passage describes rat recordings and human cueing studies, but not human replay recordings.' },
      { n: 6, type: 'mcq', prompt: 'Why does damage to the hippocampus usually spare older memories?', options: ['Older memories are physically stronger', 'They have gradually been transferred to the cortex', 'They were learned more slowly in the first place', 'They are stored in both hemispheres'], answer: 'B', explain: 'Paragraph D: repeated replay trains the cortex, so old memories depend less on the hippocampus.' },
      { n: 7, type: 'mcq', prompt: 'In the odour experiment, when was the smell presented?', options: ['Only while the volunteers were learning', 'During learning and again during slow-wave sleep', 'Only the following morning', 'Continuously throughout the night'], answer: 'B', explain: 'Paragraph E.' },
      { n: 8, type: 'mcq', prompt: 'What does the writer find most striking about cueing with sounds?', options: ['It works on material never studied before', 'It seems to weaken memory for items that were not cued', 'It is more effective than odour cueing', 'It only works late in the night'], answer: 'B', explain: 'Paragraph E: the gain appears to come at the expense of uncued items.' },
      { n: 9, type: 'mcq', prompt: 'What is the writer’s overall assessment of this research?', options: ['The effects are large and immediate', 'It shows that new memories can be created during sleep', 'Its clearest practical lesson concerns the cost of losing sleep', 'Its methods cannot be applied to people'], answer: 'C', explain: 'Paragraph F: the useful, negative conclusion is that a short night before an exam is not a neutral trade.' },
      { n: 10, type: 'gap', prompt: 'Slow-wave sleep dominates the first ______ of the night.', answer: 'half', explain: 'Paragraph B.' },
      { n: 11, type: 'gap', prompt: 'In rats, how often replay occurs predicts the next day’s ______.', answer: 'performance', explain: 'Paragraph C: "its frequency predicts how well the animal performs".' },
      { n: 12, type: 'gap', prompt: 'The hippocampus learns ______ but stores little.', answer: 'quickly', explain: 'Paragraph D.' },
      { n: 13, type: 'gap', prompt: 'Cueing only helps with material that has already been ______.', answer: 'learned', explain: 'Paragraph F.' },
    ],
  },
];

// ---------- Scoring ----------

/** Official IELTS Academic Reading raw(/40) → band, applied to a scaled score. */
export function rawToBand(raw40: number): number {
  if (raw40 >= 39) return 9.0;
  if (raw40 >= 37) return 8.5;
  if (raw40 >= 35) return 8.0;
  if (raw40 >= 33) return 7.5;
  if (raw40 >= 30) return 7.0;
  if (raw40 >= 27) return 6.5;
  if (raw40 >= 23) return 6.0;
  if (raw40 >= 19) return 5.5;
  if (raw40 >= 15) return 5.0;
  if (raw40 >= 13) return 4.5;
  if (raw40 >= 10) return 4.0;
  if (raw40 >= 8) return 3.5;
  if (raw40 >= 6) return 3.0;
  return 2.5;
}

/** Band for a short test: the raw score is scaled to the 40-question table. */
export function bandForTest(correct: number, total: number): number {
  return rawToBand(Math.round((correct / total) * 40));
}

/** Minutes of social media earned for a band. */
export function minutesForBand(band: number): number {
  if (band >= 6.5) return 30;
  if (band >= 6.0) return 15;
  if (band >= 5.0) return 10;
  return 5; // consolation for an honest attempt
}

/** Over this many minutes on a 15-minute test, the reward is halved (anti-Google). */
export const READING_TIME_LIMIT_MIN = 25;

export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/[.,!?;:'"()]/g, '').replace(/\s+/g, ' ');
}

export function isCorrect(q: ReadingQuestion, given: string): boolean {
  const g = normalizeAnswer(given);
  if (!g) return false;
  if (q.type === 'gap') {
    const variants = [q.answer, ...(q.accept ?? [])].map(normalizeAnswer);
    return variants.includes(g);
  }
  return normalizeAnswer(q.answer) === g;
}

export const TFNG_OPTIONS = ['TRUE', 'FALSE', 'NOT GIVEN'];
export const MCQ_LETTERS = ['A', 'B', 'C', 'D'];
