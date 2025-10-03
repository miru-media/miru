<!-- markdownlint-disable first-line-heading -->
<div class="bulma-modal-card-body">
  <slot name="header" title="Video editor"></slot>
  
  <div class="bulma-content">
    <p>
      Hi and welcome to our free and open source online video editor.
      Try it out and send us feedback on <a target="_blank"
        href="https://discord.gg/mmwMvf4Pnv">Discord</a>, <a target="_blank"
        href="https://codeberg.org/miru-media/miru">Codeberg</a>, or <a target="_blank"
        href="https://github.com/miru-media/miru">Github</a>.
    </p>
    <p>
      <strong>It's still alpha software and you might lose some of your work after an update!</strong>
    </p>
    <p><b>That said, the editor lets you:</b></p>
    <ul class="task-list">
      <li><div class="task-done"></div> Add multiple video clips,</li>
      <li><div class="task-done"></div> Add audio files,</li>
      <li><div class="task-done"></div> Split and trim,</li>
      <li><div class="task-done"></div> Add filter effects,</li>
      <li><div class="task-done"></div> Export to MP4 or Webm.</li>
    </ul>
    <p><b>We're still working on:</b></p>
    <ul class="task-list">
      <li><div class="task-todo"></div> Image and text overlays,</li>
      <li><div class="task-todo"></div> Resizing and positioning on the canvas,</li>
      <li><div class="task-todo"></div> Asset library,</li>
      <li><div class="task-todo"></div> Collaborative editing,</li>
      <li><div class="task-todo"></div> Transitions and crossfade effects,</li>
      <li><div class="task-todo"></div> Subtitles,</li>
      <li><div class="task-todo"></div> Keyframe animations.</li>
    </ul>
  </div>
</div>

<slot name="confirm" text="Okay, let's go!"></slot>
