/**
 * IELTS vocabulary bank: academic and band-7 words that come up across Reading, Writing and Speaking topics.
 * Each entry: [word, IPA, part of speech, meaning, example sentence, Russian gloss].
 * Words are served in fixed order (5 a day by default) and reviewed on a 1 / 3 / 7 / 14 / 30-day schedule.
 */

export type VocabTuple = [word: string, ipa: string, pos: string, meaning: string, example: string, ru: string];

export interface VocabWord {
  id: number;
  word: string;
  ipa: string;
  pos: string;
  meaning: string;
  example: string;
  ru: string;
}

const RAW: VocabTuple[] = [
  ['alleviate', 'əˈliːvieɪt', 'v', 'to make a problem or pain less severe', 'Cycle lanes were built to alleviate congestion in the city centre.', 'облегчать, смягчать'],
  ['ubiquitous', 'juːˈbɪkwɪtəs', 'adj', 'present or found everywhere', 'Smartphones have become ubiquitous, even in remote villages.', 'вездесущий, повсеместный'],
  ['detrimental', 'ˌdetrɪˈmentl', 'adj', 'causing harm or damage', 'Excessive screen time can be detrimental to children’s sleep.', 'вредный, пагубный'],
  ['mitigate', 'ˈmɪtɪɡeɪt', 'v', 'to reduce the harmful effects of something', 'Planting trees helps mitigate the effects of air pollution.', 'смягчать, уменьшать'],
  ['scrutiny', 'ˈskruːtəni', 'n', 'careful and critical examination', 'The proposal came under intense public scrutiny.', 'тщательная проверка, пристальное внимание'],
  ['exacerbate', 'ɪɡˈzæsəbeɪt', 'v', 'to make a bad situation worse', 'Rising rents have exacerbated the housing shortage.', 'усугублять'],
  ['prevalent', 'ˈprevələnt', 'adj', 'widespread in a particular area or time', 'Obesity is increasingly prevalent among teenagers.', 'распространённый'],
  ['feasible', 'ˈfiːzəbl', 'adj', 'possible and practical to do', 'Building a metro line in a town of this size is not financially feasible.', 'осуществимый, реальный'],
  ['inevitable', 'ɪnˈevɪtəbl', 'adj', 'certain to happen and impossible to avoid', 'Some job losses are inevitable when factories automate.', 'неизбежный'],
  ['substantial', 'səbˈstænʃl', 'adj', 'large in amount or importance', 'The government made a substantial investment in renewable energy.', 'существенный, значительный'],
  ['advocate', 'ˈædvəkeɪt', 'v', 'to publicly support an idea or policy', 'Many economists advocate a shorter working week.', 'выступать за, отстаивать'],
  ['compelling', 'kəmˈpelɪŋ', 'adj', 'very convincing; holding attention strongly', 'There is compelling evidence that exercise improves memory.', 'убедительный, захватывающий'],
  ['discrepancy', 'dɪsˈkrepənsi', 'n', 'a difference between things that should be the same', 'Auditors found a discrepancy between the two reports.', 'расхождение, несоответствие'],
  ['hinder', 'ˈhɪndə', 'v', 'to make it difficult for something to happen', 'Poor infrastructure hinders economic growth in rural areas.', 'препятствовать, мешать'],
  ['unprecedented', 'ʌnˈpresɪdentɪd', 'adj', 'never having happened before', 'The city experienced an unprecedented heatwave last summer.', 'беспрецедентный'],
  ['ambiguous', 'æmˈbɪɡjuəs', 'adj', 'having more than one possible meaning; unclear', 'The wording of the law is ambiguous and open to interpretation.', 'двусмысленный, неоднозначный'],
  ['constraint', 'kənˈstreɪnt', 'n', 'a limitation or restriction', 'Time constraints forced the team to simplify the design.', 'ограничение'],
  ['deteriorate', 'dɪˈtɪəriəreɪt', 'v', 'to become progressively worse', 'Air quality has deteriorated sharply over the past decade.', 'ухудшаться'],
  ['sustainable', 'səˈsteɪnəbl', 'adj', 'able to continue without harming the environment or running out', 'Sustainable farming protects soil for future generations.', 'устойчивый, экологически рациональный'],
  ['implement', 'ˈɪmplɪment', 'v', 'to put a plan or decision into effect', 'The school implemented a ban on mobile phones during lessons.', 'внедрять, осуществлять'],
  ['fluctuate', 'ˈflʌktʃueɪt', 'v', 'to change frequently in level or amount', 'Oil prices fluctuated wildly throughout the year.', 'колебаться'],
  ['plummet', 'ˈplʌmɪt', 'v', 'to fall suddenly and steeply', 'Sales plummeted after the safety scandal.', 'резко падать'],
  ['surge', 'sɜːdʒ', 'n/v', 'a sudden large increase', 'There was a surge in demand for bicycles during the pandemic.', 'резкий рост, всплеск'],
  ['stagnate', 'stæɡˈneɪt', 'v', 'to stop developing or growing', 'Wages have stagnated while living costs have risen.', 'застаиваться, стагнировать'],
  ['negligible', 'ˈneɡlɪdʒəbl', 'adj', 'so small as to be unimportant', 'The difference between the two methods was negligible.', 'ничтожный, пренебрежимо малый'],
  ['marginal', 'ˈmɑːdʒɪnl', 'adj', 'small and not important', 'The new policy produced only a marginal improvement in attendance.', 'незначительный'],
  ['peak', 'piːk', 'n/v', 'the highest point; to reach the highest level', 'Tourist numbers peak in August.', 'пик; достигать максимума'],
  ['trend', 'trend', 'n', 'a general direction of change', 'The graph shows a downward trend in coal consumption.', 'тенденция'],
  ['proportion', 'prəˈpɔːʃn', 'n', 'a part or share of a whole', 'A large proportion of the budget goes on salaries.', 'доля, соотношение'],
  ['account for', 'əˈkaʊnt fɔː', 'phr v', 'to make up a particular amount; to explain', 'Cars account for nearly half of urban emissions.', 'составлять; объяснять'],
  ['contemporary', 'kənˈtemprəri', 'adj', 'belonging to the present time', 'Contemporary architecture favours glass and steel.', 'современный'],
  ['conventional', 'kənˈvenʃənl', 'adj', 'traditional; following accepted customs', 'Conventional classrooms rely heavily on lectures.', 'традиционный, общепринятый'],
  ['curriculum', 'kəˈrɪkjələm', 'n', 'the subjects taught in a school or course', 'Financial literacy should be part of the national curriculum.', 'учебная программа'],
  ['discipline', 'ˈdɪsəplɪn', 'n', 'controlled behaviour; a field of study', 'Learning an instrument teaches children discipline.', 'дисциплина; научная область'],
  ['literacy', 'ˈlɪtərəsi', 'n', 'the ability to read and write', 'Adult literacy rates have risen dramatically since 1950.', 'грамотность'],
  ['vocational', 'vəʊˈkeɪʃənl', 'adj', 'relating to skills needed for a particular job', 'Vocational training prepares students for skilled trades.', 'профессиональный (об обучении)'],
  ['peer', 'pɪə', 'n', 'a person of the same age or status', 'Teenagers are strongly influenced by their peers.', 'сверстник, ровня'],
  ['acquire', 'əˈkwaɪə', 'v', 'to gain or obtain something', 'Children acquire language remarkably quickly.', 'приобретать, усваивать'],
  ['retain', 'rɪˈteɪn', 'v', 'to keep something', 'Students retain more information when they teach others.', 'сохранять, удерживать'],
  ['incentive', 'ɪnˈsentɪv', 'n', 'something that motivates someone to act', 'Tax breaks give companies an incentive to hire.', 'стимул'],
  ['infrastructure', 'ˈɪnfrəstrʌktʃə', 'n', 'basic systems such as roads, power and water', 'The floods exposed the weakness of the city’s infrastructure.', 'инфраструктура'],
  ['congestion', 'kənˈdʒestʃən', 'n', 'overcrowding, especially of traffic', 'Road pricing has reduced congestion in central London.', 'загруженность, пробки'],
  ['urbanisation', 'ˌɜːbənaɪˈzeɪʃn', 'n', 'the growth of towns and cities', 'Rapid urbanisation has put pressure on housing.', 'урбанизация'],
  ['amenity', 'əˈmiːnəti', 'n', 'a useful or pleasant facility', 'The suburb lacks basic amenities such as shops and clinics.', 'удобство, объект инфраструктуры'],
  ['pedestrian', 'pəˈdestriən', 'n', 'a person walking in the street', 'The square was closed to cars and given over to pedestrians.', 'пешеход'],
  ['commute', 'kəˈmjuːt', 'v/n', 'to travel regularly between home and work', 'Many people commute for over an hour each way.', 'ездить на работу; поездка на работу'],
  ['densely', 'ˈdensli', 'adv', 'closely packed together', 'Tokyo is one of the most densely populated cities on Earth.', 'плотно'],
  ['dwelling', 'ˈdwelɪŋ', 'n', 'a house or place to live', 'Thousands of new dwellings are planned on the old docks.', 'жилище'],
  ['emission', 'ɪˈmɪʃn', 'n', 'gas or other substance released into the air', 'Carbon emissions must fall to net zero by 2050.', 'выброс'],
  ['biodiversity', 'ˌbaɪəʊdaɪˈvɜːsəti', 'n', 'the variety of plant and animal life', 'Deforestation threatens biodiversity in the Amazon.', 'биоразнообразие'],
  ['deplete', 'dɪˈpliːt', 'v', 'to use up a supply of something', 'Overfishing has depleted cod stocks in the North Sea.', 'истощать'],
  ['contaminate', 'kənˈtæmɪneɪt', 'v', 'to make something impure or polluted', 'Chemical waste contaminated the river.', 'загрязнять'],
  ['renewable', 'rɪˈnjuːəbl', 'adj', 'able to be replaced naturally; not running out', 'Wind and solar are the fastest-growing renewable sources.', 'возобновляемый'],
  ['conserve', 'kənˈsɜːv', 'v', 'to protect from harm or waste', 'Simple habits can conserve a surprising amount of water.', 'сохранять, беречь'],
  ['habitat', 'ˈhæbɪtæt', 'n', 'the natural home of a plant or animal', 'Wetlands are a vital habitat for migrating birds.', 'среда обитания'],
  ['extinction', 'ɪkˈstɪŋkʃn', 'n', 'the dying out of a species', 'Several species face extinction within decades.', 'вымирание'],
  ['sedentary', 'ˈsedntri', 'adj', 'involving much sitting and little exercise', 'A sedentary lifestyle raises the risk of heart disease.', 'малоподвижный, сидячий'],
  ['obesity', 'əʊˈbiːsəti', 'n', 'the condition of being very overweight', 'Childhood obesity has tripled since the 1970s.', 'ожирение'],
  ['well-being', 'ˌwel ˈbiːɪŋ', 'n', 'the state of being healthy and happy', 'Green spaces improve residents’ well-being.', 'благополучие'],
  ['chronic', 'ˈkrɒnɪk', 'adj', 'lasting a long time; persistent', 'Chronic stress weakens the immune system.', 'хронический'],
  ['preventive', 'prɪˈventɪv', 'adj', 'intended to stop something before it happens', 'Preventive care is cheaper than treating illness.', 'профилактический'],
  ['epidemic', 'ˌepɪˈdemɪk', 'n', 'a rapid spread of a disease or problem', 'Some doctors describe loneliness as a modern epidemic.', 'эпидемия'],
  ['nutrition', 'njuˈtrɪʃn', 'n', 'the food you eat and how it affects health', 'Poor nutrition affects concentration at school.', 'питание'],
  ['automation', 'ˌɔːtəˈmeɪʃn', 'n', 'the use of machines to do work', 'Automation has transformed car manufacturing.', 'автоматизация'],
  ['obsolete', 'ˈɒbsəliːt', 'adj', 'no longer used because something newer exists', 'Fax machines became obsolete within a decade.', 'устаревший'],
  ['innovation', 'ˌɪnəˈveɪʃn', 'n', 'a new idea, method or product', 'The company rewards innovation with generous bonuses.', 'инновация, нововведение'],
  ['surveillance', 'sɜːˈveɪləns', 'n', 'close observation, especially of suspects', 'Cameras keep the station under constant surveillance.', 'наблюдение, слежка'],
  ['breakthrough', 'ˈbreɪkθruː', 'n', 'an important discovery or development', 'The vaccine was a major medical breakthrough.', 'прорыв'],
  ['cutting-edge', 'ˌkʌtɪŋ ˈedʒ', 'adj', 'the most advanced and modern', 'The lab uses cutting-edge imaging technology.', 'передовой, новейший'],
  ['reliance', 'rɪˈlaɪəns', 'n', 'dependence on something', 'Our reliance on fossil fuels must end.', 'зависимость, опора'],
  ['facilitate', 'fəˈsɪlɪteɪt', 'v', 'to make an action easier', 'Video calls facilitate collaboration across time zones.', 'способствовать, облегчать'],
  ['workforce', 'ˈwɜːkfɔːs', 'n', 'all the people who work in a company or country', 'Women now make up half of the workforce.', 'рабочая сила, персонал'],
  ['remuneration', 'rɪˌmjuːnəˈreɪʃn', 'n', 'payment for work', 'Nurses argue that their remuneration does not reflect their responsibilities.', 'вознаграждение, оплата труда'],
  ['redundant', 'rɪˈdʌndənt', 'adj', 'no longer needed; dismissed from a job', 'Hundreds of workers were made redundant when the plant closed.', 'сокращённый; излишний'],
  ['entrepreneur', 'ˌɒntrəprəˈnɜː', 'n', 'a person who starts a business', 'Young entrepreneurs are drawn to the city’s start-up scene.', 'предприниматель'],
  ['productivity', 'ˌprɒdʌkˈtɪvəti', 'n', 'the rate at which work is produced', 'Flexible hours can raise productivity.', 'производительность'],
  ['prosperity', 'prɒˈsperəti', 'n', 'the state of being successful and wealthy', 'Trade brought prosperity to the port cities.', 'процветание'],
  ['affluent', 'ˈæfluənt', 'adj', 'having a lot of money', 'Affluent families spend more on private tuition.', 'состоятельный, богатый'],
  ['disparity', 'dɪˈspærəti', 'n', 'a great difference; inequality', 'The disparity between rich and poor regions is widening.', 'неравенство, разрыв'],
  ['subsidy', 'ˈsʌbsədi', 'n', 'money given by the government to support something', 'Farm subsidies keep food prices artificially low.', 'субсидия'],
  ['expenditure', 'ɪkˈspendɪtʃə', 'n', 'the amount of money spent', 'Public expenditure on health has doubled.', 'расходы, затраты'],
  ['austerity', 'ɒˈsterəti', 'n', 'strict economy; cutting public spending', 'Years of austerity left the libraries underfunded.', 'жёсткая экономия'],
  ['consumerism', 'kənˈsjuːmərɪzəm', 'n', 'the preoccupation with buying goods', 'Critics blame consumerism for the growth of landfill.', 'потребительство'],
  ['globalisation', 'ˌɡləʊbəlaɪˈzeɪʃn', 'n', 'the process of the world becoming more connected', 'Globalisation has lowered the price of clothing.', 'глобализация'],
  ['heritage', 'ˈherɪtɪdʒ', 'n', 'traditions and buildings passed down from the past', 'The old town is protected as a world heritage site.', 'наследие'],
  ['preserve', 'prɪˈzɜːv', 'v', 'to keep something in its original state', 'Museums preserve objects that would otherwise be lost.', 'сохранять'],
  ['indigenous', 'ɪnˈdɪdʒənəs', 'adj', 'native to a particular place', 'Indigenous languages are disappearing at an alarming rate.', 'коренной, местный'],
  ['assimilate', 'əˈsɪməleɪt', 'v', 'to become part of a group or society', 'Immigrants are often expected to assimilate quickly.', 'ассимилироваться, усваивать'],
  ['multicultural', 'ˌmʌltiˈkʌltʃərəl', 'adj', 'including people of many cultures', 'London is a truly multicultural city.', 'многокультурный'],
  ['norm', 'nɔːm', 'n', 'a standard of accepted behaviour', 'Working from home has become the norm in many firms.', 'норма'],
  ['legislation', 'ˌledʒɪsˈleɪʃn', 'n', 'a law or set of laws', 'New legislation bans single-use plastic bags.', 'законодательство'],
  ['enforce', 'ɪnˈfɔːs', 'v', 'to make people obey a law or rule', 'Speed limits are rarely enforced on this road.', 'обеспечивать соблюдение, принуждать'],
  ['deterrent', 'dɪˈterənt', 'n', 'something that discourages an action', 'Heavy fines act as a deterrent to littering.', 'сдерживающий фактор'],
  ['rehabilitation', 'ˌriːəbɪlɪˈteɪʃn', 'n', 'helping someone return to normal life', 'Prisons should focus on rehabilitation rather than punishment.', 'реабилитация'],
  ['juvenile', 'ˈdʒuːvənaɪl', 'adj', 'relating to young people', 'Juvenile crime has fallen in the past decade.', 'подростковый, несовершеннолетний'],
  ['offender', 'əˈfendə', 'n', 'a person who commits a crime', 'First-time offenders may receive community service.', 'правонарушитель'],
  ['censorship', 'ˈsensəʃɪp', 'n', 'the suppression of speech or information', 'Strict censorship limits what journalists can publish.', 'цензура'],
  ['bias', 'ˈbaɪəs', 'n', 'unfair preference for or against something', 'The report was criticised for its political bias.', 'предвзятость'],
  ['credible', 'ˈkredəbl', 'adj', 'able to be believed', 'Readers struggle to tell credible sources from fake ones.', 'заслуживающий доверия'],
  ['sensationalism', 'senˈseɪʃənəlɪzəm', 'n', 'presenting news in an exaggerated way', 'Tabloids rely on sensationalism to sell copies.', 'погоня за сенсациями'],
  ['manipulate', 'məˈnɪpjuleɪt', 'v', 'to control or influence unfairly', 'Advertisers manipulate emotions to sell products.', 'манипулировать'],
  ['controversial', 'ˌkɒntrəˈvɜːʃl', 'adj', 'causing much disagreement', 'The decision to close the school was highly controversial.', 'спорный'],
  ['consensus', 'kənˈsensəs', 'n', 'general agreement', 'There is a scientific consensus on climate change.', 'консенсус, единое мнение'],
  ['notion', 'ˈnəʊʃn', 'n', 'an idea or belief', 'The notion that talent is innate is widely disputed.', 'понятие, представление'],
  ['perceive', 'pəˈsiːv', 'v', 'to notice or understand something in a particular way', 'Older people are often perceived as less adaptable.', 'воспринимать'],
  ['assumption', 'əˈsʌmpʃn', 'n', 'something accepted as true without proof', 'The plan rests on the assumption that prices will stay low.', 'предположение, допущение'],
  ['phenomenon', 'fəˈnɒmɪnən', 'n', 'a fact or event that can be observed', 'Urban sprawl is a global phenomenon.', 'явление, феномен'],
  ['empirical', 'ɪmˈpɪrɪkl', 'adj', 'based on observation or experiment', 'The claim is not supported by empirical evidence.', 'эмпирический'],
  ['hypothesis', 'haɪˈpɒθəsɪs', 'n', 'an idea to be tested', 'The researchers tested the hypothesis on 500 volunteers.', 'гипотеза'],
  ['correlation', 'ˌkɒrəˈleɪʃn', 'n', 'a connection between two things', 'There is a strong correlation between income and life expectancy.', 'корреляция, взаимосвязь'],
  ['attribute to', 'əˈtrɪbjuːt tə', 'v', 'to say something is caused by', 'Scientists attribute the decline to habitat loss.', 'приписывать, объяснять чем-либо'],
  ['derive', 'dɪˈraɪv', 'v', 'to obtain something from a source', 'Many English words derive from Latin.', 'происходить, получать'],
  ['comprise', 'kəmˈpraɪz', 'v', 'to consist of', 'The committee comprises twelve members.', 'состоять из, включать'],
  ['constitute', 'ˈkɒnstɪtjuːt', 'v', 'to form or make up', 'Women constitute 60 per cent of graduates.', 'составлять, образовывать'],
  ['predominantly', 'prɪˈdɒmɪnəntli', 'adv', 'mainly; for the most part', 'The region is predominantly rural.', 'преимущественно'],
  ['subsequently', 'ˈsʌbsɪkwəntli', 'adv', 'afterwards', 'The law was subsequently amended.', 'впоследствии'],
  ['albeit', 'ˌɔːlˈbiːɪt', 'conj', 'although', 'The plan succeeded, albeit at great cost.', 'хотя и, пусть и'],
  ['nevertheless', 'ˌnevəðəˈles', 'adv', 'in spite of that', 'The evidence is weak; nevertheless, the idea persists.', 'тем не менее'],
  ['whereas', 'weərˈæz', 'conj', 'in contrast with the fact that', 'Rents rose in the capital, whereas they fell elsewhere.', 'тогда как'],
  ['consequently', 'ˈkɒnsɪkwəntli', 'adv', 'as a result', 'Fuel became scarce; consequently, prices soared.', 'следовательно, в результате'],
  ['furthermore', 'ˌfɜːðəˈmɔː', 'adv', 'in addition', 'The scheme is costly; furthermore, it is unpopular.', 'более того'],
  ['outweigh', 'ˌaʊtˈweɪ', 'v', 'to be greater or more important than', 'The benefits of vaccination far outweigh the risks.', 'перевешивать'],
  ['drawback', 'ˈdrɔːbæk', 'n', 'a disadvantage', 'The main drawback of solar power is its intermittency.', 'недостаток'],
  ['viable', 'ˈvaɪəbl', 'adj', 'capable of working successfully', 'Hydrogen may become a viable fuel for lorries.', 'жизнеспособный, реальный'],
  ['tangible', 'ˈtændʒəbl', 'adj', 'real and able to be measured', 'The training produced tangible improvements in service.', 'ощутимый, осязаемый'],
  ['trivial', 'ˈtrɪviəl', 'adj', 'of little importance', 'The dispute began over a trivial matter.', 'незначительный, пустяковый'],
  ['profound', 'prəˈfaʊnd', 'adj', 'very great or intense', 'The internet has had a profound effect on journalism.', 'глубокий, огромный'],
  ['adverse', 'ˈædvɜːs', 'adj', 'harmful; unfavourable', 'The drug has few adverse effects.', 'неблагоприятный'],
  ['coherent', 'kəʊˈhɪərənt', 'adj', 'logical and consistent', 'The essay lacks a coherent argument.', 'связный, логичный'],
  ['elaborate', 'ɪˈlæbəreɪt', 'v', 'to explain in more detail', 'Could you elaborate on that point?', 'разъяснять, развивать мысль'],
  ['convey', 'kənˈveɪ', 'v', 'to communicate an idea or feeling', 'The painting conveys a sense of loss.', 'передавать, выражать'],
  ['undermine', 'ˌʌndəˈmaɪn', 'v', 'to weaken gradually', 'Constant criticism undermines confidence.', 'подрывать'],
  ['reinforce', 'ˌriːɪnˈfɔːs', 'v', 'to strengthen', 'Praise reinforces good behaviour.', 'укреплять, усиливать'],
  ['foster', 'ˈfɒstə', 'v', 'to encourage the development of', 'Team sports foster cooperation.', 'способствовать, воспитывать'],
  ['nurture', 'ˈnɜːtʃə', 'v', 'to care for and help grow', 'Good teachers nurture curiosity.', 'взращивать, воспитывать'],
  ['thrive', 'θraɪv', 'v', 'to grow or develop well', 'Small businesses thrive in the district.', 'процветать'],
  ['diminish', 'dɪˈmɪnɪʃ', 'v', 'to become or make smaller', 'Interest in the sport has diminished.', 'уменьшаться'],
  ['curb', 'kɜːb', 'v', 'to control or limit', 'The measures aim to curb inflation.', 'сдерживать, обуздывать'],
  ['impose', 'ɪmˈpəʊz', 'v', 'to force a rule or tax on people', 'The council imposed a tax on sugary drinks.', 'налагать, вводить'],
  ['allocate', 'ˈæləkeɪt', 'v', 'to give out for a particular purpose', 'More funds should be allocated to mental health.', 'выделять, распределять'],
  ['compensate', 'ˈkɒmpenseɪt', 'v', 'to make up for a loss', 'Higher pay compensates for the long hours.', 'компенсировать'],
  ['accommodate', 'əˈkɒmədeɪt', 'v', 'to provide space for; to adapt to', 'The new hall can accommodate 2,000 people.', 'вмещать; приспосабливать'],
  ['dispose of', 'dɪˈspəʊz ɒv', 'phr v', 'to get rid of', 'Batteries must be disposed of safely.', 'избавляться, утилизировать'],
  ['phase out', 'feɪz aʊt', 'phr v', 'to stop using gradually', 'Petrol cars will be phased out by 2035.', 'постепенно отказываться'],
  ['bring about', 'brɪŋ əˈbaʊt', 'phr v', 'to cause to happen', 'The reforms brought about real change.', 'вызывать, приводить к'],
  ['cope with', 'kəʊp wɪð', 'phr v', 'to deal successfully with', 'Hospitals struggled to cope with the surge in patients.', 'справляться с'],
  ['give rise to', 'ɡɪv raɪz tə', 'phr', 'to cause', 'Poor sanitation gives rise to disease.', 'порождать, приводить к'],
  ['take into account', 'teɪk ˈɪntu əˈkaʊnt', 'phr', 'to consider', 'The judge took his age into account.', 'принимать во внимание'],
  ['in the long run', 'ɪn ðə lɒŋ rʌn', 'phr', 'over a long period', 'Insulating homes saves money in the long run.', 'в долгосрочной перспективе'],
  ['to a large extent', 'tu ə lɑːdʒ ɪkˈstent', 'phr', 'mostly', 'The outcome depends to a large extent on funding.', 'в значительной степени'],
  ['on the contrary', 'ɒn ðə ˈkɒntrəri', 'phr', 'the opposite is true', 'The plan is not cheap; on the contrary, it is ruinous.', 'напротив'],
];

export const VOCAB: VocabWord[] = RAW.map(([word, ipa, pos, meaning, example, ru], i) => ({ id: i + 1, word, ipa, pos, meaning, example, ru }));

export function vocabById(id: number): VocabWord | undefined {
  return VOCAB[id - 1];
}

/** Review intervals in days after each successful recall (Leitner-style). */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30];
export const VOCAB_PER_DAY_DEFAULT = 5;

/** Four-option quiz for a word: the correct meaning plus three distractors, deterministic per day. */
export function quizOptions(word: VocabWord, seed: number): { options: string[]; answer: number } {
  const pool = VOCAB.filter((w) => w.id !== word.id && w.pos === word.pos);
  const fallback = VOCAB.filter((w) => w.id !== word.id);
  const src = pool.length >= 3 ? pool : fallback;
  const picks: VocabWord[] = [];
  let s = seed * 9301 + word.id * 49297;
  while (picks.length < 3) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const cand = src[s % src.length];
    if (!picks.includes(cand)) picks.push(cand);
  }
  const options = [word, ...picks].map((w) => w.meaning);
  // deterministic shuffle
  const order = options.map((o, i) => ({ o, i, k: (seed * 31 + i * 17 + word.id * 7) % 101 })).sort((a, b) => a.k - b.k);
  return { options: order.map((x) => x.o), answer: order.findIndex((x) => x.i === 0) };
}
