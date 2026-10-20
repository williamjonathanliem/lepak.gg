// Daily answers: common, friendly 5 letter words picked for this project.
// Every word must also be in public/words/en-5.txt (a test checks this).
// Adding words is fine; reordering or removing changes which word lands on which day.

const RAW = `
about above actor acute admit adopt adult after again agent agree ahead alarm album alert
alike alive allow alone along alter amber among angel anger angle angry apart apple apply
arena argue arise aside audio avoid awake award aware bacon badge baker basic beach beard
beast begin being belly below bench berry birth black blade blame blank blast blaze bleed
blend bless blind block blood bloom board boast bonus boost booth brain brake brand brave
bread break brick bride brief bring broad brown brush buddy build bunch burst buyer cabin
cable camel candy cargo carry catch cause chain chair chalk charm chart chase cheap check
cheek cheer chess chest chief child chili chill choir chunk civic claim clash class clean
clear clerk click cliff climb clock close cloth cloud coach coast cocoa color comic coral
couch count court cover crack craft crane crash crazy cream crime crisp cross crowd crown
crust curry curve cycle daily dance death debut delay delta dense depth diary dirty ditch
dizzy dough draft drain drama dream dress drift drink drive eager early earth eight elbow
elder elect elite empty enjoy enter entry equal error essay event every exact exist extra
fable faint fairy faith false fancy feast fence ferry fetch fever field fifty fight final
flame flash fleet flesh float flock flood floor flour fluid flute focus force forge forth
forty forum found frame fresh front frost fruit funny giant glass globe glory glove grace
grade grain grand grant grape graph grass great green greet grief grill grind group grove
guard guess guest guide habit happy harsh heart heavy hedge hello hobby honey honor horse
hotel house human humor hurry ideal image index inner input irony issue ivory jelly jewel
joint judge juice kayak knife knock label large laser later laugh layer learn lemon level
light limit linen liver lobby local logic loose lucky lunch magic major maker mango maple
march match mayor medal media melon mercy merit metal meter minor mixed model money month
moral motor mount mouse mouth movie music naive nerve never night noble noise north novel
nurse ocean offer often olive onion opera orbit order organ other otter outer owner oxide
paint panel panic paper party pasta patch peace peach pearl pedal penny phone photo piano
piece pilot pinch pitch pizza place plain plane plant plate plaza point polar pound power
press price pride prime print prize proof proud prove pulse punch pupil puppy purse queen
quick quiet quilt quite quote radar radio raise rally ranch range rapid raven reach react
ready realm rebel refer relax reply ridge rifle right rigid rival river roast robot rocky
rough round route royal rugby ruler rural salad sauce scale scare scarf scene scent scoop
score scout scrap seven shade shake shape share shark sharp sheep sheet shelf shell shift
shine shirt shock shore short shout shrug sight silly since skill skirt slate sleep slice
slide slope smart smile smoke snack snake solar solid solve sound south space spare spark
speak spell spend spice spill spine spoon sport spray squad stack staff stage stain stair
stake stamp stand start state steam steel steep stick still stone stool storm story stove
straw strip study stuff style sugar suite sunny super sweet swift swing sword table taste
teach teeth thank theme thick thief thing think third thumb tiger tight timer title toast
today token tooth topic torch total touch tough tower toxic trace track trade trail train
treat trend trial tribe trick truck truly trunk trust truth tulip tutor twist uncle under
unity until upper upset urban usage usual valid value vapor video vital vivid vocal voice
wagon waste watch water whale wheat wheel while white whole woman world worry worth wound
wrist write wrong yacht yield young youth zebra
`;

export const ANSWERS: readonly string[] = RAW.trim().split(/\s+/);
