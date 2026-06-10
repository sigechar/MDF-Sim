// Kevin's pun library (spec §14.1). Voice rule (§12): Kevin never uses
// periods — only exclamation points and ellipses. isWoodRelated puns hit
// harder (+6 BP vs +4) because they hit closer to home.
//
// v2: every pun now carries a passive-aggressive payload. Kevin cannot say
// the actual complaint — that would be conflict — so it leaks out sideways,
// wrapped in wordplay, then gets walked back immediately. The walk-back is
// the most aggressive part.

export const PUNS = [
  { text: "Spencer!! Not to add PRESSURE... that's the press's job!! but corporate called about the numbers and I said you were handling it!! so now that's a thing you're doing!! officially!!", isWoodRelated: true },
  { text: "The rate board's looking a little... RESTED!! not lazy!! boards can't be lazy!! that's why I said the BOARD and not, you know... anyone specific!!!", isWoodRelated: true },
  { text: "Someone left the dryer log blank... not naming names!! that's what the log was for!! ha!! anyway it WOOD be great if it filled itself out!!", isWoodRelated: true },
  { text: "You look tense!! I'd never tell you to chill... that's the cooler's department!! it delegates better than me!! its words, not mine!! I would never say that!!", isWoodRelated: true },
  { text: "Quality's off the CHARTS!! ...the bottom of the charts, but who reads the y-axis!! corporate does!! they called!! anyway!!!", isWoodRelated: false },
  { text: "I left a sticky note on your door about the sticky floor!! full circle!! no rush... the floor isn't going anywhere!! unlike SOME of our deadlines!! kidding!!!", isWoodRelated: true },
  { text: "Knock knock!! ...it's FEEDBACK!! ha!! no, it's me, Kevin!! the actual feedback is in an email I haven't sent for three weeks because of... tone!!", isWoodRelated: false },
  { text: "I told the day shift you'd hit target!! I like keeping my promises... which is why I make them YOURS!! delegation!! it's in my development plan!!!", isWoodRelated: false },
  { text: "Why don't superintendents play hide and seek?? ...okay BAD example!! nobody's hiding!! my office light is just... energy conscious!!!", isWoodRelated: false },
  { text: "The sander and I share a philosophy... everything gets SMOOTHED over eventually!! incidents, feelings, the floor... mostly the floor!!!", isWoodRelated: true },
  { text: "Wood you believe it's only midnight!! time flies when the numbers are... when the numbers are NUMBERS!! they're definitely numbers!! I checked!!", isWoodRelated: true },
  { text: "Why don't refiners gossip?? They keep it under WRAPS!! unlike the C-Crew group chat, which I am not in, and that's FINE!!!", isWoodRelated: true },
  { text: "I'd make a resin joke but I don't want it to STICK... like the housekeeping agenda item that keeps moving to next week!! by someone!! moving by itself, probably!!!", isWoodRelated: true },
  { text: "Why did the MDF board go to therapy?? Too many LAYERS!! we should all talk more!! not now!! not about anything specific!! just generally!! someday!!!", isWoodRelated: true },
  { text: "What did the saw say to the board?? Nothing, it just CUT him off!! which reminds me of this morning's meeting!! it reminds me of nothing!! great meeting!!!", isWoodRelated: true },
  { text: "The fiber silo called!! it wants to know if you're also feeling EMPTY!! I said we don't discuss feelings on this shift!! we discuss THROUGHPUT!! warmly!!!", isWoodRelated: true },
  { text: "I'm reading a book about glue... can't put it DOWN!! same with the incident report from Tuesday!! someone should file that!! someone strong and capable!!!", isWoodRelated: true },
  { text: "What's a conveyor's motto?? keep things MOVING!! it's also corporate's motto!! they emailed it!! to me!! about us!! anyway!!!", isWoodRelated: false },
  { text: "I told corporate our sawdust numbers were FINE... get it, fines!! they did not get it!! they sent a spreadsheet!! it's red!! festive!!!", isWoodRelated: true },
  { text: "What's a millwright's favorite music?? HEAVY METAL!! speaking of which, Terry's radio is off again!! someone should mention it to him!! gently!! not me!!!", isWoodRelated: false },
  { text: "The new forklift guy really LIFTS the mood!! also the rack by the dryers is dented now!! these things happen!! to racks!! near certain forklifts!! no blame!!!", isWoodRelated: false },
  { text: "I organized plant trivia night and it got BOARD fast!! attendance was two!! counting me twice!! it's fine!! morale is a marathon!!!", isWoodRelated: true },
  { text: "The hot press asked for a raise!! I said it's already our most VALUED team member... by weight!! everyone else is valued by... well, there's a matrix!!!", isWoodRelated: true },
  { text: "Why did the wood chip want a promotion?? PANEL management!! ha!! speaking of promotions, the freeze is still on!! nobody asked!! but it is!!!", isWoodRelated: true },
  { text: "Fun fact, I've never once been in the plant during an emergency!! lucky streak!! some people call it avoidance... some people say a LOT of things!! in surveys!!!", isWoodRelated: false },
  { text: "What's brown and sticky?? a STICK!! also the floor by the dryers, but that's nobody's fault!! floors have journeys!!!", isWoodRelated: true },
  { text: "They say hard work never killed anyone... but why CHANCE it, am I right!! that's a joke!! please don't put it in the survey!! again!!!", isWoodRelated: false },
  { text: "I'd joke about the dust collector but it would BLOW over!! like I'm hoping the quarterly review does!! ha!! it won't!! it's scheduled!!!", isWoodRelated: false },
  { text: "What did zero say to eight?? nice BELT!! safety joke!! wear your belts!! also someone's been skipping the toolbox talks... the belts know who!!!", isWoodRelated: false },
  { text: "You and me, Spencer... resin and fiber!! inseparable!! legally, per our shift assignments!! I checked whether that was changeable!! routine question!!!", isWoodRelated: true },
  { text: "My door is ALWAYS open!! the lock is decorative!! the light being off is about energy savings!! we're a green facility, Spencer!! a GREEN facility!!!", isWoodRelated: false },
  { text: "What do you call Terry on break?? unavailable!! ha!! but if someone could schedule his breaks around the breakdowns, that'd be... that's not a thing!! forget it!!!", isWoodRelated: false },
];

// Rate nags (spec addendum): when msf/hr runs low, Kevin appears with a
// complaint folded so many times it is legally a compliment. Same voice
// rules as the puns. (rate, needed) arrive pre-formatted.
export const KEVIN_RATE_NAGS = [
  (r, n) => `Heyyy!! not checking up on you!! but the big board says ${r} msf an hour and corporate likes ${n}... numbers, right?? they can't all be GRADE A!! that's a board joke!!`,
  (r, n) => `Spencer!! totally unrelated... what WOOD it take to get the rate above ${n}?? asking for me!! who has a call about it at four!!`,
  (r, n) => `So the rate's at ${r}!! which is a number I'm not mad at!! I'm not mad at anything!! I'm noting it!! in the notebook they make me keep!!`,
  (r, n) => `Production check-in!! ${r} an hour!! love the consistency... CONSISTENCY!! like the glue!! anyway corporate wants ${n} and I want everyone happy!! mostly corporate!!`,
  (r, n) => `Not a critique!! the line's pace is very... SUSTAINABLE!! is it sustaining ${n}?? no!! but no pressure!! pressure's the press's job!!`,
  (r, n) => `Quick thought!! if the rate stays at ${r}, day shift inherits the gap, and you know how day shift gets... I'LL be hiding!! kidding!! I'll be on a call!!`,
];
