**Report: I got as far as the key being rejected, which is the right outcome for a fake key. I never saw a forged note, so I can't judge the notes themselves.**

I added three scribbles (0:13 "fb fired him after 3 yrs?? why", 3:01 "ai helps hackers rn, maybe defenders win later - not sure", 4:00 "3 days water+food, refill meds early"). I pasted the fake key and saved it. The app rejected it. All three scribbles were still there after a page reload.

One thing blocked me early on. My first command was denied because it used a shell variable. I re-ran with literal paths and had no further problems.

**1. Screens and hesitation**
- **Start page:** it was clear. The link box is highlighted, and the three steps (paste, scribble, read) are easy to follow. The "Add your API key" banner sits above the steps, so I knew the key was needed.
- **Start button:** it is greyed out until a link is entered. My click on it timed out, and nothing explained why. A non-technical person might think it is broken.
- **Main screen:** I hesitated here.
  - The "Add API key" button in the header is small, and I could easily have missed it.
  - I wasn't sure at first that clicking a transcript line is how you jump the video.
  - The scribble box only says "Raw material goes here…". The hint "Enter to add" is tiny but good.
  - The timestamp on each scribble is shown, but you have to infer that it is your place in the video.
- **Settings:** it asked for a provider, a key and a model ("claude-haiku-5-5"). I'm not technical and don't know what a model is. The default was fine, and the help text "small, fast model is enough" reassured me.
- **Saving the key:** my first click on "Save" by its text timed out. It only worked when I targeted the button by role. That may be a quirk of how I click, and I can't tell whether a real user would hit it.

**2. When the key failed**
- A red banner appeared in the notes pane: "Anthropic rejected the API key. Check it in Settings. Your scribbles are safe." It has an "Open settings" button.
- This was clear. It said what happened and what to do, and the reassurance about my scribbles was true.
- Before I had a key, the same pane said "Add an API key in Settings to start forging. Your scribbles are safe." Both messages were good.
- The header "Add API key" button disappeared after I saved, even though the key was bad. The app now seems to treat the key as set and only complains once I try to forge. I'd prefer a visible "key invalid" cue in the header.
- The scribbles also showed orange dots and "3 scribbles waiting", which I took to mean not yet forged.

**3. What happens to the key**
- The start page says "It stays in this browser".
- Settings says: "Kept only in this browser and sent with each forge request, never stored on the server."
- That was enough for me to feel reasonably OK, and it was honest that the key is sent with each request. It doesn't say who it is sent to. It doesn't say what happens if my computer is shared, and it doesn't say how to delete the key. I didn't check whether there is a remove option.

**4. Overall**
- **What worked:** pasting a link, loading the video and transcript, stamping scribbles with the video time, saving scribbles, and the error messages.
- **What I could not check:** whether forging keeps my meaning, my questions and my doubt, and adds nothing. I also couldn't check topic grouping, links back to the video, or export. A fake key can't test any of that.
- **Anything actually broken that I'm sure of:** nothing.
- **One thing I'd change:** show a clear "key not working" state in the header after a rejection, with the same "Open settings" action. It's easy to miss that the key is bad once the banner scrolls away or you leave.
