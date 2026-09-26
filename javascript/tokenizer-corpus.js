/**
 * tokenizer-corpus.js
 *
 * The training text for tokenizer-comparison.js: a few pages of everyday
 * English prose written for this page, and a Chinese translation of it,
 * paragraph for paragraph. It is in its own module so the page can link to
 * it. A few thousand bytes each is still tiny next to a real tokenizer's
 * training set, but enough that a few hundred merges learn repeated words
 * rather than memorizing whole sentences.
 */

const ENGLISH_CORPUS = `Every morning I wake up around seven and make a pot of coffee before I do anything else. I like to sit by the window with my cup and watch the street outside slowly wake up too. Some days a neighbor walks by with her dog, and the dog always stops to sniff the same bush. Other days the street stays quiet until the first bus rattles past, and that is usually my signal to get moving.

After breakfast I usually check my email and then go for a short walk. Walking clears my head better than almost anything else, even a ten minute loop around the block. On the way back I stop at the corner store if we are out of milk or bread. The owner always asks about the weather, as if the two of us had not both just walked through it.

The weather here changes its mind more than most people I know. A morning can start clear and end in rain before lunch, so I have learned to carry a light jacket even when the sky looks friendly. In summer the heat settles in by early afternoon and does not lift until well after dark. In winter the cold arrives earlier every year, or at least it feels that way, and the days shrink until it is dark by the time I finish work.

In the afternoon I try to get some work done, but it is easy to get distracted by small chores around the house. A load of laundry, a pile of dishes, a plant that needs water. None of these tasks takes long on its own, but strung together they can eat an entire afternoon without producing anything I could point to and call finished.

By evening I am usually ready to sit down and read for a while before making dinner. I keep a stack of books on the table by the couch, more than I could read in a year, and I like choosing between them depending on my mood. Some nights call for a novel, others for something short enough to finish in one sitting.

Dinner is usually simple: rice or noodles, a vegetable, and whatever protein I remember to buy. I am not a skilled cook, but I have a handful of dishes I can make without checking a recipe, and most weeks that is enough. On weekends, if I have more time, I will try something new, even if it does not always turn out the way the recipe promised.

Weekends also mean a trip to the market, usually in the morning while the produce is still fresh and the crowds have not built up yet. I like walking between the stalls even when I am not buying much, just to see what is in season. Peaches in summer, persimmons in autumn, and always someone selling flowers by the entrance, whether or not anyone plans to buy them.

Once or twice a month I take a longer walk through the park near my apartment, further than my usual loop around the block. There is a pond where people feed the ducks, a row of old trees that turn bright orange in autumn, and a hill where kids fly kites whenever the wind cooperates. I do not always have anything to do there. Sometimes it is enough to sit on a bench and watch everyone else go by.

A few times a year I visit my parents, who live a few hours away by train. My mother always cooks too much food, insisting every time that this is the last dish, and my father asks the same three questions about work before we settle into talking about nothing in particular. I complain about the train ride beforehand and always end up glad I went.

A few years ago I started learning to play the guitar, mostly because a friend left an old one at my apartment and never came back for it. I am still not very good, but I can get through a handful of simple songs without stopping, and some evenings that is exactly the kind of small, low-stakes project I want after a day of email. My neighbors have never complained, though I suspect they are simply being polite.

Twice a week I try to go for a run before work, mostly along the river where the path is flat and mostly empty that early. I am slow and I do not pretend otherwise, but showing up on time matters more to me than any particular pace. On the mornings I skip it I notice the difference by early afternoon: less patience, more trips to the kitchen for something I do not actually want.

The commute into the city center takes about forty minutes by train, longer if there is any kind of delay, which there often is. I have given up being annoyed by it and instead treat the ride as a block of time that belongs entirely to me: an article, a chapter, or sometimes just watching the same stretch of track go by without thinking about anything in particular.

Most weeks I manage one phone call with an old friend who moved to another city a while back. We rarely have big news to share, and the calls mostly cover the same small ground: work, weather, something one of us watched recently. I used to think a friendship needed more than that to stay alive, but these calls have gone on for years now, so apparently it does not.

I try to keep my phone out of reach in the evenings, though I do not always manage it. It is too easy to open one app looking for something specific and lose twenty minutes to nothing in particular. I notice the difference on the nights I actually leave it in another room: I read more, and I fall asleep faster, though I could not tell you exactly why.

None of this is especially remarkable. It is just the shape one ordinary life happens to take: coffee, walking, small chores, a shared meal, a book before bed. I do not think the details matter as much as the rhythm does. Some weeks the rhythm holds and some weeks it falls apart entirely, and either way tomorrow morning starts the same way it always does, with a pot of coffee and a window to sit by.`

/**
 * A Chinese translation of ENGLISH_CORPUS above, paragraph for paragraph.
 */
const CHINESE_CORPUS = `我每天早上七点左右起床，先泡一壶咖啡，然后才开始做别的事情。我喜欢端着杯子坐在窗边，看外面的街道慢慢热闹起来。有时候邻居会牵着狗散步，那只狗总是喜欢在同一丛灌木前停下来闻一闻。有时候街上一直很安静，直到第一辆公交车轰隆驶过，那通常就是提醒我该起身做事了。

吃过早饭后，我通常会看看邮件，然后出去走一走。散步比几乎任何事情都更能让我的头脑清醒，哪怕只是绕着这条街走十分钟。回家的路上，如果家里没有牛奶或者面包了，我会去街角的小店买一些。店主总会问起天气，好像我们俩刚才没有一起在外面走过似的。

这里的天气比我认识的大多数人都更善变。早上可能还阳光明媚，午饭前就下起雨来，所以我学会了即使天看起来很友好，也带一件薄外套。夏天，闷热到了午后就沉沉压下来，天黑很久以后才肯散去。冬天，寒冷似乎一年比一年来得早，白天越来越短，等我下班的时候天已经黑了。

下午我想做一点工作，但家里总有些小事容易让我分心：一桶要洗的衣服，一堆碗，一株需要浇水的植物。这些事单独看都花不了多少时间，但一件接一件地做下来，一个下午就没了，到头来却说不出自己完成了什么。

到了晚上，我一般会先坐下来看一会儿书，再去做饭。沙发旁边的桌子上摆着一堆书，多到我一年也读不完，我喜欢按当时的心情从里面挑一本。有些晚上适合读小说，有些晚上更想找一篇短得能一口气读完的文章。

晚饭通常很简单：米饭或者面条，一份青菜，再加上我记得买的任何肉类或豆制品。我厨艺并不精，但有几道菜不用看食谱也能做出来，大多数时候这就够了。周末时间多一点，我会尝试做点新菜，虽然结果不一定像食谱说得那样。

周末也意味着要去一趟市场，通常趁早上蔬果还新鲜、人也还不多的时候去。就算不打算买太多东西，我也喜欢在摊位之间走一走，看看现在都有什么时令货：夏天是桃子，秋天是柿子，入口处总有人在卖花，不管有没有人真的想买。

每个月总有一两次，我会到公寓附近的公园里走得更远一些，不只是绕街区那一圈。公园里有个池塘，人们在那里喂鸭子；还有一排老树，秋天会变成明亮的橙色；再往上是一座小山，只要风合适，孩子们就在那里放风筝。我在那里不一定有什么事要做，有时候只是坐在长椅上，看着其他人走来走去，也就够了。

一年里我会去看几次父母，他们住在坐火车要几个小时的地方。我母亲每次都做太多菜，还每次都说这是最后一道了；我父亲总会问起工作上那几个老问题，问完之后我们才慢慢聊起些无关紧要的事。出发前我总要抱怨一下坐火车麻烦，但每次去了都觉得值得。

几年前我开始学吉他，主要是因为一个朋友把一把旧吉他忘在我家，后来再也没来取。我弹得还是不太好，但已经能不停顿地弹完几首简单的曲子，有些晚上，这正是我处理完一天的邮件之后想做的那种低风险的小事。邻居们从没抱怨过，不过我怀疑他们只是出于礼貌。

每周我会争取跑两次步，通常在上班前，沿着河边那条平坦的路跑，那么早路上基本没什么人。我跑得慢，也不打算装作不是这样，但对我来说，按时出门比配速更重要。哪天早上没去跑，到了下午我就能感觉出差别：更容易没耐心，也更常跑去厨房找些其实并不想吃的东西。

坐火车去市中心上班大约要四十分钟，如果晚点就更久，而晚点又是常有的事。我已经不再为此烦躁，而是把这段车程当成完全属于自己的一段时间：读一篇文章，看一章书，或者有时候什么都不想，就看着窗外同一段铁轨一晃而过。

大多数星期，我都会和一个几年前搬到别的城市的老朋友打一次电话。我们很少有什么大事要说，电话里聊的基本还是那些小事：工作、天气、最近看的什么东西。我以前觉得一段友情得靠更多内容才能维持下去，但这些电话已经打了这么多年，看来并不需要那么多。

晚上我尽量把手机放得远一点，不过并不总能做到。太容易打开一个应用去找某件具体的事情，结果二十分钟就在无关紧要的事情上过去了。真把手机留在另一个房间的那些晚上，差别很明显：我会读更多书，也睡得更快，不过具体为什么，我也说不清楚。

这些都算不上什么了不起的事，只是一种普通生活恰好呈现出来的样子：咖啡、散步、琐事、一起吃饭、睡前一本书。我觉得重要的不是这些细节，而是它们的节奏。有些星期这个节奏保持得很好，有些星期完全乱掉，但不管怎样，第二天早上总是照旧开始——一壶咖啡，一扇可以坐着的窗。`

export { ENGLISH_CORPUS, CHINESE_CORPUS }
