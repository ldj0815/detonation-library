#!/bin/zsh -l
# Double-click to reopen the local banner editor.
cd "${0:A:h}/site" || exit 1
editor_url='http://localhost:5174/#/banner-editor'
if /usr/bin/curl --silent --fail --max-time 2 'http://localhost:5174/__banner-editor/status' >/dev/null; then
  /usr/bin/open "$editor_url"
  exit 0
fi
if ! command -v npm >/dev/null; then
  print 'Node.js is needed to run the editor. Open this project in Codex for help starting it.'
  read '?Press Return to close.'
  exit 1
fi
print 'Starting Banner studio. Keep this window open while editing.'
npm run banner:edit
read '?Press Return to close.'
