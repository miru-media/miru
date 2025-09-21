<!-- markdownlint-disable first-line-heading -->
<div class="bulma-modal-card-body">
  <slot name="header" title="video editor"></slot>
  
  <div class="bulma-content">
    <p>
      Hi and welcome to our free and open source online video editor.
      Try it out and send us feedback on <a target="_blank"
        href="https://discord.gg/mmwMvf4Pnv">Discord</a>, <a target="_blank"
        href="https://codeberg.org/miru-media/miru">Codeberg</a>, or <a target="_blank"
        href="https://github.com/miru-media/miru">Github</a>.
    </p>
    <p>
      <strong>It's still alpha software and you might lose some of your work after an update!</strong> That said, the editor lets you:
    </p>
    <ul>
      <li>✅ Add multiple video clips</li>
      <li>✅ Add audio files</li>
      <li>✅ Split and trim</li>
      <li>✅ Add filter effects</li>
      <li>✅ Export to MP4 or Webm</li>
    </ul>
    <p>We're still working on:</p>
    <ul>
      <li>Image and text overlays</li>
      <li>Resizing and positioning on the canvas</li>
      <li>Asset library</li>
      <li>Collaborative editing</li>
      <li>Transitions crossfade effects</li>
      <li>Subtitles</li>
      <li>Keyframe animations</li>
    </ul>
  </div>
</div>

<slot name="confirm" text="Okay, let's go!"></slot>
