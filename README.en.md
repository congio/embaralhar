<p align="center">
  <a href="README.md">Português</a> | <b>English</b>
</p>

<p align="center">
  <img src="docs/icon.svg" width="96" height="96" alt="Embaralhar de Verdade icon">
</p>

<h1 align="center">Embaralhar de Verdade</h1>

<p align="center">
  Browser extension that plays YouTube Music playlists <b>in full</b>, truly shuffled,<br>
  without leaving songs out and without changing the original playlist.
</p>

---

## The problem

YouTube Music's shuffle doesn't play the whole playlist. When you press shuffle, it builds the queue with only part of the songs, and the rest never shows up. In large playlists, you end up hearing the same songs over and over.

## What the extension does

- **Shuffle:** reads the whole playlist, shuffles the order, starts playing right away and puts **all** the other songs in "Up next". After that, YouTube Music plays as usual: next, previous and the queue work normally.
- **Save shuffled copy:** does the same shuffle, but instead of playing it creates a new playlist with the name you choose, private, unlisted or public.
- **Shuffle the queue:** shuffles the "Up next" queue that is already playing. The current song keeps playing and all the others come after it, in a shuffled order.
- **Save queue as playlist:** creates a new playlist with the songs in the queue, in their current order.
- **The original playlist is never changed.**
- Works with any playlist: yours, other people's and Liked Music.
- Unavailable and duplicate songs are left out.
- Handles large playlists: the music starts right away and the queue is filled in batches while it plays.
- In Portuguese or English, following the browser's language.

## Installation

Works on Chrome 111 or newer and on browsers based on it, such as Edge, Brave and Opera.

The installation files are on the [Releases](https://github.com/congio/embaralhar/releases/latest) page. You don't need to download the whole repository.

### Chrome, Edge, Brave, Opera

1. Download the `embaralhar-X.Y.Z-chrome.zip` file from the [latest release](https://github.com/congio/embaralhar/releases/latest) and extract it. An `embaralhar` folder will appear.
2. In your browser, open `your_browser://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the extracted **`embaralhar`** folder.
5. Open a playlist on [music.youtube.com](https://music.youtube.com).

Don't delete or move that folder after installing: the browser loads the extension from it. To update, download the new version, replace the folder and click reload on the extension.

If the YouTube Music page was already open, reload it after installing.

## How to use

1. Open a playlist on YouTube Music.
2. Click the **red circle** in the bottom right corner of the page and choose **Shuffle**.
3. The music starts and "Up next" receives the whole playlist, shuffled. Progress shows next to the circle.

To keep a shuffled order, use **Save shuffled copy**: choose the name and who can see it, and the new playlist is created in your account.

While music is playing, the circle also shows up outside playlist pages. In its menu, **Shuffle the queue** shuffles the order of "Up next" and **Save queue as playlist** saves the queue as a new playlist.

> After shuffling, don't press YouTube Music's own shuffle. It cuts the queue again.

### Extension window

Clicking the extension icon in the browser toolbar:

- **Extension on:** turns the extension on and off. When off, it disappears from the page completely.
- **Theme of this window:** Automatic (follows the browser), Light or Dark.

## Language

The extension shows its texts in Portuguese when the browser is in Portuguese, and in English in any other language. The texts are in the `extension/_locales` folder, one file per language.

## How it works

The extension runs only on `music.youtube.com` and uses your session that is already signed in to the site, the same way the page itself does:

1. Reads every song in the open playlist, skipping unavailable and duplicate ones.
2. Shuffles the order with `crypto.getRandomValues` (Fisher-Yates shuffle), so every possible order has the same chance.
3. **Shuffle:** plays the first shuffled song and inserts the others in "Up next" right after it.
   **Save shuffled copy:** creates a new playlist and adds the songs in the shuffled order.
4. **Shuffle the queue:** reads "Up next", keeps the current song at the top and puts the others in a shuffled order.
   **Save queue as playlist:** creates a new playlist with the songs in the queue, in their current order.

| File | Purpose |
| --- | --- |
| `extension/content.js` | Runs inside the page: reads the playlist, shuffles, builds the queue, creates the copy and draws the circle. |
| `extension/bridge.js` | Passes the on/off switch and the texts in the browser's language from the extension to the page. |
| `extension/popup.html`, `popup.css`, `popup.js` | Extension window. |
| `extension/_locales` | Texts in each language. |
| `extension/manifest.json` | Extension configuration. |

## Privacy

- The only permission requested is `storage`, used to save the extension window settings (extension on and theme).
- The extension doesn't collect, store or send data anywhere outside `music.youtube.com`.
- There is no server, account or tracking.

## Limitations

- The extension uses YouTube Music's internal communication, which is not official. If Google changes the site, it may stop working until it's updated. If that happens, [open an issue](https://github.com/congio/embaralhar/issues).
- Copies can only be saved to the account signed in on the browser.

## Publishing a new version

1. Bump the `version` number in `extension/manifest.json` and record the change in `CHANGELOG.md` and `CHANGELOG.en.md`.
2. Zip the `extension` folder renamed to `embaralhar` (with the folder inside the zip) as `embaralhar-X.Y.Z-chrome.zip`.
3. Create a GitHub release with the tag `vX.Y.Z` and attach `embaralhar-X.Y.Z-chrome.zip`.

## Troubleshooting

If something goes wrong, a notice shows up next to the circle. For more details, press **F12**, open the **Console** tab and look for messages starting with `[Embaralhar de Verdade]`. Include those messages when you [open an issue](https://github.com/congio/embaralhar/issues).

## License

[MIT](LICENSE) © 2026 Congio

This project is not affiliated with Google or YouTube. YouTube Music is a trademark of Google LLC.
