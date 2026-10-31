# Demo script

About 2 to 3 minutes. Prabal films this on his laptop. The live SAM path runs on that machine. Sample demos use the recorded masks in the repo.

Say the words below, or stay close to them. Read the step titles that are actually on screen. Do not rename a flask step, and do not name a chemical.

## Run locally for filming

Use Node 22 (`.nvmrc` is `22`), then install dependencies.

```bash
npm i
```

There is no `.env.example`. Next.js reads `.env.local` for `npm run dev`, and `.env.*` is gitignored. Create `.env.local` in the repo root:

```
META_MODEL_API_KEY=<your key>
```

That value is a placeholder. Do not commit a real key, and do not say the key on camera.

`PREVIEW_PASSWORD` is optional locally. Leave it unset and every route stays open. An empty value returns 503 on every route. A non-empty value requires HTTP basic auth.

```bash
npm run dev
```

Open http://localhost:3000. A new browser session has no tutorial yet, so the coach sends you to upload until you open a Sample.

Live SAM runs from this laptop. Allow the camera when the coach asks. Use the laptop webcam, aimed at the desk, not a phone unless you want the phone-stand shot as a second angle.

## Before you roll

- Full screen the browser. Hide bookmarks. 1440-wide is a good frame. A second phone at 390 is optional, only if you want to show the card stack.
- The hero must be the chai clip. The five cards under Demos are masala chai, flask colour, origami, seed planting, and latte art.
- Sample chips say Sample, or Sample · recorded SAM output. If a chip says Live, you are on an uploaded clip, not a Sample. If a chip says Mock, the highlights are the local stand-in. Film the judging take with the model key set.
- Leave the mode on Keyframe. Chunk mode is optional. Gate 0 measured 2213 ms to the first box on a 2 second chunk, over the 2000 ms live threshold. A still was 922 ms.
- Point at each noun and confirm it is fully in frame before you claim a highlight.
- flask-colour: the yellow note says Grown-up supervision. Do not say a chemical name. Describe the colour you see.
- Hands and props only, unless you have consent for a face.
- Upload a clip you filmed. Do not paste an Instagram link. There is no fetch field.

## Shot list

Aim for the times. Cut on the beats, not on silence.

### 1. Landing (0:00 to 0:25)

On camera: the laptop screen, browser at the landing page.

Say: "Reel2Real coaches you through a short tutorial. The phone sits on a stand. You match the step, and the object lights up."

Show the chai hero and the Sample label. Scroll to Demos. All five cards are in one row on a wide window, each cover 4:5. Hover or wait so one loop plays. Point at a credit line under a card. On the flask card, point at Grown-up supervision.

### 2. Sample chai (0:25 to 0:50)

Click Open in coach on masala chai.

Say: "This is a Sample. The outlines were recorded from SAM. They are not the live camera."

Show the chip `Sample · recorded SAM output`, the Keyframe mode chip, and the model ids when they are on screen (`muse-spark-1.3`, `sam-3.1`). Read the three step titles as they appear. Press Next through them. The credit stays `Pexels contributor` and links the Pexels page for the clip.

### 3. Live camera (0:50 to 1:25)

Back to Upload. This beat uses the laptop camera.

Say: "The same coach runs live from this machine. Spark reads a clip once. SAM checks the frame."

Either upload a 5 to 10 second clip you just filmed on the desk (mortar, paper, a mug, anything you can keep in frame), or open the coach with that clip and allow the camera.

Hold on `/extracting` long enough to see the stage clock. Spark on a short clip was about 15 to 20 seconds. Do not pretend it is instant.

When the coach opens, the header chip can say Live because this is your clip, not a Sample. Keep two or three objects fully in frame. When SAM returns a highlight, point at it. If it does not, leave the `Highlights unavailable` line on screen and press Next anyway.

Say: "If SAM does not answer, we say so. Next still moves the step. We do not draw a fake box."

### 4. The other Samples (1:25 to 2:25)

Open each remaining demo from the landing cards. Spend about 15 seconds on each. Read the step title. Do not invent a noun that is not on the chip.

- Origami. Yogendra Singh, Pexels. Read: "Fold the patterned paper", "Press a clean triangle crease", "Keep folding beside the crane". The paper highlight is the sheet being folded. Then heart, then crane.
- Seed planting. Tima Miroshnichenko, Pexels. Read: "Poke cells in the seed tray", "Work across the tray beside the pot", "Finish with the jar in view". Highlights: gloves and tray, then pot and gloves, then jar and gloves.
- Latte art. franklandgrave, Mixkit. Read: "Start filling the cup", "Build a foam circle in the cup", "Finish the foam on the cup". Step 2 shows the cup. Steps 1 and 3 have no verified mask, so they show the step text and no outline. The second still is the retimed frame.
- Flask colour, last, so the supervision note is the closer. AlexKopeykin, Pixabay. Read: "Pour powder into the flask", "Watch the colour change", "Set the flask and rod in view". Say: "Kids science. A grown-up stays with you. The steps only talk about what you can see." Show the yellow Grown-up supervision note. Highlights: flask and bottle, then flask and bottle, then rod and flask. Do not name a chemical.

Read the title on the glass. Latte steps 1 and 3 keep that title and show "No verified mask on this frame." with no outline. Do not draw a box for them.

### 5. Done (2:25 to 2:45)

Finish a Sample run so the done screen appears.

Say: "Steps, skips, and safety hits. Spark for the steps, SAM for the highlights. Sample stays Sample."

Hold on the model ids and the credit. End.

## Framing notes for the Samples

SAM only boxes what the camera can see. Before a live step, put the tracked objects fully inside the frame: not cropped by the edge, not hidden in a hand.

If the coach says a noun is not highlighted, stop and reframe.

| Demo | What the clip shows | Credit |
| --- | --- | --- |
| masala-chai | One kitchen, mortar and pestle, spices, herbs | Pexels contributor, Pexels License, https://www.pexels.com/video/5480225/ |
| flask-colour | Flask, bottle, then a rod with the flask. No chemical names | AlexKopeykin, Pixabay Content License. Source and licence links are on the card |
| origami | Paper, then a heart, then a crane | Yogendra Singh, Pexels License, Pexels 6364305 |
| seed-planting | Gloves with a tray, a pot, then a jar | Tima Miroshnichenko, Pexels License, Pexels 6508485 |
| latte-art | A cup, including the retimed second still | franklandgrave, Mixkit Stock Video Free License, Mixkit 810 |

## Your own filming

The coach uses the laptop camera when you allow it, and Sample keyframes only on the Sample runs above. If live SAM does not answer, the stage says Highlights unavailable. Next still moves the step.

## Extra beats if you have time

These are optional. Cut them if you are over 3 minutes.

- Move one required object out of frame. Wait for the hint, then Skip. The credit stays on screen.
- Bring the next step's object in early and wait for Out of order.
- Knife safety lives on the aloo jeera fixture, not on these five Samples. Do not load it unless you mean to show Retry.
