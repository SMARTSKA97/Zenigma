/**
 * Word pairs that join into a compound word or a very common phrase: "sun: flower light" means sunflower, sunlight.
 * A word after a "~" is how the pair is written when it is not simply the two glued together ("man~made" ... see below).
 * Chain Link walks along these pairs, so every second word here should also appear as a first word where it can.
 */
const RAW = `
sun: flower light rise set shine burn day dial glasses tan roof beam
moon: light shine walk stone beam rise
star: fish light dust board ship struck gazer burst
fire: fly place work wood man side arm ball proof house fight truck storm wall light cracker
water: fall melon proof color front mark way line wheel bed park tight shed cress
rain: bow coat drop fall storm forest water proof
snow: ball man flake fall storm board drift shoe plow
ice: berg cream~ice_cream cube box age pack skate storm land
wind: mill fall storm shield surf pipe break chime
light: house bulb year weight switch ship show
house: boat fly hold keeper work wife plant warming mate guest party
home: work land made sick town page coming run less owner school stead
work: shop load place book day force out bench mate week station room man flow
book: mark case shelf worm store keeper shop end club
back: pack bone ground yard fire hand stage side door track lash log up drop space board seat bite
ball: room park point game boy gown bearing
foot: ball print step note path wear hold work bridge locker
hand: bag shake book made writing rail cuff ball set some out stand craft gun print brake
head: line light phone band lock ache master quarters stone board set rest strong way
eye: ball brow lash lid sight witness glass shadow sore opener drop tooth
air: port plane line craft bag bus brush mail tight ship strike space field fare force way lift waves
sea: shell side food weed horse bed gull port shore sick level plane salt wall man
land: mark lord slide scape fill mine lady owner fall locked mass
line: man up age backer drive dance out judge
side: walk line kick show board burns car step track ways effect
time: table line piece zone keeper out less share frame bomb sheet warp
day: light dream break time care book bed trip job off
night: fall mare club gown light shift time stand watch life cap owl hawk shade wear school
board: room walk game member meeting shorts
door: bell knob mat step way frame stop man handle post
floor: board plan lamp show manager
room: mate service temperature key
bed: room time bug rock sheet spread side post pan ridden
paper: back clip weight work boy plane towel mill trail route cut bag
case: study work load
cake: walk pop mix stand tin shop
cup: board cake holder
pot: hole luck belly roast pie holder plant shot ash
pan: cake handle
box: car office room cutter wood set kite spring
bag: pipe
man: made~man-made kind hole hunt power hood slaughter servant eater cave
made: up~made-up
mark: down up
point: blank less
play: ground house mate time list back boy off pen thing wright room school dough group fellow
ground: work hog water floor breaking rule nut keeper swell zero level crew control
stone: wall age work mason henge ware fish fruit
wood: work pecker land cutter shed wind chuck pile worm stock
shop: keeper lifter floor window front steward assistant
store: house room keeper front
down: town load fall pour stairs side hill grade size wind play turn time beat cast draft force right stream payment
up: stairs load date hill side set town grade right stream keep roar turn wind beat bringing draft lift swing shot take hold start stage land
over: coat come due flow head look night pass seas see take time turn weight all board cast drive load lap paid pay run sight sleep state work hand kill rate view haul
under: ground water wear dog line pass stand take world cover current study age arm belly carriage cut growth hand mine pants pay score side sea sign state tone tow weight wood write
out: side door line put come look doors cast break burst cry fit going last law let live post rage reach right run set shine skirts source spoken standing take ward wit work back
in: side door come put take sight land let form flow born bound built depth field mate patient tray law laws
off: shore line spring side set shoot beat hand load peak putting road stage season white cut day key limits print track
cross: word roads walk bow bar fire over eyed section country breed check dress examine stitch wind ways hatch
road: side work way map house block kill runner trip show rage sign test bed hog
rail: road way car head track
way: side point farer lay bill
bell: boy hop tower ringer pepper bottom weather flower
bird: bath cage house song seed brain
fish: bowl cake hook net tank bone eye monger wife pond finger market tail farm food
dog: house fight fish food leg tag ear collar sled walker bone days wood paddle show trot
cat: walk fish nap call food nip tail bird burglar eye gut litter suit
horse: shoe back power fly play radish whip hair trading race riding tail man woman
cow: boy girl bell hide lick pat shed slip hand herd catcher poke
pig: pen tail sty skin iron
bee: hive line keeper sting bread
butter: fly cup milk scotch nut fingers bean knife dish
fly: wheel paper trap weight catcher over leaf swatter fishing away by boy
hair: cut brush pin band dryer line style spray net piece clip ball dresser tie
finger: nail print tip food board puppet painting ling bowl
nail: file polish brush bed biter gun clipper scissors
pin: ball cushion point hole wheel prick stripe up board head drop number pad
ring: tone leader side master worm finger road binder fence
check: mate point list out book up mark in board room sum box
post: card man mark office box code script age master war season graduate haste
card: board game holder trick table shark sharp
key: board hole ring note stone word pad chain card stroke
lock: smith down out step jaw box up nut pick
tooth: brush paste pick ache fairy less some
brush: fire stroke off up wood work
tea: pot spoon cup bag room time party leaf kettle towel house set shop
coffee: pot cup table shop bean break maker house grinder mug filter
milk: shake man maid weed tooth chocolate bottle float
cream: cheese soda puff
cheese: cake burger board cloth grater
apple: pie sauce tree juice core cart seed blossom cider
pie: chart crust
bread: crumb winner basket board line stick fruit knife box maker
corn: bread flake flower field starch meal cob dog stalk row
pop: corn star gun up music quiz art
nut: shell cracker case
shell: fish shock game suit fire company
net: work ball book
web: site cam page cast master log mail feet browser
site: map seeing plan
mail: box man bag order room merge shot
screen: shot saver play writer time print door name test
shot: gun put glass
gun: powder shot fire man point smith boat metal ship runner slinger barrel play fight crew
powder: room puff keg milk
ship: yard mate wreck shape load builder owner
yard: stick arm sale work
bone: yard head marrow dry china idle meal fish
meal: time worm ticket plan prep replacement
worm: hole wood cast gear
glass: house ware blower eye work
sand: paper box storm castle bag bar stone man pit fly blast
bank: note roll robber account holiday teller book card loan vault clerk
note: book pad worthy paper card taker
school: house boy girl yard work teacher bus mate room master book bag day year uniform trip board age friend
class: room mate work action war clown
life: time guard boat style line jacket span long saver like size cycle raft
guard: rail house dog
heart: beat break burn ache felt land throb strings warming attack shaped less sick failure rate
beat: box down up
break: fast down through water out even point neck away dance up time
fast: food track forward lane
food: court chain stuff bank truck fight hall web
hot: dog~hot_dog house pot spot line rod shot head plate key
cold: front war shoulder snap case cut storage sore turkey call
black: bird board mail smith out berry jack belt hole list market sheep top
white: board wash house out wine collar noise lie wall water
blue: bird berry print bell grass jay tooth collar ribbon whale bonnet chip
red: head neck wood fish coat cross light wine tape carpet hot bird brick eye line rock shift skin wing current
green: house back card peace grocer land light room tea belt horn fly
gold: fish mine smith rush finch medal leaf digger plate standard bar coin
golden: gate age boy rod retriever
silver: ware smith fish lining screen spoon back bullet medal
iron: man work side clad curtain fist horse age bound
steel: work wool mill drum toe band trap
rock: star fall slide salt band bottom climbing garden pool music hard steady solid face
river: bed bank boat side front mouth fish horse rock basin
lake: side shore front house view land
mountain: top side range lion bike goat dew climber peak pass view
hill: side top billy
arm: chair pit band rest wrestling hole load
leg: room work end warmer
knee: cap pad deep jerk high length brace
toe: nail tip hold cap print rag
neck: lace tie line band brace ache cloth
lip: stick gloss balm service read sync liner
mouth: wash piece guard watering organ
belly: button dance flop ache laugh band
chest: nut plate hair pain freezer
date: line stamp
sky: line light scraper diving rocket high lark
sky: walk
fruit: cake salad fly juice bowl basket
salt: water shaker mine lake
cloud: burst nine
storm: cloud water front drain
thunder: storm bolt clap cloud
lightning: bolt rod bug
bolt: hole cutter
sail: boat cloth fish
boat: house yard hook load man
car: pool port wash park pet load sick
pool: side room table hall party
port: hole side land
paper: clip
plane: load
pen: knife name friend pal drive
pencil: case sharpener
knife: edge
edge: wise
cut: back off out throat price down
price: tag list war
tag: line team
team: mate work
mate: ship
land: scape
ship: shape
`;

/** first word → (second word → how the pair is written). */
export type Compounds = ReadonlyMap<string, ReadonlyMap<string, string>>;

function parse(raw: string): Compounds {
  const graph = new Map<string, Map<string, string>>();
  for (const line of raw.split('\n')) {
    const [head, tail] = line.split(':');
    if (!tail) continue;
    const first = head.trim();
    const next = graph.get(first) ?? new Map<string, string>();
    for (const token of tail.trim().split(/\s+/)) {
      const [second, written] = token.split('~');
      if (second === first) continue;
      next.set(second, written ? written.replace(/_/g, ' ') : first + second);
    }
    graph.set(first, next);
  }
  return graph;
}

export const COMPOUNDS: Compounds = parse(RAW);
