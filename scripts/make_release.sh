#!/bin/bash

sed -e '/appUUID/s/"[^"]*",/"5971756c-5a3c-4fb3-bbb9-b8079fde9e81",/' \
    -i package.json
npx fitbit-build
git checkout package.json
