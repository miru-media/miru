<!-- markdownlint-disable first-line-heading -->
<div class="bulma-modal-card-body">
  <slot name="header" title="Videoeditor"></slot>
  
  <div class="bulma-content">
    <p>
    Hallo, dies ist ein Freie-Software- und Open-Source-Online-Videoeditor. Schau es dir an, und gib uns Feedback auf <a target="_blank"
        href="https://discord.gg/mmwMvf4Pnv">Discord</a>, <a target="_blank"
        href="https://codeberg.org/miru-media/miru">Codeberg</a> oder <a target="_blank"
        href="https://github.com/miru-media/miru">Github</a>.
    </p>
    <p>
      <strong>Vorsicht: Er handelt sich noch um Alpha-Software, daher kann es passieren, dass mit einem Update deine Edits gelöscht werden!</strong>
    </p>
    <p><b>Der Editor ermöglicht dir:</b></p>
    <ul class="task-list">
      <li><div class="task-done"></div> Mehrere Videoclips hinzufügen</li>
      <li><div class="task-done"></div> Audio-Dateien hinzufügen</li>
      <li><div class="task-done"></div> Clips schneiden und trimmen</li>
      <li><div class="task-done"></div> Filtereffekte anwenden</li>
      <li><div class="task-done"></div> Exportieren als MP4 oder Webm</li>
    </ul class="task-list">
    <p><b>Wir arbeiten noch an:</b></p>
    <ul class="task-list">
      <li><div class="task-todo"></div> Overlays von Bildern und Text</li>
      <li><div class="task-todo"></div> Größenänderung und Positionierung</li>
      <li><div class="task-todo"></div> Asset-Bibliothek</li>
      <li><div class="task-todo"></div> Kollaboratives Editieren</li>
      <li><div class="task-todo"></div> Übergänge und Crossfade-Effekte</li>
      <li><div class="task-todo"></div> Untertitlen</li>
      <li><div class="task-todo"></div> Keyframe-Animationen</li>
    </ul>
  </div>
</div>

<slot name="confirm" text="Okay, los gehts!"></slot>
