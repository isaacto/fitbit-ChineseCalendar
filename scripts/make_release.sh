#!/bin/bash

sed -e '/appUUID/s/"[^"]*",/"8f7f02cb-ac2d-46f3-9ddc-1a32f60b9ce6",/' \
    -i package.json
npx fitbit-build
git checkout package.json
