(() => {
  'use strict';
  const button = document.getElementById('vetogramMusicLauncher');
  if (!button) return;
  button.addEventListener('click', () => {
    window.location.assign('/music.html');
  });
})();