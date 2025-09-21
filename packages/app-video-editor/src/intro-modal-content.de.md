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
    <p>Der Editor ermöglicht dir:</p>
    <ul>
      <li>✅ Mehrere Videoclips hinzufügen</li>
      <li>✅ Audio-Dateien hinzufügen</li>
      <li>✅ Clips schneiden und trimmen</li>
      <li>✅ Filtereffekte anwenden</li>
      <li>✅ Exportieren als MP4 oder Webm</li>
    </ul>
    <p>Wir arbeiten noch an:</p>
    <ul>
      <li>Overlays von Bildern und Text</li>
      <li>Größenänderung und Positionierung</li>
      <li>Asset-Bibliothek</li>
      <li>Kollaboratives Editieren</li>
      <li>Übergänge und Crossfade-Effekte</li>
      <li>Untertitlen</li>
      <li>Keyframe-Animationen</li>
    </ul>
  </div>
</div>

<slot name="confirm" text="Okay, los gehts!"></slot>
