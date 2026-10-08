# Talking Object

Give everyday objects a voice. Point your camera at a cup, chair, pet, or another common object, select a detection, and chat with it. Or start immediately with a sample object: no camera, account, API key, or model download required.

This is a polished browser demo of the September 2025 prototype, not a general-purpose assistant. Built-in replies are predictable; the optional small language model is experimental.

## Run locally

Install **Node.js 22 or newer**, then:

```sh
git clone https://github.com/Nathan75432/talkingobject.git
cd talkingobject
npm start
```

Open **http://localhost:3000**. No dependency installation or build is needed to run the demo. Use a local server rather than opening `index.html` directly: ES modules and camera access need an appropriate origin.

If port 3000 is occupied, use `PORT=3001 npm start` on macOS/Linux, or `$env:PORT=3001; npm start` in PowerShell. The development server binds to the local computer only. The app can also be served by any static host over HTTPS; publish `index.html`, `styles.css`, `app.js`, and `replies.js` together. Hosting configuration is not included.

## Try it in a minute

1. Choose **Cup**, **Cat**, **Dog**, **Chair**, **Book**, or **Bottle** in sample mode.
2. Click **Hello!**, ask **What do you do?**, or type a message and press Enter.
3. Switch **Personality** to **Playful**. Enable **Voice on** for spoken replies.
4. Choose **Use my camera**, allow camera permission, and wait for the object detector. Select who to talk to from the detected objects. **Stop camera** returns to samples and releases the camera.
5. If your browser supports speech recognition, **Use microphone** records one message. It stops before the reply so the object does not hear itself. Click again for another message.

The camera preview and detection boxes share one view. Detections below 60% confidence are ignored; duplicate object classes are combined. The current selection is retained while its class is visible, otherwise the highest-confidence class is selected. If nothing is detected, chat asks you to choose a sample or bring an object into view. Selection is by object class, not by an individual instance.

## Optional language model

Expand **Try the experimental language model** and click **Load language model**. [Transformers.js 2.17.2](https://huggingface.co/docs/transformers.js/v2.17.2/en/pipelines) downloads the quantized [FLAN-T5-small](https://huggingface.co/Xenova/flan-t5-small) model on demand. Download time and memory use vary; allow several minutes on a slower connection. Progress is shown per file. Browser caching may speed up later visits.

The prompt includes the selected object and personality. This replaces the prototype’s unconditioned DistilGPT2 text completion. The model is small: replies may be repetitive, inaccurate, or fail to stay in character, and it has no conversation memory. Switch back to built-in replies at any time. Failed downloads can be retried; generation errors fall back to a built-in reply. Camera and language model status are separate.

## Browser support and privacy

- Sample mode and typed chat work in modern browsers with JavaScript modules and continue to work without internet access once the local files are served.
- Live detection uses pinned **TensorFlow.js 4.22.0** and **COCO-SSD 2.2.3**, loaded only after camera startup. The first load needs access to jsDelivr and model asset hosts. COCO-SSD recognizes a limited set of common classes; it cannot recognize arbitrary objects or identify people.
- Camera access requires **localhost or HTTPS** and browser permission. Video frames are processed in the browser and are not uploaded by this app. There is no backend, analytics, or chat persistence.
- Speech synthesis uses voices provided by the browser/device. Availability varies. Speech recognition is less widely supported and may send audio to the browser vendor’s service; use typed chat if you prefer. Unsupported speech controls are disabled.
- Camera tracks and microphone recognition stop when the tab becomes hidden or leaves the page. Camera startup is an explicit action; returning to the tab requires restarting the camera.
- CDN and model downloads contact third parties. Model output and user input are rendered as text, never HTML. Chat is capped at 80 messages and messages at 500 characters.

## Troubleshooting

| Symptom                         | What to try                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| Camera denied                   | Allow access in browser site settings and choose **Use my camera** again. Samples remain available. |
| No camera / camera busy         | Connect a camera or close another app using it.                                                     |
| No objects detected             | Improve lighting and point at a common object, such as a cup or chair.                              |
| Model download fails            | Check your internet connection and blockers for jsDelivr/Hugging Face/model hosts, then retry.      |
| Microphone unavailable or fails | Use typed chat; speech recognition support and permissions vary.                                    |
| No spoken reply                 | Enable voice and check device volume and available browser voices.                                  |
| Address already in use          | Set a different `PORT` as described above.                                                          |

## Development and checks

The runtime has no npm dependencies. Development tests use Playwright:

```sh
npm ci
npx playwright install chromium
npm test
npm run test:browser
```

Unit tests cover object-specific replies and confidence filtering. Browser tests run on desktop and mobile viewports, covering sample mode without external downloads, safe text rendering, permission rejection, model download/generation failure, concurrent chat handling, clearing an in-flight reply, live selection, empty detections, microphone lifecycle, and camera cleanup. Hardware and detector tests use a synthetic camera and stubbed predictions; they do not establish real-world detection accuracy or microphone service availability.

The actual COCO-SSD download/inference and FLAN-T5 download/generation were also smoke-tested in Chromium with a synthetic camera. FLAN-T5 can generate a reply, but its small size limits the quality and consistency of the result. Physical camera accuracy and browser speech services still need device testing.

Files: `index.html` (accessible UI), `styles.css` (responsive layout), `app.js` (camera/chat/speech/model lifecycle), `replies.js` (reply and selection helpers), `server.js` (local static server).

## Review and remaining work

The original repository had a single HTML file, no setup guide, eager concurrent model downloads, a camera without error recovery or stop controls, duplicate video/canvas views, typed chat hardcoded to a default object, voice chat guessing the object from a spoken detection string, and unescaped HTML insertion in chat. This revision addresses those issues and makes the demo usable without hardware or model downloads.

Future work: validate on more physical mobile devices, improve detection stability across frames, add per-instance selection, and evaluate a stronger conversational model. The language model remains optional so these experiments do not block the core demo.
