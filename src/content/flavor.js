// Machine flavor descriptors and breakdown ticker lines. Every machine has
// a personality; the personality is bad.

export const RUNNING_FLAVOR = ['nominal', 'humming', 'behaving', 'suspiciously fine', 'earning its keep'];

export const DEGRADED_FLAVOR = {
  REFINER: 'screaming slightly',
  BLENDER: 'weeping resin',
  FORMER: 'drifting philosophically',
  PRESS: 'breathing wrong',
  COOLER: 'sweating',
  SANDER: 'chattering',
};

export const BREAKDOWN_LINES = {
  REFINER: [
    'REFINER DOWN. It made a noise like a word. The word was rude.',
    'REFINER DOWN. The bearings have chosen violence.',
    'REFINER DOWN. Dave was three feet away and said "told you" before it finished stopping.',
  ],
  BLENDER: [
    'BLENDER DOWN. The resin is going somewhere. The somewhere is the floor.',
    'BLENDER DOWN. It is now a very expensive bucket.',
    'BLENDER DOWN. Smells like a craft fair held inside a chemistry exam.',
  ],
  FORMER: [
    'FORMING LINE DOWN. The mat is forming opinions instead of boards.',
    'FORMING LINE DOWN. It stopped mid-board, which is somehow more insulting.',
    'FORMING LINE DOWN. The fiber is everywhere. EVERYWHERE is now a technical term.',
  ],
  PRESS: [
    'HOT PRESS DOWN. The diva has left the stage.',
    'HOT PRESS DOWN. It made a sound usually reserved for ships.',
    'HOT PRESS DOWN. 400 tonnes of machine, zero tonnes of work ethic.',
  ],
  COOLER: [
    'STAR COOLER DOWN. The boards are forming a hot, angry line.',
    'STAR COOLER DOWN. It is neither starring nor cooling.',
    'STAR COOLER DOWN. Chris said he heard it "acting cocky" earlier. Unclear.',
  ],
  SANDER: [
    'SANDER/SAW DOWN. The belt snapped with the energy of a man quitting retail.',
    'SANDER/SAW DOWN. Everything downstream is now "rustic finish."',
    'SANDER/SAW DOWN. It sanded itself. Career-ending, philosophically interesting.',
  ],
};
